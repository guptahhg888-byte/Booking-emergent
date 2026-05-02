/**
 * Entry point — connects DB, seeds data, then starts listening.
 * Equivalent of uvicorn startup lifecycle.
 */
import { connectDB } from './core/database';
import { ensureIndexes, seedAdmin, seedSampleDoctors } from './seed';
import { PORT } from './core/config';
import app from './server';

(async () => {
  await connectDB();
  await ensureIndexes();
  await seedAdmin();
  await seedSampleDoctors();

  app.listen(PORT, () => {
    console.info(`[MediConsult] API v2.0 running on http://localhost:${PORT}`);
  });
})();
