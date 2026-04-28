"""Auth routes: email/password JWT + Emergent Google OAuth."""
import logging
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException, Depends

from core.config import EMERGENT_AUTH_SESSION_URL
from core.database import db
from core.deps import get_current_user
from core.models import RegisterRequest, LoginRequest, GoogleSessionRequest
from core.security import hash_password, verify_password, create_token
from services.activity import log_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(body: RegisterRequest):
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


@router.post("/google")
async def google_auth(body: GoogleSessionRequest):
    """Exchange Emergent session_id for app JWT."""
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": body.session_id},
            )
    except Exception as e:
        logger.error(f"Emergent auth call failed: {e}")
        raise HTTPException(status_code=502, detail="Auth provider unreachable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google session")

    data = resp.json()
    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or (email.split("@")[0] if email else "Google User")
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="No email from provider")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = str(existing["_id"])
        role = existing.get("role", "user")
        update = {
            "name": existing.get("name") or name,
            "picture": picture,
            "auth_provider": "google",
        }
        await db.users.update_one({"_id": existing["_id"]}, {"$set": update})
        await log_activity(user_id, update["name"], "USER_LOGIN", "Google")
    else:
        doc = {
            "email": email, "name": name, "picture": picture,
            "role": "user", "auth_provider": "google",
            "created_at": datetime.now(timezone.utc),
        }
        result = await db.users.insert_one(doc)
        user_id = str(result.inserted_id)
        role = "user"
        await log_activity(user_id, name, "USER_REGISTERED", f"Google signup: {email}")

    return {
        "token": create_token(user_id, email, role),
        "user": {"id": user_id, "email": email, "name": name, "role": role, "picture": picture},
    }
