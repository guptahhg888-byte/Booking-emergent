/**
 * Doctor CRUD + availability slots.
 * Equivalent of Python's routes/doctors.py
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../core/database';
import { requireAdmin } from '../core/middleware';
import { validate, DoctorCreateSchema, DoctorSlotsSchema, DoctorBlockedDateSchema } from '../core/schemas';
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

const normalizeServices = (services: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(services)) return [];
  return services
    .map((service, index) => {
      const item = service as Record<string, unknown>;
      const name = String(item.name ?? '').trim();
      const price = Number(item.price);
      if (!name || Number.isNaN(price) || price < 0) return null;
      const duration = item.duration_minutes == null || item.duration_minutes === ''
        ? null
        : Number(item.duration_minutes);
      return {
        id: String(item.id || `svc_${Date.now()}_${index}`),
        name,
        price,
        duration_minutes: duration && duration > 0 ? duration : null,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
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

  // Check for admin-defined custom slots first; fall back to auto-generation
  const customSlotDoc = await db.doctor_slots().findOne({ doctor_id: doctorId, date }) as Record<string, unknown> | null;
if (customSlotDoc?.['is_blocked']) {
    res.json({
      available_slots: [],
      is_custom: true,
      is_blocked: true,
      block_reason: customSlotDoc['reason'] ?? 'Blocked by admin',
    });
    return;
  }  
const allSlots = customSlotDoc
    ? (customSlotDoc['slots'] as string[]).slice().sort()
    : generateSlots(doc);

  const booked = await db
    .appointments()
    .find(
      { doctor_id: doctorId, appointment_date: date, status: { $nin: ['cancelled'] } },
      { projection: { appointment_time: 1 } }
    )
    .toArray();
  const bookedTimes = new Set(booked.map((a) => a.appointment_time as string));
  res.json({
    available_slots: allSlots.filter((s) => !bookedTimes.has(s)),
    is_custom: !!customSlotDoc,
    is_blocked: false,
  });
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
    services: normalizeServices(body.services),
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
  if ('services' in body) body.services = normalizeServices(body.services);
  try {
    await db.doctors().updateOne({ _id: new ObjectId(doctorId) }, { $set: body });
    const updated = await db.doctors().findOne({ _id: new ObjectId(doctorId) });
    if (!updated) { res.status(404).json({ detail: 'Doctor not found' }); return; }
    res.json({ ...updated, _id: String(updated._id) });
  } catch {
    res.status(404).json({ detail: 'Doctor not found' });
  }
});

// ─── POST /doctors/:id/slots — set custom slots for a date ────────────────

router.post('/:doctorId/slots', requireAdmin, validate(DoctorSlotsSchema), async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const admin = req.user!;
  const { date, slots } = req.body as { date: string; slots: string[] };

  let doc: Record<string, unknown> | null = null;
  try {
    doc = await db.doctors().findOne({ _id: new ObjectId(doctorId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' }); return;
  }
  if (!doc) { res.status(404).json({ detail: 'Doctor not found' }); return; }

  const sortedSlots = [...new Set(slots)].sort();

  await db.doctor_slots().updateOne(
    { doctor_id: doctorId, date },
    {
      $set: { slots: sortedSlots, is_blocked: false, reason: null, updated_at: new Date() },
      $setOnInsert: { doctor_id: doctorId, date, created_by: admin['_id'] as string, created_at: new Date() },
    },
    { upsert: true }
  );

  await logActivity(admin['_id'] as string, admin['name'] as string, 'SLOTS_UPDATED', `Custom slots set for ${doc['name']} on ${date} (${sortedSlots.length} slots)`);
  res.json({ message: 'Custom slots saved', doctor_id: doctorId, date, slots: sortedSlots });
});

// ─── GET /doctors/:id/slots — get custom slots for a date ─────────────────

router.get('/:doctorId/slots', requireAdmin, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { date } = req.query as { date: string };

  if (!date) { res.status(400).json({ detail: 'date query parameter is required' }); return; }

  const slotDoc = await db.doctor_slots().findOne({ doctor_id: doctorId, date }) as Record<string, unknown> | null;
  if (!slotDoc) {
    res.json({ custom_slots: null, is_custom: false, is_blocked: false });
    return;
  }
  res.json({
    custom_slots: slotDoc['slots'],
    is_custom: true,
    is_blocked: !!slotDoc['is_blocked'],
    block_reason: slotDoc['reason'] ?? null,
    created_at: slotDoc['created_at'],
    updated_at: slotDoc['updated_at'],
  });
});

// ─── DELETE /doctors/:id/slots — remove custom slots (revert to auto) ─────

router.post('/:doctorId/block-date', requireAdmin, validate(DoctorBlockedDateSchema), async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const admin = req.user!;
  const { date, reason } = req.body as { date: string; reason: string };

  let doc: Record<string, unknown> | null = null;
  try {
    doc = await db.doctors().findOne({ _id: new ObjectId(doctorId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' }); return;
  }
  if (!doc) { res.status(404).json({ detail: 'Doctor not found' }); return; }

  await db.doctor_slots().updateOne(
    { doctor_id: doctorId, date },
    {
      $set: { slots: [], is_blocked: true, reason, updated_at: new Date() },
      $setOnInsert: { doctor_id: doctorId, date, created_by: admin['_id'] as string, created_at: new Date() },
    },
    { upsert: true }
  );

  await logActivity(admin['_id'] as string, admin['name'] as string, 'BOOKING_DATE_BLOCKED', `Blocked bookings for ${doc['name']} on ${date}`);
  res.json({ message: 'Booking disabled for this date', doctor_id: doctorId, date, is_blocked: true, reason });
});

router.delete('/:doctorId/slots', requireAdmin, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { date } = req.query as { date: string };
  const admin = req.user!;

  if (!date) { res.status(400).json({ detail: 'date query parameter is required' }); return; }

  const result = await db.doctor_slots().deleteOne({ doctor_id: doctorId, date });
  if (result.deletedCount === 0) {
    res.json({ message: 'No custom slots found for this date' });
    return;
  }

  await logActivity(admin['_id'] as string, admin['name'] as string, 'SLOTS_RESET', `Custom slots removed for doctor ${doctorId} on ${date}`);
  res.json({ message: 'Custom slots removed, reverted to auto-generated schedule' });
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
