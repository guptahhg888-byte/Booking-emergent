/**
 * Auth routes: captcha, register, login, /me, profile update.
 * Equivalent of Python's routes/auth.py
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { db } from '../core/database';
import { JWT_SECRET } from '../core/config';
import { requireAuth } from '../core/middleware';
import { validate, RegisterSchema, LoginSchema, ProfileUpdateSchema } from '../core/schemas';
import { hashPassword, verifyPassword, createToken } from '../core/security';
import { logActivity } from '../services/activity';

const router = Router();

// ─── Captcha helpers ──────────────────────────────────────────────────────────

const verifyCaptcha = (token: string, answer: string): void => {
  if (!token || !answer) {
    const err = new Error('CAPTCHA is required');
    (err as NodeJS.ErrnoException).code = '400';
    throw err;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { answer: number };
    if (String(payload.answer) !== String(answer).trim()) {
      const err = new Error('Incorrect CAPTCHA answer');
      (err as NodeJS.ErrnoException).code = '400';
      throw err;
    }
  } catch (e: unknown) {
    if (e instanceof jwt.TokenExpiredError) {
      const err = new Error('CAPTCHA expired. Please try again.');
      (err as NodeJS.ErrnoException).code = '400';
      throw err;
    }
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === '400') throw e;
    const err = new Error('Invalid CAPTCHA token');
    (err as NodeJS.ErrnoException).code = '400';
    throw err;
  }
};

// ─── GET /auth/captcha ────────────────────────────────────────────────────────

router.get('/captcha', (_req: Request, res: Response) => {
  const a = Math.floor(Math.random() * 10) + 1;
  let b = Math.floor(Math.random() * 10) + 1;
  const op = Math.random() < 0.5 ? '+' : '-';
  let [x, y] = [a, b];
  if (op === '-' && x < y) [x, y] = [y, x];
  const ans = op === '+' ? x + y : x - y;

  const token = jwt.sign({ answer: ans }, JWT_SECRET, { expiresIn: '5m' });
  res.json({ question: `${x} ${op} ${y} = ?`, token });
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  const body = req.body;
  try { verifyCaptcha(body.captcha_token, body.captcha_answer); }
  catch (e: unknown) { res.status(400).json({ detail: (e as Error).message }); return; }

  const email = body.email.toLowerCase().trim();
  const exists = await db.users().findOne({ email });
  if (exists) { res.status(400).json({ detail: 'Email already registered' }); return; }

  const doc = {
    email,
    password_hash: hashPassword(body.password),
    name: body.name,
    role: 'user',
    phone: body.phone ?? null,
    created_at: new Date(),
  };
  const result = await db.users().insertOne(doc);
  const userId = String(result.insertedId);

  await logActivity(userId, body.name, 'USER_REGISTERED', `New user: ${email}`);
  res.status(201).json({
    token: createToken(userId, email, 'user'),
    user: { id: userId, email, name: body.name, role: 'user', phone: body.phone ?? null },
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  const body = req.body;
  try { verifyCaptcha(body.captcha_token, body.captcha_answer); }
  catch (e: unknown) { res.status(400).json({ detail: (e as Error).message }); return; }

  const email = body.email.toLowerCase().trim();
  const user = await db.users().findOne({ email });
  if (!user || !verifyPassword(body.password, (user.password_hash as string) ?? '')) {
    res.status(401).json({ detail: 'Invalid email or password' });
    return;
  }
  const userId = String(user._id);
  const role = (user.role as string) ?? 'user';
  await logActivity(userId, (user.name as string) ?? email, 'USER_LOGIN');
  res.json({
    token: createToken(userId, email, role),
    user: {
      id: userId,
      email,
      name: user.name ?? '',
      role,
      phone: user.phone ?? null,
    },
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json(req.user);
});

// ─── PATCH /auth/profile ──────────────────────────────────────────────────────

router.patch('/profile', requireAuth, validate(ProfileUpdateSchema), async (req: Request, res: Response) => {
  const user = req.user!;
  const body = req.body as Record<string, unknown>;

  // Remove undefined/null values
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) { res.json(user); return; }

  await db.users().updateOne({ _id: new ObjectId(user['_id'] as string) }, { $set: updates });
  await logActivity(
    user['_id'] as string,
    (user['name'] as string) ?? '',
    'PROFILE_UPDATED',
    Object.keys(updates).join(', ')
  );

  const updated = await db.users().findOne({ _id: new ObjectId(user['_id'] as string) });
  if (!updated) { res.status(404).json({ detail: 'User not found' }); return; }
  const safe: Record<string, unknown> = { ...updated };
  safe['_id'] = String(safe['_id']);
  delete safe['password_hash'];
  res.json(safe);
});

export default router;
