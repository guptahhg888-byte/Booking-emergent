"""Pydantic request models."""
from typing import Optional, List
from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleSessionRequest(BaseModel):
    session_id: str


class DoctorCreate(BaseModel):
    name: str
    specialization: str
    qualification: str
    experience_years: int
    consultation_fee: float = 2000.0
    # Per-duration fees. If not set, falls back to consultation_fee.
    fee_45min: Optional[float] = None
    fee_60min: Optional[float] = None
    bio: Optional[str] = None
    image_url: Optional[str] = None
    available_days: List[str] = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    ]
    # Custom working hours (HH:MM 24h). Defaults kept for backward-compat.
    start_time: str = "09:00"
    end_time: str = "17:00"
    slot_duration_minutes: int = 30
    lunch_start: Optional[str] = "13:00"
    lunch_end: Optional[str] = "14:00"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class RescheduleRequest(BaseModel):
    appointment_date: str
    appointment_time: str


class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: str
    appointment_time: str
    duration_minutes: Optional[int] = None   # 45 or 60 (None = use doctor default)
    notes: Optional[str] = None


class PaymentInitiateRequest(BaseModel):
    appointment_id: str
