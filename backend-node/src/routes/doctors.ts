/**
 * Doctor CRUD + availability slots.
 * Equivalent of Python's routes/doctors.py
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../core/database';
import { requireAdmin } from '../core/middleware';
import { validate, DoctorCreateSchema } from '../core/schemas';
import { logActivity } from '../services/activity';

const router = Router();

// ─── Slot generation helpers ──────────────────────────────────────────────────

const hmToMinutes = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

const minutesToHm = (total: number): string => {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const generateSlots = (doc: Record<string, unknown>): string[] => {
  const start = hmToMinutes((doc.start_time as string) || '09:00');
  const end = hmToMinutes((doc.end_time as string) || '17:00');
  const dur = Number(doc.slot_duration_minutes || 30);
  if (dur <= 0 || end <= start) return [];

  const lunchS = doc.lunch_start as string | undefined;
  const lunchE = doc.lunch_end as string | undefined;
  let lunchRange: [number, number] | null = null;
  if (lunchS && lunchE) {
    const ls = hmToMinutes(lunchS);
    const le = hmToMinutes(lunchE);
    if (le > ls) lunchRange = [ls, le];
  }

  const slots: string[] = [];
  let cur = start;
  while (cur + dur <= end) {
    if (lunchRange && lunchRange[0] <= cur && cur < lunchRange[1]) {
      cur += dur;
      continue;
    }
    slots.push(minutesToHm(cur));
    cur += dur;
  }
  return slots;
};

// ─── GET /doctors ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { is_active: true };
  if (search) {
    query['$or'] = [
      { name: { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } },
    ];
  }
  const docs = await db.doctors().find(query).limit(100).toArray();
  const result = docs.map((d) => ({ ...d, _id: String(d._id) }));
  res.json(result);
});

// ─── GET /doctors/:id/available-slots ─────────────────────────────────────────

router.get('/:doctorId/available-slots', async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { date } = req.query as { date: string };
  let doc: Record<string, unknown> | null = null;
  try {
    doc = await db.doctors().findOne({ _id: new ObjectId(doctorId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' });
    return;
  }
  if (!doc) { res.status(404).json({ detail: 'Doctor not found' }); return; }

  const allSlots = generateSlots(doc);
  const booked = await db
    .appointments()
    .find(
      { doctor_id: doctorId, appointment_date: date, status: { $nin: ['cancelled'] } },
      { projection: { appointment_time: 1 } }
    )
    .toArray();
  const bookedTimes = new Set(booked.map((a) => a.appointment_time as string));
  res.json({ available_slots: allSlots.filter((s) => !bookedTimes.has(s)) });
});

// ─── GET /doctors/:id ─────────────────────────────────────────────────────────

router.get('/:doctorId', async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  let doc: Record<string, unknown> | null = null;
  try {
    doc = await db.doctors().findOne({ _id: new ObjectId(doctorId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' });
    return;
  }
  if (!doc) { res.status(404).json({ detail: 'Doctor not found' }); return; }
  res.json({ ...doc, _id: String(doc._id) });
});

// ─── POST /doctors ────────────────────────────────────────────────────────────

router.post('/', requireAdmin, validate(DoctorCreateSchema), async (req: Request, res: Response) => {
  const admin = req.user!;
  const body = req.body;
  const doc = {
    ...body,
    is_active: true,
    rating: 4.5,
    total_reviews: 0,
    created_at: new Date(),
  };
  const result = await db.doctors().insertOne(doc);
  await logActivity(admin['_id'] as string, admin['name'] as string, 'DOCTOR_ADDED', `Added: ${body.name}`);
  res.status(201).json({ ...doc, _id: String(result.insertedId) });
});

// ─── PUT /doctors/:id ─────────────────────────────────────────────────────────

router.put('/:doctorId', requireAdmin, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const body = { ...req.body };
  delete body._id;
  delete body.id;
  try {
    await db.doctors().updateOne({ _id: new ObjectId(doctorId) }, { $set: body });
    const updated = await db.doctors().findOne({ _id: new ObjectId(doctorId) });
    if (!updated) { res.status(404).json({ detail: 'Doctor not found' }); return; }
    res.json({ ...updated, _id: String(updated._id) });
  } catch {
    res.status(404).json({ detail: 'Doctor not found' });
  }
});

// ─── DELETE /doctors/:id ──────────────────────────────────────────────────────

router.delete('/:doctorId', requireAdmin, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const admin = req.user!;
  try {
    const result = await db.doctors().deleteOne({ _id: new ObjectId(doctorId) });
    if (result.deletedCount === 0) { res.status(404).json({ detail: 'Doctor not found' }); return; }
  } catch {
    res.status(404).json({ detail: 'Doctor not found' });
    return;
  }
  await logActivity(admin['_id'] as string, admin['name'] as string, 'DOCTOR_DELETED', `ID: ${doctorId}`);
  res.json({ message: 'Doctor deleted' });
});

export default router;
