/**
 * Global configuration settings loaded from environment variables.
 * Equivalent of Python's core/config.py
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function getEnv(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

// --- App Settings ---
export const PROJECT_NAME = getEnv('PROJECT_NAME', 'MediConsult API');
export const DEBUG = getEnv('DEBUG', 'False').toLowerCase() === 'true';

// --- Database ---
export const MONGODB_URI = getEnv(
  'MONGO_URL',
  'mongodb+srv://admin:admin123@cluster0.mongodb.net/mediconsult?retryWrites=true&w=majority'
);
export const MONGO_URL = MONGODB_URI;
export const DB_NAME = getEnv('DB_NAME', 'guptahhg888_db_user');

// --- Security ---
export const JWT_SECRET = getEnv('JWT_SECRET', 'supersecretkey');
export const JWT_ALGORITHM = 'HS256';
export const ACCESS_TOKEN_EXPIRE_MINUTES = parseInt(getEnv('ACCESS_TOKEN_EXPIRE_MINUTES', '10080'), 10);

// --- PhonePe v2 OAuth ---
export const PHONEPE_ENV = getEnv('PHONEPE_ENV', 'SANDBOX').toUpperCase();
export const PHONEPE_MERCHANT_ID = getEnv('PHONEPE_MERCHANT_ID', '');
export const PHONEPE_CLIENT_ID = getEnv('PHONEPE_CLIENT_ID', '');
export const PHONEPE_CLIENT_VERSION = getEnv('PHONEPE_CLIENT_VERSION', '1');
export const PHONEPE_CLIENT_SECRET = getEnv('PHONEPE_CLIENT_SECRET', '');

export const PHONEPE_WEBHOOK_USERNAME = getEnv('PHONEPE_WEBHOOK_USERNAME', '');
export const PHONEPE_WEBHOOK_PASSWORD = getEnv('PHONEPE_WEBHOOK_PASSWORD', '');

const PHONEPE_UAT_BASE = getEnv('PHONEPE_UAT_BASE', 'https://api-preprod.phonepe.com/apis/pg-sandbox');
const PHONEPE_PROD_BASE = getEnv('PHONEPE_PROD_BASE', 'https://api.phonepe.com/apis/pg');
const PHONEPE_PROD_AUTH_BASE = getEnv('PHONEPE_PROD_AUTH_BASE', 'https://api.phonepe.com/apis/identity-manager');

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
export const PORT = parseInt(getEnv('PORT', '8000'), 10);

// --- Admin ---
export const ADMIN_EMAIL = getEnv('ADMIN_EMAIL', 'admin@platform.com');
export const ADMIN_PASSWORD = getEnv('ADMIN_PASSWORD', 'Admin@123');

// --- Google OAuth (for Calendar/Meet) ---
export const GOOGLE_CLIENT_ID = getEnv('GOOGLE_CLIENT_ID', '');
export const GOOGLE_CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET', '');
export const GOOGLE_REFRESH_TOKEN = getEnv('GOOGLE_REFRESH_TOKEN', '');
export const GOOGLE_CALENDAR_EMAIL = getEnv('GOOGLE_CALENDAR_EMAIL', 'madhumati.singh@gmail.com');

// --- Email (SMTP via Gmail) ---
export const SMTP_EMAIL = getEnv('SMTP_EMAIL', '');
export const SMTP_PASSWORD = getEnv('SMTP_PASSWORD', '');

// --- Booking recipients ---
export const CONSULTANT_EMAIL = 'madhumati.singh@gmail.com';
export const CC_EMAILS = ['spydreamer75@gmail.com', 'gmukul600@gmail.com'];
