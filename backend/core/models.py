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
    bio: Optional[str] = None
    image_url: Optional[str] = None
    available_days: List[str] = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    ]


class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: str
    appointment_time: str
    notes: Optional[str] = None


class PaymentInitiateRequest(BaseModel):
    appointment_id: str
