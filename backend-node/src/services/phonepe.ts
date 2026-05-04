/**
 * PhonePe service integration (V2 OAuth API).
 * Equivalent of Python's services/phonepe.py
 */
import axios from 'axios';
import {
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  PHONEPE_CLIENT_VERSION,
  PHONEPE_AUTH_URL,
  PHONEPE_WEBHOOK_USERNAME,
  PHONEPE_WEBHOOK_PASSWORD,
  PHONEPE_ENV,
} from '../core/config';

let cachedToken: string | null = null;
let tokenExpiresAt: Date | null = null;

export const getPhonepeToken = async (): Promise<string | null> => {
  if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
    console.warn('[PhonePe] Credentials missing');
    return null;
  }

  const now = new Date();
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams({
      client_id: PHONEPE_CLIENT_ID,
      client_version: PHONEPE_CLIENT_VERSION,
      client_secret: PHONEPE_CLIENT_SECRET,
      grant_type: 'client_credentials',
    });

    const resp = await axios.post(PHONEPE_AUTH_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const data = resp.data;
    const access_token = data.access_token;
    if (!access_token) return null;

    cachedToken = access_token;
    const expiresIn = data.expires_in; // usually seconds
    tokenExpiresAt = expiresIn
      ? new Date(now.getTime() + expiresIn * 1000 - 60000)
      : new Date(now.getTime() + 50 * 60 * 1000);

    return access_token;
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.warn(`[PhonePe] Token fetch error: ${status} - ${msg}`);
    return null;
  }
};

export const webhookAuthRequired = (): boolean => {
  return PHONEPE_ENV === 'PRODUCTION' || (!!PHONEPE_WEBHOOK_USERNAME && !!PHONEPE_WEBHOOK_PASSWORD);
};

export const verifyWebhookAuth = (authorizationHeader: string): boolean => {
  if (!PHONEPE_WEBHOOK_USERNAME || !PHONEPE_WEBHOOK_PASSWORD) {
    return true; // dev mode — accept all if not configured
  }
  const prefix = 'Basic ';
  if (!authorizationHeader.startsWith(prefix)) return false;
  
  try {
    const b64 = authorizationHeader.slice(prefix.length);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    const [u, p] = decoded.split(':');
    return u === PHONEPE_WEBHOOK_USERNAME && p === PHONEPE_WEBHOOK_PASSWORD;
  } catch {
    return false;
  }
};
