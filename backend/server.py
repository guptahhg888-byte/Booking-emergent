from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from bson import ObjectId
from typing import Optional, List, Annotated, Any, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
import os, bcrypt, jwt, json, logging, uuid, calendar as cal
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Config ---
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get("JWT_SECRET", "mediconsult-dev-secret-key-2024")
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@platform.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")

# PhonePe v2 (OAuth) Config
PHONEPE_ENV = os.environ.get("PHONEPE_ENV", "SANDBOX").upper()
PHONEPE_MERCHANT_ID = os.environ.get("PHONEPE_MERCHANT_ID", "")
PHONEPE_CLIENT_ID = os.environ.get("PHONEPE_CLIENT_ID", "")
PHONEPE_CLIENT_VERSION = os.environ.get("PHONEPE_CLIENT_VERSION", "1")
PHONEPE_CLIENT_SECRET = os.environ.get("PHONEPE_CLIENT_SECRET", "")
PHONEPE_UAT_BASE = os.environ.get("PHONEPE_UAT_BASE", "https://api-preprod.phonepe.com/apis/pg-sandbox")
PHONEPE_PROD_BASE = os.environ.get("PHONEPE_PROD_BASE", "https://api.phonepe.com/apis/pg")
PHONEPE_PROD_AUTH_BASE = os.environ.get("PHONEPE_PROD_AUTH_BASE", "https://api.phonepe.com/apis/identity-manager")

if PHONEPE_ENV == "PRODUCTION":
    PHONEPE_AUTH_URL = f"{PHONEPE_PROD_AUTH_BASE}/v1/oauth/token"
    PHONEPE_PAY_URL = f"{PHONEPE_PROD_BASE}/checkout/v2/pay"
    PHONEPE_STATUS_BASE = f"{PHONEPE_PROD_BASE}/checkout/v2/order"
else:
    PHONEPE_AUTH_URL = f"{PHONEPE_UAT_BASE}/v1/oauth/token"
    PHONEPE_PAY_URL = f"{PHONEPE_UAT_BASE}/checkout/v2/pay"
    PHONEPE_STATUS_BASE = f"{PHONEPE_UAT_BASE}/checkout/v2/order"

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
EMERGENT_AUTH_SESSION_URL = os.environ.get(
    "EMERGENT_AUTH_SESSION_URL",
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="MediConsult API", version="1.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- PyObjectId ---
PyObjectId = Annotated[str, BeforeValidator(str)]

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# --- PhonePe v2 OAuth Token Manager ---
_phonepe_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": None}

async def get_phonepe_token() -> Optional[str]:
    """Fetch or reuse PhonePe OAuth access token. Returns None on failure."""
    now = datetime.now(timezone.utc)
    cached = _phonepe_token_cache
    if cached["access_token"] and cached["expires_at"] and now < cached["expires_at"] - timedelta(minutes=2):
        return cached["access_token"]

    if not (PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET):
        return None
    try:
        data = {
            "client_id": PHONEPE_CLIENT_ID,
            "client_version": str(PHONEPE_CLIENT_VERSION),
            "client_secret": PHONEPE_CLIENT_SECRET,
            "grant_type": "client_credentials",
        }
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.post(
                PHONEPE_AUTH_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            logger.warning(f"PhonePe auth failed: {resp.status_code} {resp.text}")
            return None
        body = resp.json()
        access_token = body.get("access_token")
        expires_at_epoch = body.get("expires_at")
        if not access_token:
            return None
        if expires_at_epoch:
            cached["expires_at"] = datetime.fromtimestamp(int(expires_at_epoch), tz=timezone.utc)
        else:
            cached["expires_at"] = now + timedelta(minutes=50)
        cached["access_token"] = access_token
        return access_token
    except Exception as e:
        logger.warning(f"PhonePe token fetch error: {e}")
        return None

async def log_activity(user_id: str, user_name: str, action: str, details: str = None):
    await db.activity_logs.insert_one({
        "user_id": user_id, "user_name": user_name,
        "action": action, "details": details,
        "timestamp": datetime.now(timezone.utc)
    })

# --- Request Models ---
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class DoctorCreate(BaseModel):
    name: str
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: float = 2000.0
    bio: Optional[str] = None
    image_url: Optional[str] = None
    available_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: str
    appointment_time: str
    notes: Optional[str] = None

class PaymentInitiateRequest(BaseModel):
    appointment_id: str

# ========== AUTH ROUTES ==========
@api_router.post("/auth/register")
async def register(body: RegisterRequest):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name, "role": "user", "phone": body.phone,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    await log_activity(user_id, body.name, "USER_REGISTERED", f"New user: {email}")
    return {
        "token": create_token(user_id, email, "user"),
        "user": {"id": user_id, "email": email, "name": body.name, "role": "user", "phone": body.phone}
    }

@api_router.post("/auth/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    role = user.get("role", "user")
    await log_activity(user_id, user.get("name", email), "USER_LOGIN")
    return {
        "token": create_token(user_id, email, role),
        "user": {"id": user_id, "email": email, "name": user.get("name", ""), "role": role, "phone": user.get("phone")}
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ========== GOOGLE OAUTH (Emergent) ==========
class GoogleSessionRequest(BaseModel):
    session_id: str

@api_router.post("/auth/google")
async def google_auth(body: GoogleSessionRequest):
    """
    Exchange Emergent session_id for app JWT.
    Creates user if not exists (role=user), otherwise logs them in.
    """
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": body.session_id}
            )
    except Exception as e:
        logger.error(f"Emergent auth call failed: {e}")
        raise HTTPException(status_code=502, detail="Auth provider unreachable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")

    data = resp.json()
    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="No email from provider")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = str(existing["_id"])
        role = existing.get("role", "user")
        update = {"name": existing.get("name") or name, "picture": picture, "auth_provider": "google"}
        await db.users.update_one({"_id": existing["_id"]}, {"$set": update})
        await log_activity(user_id, update["name"], "USER_LOGIN", "Google")
    else:
        doc = {
            "email": email,
            "name": name,
            "picture": picture,
            "role": "user",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(doc)
        user_id = str(result.inserted_id)
        role = "user"
        await log_activity(user_id, name, "USER_REGISTERED", f"Google signup: {email}")

    return {
        "token": create_token(user_id, email, role),
        "user": {"id": user_id, "email": email, "name": name, "role": role, "picture": picture}
    }

# ========== DOCTOR ROUTES ==========
@api_router.get("/doctors")
async def list_doctors(search: Optional[str] = None):
    query: Dict[str, Any] = {"is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"specialization": {"$regex": search, "$options": "i"}}
        ]
    docs = await db.doctors.find(query).to_list(100)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs

@api_router.get("/doctors/{doctor_id}/available-slots")
async def get_available_slots(doctor_id: str, date: str):
    ALL_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30",
                 "12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"]
    booked = await db.appointments.find(
        {"doctor_id": doctor_id, "appointment_date": date, "status": {"$nin": ["cancelled"]}},
        {"appointment_time": 1}
    ).to_list(100)
    booked_times = {a["appointment_time"] for a in booked}
    return {"available_slots": [s for s in ALL_SLOTS if s not in booked_times]}

@api_router.get("/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    try:
        doc = await db.doctors.find_one({"_id": ObjectId(doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doc["_id"] = str(doc["_id"])
    return doc

@api_router.post("/doctors")
async def create_doctor(body: DoctorCreate, admin: dict = Depends(get_admin_user)):
    doc = body.model_dump()
    doc.update({"is_active": True, "rating": 4.5, "total_reviews": 0, "created_at": datetime.now(timezone.utc)})
    result = await db.doctors.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await log_activity(admin["_id"], admin["name"], "DOCTOR_ADDED", f"Added: {body.name}")
    return doc

@api_router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, body: Dict[str, Any], admin: dict = Depends(get_admin_user)):
    body.pop("_id", None)
    body.pop("id", None)
    try:
        await db.doctors.update_one({"_id": ObjectId(doctor_id)}, {"$set": body})
        doc = await db.doctors.find_one({"_id": ObjectId(doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, admin: dict = Depends(get_admin_user)):
    try:
        result = await db.doctors.delete_one({"_id": ObjectId(doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await log_activity(admin["_id"], admin["name"], "DOCTOR_DELETED", f"ID: {doctor_id}")
    return {"message": "Doctor deleted"}

# ========== APPOINTMENT ROUTES ==========
@api_router.post("/appointments")
async def create_appointment(body: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    try:
        doctor = await db.doctors.find_one({"_id": ObjectId(body.doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    existing = await db.appointments.find_one({
        "doctor_id": body.doctor_id, "appointment_date": body.appointment_date,
        "appointment_time": body.appointment_time, "status": {"$nin": ["cancelled"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    user_id = current_user["_id"]
    appt = {
        "user_id": user_id, "doctor_id": body.doctor_id,
        "doctor_name": doctor["name"], "patient_name": current_user["name"],
        "patient_email": current_user["email"], "patient_phone": current_user.get("phone"),
        "appointment_date": body.appointment_date, "appointment_time": body.appointment_time,
        "status": "pending_payment", "payment_status": "pending", "transaction_id": None,
        "consultation_fee": doctor.get("consultation_fee", 2000), "notes": body.notes,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.appointments.insert_one(appt)
    appt["_id"] = str(result.inserted_id)
    await log_activity(user_id, current_user["name"], "APPOINTMENT_CREATED",
                       f"With {doctor['name']} on {body.appointment_date} at {body.appointment_time}")
    return appt

@api_router.get("/appointments")
async def list_appointments(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        appts = await db.appointments.find().sort("created_at", -1).to_list(500)
    else:
        appts = await db.appointments.find({"user_id": current_user["_id"]}).sort("created_at", -1).to_list(200)
    for a in appts:
        a["_id"] = str(a["_id"])
    return appts

@api_router.get("/appointments/{appt_id}")
async def get_appointment(appt_id: str, current_user: dict = Depends(get_current_user)):
    try:
        appt = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.get("role") != "admin" and appt["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    appt["_id"] = str(appt["_id"])
    return appt

@api_router.put("/appointments/{appt_id}")
async def update_appointment(appt_id: str, body: Dict[str, Any], admin: dict = Depends(get_admin_user)):
    body.pop("_id", None)
    body.pop("id", None)
    try:
        await db.appointments.update_one({"_id": ObjectId(appt_id)}, {"$set": body})
        appt = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt:
        appt["_id"] = str(appt["_id"])
    return appt

@api_router.delete("/appointments/{appt_id}")
async def cancel_appointment(appt_id: str, current_user: dict = Depends(get_current_user)):
    try:
        appt = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.get("role") != "admin" and appt["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    await db.appointments.update_one({"_id": ObjectId(appt_id)}, {"$set": {"status": "cancelled"}})
    return {"message": "Appointment cancelled"}

# ========== PAYMENT ROUTES (PhonePe v2 - OAuth) ==========
@api_router.post("/payments/initiate")
async def initiate_payment(body: PaymentInitiateRequest, current_user: dict = Depends(get_current_user)):
    try:
        appt = await db.appointments.find_one({"_id": ObjectId(body.appointment_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    amount_paise = int(appt.get("consultation_fee", 2000) * 100)
    merchant_order_id = f"MC{str(uuid.uuid4())[:8].upper()}"
    # For v2, we use the merchantOrderId as the external reference (status queries use it too)
    txn_id = merchant_order_id
    redirect_url = f"{FRONTEND_URL}/payment/status?txnId={txn_id}"

    checkout_url = None
    api_error = None
    access_token = await get_phonepe_token()
    if access_token:
        try:
            payload = {
                "merchantOrderId": merchant_order_id,
                "amount": amount_paise,
                "expireAfter": 1200,
                "metaInfo": {
                    "udf1": current_user["_id"],
                    "udf2": appt.get("doctor_name", ""),
                    "udf3": str(appt["_id"]),
                },
                "paymentFlow": {
                    "type": "PG_CHECKOUT",
                    "message": f"Consultation fee - {appt.get('doctor_name', '')}",
                    "merchantUrls": {"redirectUrl": redirect_url},
                },
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"O-Bearer {access_token}",
            }
            async with httpx.AsyncClient(timeout=10.0) as c:
                resp = await c.post(PHONEPE_PAY_URL, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                checkout_url = data.get("redirectUrl") or data.get("data", {}).get("redirectUrl")
            else:
                api_error = f"{resp.status_code}: {resp.text[:200]}"
                logger.warning(f"PhonePe pay init failed: {api_error}")
        except Exception as e:
            api_error = str(e)
            logger.warning(f"PhonePe API exception: {e}")

    if not checkout_url:
        # Fallback simulation so flow remains testable in UAT/dev
        checkout_url = f"{FRONTEND_URL}/payment/simulate/{txn_id}"

    await db.transactions.insert_one({
        "appointment_id": str(appt["_id"]),
        "user_id": current_user["_id"],
        "merchant_order_id": merchant_order_id,
        "transaction_id": txn_id,
        "amount": amount_paise,
        "payment_state": "PENDING",
        "checkout_url": checkout_url,
        "doctor_name": appt.get("doctor_name", ""),
        "appointment_date": appt.get("appointment_date", ""),
        "appointment_time": appt.get("appointment_time", ""),
        "phonepe_env": PHONEPE_ENV,
        "api_error": api_error,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    await db.appointments.update_one(
        {"_id": ObjectId(body.appointment_id)},
        {"$set": {"transaction_id": txn_id}}
    )
    return {
        "checkout_url": checkout_url,
        "transaction_id": txn_id,
        "merchant_order_id": merchant_order_id,
        "is_simulation": "/simulate/" in checkout_url,
    }

@api_router.get("/payments/status/{txn_id}")
async def get_payment_status(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn["_id"] = str(txn["_id"])
    if txn["payment_state"] == "PENDING":
        access_token = await get_phonepe_token()
        if access_token:
            try:
                url = f"{PHONEPE_STATUS_BASE}/{txn['merchant_order_id']}/status?details=false&errorContext=true"
                async with httpx.AsyncClient(timeout=10.0) as c:
                    resp = await c.get(url, headers={
                        "Content-Type": "application/json",
                        "Authorization": f"O-Bearer {access_token}",
                    })
                if resp.status_code == 200:
                    data = resp.json()
                    # v2 returns { state: "COMPLETED"|"FAILED"|"PENDING", ... }
                    new_state = data.get("state") or data.get("data", {}).get("state")
                    if new_state in ["COMPLETED", "FAILED"]:
                        await db.transactions.update_one(
                            {"transaction_id": txn_id},
                            {"$set": {"payment_state": new_state, "updated_at": datetime.now(timezone.utc)}}
                        )
                        txn["payment_state"] = new_state
                        if new_state == "COMPLETED":
                            await db.appointments.update_one(
                                {"transaction_id": txn_id},
                                {"$set": {"status": "confirmed", "payment_status": "paid"}}
                            )
                        else:
                            await db.appointments.update_one(
                                {"transaction_id": txn_id},
                                {"$set": {"status": "cancelled", "payment_status": "failed"}}
                            )
            except Exception as e:
                logger.warning(f"PhonePe status check failed: {e}")
    return txn

@api_router.post("/payments/simulate/{txn_id}/success")
async def simulate_success(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    prov_ref = f"SIM{str(uuid.uuid4())[:8].upper()}"
    await db.transactions.update_one(
        {"transaction_id": txn_id},
        {"$set": {"payment_state": "COMPLETED", "payment_mode": "UPI_SIMULATE",
                  "provider_reference_id": prov_ref, "updated_at": datetime.now(timezone.utc)}}
    )
    appt = await db.appointments.find_one({"transaction_id": txn_id})
    if appt:
        await db.appointments.update_one(
            {"transaction_id": txn_id},
            {"$set": {"status": "confirmed", "payment_status": "paid"}}
        )
        await log_activity(txn["user_id"], "Patient", "PAYMENT_SUCCESS",
                           f"Appointment confirmed for {appt.get('doctor_name', '')}")
    return {"message": "Payment simulated successfully", "transaction_id": txn_id, "provider_reference_id": prov_ref}

@api_router.post("/payments/simulate/{txn_id}/failure")
async def simulate_failure(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.transactions.update_one(
        {"transaction_id": txn_id},
        {"$set": {"payment_state": "FAILED", "updated_at": datetime.now(timezone.utc)}}
    )
    await db.appointments.update_one(
        {"transaction_id": txn_id},
        {"$set": {"status": "cancelled", "payment_status": "failed"}}
    )
    return {"message": "Payment failed", "transaction_id": txn_id}

@api_router.post("/payments/webhook")
async def phonepe_webhook(request: Request):
    """
    PhonePe v2 webhook. Body may be either:
    - { "event": "checkout.order.completed", "payload": { ... merchantOrderId, state ... } }
    - { "response": "<base64 json>" } (legacy)
    Always respond 200 to prevent infinite retries.
    """
    try:
        raw = await request.body()
        body: Dict[str, Any] = {}
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            body = {}

        # Legacy base64-wrapped payload
        if "response" in body and isinstance(body["response"], str):
            try:
                import base64 as _b64
                decoded = _b64.b64decode(body["response"]).decode("utf-8")
                body = json.loads(decoded)
            except Exception:
                pass

        event = body.get("event", "")
        payload = body.get("payload") or body.get("data") or {}
        merchant_order_id = payload.get("merchantOrderId") or payload.get("merchantTransactionId")
        state = (payload.get("state") or "").upper()

        if not merchant_order_id:
            return {"status": "ignored"}

        # Resolve outcome either from state field or from event name
        is_success = state == "COMPLETED" or "completed" in event.lower() or "success" in event.lower()
        is_failure = state in ("FAILED", "CANCELLED") or "failed" in event.lower() or "cancel" in event.lower()

        if is_success:
            await db.transactions.update_one(
                {"merchant_order_id": merchant_order_id},
                {"$set": {"payment_state": "COMPLETED", "updated_at": datetime.now(timezone.utc)}}
            )
            await db.appointments.update_one(
                {"transaction_id": merchant_order_id},
                {"$set": {"status": "confirmed", "payment_status": "paid"}}
            )
        elif is_failure:
            await db.transactions.update_one(
                {"merchant_order_id": merchant_order_id},
                {"$set": {"payment_state": "FAILED", "updated_at": datetime.now(timezone.utc)}}
            )
            await db.appointments.update_one(
                {"transaction_id": merchant_order_id},
                {"$set": {"status": "cancelled", "payment_status": "failed"}}
            )
        return {"status": "received"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ========== ADMIN ROUTES ==========
@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_doctors = await db.doctors.count_documents({})
    total_appointments = await db.appointments.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    rev_result = await db.transactions.aggregate([
        {"$match": {"payment_state": "COMPLETED"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_revenue = rev_result[0]["total"] / 100 if rev_result else 0

    confirmed = await db.appointments.count_documents({"status": "confirmed"})
    pending = await db.appointments.count_documents({"status": "pending_payment"})
    cancelled = await db.appointments.count_documents({"status": "cancelled"})
    completed = await db.appointments.count_documents({"status": "completed"})

    now = datetime.now(timezone.utc)
    monthly_data = []
    for i in range(5, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        last_day = cal.monthrange(year, month)[1]
        start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        month_name = start.strftime("%b")
        rev = await db.transactions.aggregate([
            {"$match": {"payment_state": "COMPLETED", "created_at": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        appts_count = await db.appointments.count_documents({"created_at": {"$gte": start, "$lte": end}})
        monthly_data.append({
            "month": month_name,
            "revenue": rev[0]["total"] / 100 if rev else 0,
            "appointments": appts_count
        })

    return {
        "total_doctors": total_doctors,
        "total_appointments": total_appointments,
        "total_users": total_users,
        "total_revenue": total_revenue,
        "appointment_stats": {"confirmed": confirmed, "pending": pending, "cancelled": cancelled, "completed": completed},
        "monthly_data": monthly_data
    }

@api_router.get("/admin/activity")
async def get_activity_logs(admin: dict = Depends(get_admin_user)):
    logs = await db.activity_logs.find().sort("timestamp", -1).limit(50).to_list(50)
    for l in logs:
        l["_id"] = str(l["_id"])
        if isinstance(l.get("timestamp"), datetime):
            l["timestamp"] = l["timestamp"].isoformat()
    return logs

@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        u["_id"] = str(u["_id"])
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
    return users

@api_router.get("/admin/transactions")
async def list_transactions(admin: dict = Depends(get_admin_user)):
    txns = await db.transactions.find().sort("created_at", -1).to_list(500)
    for t in txns:
        t["_id"] = str(t["_id"])
        for k in ["created_at", "updated_at"]:
            if isinstance(t.get(k), datetime):
                t[k] = t[k].isoformat()
    return txns

# ========== SEED DATA ==========
SAMPLE_DOCTORS = [
    {
        "name": "Dr. Priya Sharma",
        "specialization": "Cardiologist",
        "qualification": "MBBS, MD (Cardiology), DM",
        "experience_years": 15,
        "consultation_fee": 2000,
        "bio": "Dr. Priya Sharma is a renowned cardiologist with 15 years of experience treating complex cardiac conditions. She has performed over 5000 consultations and is known for her patient-first approach and cutting-edge treatment protocols.",
        "image_url": "https://images.pexels.com/photos/7578806/pexels-photo-7578806.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "is_active": True, "rating": 4.9, "total_reviews": 312,
        "created_at": datetime.now(timezone.utc)
    },
    {
        "name": "Dr. Rahul Verma",
        "specialization": "Neurologist",
        "qualification": "MBBS, MD (Neurology), DM",
        "experience_years": 12,
        "consultation_fee": 2000,
        "bio": "Dr. Rahul Verma specializes in neurological disorders including epilepsy, migraine, and Parkinson's disease. With 12 years of expertise, he brings advanced diagnostic and treatment options to his patients.",
        "image_url": "https://images.pexels.com/photos/4761779/pexels-photo-4761779.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Wednesday", "Friday"],
        "is_active": True, "rating": 4.7, "total_reviews": 198,
        "created_at": datetime.now(timezone.utc)
    },
    {
        "name": "Dr. Anita Mehta",
        "specialization": "Dermatologist",
        "qualification": "MBBS, MD (Dermatology)",
        "experience_years": 10,
        "consultation_fee": 2000,
        "bio": "Dr. Anita Mehta is a highly skilled dermatologist specializing in skin disorders, cosmetic procedures, and hair treatment. She has helped thousands of patients achieve healthy, glowing skin with personalized care plans.",
        "image_url": "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Tuesday", "Thursday", "Saturday"],
        "is_active": True, "rating": 4.8, "total_reviews": 267,
        "created_at": datetime.now(timezone.utc)
    },
    {
        "name": "Dr. Suresh Nair",
        "specialization": "Orthopedic Surgeon",
        "qualification": "MBBS, MS (Orthopaedics), MCh",
        "experience_years": 18,
        "consultation_fee": 2000,
        "bio": "Dr. Suresh Nair is a leading orthopedic surgeon with 18 years of experience in joint replacement, sports injuries, and spine surgery. Known for minimally invasive techniques with faster recovery times.",
        "image_url": "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday"],
        "is_active": True, "rating": 4.9, "total_reviews": 445,
        "created_at": datetime.now(timezone.utc)
    },
    {
        "name": "Dr. Kavitha Rao",
        "specialization": "Pediatrician",
        "qualification": "MBBS, MD (Pediatrics), DCH",
        "experience_years": 8,
        "consultation_fee": 2000,
        "bio": "Dr. Kavitha Rao is a compassionate pediatrician dedicated to the health and well-being of children from newborn to adolescence. Special expertise in developmental pediatrics and childhood nutrition.",
        "image_url": "https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "is_active": True, "rating": 4.8, "total_reviews": 189,
        "created_at": datetime.now(timezone.utc)
    }
]

async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Platform Admin", "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
        )
        logger.info("Admin password updated")

async def seed_sample_doctors():
    count = await db.doctors.count_documents({})
    if count == 0:
        await db.doctors.insert_many(SAMPLE_DOCTORS)
        logger.info(f"Seeded {len(SAMPLE_DOCTORS)} sample doctors")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await seed_admin()
    await seed_sample_doctors()
    logger.info("MediConsult API started!")

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
