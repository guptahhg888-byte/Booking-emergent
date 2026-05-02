"""Central configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# --- MongoDB ---
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# --- JWT ---
JWT_SECRET = os.environ.get("JWT_SECRET", "mediconsult-dev-secret-key-2024")
JWT_ALGORITHM = "HS256"

# --- Admin seed ---
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@platform.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")

# --- PhonePe v2 OAuth ---
PHONEPE_ENV = os.environ.get("PHONEPE_ENV", "SANDBOX").upper()
PHONEPE_MERCHANT_ID = os.environ.get("PHONEPE_MERCHANT_ID", "")
PHONEPE_CLIENT_ID = os.environ.get("PHONEPE_CLIENT_ID", "")
PHONEPE_CLIENT_VERSION = os.environ.get("PHONEPE_CLIENT_VERSION", "1")
PHONEPE_CLIENT_SECRET = os.environ.get("PHONEPE_CLIENT_SECRET", "")
PHONEPE_UAT_BASE = os.environ.get(
    "PHONEPE_UAT_BASE", "https://api-preprod.phonepe.com/apis/pg-sandbox"
)
PHONEPE_PROD_BASE = os.environ.get("PHONEPE_PROD_BASE", "https://api.phonepe.com/apis/pg")
PHONEPE_PROD_AUTH_BASE = os.environ.get(
    "PHONEPE_PROD_AUTH_BASE", "https://api.phonepe.com/apis/identity-manager"
)

# Webhook Basic-Auth credentials configured in PhonePe Business Dashboard.
# When both set, incoming webhooks MUST send Authorization: SHA256(username:password).
# When either is blank (dev), validation is skipped.
PHONEPE_WEBHOOK_USERNAME = os.environ.get("PHONEPE_WEBHOOK_USERNAME", "")
PHONEPE_WEBHOOK_PASSWORD = os.environ.get("PHONEPE_WEBHOOK_PASSWORD", "")

if PHONEPE_ENV == "PRODUCTION":
    PHONEPE_AUTH_URL = f"{PHONEPE_PROD_AUTH_BASE}/v1/oauth/token"
    PHONEPE_PAY_URL = f"{PHONEPE_PROD_BASE}/checkout/v2/pay"
    PHONEPE_STATUS_BASE = f"{PHONEPE_PROD_BASE}/checkout/v2/order"
else:
    PHONEPE_AUTH_URL = f"{PHONEPE_UAT_BASE}/v1/oauth/token"
    PHONEPE_PAY_URL = f"{PHONEPE_UAT_BASE}/checkout/v2/pay"
    PHONEPE_STATUS_BASE = f"{PHONEPE_UAT_BASE}/checkout/v2/order"

# --- URLs ---
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
