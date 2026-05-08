/**
 * Entry point — connects DB, seeds data, then starts listening.
 */
import { connectDB } from './core/database';
import { ensureIndexes, seedAdmin, seedSampleDoctors } from './seed';
import { PORT, SMTP_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } from './core/config';
import app from './server';
import { google } from 'googleapis';

async function validateGoogleOAuth(): Promise<void> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn('[Startup] Google Meet: NOT CONFIGURED — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    return;
  }
  try {
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
    oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    const { token } = await oauth2.getAccessToken();
    if (token) {
      console.info('[Startup] Google Meet: READY (token refresh successful)');
    } else {
      console.error('[Startup] Google Meet: FAILED — getAccessToken returned null. Regenerate refresh token.');
    }
  } catch (err: any) {
    console.error(`[Startup] Google Meet: FAILED — ${err.message}`);
    if (err.message?.includes('invalid_grant')) {
      console.error('[Startup] REASON: Refresh token expired/revoked. Likely cause: OAuth consent screen in "Testing" mode (7-day token expiry).');
      console.error('[Startup] FIX: 1) Publish app to Production in Google Cloud Console');
      console.error('[Startup] FIX: 2) Regenerate refresh token at https://developers.google.com/oauthplayground');
    }
  }
}

(async () => {
  await connectDB();
  await ensureIndexes();
  await seedAdmin();
  await seedSampleDoctors();

  app.listen(PORT, () => {
    console.info(`[Dr.MadhumatiSingh] API v2.0 running on http://localhost:${PORT}`);
    console.info(`[Config] Email: ${SMTP_EMAIL ? 'configured' : 'NOT SET'} | Google OAuth: ${GOOGLE_CLIENT_ID && GOOGLE_REFRESH_TOKEN ? 'configured' : 'NOT SET'}`);
  });

  // Non-blocking: validate Google OAuth credentials at startup
  validateGoogleOAuth();
})();
