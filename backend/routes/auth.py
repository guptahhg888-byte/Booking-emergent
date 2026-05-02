"""Auth routes: email/password JWT + Emergent Google OAuth."""
import logging
import random
import jwt
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, HTTPException, Depends

from core.database import db
from core.config import JWT_SECRET, JWT_ALGORITHM
from core.deps import get_current_user
from core.models import RegisterRequest, LoginRequest, ProfileUpdate
from core.security import hash_password, verify_password, create_token
from services.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

def verify_captcha(token: str, answer: str):
    if not token or not answer:
        raise HTTPException(status_code=400, detail="CAPTCHA is required")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if str(payload.get("answer")) != str(answer).strip():
            raise HTTPException(status_code=400, detail="Incorrect CAPTCHA answer")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="CAPTCHA expired. Please try again.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CAPTCHA token")

@router.get("/captcha")
async def get_captcha():
    a = random.randint(1, 10)
    b = random.randint(1, 10)
    operator = random.choice(["+", "-"])
    if operator == "-":
        if a < b:
            a, b = b, a # Ensure positive answer
        ans = a - b
    else:
        ans = a + b
    
    payload = {
        "answer": ans,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"question": f"{a} {operator} {b} = ?", "token": token}


@router.post("/register")
async def register(body: RegisterRequest):
    verify_captcha(body.captcha_token, body.captcha_answer)
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "user",
        "phone": body.phone,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)
    await log_activity(user_id, body.name, "USER_REGISTERED", f"New user: {email}")
    return {
        "token": create_token(user_id, email, "user"),
        "user": {"id": user_id, "email": email, "name": body.name, "role": "user", "phone": body.phone},
    }


@router.post("/login")
async def login(body: LoginRequest):
    verify_captcha(body.captcha_token, body.captcha_answer)
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    role = user.get("role", "user")
    await log_activity(user_id, user.get("name", email), "USER_LOGIN")
    return {
        "token": create_token(user_id, email, role),
        "user": {
            "id": user_id, "email": email,
            "name": user.get("name", ""), "role": role, "phone": user.get("phone"),
        },
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.patch("/profile")
async def update_profile(body: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Patient profile editor — updates name, phone, address. Email is locked (identity)."""
    from bson import ObjectId
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        return current_user
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": updates},
    )
    await log_activity(current_user["_id"], current_user.get("name", ""), "PROFILE_UPDATED",
                       ", ".join(updates.keys()))
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user



