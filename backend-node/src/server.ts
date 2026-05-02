/**
 * Express app setup — mounts routers, CORS, JSON parsing.
 * Equivalent of Python's server.py
 */
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import doctorsRouter from './routes/doctors';
import appointmentsRouter from './routes/appointments';
import paymentsRouter from './routes/payments';
import adminRouter from './routes/admin';

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(cors({ origin: '*', credentials: false }));

// Raw body for webhook (must come BEFORE express.json())
app.use('/api/payments/webhook', express.raw({ type: '*/*' }), (req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString('utf-8')); }
    catch { req.body = {}; }
  }
  next();
});

app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', runtime: 'node' });
});

// ─── API routers ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ detail: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ detail: 'Internal server error' });
});

export default app;
