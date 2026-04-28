"""Appointment CRUD."""
from datetime import datetime, timezone
from typing import Any, Dict
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from core.database import db
from core.deps import get_current_user, get_admin_user
from core.models import AppointmentCreate, RescheduleRequest
from services.activity import log_activity

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("")
async def create_appointment(body: AppointmentCreate, current_user: dict = Depends(get_current_user)):
    try:
        doctor = await db.doctors.find_one({"_id": ObjectId(body.doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    existing = await db.appointments.find_one({
        "doctor_id": body.doctor_id,
        "appointment_date": body.appointment_date,
        "appointment_time": body.appointment_time,
        "status": {"$nin": ["cancelled"]},
    })
    if existing:
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    user_id = current_user["_id"]
    appt = {
        "user_id": user_id,
        "doctor_id": body.doctor_id,
        "doctor_name": doctor["name"],
        "patient_name": current_user["name"],
        "patient_email": current_user["email"],
        "patient_phone": current_user.get("phone"),
        "appointment_date": body.appointment_date,
        "appointment_time": body.appointment_time,
        "status": "pending_payment",
        "payment_status": "pending",
        "transaction_id": None,
        "consultation_fee": doctor.get("consultation_fee", 2000),
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.appointments.insert_one(appt)
    appt["_id"] = str(result.inserted_id)
    await log_activity(
        user_id, current_user["name"], "APPOINTMENT_CREATED",
        f"With {doctor['name']} on {body.appointment_date} at {body.appointment_time}",
    )
    return appt


@router.get("")
async def list_appointments(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") == "admin":
        appts = await db.appointments.find().sort("created_at", -1).to_list(500)
    else:
        appts = await db.appointments.find({"user_id": current_user["_id"]}).sort("created_at", -1).to_list(200)
    for a in appts:
        a["_id"] = str(a["_id"])
    return appts


@router.get("/{appt_id}")
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


@router.put("/{appt_id}")
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


@router.delete("/{appt_id}")
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


@router.put("/{appt_id}/reschedule")
async def reschedule_appointment(
    appt_id: str, body: RescheduleRequest, current_user: dict = Depends(get_current_user)
):
    """Patient or admin can reschedule an upcoming confirmed/pending_payment appointment."""
    try:
        appt = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    is_admin = current_user.get("role") == "admin"
    if not is_admin and appt["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if appt["status"] not in ("confirmed", "pending_payment"):
        raise HTTPException(status_code=400, detail="Only upcoming appointments can be rescheduled")

    # Reject past slots
    try:
        target = datetime.strptime(f"{body.appointment_date} {body.appointment_time}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format")
    if target < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot reschedule to a past slot")

    # Don't clash with another appointment on the same doctor+date+time (excluding self)
    clash = await db.appointments.find_one({
        "_id": {"$ne": ObjectId(appt_id)},
        "doctor_id": appt["doctor_id"],
        "appointment_date": body.appointment_date,
        "appointment_time": body.appointment_time,
        "status": {"$nin": ["cancelled"]},
    })
    if clash:
        raise HTTPException(status_code=400, detail="This time slot is already booked")

    old = f"{appt['appointment_date']} {appt['appointment_time']}"
    await db.appointments.update_one(
        {"_id": ObjectId(appt_id)},
        {"$set": {
            "appointment_date": body.appointment_date,
            "appointment_time": body.appointment_time,
            "rescheduled_at": datetime.now(timezone.utc),
        }},
    )
    await log_activity(
        current_user["_id"], current_user.get("name", ""), "APPOINTMENT_RESCHEDULED",
        f"{appt.get('doctor_name', '')}: {old} → {body.appointment_date} {body.appointment_time}",
    )
    updated = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    updated["_id"] = str(updated["_id"])
    return updated
