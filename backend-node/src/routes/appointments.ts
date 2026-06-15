/**
 * Appointment CRUD + reschedule.
 * Equivalent of Python's routes/appointments.py
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../core/database';
import { requireAuth, requireAdmin } from '../core/middleware';
import { validate, AppointmentCreateSchema, RescheduleSchema } from '../core/schemas';
import { logActivity } from '../services/activity';

// Country-based fee multipliers (must stay in sync with frontend COUNTRY_CONFIG)
const COUNTRY_FEE_MULTIPLIER: Record<string, number> = {
  IN: 1.0,
  US: 2.5,
  GB: 2.5,
  DE: 2.25,
  FR: 2.25,
  AE: 2.0,
  AU: 2.25,
  CA: 2.25,
  SG: 2.25,
  NZ: 2.0,
  JP: 2.0,
  KR: 1.75,
  MY: 1.25,
  PK: 1.25,
  BD: 1.25,
  LK: 1.25,
  SA: 2.0,
  QA: 2.0,
};
const DEFAULT_INTL_MULTIPLIER = 2.5;

const router = Router();

// ─── POST /appointments ───────────────────────────────────────────────────────

router.post('/', requireAuth, validate(AppointmentCreateSchema), async (req: Request, res: Response) => {
  const user = req.user!;
  const body = req.body;

  let doctor: Record<string, unknown> | null = null;
  try {
    doctor = await db.doctors().findOne({ _id: new ObjectId(body.doctor_id) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Doctor not found' }); return;
  }
  if (!doctor) { res.status(404).json({ detail: 'Doctor not found' }); return; }

const blockedDate = await db.doctor_slots().findOne({
    doctor_id: body.doctor_id,
    date: body.appointment_date,
    is_blocked: true,
  });
  if (blockedDate) {
    res.status(400).json({ detail: 'Bookings are disabled for this date' });
    return;
  }

  const existing = await db.appointments().findOne({
    doctor_id: body.doctor_id,
    appointment_date: body.appointment_date,
    appointment_time: body.appointment_time,
    status: { $nin: ['cancelled'] },
  });
  if (existing) { res.status(400).json({ detail: 'This time slot is already booked' }); return; }

  // Resolve fee based on chosen duration
  const baseFee = (doctor.consultation_fee as number) ?? 2000;
  let resolvedFee = baseFee;
  let serviceId: string | null = body.service_id ?? null;
  let serviceName: string | null = null;
  let durationMinutes: number | null = body.duration_minutes ?? null;
  const services = Array.isArray(doctor.services) ? doctor.services as Record<string, unknown>[] : [];
  if (services.length > 0) {
    const selectedService = serviceId
      ? services.find((service) => service.id === serviceId)
      : services[0];
    if (!selectedService) {
      res.status(400).json({ detail: 'Selected service is not available for this doctor' });
      return;
    }
    serviceId = String(selectedService.id);
    serviceName = String(selectedService.name);
    resolvedFee = Number(selectedService.price);
    durationMinutes = selectedService.duration_minutes == null ? null : Number(selectedService.duration_minutes);
  } else if (body.duration_minutes === 45 && doctor.fee_45min != null) {
    resolvedFee = doctor.fee_45min as number;
  } else if (body.duration_minutes === 60 && doctor.fee_60min != null) {
    resolvedFee = doctor.fee_60min as number;
  }

  // Apply country-based fee multiplier
  const countryCode: string = body.country_code || 'IN';
  const multiplier = COUNTRY_FEE_MULTIPLIER[countryCode] ?? DEFAULT_INTL_MULTIPLIER;
  const countryAdjustedFee = Math.round(resolvedFee * multiplier);

  const userId = user['_id'] as string;
  const appt = {
    user_id: userId,
    doctor_id: body.doctor_id,
    doctor_name: doctor.name as string,
    patient_name: user['name'] as string,
    patient_email: user['email'] as string,
    patient_phone: (user['phone'] as string) ?? null,
    appointment_date: body.appointment_date,
    appointment_time: body.appointment_time,
    service_id: serviceId,
    service_name: serviceName,
    duration_minutes: durationMinutes,
show_meet_link: false,
    country_code: countryCode,
    status: 'pending_payment',
    payment_status: 'pending',
    transaction_id: null,
    consultation_fee: countryAdjustedFee,
    base_fee_inr: resolvedFee,
    fee_multiplier: multiplier,
    notes: body.notes ?? null,
    created_at: new Date(),
  };
  const result = await db.appointments().insertOne(appt);
  await logActivity(
    userId,
    user['name'] as string,
    'APPOINTMENT_CREATED',
    `With ${doctor.name} on ${body.appointment_date} at ${body.appointment_time}`
  );
  res.status(201).json({ ...appt, _id: String(result.insertedId) });
});

// ─── GET /appointments ────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const isAdmin = user['role'] === 'admin';
  const query = isAdmin ? {} : { user_id: user['_id'] as string };
  const limit = isAdmin ? 500 : 200;
  const appts = await db
    .appointments()
    .find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();
  res.json(appts.map((a) => ({ ...a, _id: String(a._id) })));
});

// ─── GET /appointments/:id ────────────────────────────────────────────────────

router.get('/:apptId', requireAuth, async (req: Request, res: Response) => {
  const { apptId } = req.params;
  const user = req.user!;
  let appt: Record<string, unknown> | null = null;
  try {
    appt = await db.appointments().findOne({ _id: new ObjectId(apptId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Appointment not found' }); return;
  }
  if (!appt) { res.status(404).json({ detail: 'Appointment not found' }); return; }
  if (user['role'] !== 'admin' && appt['user_id'] !== user['_id']) {
    res.status(403).json({ detail: 'Access denied' }); return;
  }
  res.json({ ...appt, _id: String(appt._id) });
});

// ─── PUT /appointments/:id (admin) ────────────────────────────────────────────

router.put('/:apptId', requireAdmin, async (req: Request, res: Response) => {
  const { apptId } = req.params;
  const body = { ...req.body };
  delete body._id;
  delete body.id;
  try {
    await db.appointments().updateOne({ _id: new ObjectId(apptId) }, { $set: body });
    const updated = await db.appointments().findOne({ _id: new ObjectId(apptId) });
    if (!updated) { res.status(404).json({ detail: 'Appointment not found' }); return; }
    res.json({ ...updated, _id: String(updated._id) });
  } catch {
    res.status(404).json({ detail: 'Appointment not found' });
  }
});

// ─── DELETE /appointments/:id (cancel) ───────────────────────────────────────

router.delete('/:apptId', requireAuth, async (req: Request, res: Response) => {
  const { apptId } = req.params;
  const user = req.user!;
  let appt: Record<string, unknown> | null = null;
  try {
    appt = await db.appointments().findOne({ _id: new ObjectId(apptId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Appointment not found' }); return;
  }
  if (!appt) { res.status(404).json({ detail: 'Appointment not found' }); return; }
  if (user['role'] !== 'admin' && appt['user_id'] !== user['_id']) {
    res.status(403).json({ detail: 'Access denied' }); return;
  }
  await db.appointments().updateOne({ _id: new ObjectId(apptId) }, { $set: { status: 'cancelled' } });
  res.json({ message: 'Appointment cancelled' });
});

// ─── PUT /appointments/:id/reschedule ─────────────────────────────────────────

router.put('/:apptId/reschedule', requireAuth, validate(RescheduleSchema), async (req: Request, res: Response) => {
  const { apptId } = req.params;
  const user = req.user!;
  const body = req.body;

  let appt: Record<string, unknown> | null = null;
  try {
    appt = await db.appointments().findOne({ _id: new ObjectId(apptId) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Appointment not found' }); return;
  }
  if (!appt) { res.status(404).json({ detail: 'Appointment not found' }); return; }

  const isAdmin = user['role'] === 'admin';
  if (!isAdmin && appt['user_id'] !== user['_id']) {
    res.status(403).json({ detail: 'Access denied' }); return;
  }
  if (!['confirmed', 'pending_payment'].includes(appt['status'] as string)) {
    res.status(400).json({ detail: 'Only upcoming appointments can be rescheduled' }); return;
  }

  // Reject past slots
  const target = new Date(`${body.appointment_date}T${body.appointment_time}`);
  if (isNaN(target.getTime())) {
    res.status(400).json({ detail: 'Invalid date or time format' }); return;
  }
  if (target < new Date()) {
    res.status(400).json({ detail: 'Cannot reschedule to a past slot' }); return;
  }

  // Check for clashes
  const clash = await db.appointments().findOne({
    _id: { $ne: new ObjectId(apptId) },
    doctor_id: appt['doctor_id'],
    appointment_date: body.appointment_date,
    appointment_time: body.appointment_time,
    status: { $nin: ['cancelled'] },
  });
  if (clash) { res.status(400).json({ detail: 'This time slot is already booked' }); return; }

  const oldSlot = `${appt['appointment_date']} ${appt['appointment_time']}`;
  await db.appointments().updateOne(
    { _id: new ObjectId(apptId) },
    {
      $set: {
        appointment_date: body.appointment_date,
        appointment_time: body.appointment_time,
        rescheduled_at: new Date(),
      },
    }
  );
  await logActivity(
    user['_id'] as string,
    (user['name'] as string) ?? '',
    'APPOINTMENT_RESCHEDULED',
    `${appt['doctor_name'] ?? ''}: ${oldSlot} → ${body.appointment_date} ${body.appointment_time}`
  );
  const updated = await db.appointments().findOne({ _id: new ObjectId(apptId) });
  res.json({ ...updated, _id: String(updated!._id) });
});

export default router;
