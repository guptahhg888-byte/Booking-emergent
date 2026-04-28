from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from bson import ObjectId
from typing import Optional, List, Annotated, Any, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
import os, bcrypt, jwt, hashlib, base64, json, logging, uuid, calendar as cal
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
PHONEPE_MERCHANT_ID = os.environ.get("PHONEPE_MERCHANT_ID", "PGTESTPAYUAT")
PHONEPE_SALT_KEY = os.environ.get("PHONEPE_SALT_KEY", "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399")
PHONEPE_SALT_INDEX = int(os.environ.get("PHONEPE_SALT_INDEX", "1"))
PHONEPE_API_ENDPOINT = os.environ.get("PHONEPE_API_ENDPOINT", "https://api-preprod.phonepe.com/apis/pg-sandbox")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")

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

# --- PhonePe Helpers ---
def generate_x_verify_initiate(payload_dict: dict, salt_key: str, salt_index: int):
    payload_json = json.dumps(payload_dict, separators=(',', ':'))
    payload_b64 = base64.b64encode(payload_json.encode()).decode()
    endpoint = "/v3/transaction/sdk-less/initiate"
    hash_hex = hashlib.sha256((payload_b64 + endpoint + salt_key).encode()).hexdigest()
    return f"{hash_hex}###{salt_index}", payload_b64

def generate_x_verify_status(merchant_id: str, txn_id: str, salt_key: str, salt_index: int) -> str:
    endpoint = f"/v3/transaction/{merchant_id}/{txn_id}/status"
    hash_hex = hashlib.sha256((endpoint + salt_key).encode()).hexdigest()
    return f"{hash_hex}###{salt_index}"

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

# ========== PAYMENT ROUTES ==========
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
    txn_id = f"TXN{str(uuid.uuid4())[:12].upper()}"
    redirect_url = f"{FRONTEND_URL}/payment/status?txnId={txn_id}"
    callback_url = f"{BACKEND_URL}/api/payments/webhook"

    checkout_url = None
    try:
        payload = {
            "merchantId": PHONEPE_MERCHANT_ID, "transactionId": txn_id,
            "merchantOrderId": merchant_order_id, "amount": amount_paise,
            "validFor": 900000, "redirectUrl": redirect_url
        }
        x_verify, payload_b64 = generate_x_verify_initiate(payload, PHONEPE_SALT_KEY, PHONEPE_SALT_INDEX)
        headers = {
            "Content-Type": "application/json",
            "X-VERIFY": x_verify,
            "X-CLIENT-ID": PHONEPE_MERCHANT_ID,
            "X-CALLBACK-URL": callback_url
        }
        async with httpx.AsyncClient(timeout=8.0) as c:
            resp = await c.post(
                f"{PHONEPE_API_ENDPOINT}/v3/transaction/sdk-less/initiate",
                json={"request": payload_b64}, headers=headers
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success"):
                checkout_url = data.get("data", {}).get("redirectUrl")
    except Exception as e:
        logger.warning(f"PhonePe API failed (using simulation): {e}")

    if not checkout_url:
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
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    await db.appointments.update_one(
        {"_id": ObjectId(body.appointment_id)},
        {"$set": {"transaction_id": txn_id}}
    )
    return {
        "checkout_url": checkout_url,
        "transaction_id": txn_id,
        "merchant_order_id": merchant_order_id,
        "is_simulation": "/simulate/" in checkout_url
    }

@api_router.get("/payments/status/{txn_id}")
async def get_payment_status(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn["_id"] = str(txn["_id"])
    if txn["payment_state"] == "PENDING":
        try:
            x_verify = generate_x_verify_status(PHONEPE_MERCHANT_ID, txn_id, PHONEPE_SALT_KEY, PHONEPE_SALT_INDEX)
            async with httpx.AsyncClient(timeout=8.0) as c:
                resp = await c.get(
                    f"{PHONEPE_API_ENDPOINT}/v3/transaction/{PHONEPE_MERCHANT_ID}/{txn_id}/status",
                    headers={"Content-Type": "application/json", "X-VERIFY": x_verify, "X-CLIENT-ID": PHONEPE_MERCHANT_ID}
                )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    new_state = data.get("data", {}).get("paymentState")
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
    try:
        body = await request.json()
        event = body.get("event", "")
        data = body.get("payload", body.get("data", {}))
        txn_id = data.get("merchantTransactionId") or data.get("transactionId")
        if event == "pg.transaction.completed" and txn_id:
            await db.transactions.update_one(
                {"transaction_id": txn_id},
                {"$set": {"payment_state": "COMPLETED", "updated_at": datetime.now(timezone.utc)}}
            )
            await db.appointments.update_one(
                {"transaction_id": txn_id},
                {"$set": {"status": "confirmed", "payment_status": "paid"}}
            )
        elif event in ["pg.transaction.failed", "pg.transaction.cancelled"] and txn_id:
            await db.transactions.update_one(
                {"transaction_id": txn_id},
                {"$set": {"payment_state": "FAILED", "updated_at": datetime.now(timezone.utc)}}
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
