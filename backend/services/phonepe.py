"""PhonePe v2 OAuth: token management + webhook signature validation."""
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import httpx

from core.config import (
    PHONEPE_AUTH_URL,
    PHONEPE_CLIENT_ID,
    PHONEPE_CLIENT_SECRET,
    PHONEPE_CLIENT_VERSION,
    PHONEPE_WEBHOOK_USERNAME,
    PHONEPE_WEBHOOK_PASSWORD,
)

logger = logging.getLogger(__name__)

_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": None}


async def get_phonepe_token() -> Optional[str]:
    """Fetch or reuse PhonePe OAuth access token. Returns None on failure."""
    now = datetime.now(timezone.utc)
    cached = _token_cache
    if (
        cached["access_token"]
        and cached["expires_at"]
        and now < cached["expires_at"] - timedelta(minutes=2)
    ):
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
            cached["expires_at"] = datetime.fromtimestamp(
                int(expires_at_epoch), tz=timezone.utc
            )
        else:
            cached["expires_at"] = now + timedelta(minutes=50)
        cached["access_token"] = access_token
        return access_token
    except Exception as e:
        logger.warning(f"PhonePe token fetch error: {e}")
        return None


def verify_webhook_auth(authorization_header: str) -> bool:
    """
    Verify webhook Authorization header against configured username:password.

    PhonePe v2 webhooks send Authorization: SHA256(username:password) where
    username/password are configured in the PhonePe Business Dashboard.

    If either credential is not configured (dev mode), skip validation.
    """
    if not PHONEPE_WEBHOOK_USERNAME or not PHONEPE_WEBHOOK_PASSWORD:
        # Dev mode — accept all webhooks. Logged by caller.
        return True
    if not authorization_header:
        return False
    expected = hashlib.sha256(
        f"{PHONEPE_WEBHOOK_USERNAME}:{PHONEPE_WEBHOOK_PASSWORD}".encode("utf-8")
    ).hexdigest()
    # Accept both raw hex and "SHA256 <hex>" prefixed forms to be resilient.
    provided = authorization_header.strip()
    if provided.lower().startswith("sha256 "):
        provided = provided[7:].strip()
    return provided.lower() == expected.lower()


def webhook_auth_required() -> bool:
    """True if webhook signature validation is enabled (both creds set)."""
    return bool(PHONEPE_WEBHOOK_USERNAME and PHONEPE_WEBHOOK_PASSWORD)
