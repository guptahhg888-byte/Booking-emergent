/**
 * Admin analytics + management routes.
 * Equivalent of Python's routes/admin.py
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { requireAdmin } from '../core/middleware';
import { db } from '../core/database';

const router = Router();

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  const [totalDoctors, totalAppointments, totalUsers] = await Promise.all([
    db.doctors().countDocuments({}),
    db.appointments().countDocuments({}),
    db.users().countDocuments({ role: 'user' }),
  ]);

  const revResult = await db.transactions()
    .aggregate([
      { $match: { payment_state: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    .toArray();
  const totalRevenue = revResult.length > 0 ? (revResult[0]['total'] as number) / 100 : 0;

  const [confirmed, pending, cancelled, completed] = await Promise.all([
    db.appointments().countDocuments({ status: 'confirmed' }),
    db.appointments().countDocuments({ status: 'pending_payment' }),
    db.appointments().countDocuments({ status: 'cancelled' }),
    db.appointments().countDocuments({ status: 'completed' }),
  ]);

  // Last 6 months monthly data
  const now = new Date();
  const monthlyData: { month: string; revenue: number; appointments: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const start = new Date(year, month, 1, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const monthName = start.toLocaleString('en-US', { month: 'short' });

    const [rev, apptCount] = await Promise.all([
      db.transactions()
        .aggregate([
          { $match: { payment_state: 'COMPLETED', created_at: { $gte: start, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray(),
      db.appointments().countDocuments({ created_at: { $gte: start, $lte: end } }),
    ]);

    monthlyData.push({
      month: monthName,
      revenue: rev.length > 0 ? (rev[0]['total'] as number) / 100 : 0,
      appointments: apptCount,
    });
  }

  res.json({
    total_doctors: totalDoctors,
    total_appointments: totalAppointments,
    total_users: totalUsers,
    total_revenue: totalRevenue,
    appointment_stats: { confirmed, pending, cancelled, completed },
    monthly_data: monthlyData,
  });
});

// ─── GET /admin/activity ──────────────────────────────────────────────────────

router.get('/activity', requireAdmin, async (_req: Request, res: Response) => {
  const logs = await db.activity_logs()
    .find()
    .sort({ timestamp: -1 })
    .limit(50)
    .toArray();
  const result = logs.map((log) => ({
    ...log,
    _id: String(log._id),
    timestamp: log['timestamp'] instanceof Date ? log['timestamp'].toISOString() : log['timestamp'],
  }));
  res.json(result);
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (_req: Request, res: Response) => {
  const users = await db.users()
    .find({}, { projection: { password_hash: 0 } })
    .sort({ created_at: -1 })
    .limit(500)
    .toArray();
  const result = users.map((u) => ({
    ...u,
    _id: String(u._id),
    created_at: u['created_at'] instanceof Date ? u['created_at'].toISOString() : u['created_at'],
  }));
  res.json(result);
});

// ─── GET /admin/transactions ──────────────────────────────────────────────────

router.get('/transactions', requireAdmin, async (_req: Request, res: Response) => {
  const txns = await db.transactions()
    .find()
    .sort({ created_at: -1 })
    .limit(500)
    .toArray();
  const result = txns.map((t) => ({
    ...t,
    _id: String(t._id),
    created_at: t['created_at'] instanceof Date ? t['created_at'].toISOString() : t['created_at'],
    updated_at: t['updated_at'] instanceof Date ? t['updated_at'].toISOString() : t['updated_at'],
  }));
  res.json(result);
});

// ─── PUT /admin/users/:id/country ────────────────────────────────────────────

router.put('/users/:userId/country', requireAdmin, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { country_code } = req.body;

  if (!country_code || typeof country_code !== 'string' || country_code.length > 3) {
    res.status(400).json({ detail: 'Invalid country_code' });
    return;
  }

  try {
    await db.users().updateOne(
      { _id: new ObjectId(userId) },
      { $set: { country_code, updated_at: new Date() } }
    );
    res.json({ message: 'Country updated', country_code });
  } catch {
    res.status(404).json({ detail: 'User not found' });
  }
});

export default router;
