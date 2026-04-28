"""Payment routes using PhonePe v2 OAuth + webhook (signature-validated)."""
import base64
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

import httpx
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, Request

from core.config import FRONTEND_URL, PHONEPE_ENV, PHONEPE_PAY_URL, PHONEPE_STATUS_BASE
from core.database import db
from core.deps import get_current_user
from core.models import PaymentInitiateRequest
from services.activity import log_activity
from services.phonepe import (
    get_phonepe_token,
    verify_webhook_auth,
    webhook_auth_required,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/initiate")
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
        {"$set": {"transaction_id": txn_id}},
    )
    return {
        "checkout_url": checkout_url,
        "transaction_id": txn_id,
        "merchant_order_id": merchant_order_id,
        "is_simulation": "/simulate/" in checkout_url,
    }


@router.get("/status/{txn_id}")
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
                    new_state = data.get("state") or data.get("data", {}).get("state")
                    if new_state in ["COMPLETED", "FAILED"]:
                        await db.transactions.update_one(
                            {"transaction_id": txn_id},
                            {"$set": {"payment_state": new_state, "updated_at": datetime.now(timezone.utc)}},
                        )
                        txn["payment_state"] = new_state
                        if new_state == "COMPLETED":
                            await db.appointments.update_one(
                                {"transaction_id": txn_id},
                                {"$set": {"status": "confirmed", "payment_status": "paid"}},
                            )
                        else:
                            await db.appointments.update_one(
                                {"transaction_id": txn_id},
                                {"$set": {"status": "cancelled", "payment_status": "failed"}},
                            )
            except Exception as e:
                logger.warning(f"PhonePe status check failed: {e}")
    return txn


@router.post("/simulate/{txn_id}/success")
async def simulate_success(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    prov_ref = f"SIM{str(uuid.uuid4())[:8].upper()}"
    await db.transactions.update_one(
        {"transaction_id": txn_id},
        {"$set": {
            "payment_state": "COMPLETED", "payment_mode": "UPI_SIMULATE",
            "provider_reference_id": prov_ref, "updated_at": datetime.now(timezone.utc),
        }},
    )
    appt = await db.appointments.find_one({"transaction_id": txn_id})
    if appt:
        await db.appointments.update_one(
            {"transaction_id": txn_id},
            {"$set": {"status": "confirmed", "payment_status": "paid"}},
        )
        await log_activity(
            txn["user_id"], "Patient", "PAYMENT_SUCCESS",
            f"Appointment confirmed for {appt.get('doctor_name', '')}",
        )
    return {"message": "Payment simulated successfully", "transaction_id": txn_id, "provider_reference_id": prov_ref}


@router.post("/simulate/{txn_id}/failure")
async def simulate_failure(txn_id: str):
    txn = await db.transactions.find_one({"transaction_id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.transactions.update_one(
        {"transaction_id": txn_id},
        {"$set": {"payment_state": "FAILED", "updated_at": datetime.now(timezone.utc)}},
    )
    await db.appointments.update_one(
        {"transaction_id": txn_id},
        {"$set": {"status": "cancelled", "payment_status": "failed"}},
    )
    return {"message": "Payment failed", "transaction_id": txn_id}


@router.post("/webhook")
async def phonepe_webhook(request: Request):
    """
    PhonePe v2 webhook with signature validation.

    When PHONEPE_WEBHOOK_USERNAME and PHONEPE_WEBHOOK_PASSWORD are set in env,
    incoming webhooks must include `Authorization: <SHA256(username:password)>`.
    When either is empty (dev mode), validation is skipped (logged as warning).

    Always responds 200 to acknowledge receipt (prevents infinite retries).
    """
    auth_header = request.headers.get("Authorization", "")
    if webhook_auth_required() and not verify_webhook_auth(auth_header):
        logger.warning("PhonePe webhook rejected: invalid Authorization signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    if not webhook_auth_required():
        logger.warning("PhonePe webhook auth is DISABLED (dev mode). Set PHONEPE_WEBHOOK_USERNAME/PASSWORD before production.")

    try:
        raw = await request.body()
        body: Dict[str, Any] = {}
        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            body = {}

        # Legacy base64-wrapped payload support
        if "response" in body and isinstance(body["response"], str):
            try:
                decoded = base64.b64decode(body["response"]).decode("utf-8")
                body = json.loads(decoded)
            except Exception:
                pass

        event = body.get("event", "")
        payload = body.get("payload") or body.get("data") or {}
        merchant_order_id = payload.get("merchantOrderId") or payload.get("merchantTransactionId")
        state = (payload.get("state") or "").upper()

        if not merchant_order_id:
            return {"status": "ignored"}

        is_success = state == "COMPLETED" or "completed" in event.lower() or "success" in event.lower()
        is_failure = state in ("FAILED", "CANCELLED") or "failed" in event.lower() or "cancel" in event.lower()

        if is_success:
            await db.transactions.update_one(
                {"merchant_order_id": merchant_order_id},
                {"$set": {"payment_state": "COMPLETED", "updated_at": datetime.now(timezone.utc)}},
            )
            await db.appointments.update_one(
                {"transaction_id": merchant_order_id},
                {"$set": {"status": "confirmed", "payment_status": "paid"}},
            )
        elif is_failure:
            await db.transactions.update_one(
                {"merchant_order_id": merchant_order_id},
                {"$set": {"payment_state": "FAILED", "updated_at": datetime.now(timezone.utc)}},
            )
            await db.appointments.update_one(
                {"transaction_id": merchant_order_id},
                {"$set": {"status": "cancelled", "payment_status": "failed"}},
            )
        return {"status": "received"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}
