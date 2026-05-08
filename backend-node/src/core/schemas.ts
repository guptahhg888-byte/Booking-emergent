/**
 * Zod validation schemas for all request bodies.
 * Equivalent of Python's core/models.py (Pydantic models).
 */
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  captcha_token: z.string(),
  captcha_answer: z.string(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captcha_token: z.string(),
  captcha_answer: z.string(),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
});

export const DoctorCreateSchema = z.object({
  name: z.string().min(1),
  specialization: z.string().min(1),
  qualification: z.string().min(1),
  experience_years: z.number().int(),
  consultation_fee: z.number().default(2000),
  fee_45min: z.number().optional(),
  fee_60min: z.number().optional(),
  bio: z.string().optional(),
  image_url: z.string().optional(),
  available_days: z
    .array(z.string())
    .default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  start_time: z.string().default('09:00'),
  end_time: z.string().default('17:00'),
  slot_duration_minutes: z.number().int().default(30),
  lunch_start: z.string().optional().default('13:00'),
  lunch_end: z.string().optional().default('14:00'),
});

export const AppointmentCreateSchema = z.object({
  doctor_id: z.string(),
  appointment_date: z.string(),
  appointment_time: z.string(),
  duration_minutes: z.number().int().nullish(),
  country_code: z.string().max(3).default('IN'),
  notes: z.string().nullish(),
});

export const RescheduleSchema = z.object({
  appointment_date: z.string(),
  appointment_time: z.string(),
});

export const PaymentInitiateSchema = z.object({
  appointment_id: z.string(),
});

export const DoctorSlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  slots: z.array(
    z.string().regex(/^\d{2}:\d{2}$/, 'Each slot must be in HH:MM format')
  ).min(1, 'At least one slot is required'),
});

// Middleware factory: validates req.body against a Zod schema
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      console.warn(`[Validation Error] POST ${req.originalUrl}:`, JSON.stringify(result.error.errors, null, 2));
      res.status(422).json({ detail: result.error.errors });
      return;
    }
    req.body = result.data;
    next();
  };
