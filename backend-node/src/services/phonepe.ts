/**
 * PhonePe v2 OAuth: token management + webhook signature validation.
 * Equivalent of Python's services/phonepe.py
 */
import crypto from 'crypto';
import axios from 'axios';
import {
  PHONEPE_AUTH_URL,
  PHONEPE_CLIENT_ID,
  PHONEPE_CLIENT_SECRET,
  PHONEPE_CLIENT_VERSION,
  PHONEPE_WEBHOOK_USERNAME,
  PHONEPE_WEBHOOK_PASSWORD,
} from '../core/config';

interface TokenCache {
  access_token: string | null;
  expires_at: Date | null;
}

const tokenCache: TokenCache = { access_token: null, expires_at: null };

export const getPhonepeToken = async (): Promise<string | null> => {
  const now = new Date();

  // Return cached token if still valid (with 2 min buffer)
  if (
    tokenCache.access_token &&
    tokenCache.expires_at &&
    now < new Date(tokenCache.expires_at.getTime() - 2 * 60 * 1000)
  ) {
    return tokenCache.access_token;
  }

  if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
    return null;
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

    const body = resp.data;
    const access_token: string = body.access_token;
    const expires_at_epoch: number | undefined = body.expires_at;

    if (!access_token) return null;

    tokenCache.access_token = access_token;
    tokenCache.expires_at = expires_at_epoch
      ? new Date(expires_at_epoch * 1000)
      : new Date(now.getTime() + 50 * 60 * 1000);

    return access_token;
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.warn(`[PhonePe] Token fetch error: ${status} - ${msg}`);
    return null;
  }
};

export const verifyWebhookAuth = (authorizationHeader: string): boolean => {
  if (!PHONEPE_WEBHOOK_USERNAME || !PHONEPE_WEBHOOK_PASSWORD) {
    return true; // dev mode — accept all
  }
  if (!authorizationHeader) return false;

  const expected = crypto
    .createHash('sha256')
    .update(`${PHONEPE_WEBHOOK_USERNAME}:${PHONEPE_WEBHOOK_PASSWORD}`)
    .digest('hex');

  let provided = authorizationHeader.trim();
  if (provided.toLowerCase().startsWith('sha256 ')) {
    provided = provided.slice(7).trim();
  }
  return provided.toLowerCase() === expected.toLowerCase();
};

export const webhookAuthRequired = (): boolean => {
  return Boolean(PHONEPE_WEBHOOK_USERNAME && PHONEPE_WEBHOOK_PASSWORD);
};
