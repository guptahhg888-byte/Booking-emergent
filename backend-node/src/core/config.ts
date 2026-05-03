/**
 * Central configuration loaded from environment variables.
 * Equivalent of Python's core/config.py
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const getEnv = (key: string, fallback?: string): string => {
  const val = process.env[key];
  if (val === undefined || val === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
};

// --- MongoDB ---
export const MONGO_URL = getEnv('MONGO_URL');
export const DB_NAME = getEnv('DB_NAME');

// --- JWT ---
export const JWT_SECRET = getEnv('JWT_SECRET', 'mediconsult-dev-secret-key-2024');
export const JWT_ALGORITHM = 'HS256';

// --- Admin seed ---
export const ADMIN_EMAIL = getEnv('ADMIN_EMAIL', 'admin@platform.com');
export const ADMIN_PASSWORD = getEnv('ADMIN_PASSWORD', 'Admin@123');

// --- PhonePe v2 OAuth ---
export const PHONEPE_ENV = getEnv('PHONEPE_ENV', 'SANDBOX').toUpperCase();
export const PHONEPE_MERCHANT_ID = getEnv('PHONEPE_MERCHANT_ID', 'PGTESTPAYUAT86');
export const PHONEPE_SALT_KEY = getEnv('PHONEPE_SALT_KEY', '96434309-7796-489d-8924-ab56988a6076');
export const PHONEPE_SALT_INDEX = getEnv('PHONEPE_SALT_INDEX', '1');

export const PHONEPE_WEBHOOK_USERNAME = getEnv('PHONEPE_WEBHOOK_USERNAME', '');
export const PHONEPE_WEBHOOK_PASSWORD = getEnv('PHONEPE_WEBHOOK_PASSWORD', '');

const PHONEPE_UAT_BASE = getEnv('PHONEPE_UAT_BASE', 'https://api-preprod.phonepe.com/apis/pg-sandbox');
const PHONEPE_PROD_BASE = getEnv('PHONEPE_PROD_BASE', 'https://api.phonepe.com/apis/pg');

export const PHONEPE_PAY_URL =
  PHONEPE_ENV === 'PRODUCTION'
    ? `${PHONEPE_PROD_BASE}/v1/pay`
    : `${PHONEPE_UAT_BASE}/pg/v1/pay`;

export const PHONEPE_STATUS_BASE =
  PHONEPE_ENV === 'PRODUCTION'
    ? `${PHONEPE_PROD_BASE}/v1/status`
    : `${PHONEPE_UAT_BASE}/pg/v1/status`;

// --- URLs ---
export const FRONTEND_URL = getEnv('FRONTEND_URL', 'http://localhost:3000');
export const BACKEND_URL = getEnv('BACKEND_URL', 'http://localhost:8000');
export const PORT = parseInt(getEnv('PORT', '8000'), 10);
