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
export const PHONEPE_MERCHANT_ID = getEnv('PHONEPE_MERCHANT_ID', '');
export const PHONEPE_CLIENT_ID = getEnv('PHONEPE_CLIENT_ID', '');
export const PHONEPE_CLIENT_VERSION = getEnv('PHONEPE_CLIENT_VERSION', '1');
export const PHONEPE_CLIENT_SECRET = getEnv('PHONEPE_CLIENT_SECRET', '');

const PHONEPE_UAT_BASE = getEnv('PHONEPE_UAT_BASE', 'https://api-preprod.phonepe.com/apis/pg-sandbox');
const PHONEPE_PROD_BASE = getEnv('PHONEPE_PROD_BASE', 'https://api.phonepe.com/apis/pg');
const PHONEPE_PROD_AUTH_BASE = getEnv('PHONEPE_PROD_AUTH_BASE', 'https://api.phonepe.com/apis/identity-manager');

export const PHONEPE_WEBHOOK_USERNAME = getEnv('PHONEPE_WEBHOOK_USERNAME', '');
export const PHONEPE_WEBHOOK_PASSWORD = getEnv('PHONEPE_WEBHOOK_PASSWORD', '');

export const PHONEPE_AUTH_URL =
  PHONEPE_ENV === 'PRODUCTION'
    ? `${PHONEPE_PROD_AUTH_BASE}/v1/oauth/token`
    : `${PHONEPE_UAT_BASE}/v1/oauth/token`;

export const PHONEPE_PAY_URL =
  PHONEPE_ENV === 'PRODUCTION'
    ? `${PHONEPE_PROD_BASE}/checkout/v2/pay`
    : `${PHONEPE_UAT_BASE}/checkout/v2/pay`;

export const PHONEPE_STATUS_BASE =
  PHONEPE_ENV === 'PRODUCTION'
    ? `${PHONEPE_PROD_BASE}/checkout/v2/order`
    : `${PHONEPE_UAT_BASE}/checkout/v2/order`;

// --- URLs ---
export const FRONTEND_URL = getEnv('FRONTEND_URL', 'http://localhost:3000');
export const BACKEND_URL = getEnv('BACKEND_URL', 'http://localhost:8000');
export const PORT = parseInt(getEnv('PORT', '8000'), 10);
