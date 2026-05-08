/**
 * Entry point — connects DB, seeds data, then starts listening.
 * Equivalent of uvicorn startup lifecycle.
 */
import { connectDB } from './core/database';
import { ensureIndexes, seedAdmin, seedSampleDoctors } from './seed';
import { PORT, SMTP_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_REFRESH_TOKEN } from './core/config';
import app from './server';

(async () => {
  await connectDB();
  await ensureIndexes();
  await seedAdmin();
  await seedSampleDoctors();

  app.listen(PORT, () => {
    console.info(`[MediConsult] API v2.0 running on http://localhost:${PORT}`);
    console.info(`[Config] Email: ${SMTP_EMAIL ? 'configured' : 'NOT SET'} | Google OAuth: ${GOOGLE_CLIENT_ID && GOOGLE_REFRESH_TOKEN ? 'configured' : 'NOT SET'}`);
  });
})();
