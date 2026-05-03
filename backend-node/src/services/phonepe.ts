/**
 * PhonePe Standard PG Checkout integration (V1)
 * Uses base64 payloads and X-VERIFY checksums.
 */
import crypto from 'crypto';
import { PHONEPE_SALT_KEY, PHONEPE_SALT_INDEX, PHONEPE_WEBHOOK_USERNAME, PHONEPE_WEBHOOK_PASSWORD, PHONEPE_ENV } from '../core/config';

/**
 * Generate X-VERIFY checksum for PhonePe Standard PG.
 * Formula: sha256(base64Payload + endpoint + saltKey) + "###" + saltIndex
 */
export const generateChecksum = (base64Payload: string, endpoint: string): string => {
  const str = base64Payload + endpoint + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(str).digest('hex');
  return `${sha256}###${PHONEPE_SALT_INDEX}`;
};

/**
 * Validates incoming webhook X-VERIFY header.
 * Formula: sha256(base64Body + saltKey) + "###" + saltIndex
 */
export const verifyWebhookChecksum = (base64Body: string, xVerifyHeader: string): boolean => {
  const expectedStr = base64Body + PHONEPE_SALT_KEY;
  const expectedSha256 = crypto.createHash('sha256').update(expectedStr).digest('hex');
  const expectedChecksum = `${expectedSha256}###${PHONEPE_SALT_INDEX}`;
  return xVerifyHeader === expectedChecksum;
};

// Kept for legacy compatibility if Basic Auth was also configured
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
