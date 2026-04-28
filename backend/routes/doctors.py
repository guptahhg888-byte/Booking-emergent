"""Doctor CRUD + availability."""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from core.database import db
from core.deps import get_admin_user
from core.models import DoctorCreate
from services.activity import log_activity

router = APIRouter(prefix="/doctors", tags=["doctors"])

_ALL_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00",
]


@router.get("")
async def list_doctors(search: Optional[str] = None):
    query: Dict[str, Any] = {"is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"specialization": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.doctors.find(query).to_list(100)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@router.get("/{doctor_id}/available-slots")
async def get_available_slots(doctor_id: str, date: str):
    booked = await db.appointments.find(
        {
            "doctor_id": doctor_id,
            "appointment_date": date,
            "status": {"$nin": ["cancelled"]},
        },
        {"appointment_time": 1},
    ).to_list(100)
    booked_times = {a["appointment_time"] for a in booked}
    return {"available_slots": [s for s in _ALL_SLOTS if s not in booked_times]}


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str):
    try:
        doc = await db.doctors.find_one({"_id": ObjectId(doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("")
async def create_doctor(body: DoctorCreate, admin: dict = Depends(get_admin_user)):
    doc = body.model_dump()
    doc.update({
        "is_active": True,
        "rating": 4.5,
        "total_reviews": 0,
        "created_at": datetime.now(timezone.utc),
    })
    result = await db.doctors.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await log_activity(admin["_id"], admin["name"], "DOCTOR_ADDED", f"Added: {body.name}")
    return doc


@router.put("/{doctor_id}")
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


@router.delete("/{doctor_id}")
async def delete_doctor(doctor_id: str, admin: dict = Depends(get_admin_user)):
    try:
        result = await db.doctors.delete_one({"_id": ObjectId(doctor_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await log_activity(admin["_id"], admin["name"], "DOCTOR_DELETED", f"ID: {doctor_id}")
    return {"message": "Doctor deleted"}
