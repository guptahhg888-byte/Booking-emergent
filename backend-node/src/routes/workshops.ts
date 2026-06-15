import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../core/database';
import { requireAuth, requireAdmin } from '../core/middleware';
import { validate, WorkshopCreateSchema } from '../core/schemas';
import { logActivity } from '../services/activity';

const router = Router();

const serialize = (doc: Record<string, unknown>) => ({
  ...doc,
  _id: String(doc._id),
}) as Record<string, unknown>;

const publicWorkshop = (doc: Record<string, unknown>) => {
  const result = serialize(doc);
  delete result['gmeet_link'];
  return result;
};

router.get('/', async (_req: Request, res: Response) => {
  const docs = await db.workshops()
    .find({ is_active: true })
    .sort({ workshop_date: 1, start_time: 1 })
    .limit(100)
    .toArray();
  res.json(docs.map((doc) => publicWorkshop(doc as Record<string, unknown>)));
});

router.get('/admin/all', requireAdmin, async (_req: Request, res: Response) => {
  const docs = await db.workshops()
    .find()
    .sort({ workshop_date: -1, start_time: -1 })
    .limit(300)
    .toArray();
  res.json(docs.map((doc) => serialize(doc as Record<string, unknown>)));
});

router.get('/my', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const registrations = await db.workshop_registrations()
    .find({ user_id: user['_id'] as string })
    .sort({ created_at: -1 })
    .limit(200)
    .toArray();
  res.json(registrations.map((registration) => {
    const item = serialize(registration as Record<string, unknown>);
    if (!item['show_meet_link']) delete item['gmeet_link'];
    return item;
  }));
});

router.post('/', requireAdmin, validate(WorkshopCreateSchema), async (req: Request, res: Response) => {
  const admin = req.user!;
  const body = req.body;
  let doctor: Record<string, unknown> | null = null;
  try {
    doctor = await db.doctors().findOne({ _id: new ObjectId(body.doctor_id) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' }); return;
  }
  if (!doctor) { res.status(404).json({ detail: 'Doctor not found' }); return; }

  const doc = {
    ...body,
    doctor_name: doctor.name as string,
    created_by: admin['_id'] as string,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const result = await db.workshops().insertOne(doc);
  await logActivity(admin['_id'] as string, admin['name'] as string, 'WORKSHOP_CREATED', `Workshop: ${body.title}`);
  res.status(201).json({ ...doc, _id: String(result.insertedId) });
});

router.put('/:workshopId', requireAdmin, async (req: Request, res: Response) => {
  const { workshopId } = req.params;
  const body = { ...req.body };
  delete body._id;
  delete body.id;
  body.updated_at = new Date();

  if (body.doctor_id) {
    const doctor = await db.doctors().findOne({ _id: new ObjectId(body.doctor_id) }) as Record<string, unknown> | null;
    if (!doctor) { res.status(404).json({ detail: 'Doctor not found' }); return; }
    body.doctor_name = doctor.name;
  }

  try {
    await db.workshops().updateOne({ _id: new ObjectId(workshopId) }, { $set: body });
    const updated = await db.workshops().findOne({ _id: new ObjectId(workshopId) });
    if (!updated) { res.status(404).json({ detail: 'Workshop not found' }); return; }
    res.json(serialize(updated as Record<string, unknown>));
  } catch {
    res.status(404).json({ detail: 'Workshop not found' });
  }
});

router.delete('/:workshopId', requireAdmin, async (req: Request, res: Response) => {
  const { workshopId } = req.params;
  try {
    const result = await db.workshops().deleteOne({ _id: new ObjectId(workshopId) });
    if (result.deletedCount === 0) { res.status(404).json({ detail: 'Workshop not found' }); return; }
    res.json({ message: 'Workshop deleted' });
  } catch {
    res.status(404).json({ detail: 'Workshop not found' });
  }
});

router.post('/:workshopId/register', requireAuth, async (req: Request, res: Response) => {
  const { workshopId } = req.params;
  const user = req.user!;
  let workshop: Record<string, unknown> | null = null;
  try {
    workshop = await db.workshops().findOne({ _id: new ObjectId(workshopId), is_active: true }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Workshop not found' }); return;
  }
  if (!workshop) { res.status(404).json({ detail: 'Workshop not found' }); return; }

  const existing = await db.workshop_registrations().findOne({
    workshop_id: workshopId,
    user_id: user['_id'] as string,
    payment_status: { $in: ['pending', 'paid'] },
  }) as Record<string, unknown> | null;
  if (existing) {
    res.status(200).json(serialize(existing));
    return;
  }

  const registration = {
    workshop_id: workshopId,
    title: workshop.title,
    doctor_id: workshop.doctor_id,
    doctor_name: workshop.doctor_name,
    workshop_date: workshop.workshop_date,
    start_time: workshop.start_time,
    duration_minutes: workshop.duration_minutes,
    price: workshop.price,
    gmeet_link: workshop.gmeet_link,
    user_id: user['_id'] as string,
    patient_name: user['name'] as string,
    patient_email: user['email'] as string,
    patient_phone: (user['phone'] as string) ?? null,
    payment_status: 'pending',
    transaction_id: null,
    show_meet_link: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const result = await db.workshop_registrations().insertOne(registration);
  res.status(201).json({ ...registration, _id: String(result.insertedId) });
});

export default router;

