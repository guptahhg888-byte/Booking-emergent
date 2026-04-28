"""Iteration 4 NEW feature tests:
1. Doctor custom working hours (start_time/end_time/slot_duration/lunch)
2. Patient profile PATCH /api/auth/profile
3. Appointment reschedule PUT /api/appointments/{id}/reschedule
"""
import os
import random
import requests
import pytest
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@platform.com"
ADMIN_PASSWORD = "Admin@123"
USER_EMAIL = "iter4_user@test.com"
USER_PASSWORD = "Test@1234"
USER_NAME = "Iter4 User"


def _future_date(days_ahead=30):
    return (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def user_headers():
    requests.post(f"{BASE_URL}/api/auth/register", json={"email": USER_EMAIL, "password": USER_PASSWORD, "name": USER_NAME})
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def user2_headers():
    email = "iter4_user2@test.com"
    requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": USER_PASSWORD, "name": "Iter4 User2"})
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": USER_PASSWORD})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---- 1. Custom doctor hours ----
class TestCustomHours:
    def test_create_doctor_custom_hours_and_slots(self, admin_headers):
        payload = {
            "name": "TEST_Dr_CustomHours",
            "specialization": "TestSpec",
            "qualification": "MBBS",
            "experience_years": 5,
            "consultation_fee": 1500,
            "start_time": "10:00",
            "end_time": "12:30",
            "slot_duration_minutes": 30,
            "lunch_start": "11:00",
            "lunch_end": "11:30",
        }
        r = requests.post(f"{BASE_URL}/api/doctors", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["start_time"] == "10:00"
        assert d["lunch_start"] == "11:00"
        TestCustomHours.doc_id = d["_id"]

        date = _future_date(45)
        s = requests.get(f"{BASE_URL}/api/doctors/{d['_id']}/available-slots", params={"date": date})
        assert s.status_code == 200
        slots = s.json()["available_slots"]
        # Expected: 10:00, 10:30 (skip 11:00 lunch), 11:30, 12:00 — 12:30 excluded (would end at 13:00 > end)
        assert slots == ["10:00", "10:30", "11:30", "12:00"], f"Got {slots}"

    def test_legacy_doctor_default_slots(self):
        # Seeded doctors have no custom fields → fallback 09-17 / 30 / 13-14 lunch
        r = requests.get(f"{BASE_URL}/api/doctors")
        doctors = r.json()
        legacy = next((d for d in doctors if not str(d["name"]).startswith("TEST_")), None)
        assert legacy is not None
        s = requests.get(f"{BASE_URL}/api/doctors/{legacy['_id']}/available-slots", params={"date": _future_date(60)})
        assert s.status_code == 200
        slots = s.json()["available_slots"]
        assert "09:00" in slots
        assert "13:00" not in slots  # lunch
        assert "13:30" not in slots
        assert "16:30" in slots
        assert len(slots) >= 14

    def test_cleanup_custom_doc(self, admin_headers):
        if hasattr(TestCustomHours, "doc_id"):
            requests.delete(f"{BASE_URL}/api/doctors/{TestCustomHours.doc_id}", headers=admin_headers)


# ---- 2. Profile PATCH ----
class TestProfile:
    def test_patch_profile_no_auth(self):
        r = requests.patch(f"{BASE_URL}/api/auth/profile", json={"name": "Hacker"})
        assert r.status_code == 401

    def test_patch_profile_updates_fields(self, user_headers):
        r = requests.patch(f"{BASE_URL}/api/auth/profile", json={
            "name": "Iter4 Updated",
            "phone": "+919999988888",
            "address": "221B Baker Street",
        }, headers=user_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "Iter4 Updated"
        assert d["phone"] == "+919999988888"
        assert d["address"] == "221B Baker Street"
        assert "password_hash" not in d
        assert isinstance(d["_id"], str)

        # Verify GET /me reflects update
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=user_headers).json()
        assert me["name"] == "Iter4 Updated"
        assert me["phone"] == "+919999988888"

    def test_patch_profile_email_locked(self, user_headers):
        # email should not be changeable - even if sent, it must be ignored (extra field)
        r = requests.patch(f"{BASE_URL}/api/auth/profile", json={
            "email": "hijacked@test.com",
            "name": "Iter4 Updated2",
        }, headers=user_headers)
        # Pydantic ignores extra fields by default → 200, name updated, email unchanged
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == USER_EMAIL  # original
        assert d["name"] == "Iter4 Updated2"


# ---- 3. Reschedule ----
class TestReschedule:
    @pytest.fixture(scope="class", autouse=True)
    def setup(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/doctors")
        TestReschedule.doctor_id = r.json()[0]["_id"]
        # Create an appointment in future
        TestReschedule.date1 = _future_date(40)
        TestReschedule.time1 = f"{random.randint(9, 11):02d}:00"
        ar = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": TestReschedule.doctor_id,
            "appointment_date": TestReschedule.date1,
            "appointment_time": TestReschedule.time1,
        }, headers=user_headers)
        assert ar.status_code == 200, ar.text
        TestReschedule.appt_id = ar.json()["_id"]

    def test_reschedule_to_future_slot(self, user_headers):
        new_date = _future_date(50)
        new_time = "15:00"
        r = requests.put(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}/reschedule",
                         json={"appointment_date": new_date, "appointment_time": new_time},
                         headers=user_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["appointment_date"] == new_date
        assert d["appointment_time"] == new_time
        # GET to verify persistence
        g = requests.get(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}", headers=user_headers)
        assert g.json()["appointment_date"] == new_date

    def test_reschedule_past_slot_rejected(self, user_headers):
        r = requests.put(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}/reschedule",
                         json={"appointment_date": "2020-01-01", "appointment_time": "10:00"},
                         headers=user_headers)
        assert r.status_code == 400
        assert "past" in r.json()["detail"].lower()

    def test_reschedule_clash_rejected(self, user_headers, user2_headers):
        # User2 books another slot on same doctor
        clash_date = _future_date(55)
        clash_time = "14:00"
        ar = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": TestReschedule.doctor_id,
            "appointment_date": clash_date,
            "appointment_time": clash_time,
        }, headers=user2_headers)
        assert ar.status_code == 200
        # User1 tries to reschedule into same slot
        r = requests.put(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}/reschedule",
                         json={"appointment_date": clash_date, "appointment_time": clash_time},
                         headers=user_headers)
        assert r.status_code == 400
        assert "booked" in r.json()["detail"].lower()

    def test_reschedule_non_owner_forbidden(self, user2_headers):
        r = requests.put(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}/reschedule",
                         json={"appointment_date": _future_date(70), "appointment_time": "10:00"},
                         headers=user2_headers)
        assert r.status_code == 403

    def test_admin_can_reschedule(self, admin_headers):
        new_date = _future_date(80)
        r = requests.put(f"{BASE_URL}/api/appointments/{TestReschedule.appt_id}/reschedule",
                         json={"appointment_date": new_date, "appointment_time": "16:00"},
                         headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["appointment_date"] == new_date

    def test_reschedule_cancelled_rejected(self, user_headers, admin_headers):
        # Create + cancel a fresh appointment
        ar = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": TestReschedule.doctor_id,
            "appointment_date": _future_date(90),
            "appointment_time": "11:30",
        }, headers=user_headers)
        assert ar.status_code == 200
        new_id = ar.json()["_id"]
        cancel = requests.delete(f"{BASE_URL}/api/appointments/{new_id}", headers=user_headers)
        assert cancel.status_code == 200
        # Try to reschedule cancelled
        r = requests.put(f"{BASE_URL}/api/appointments/{new_id}/reschedule",
                         json={"appointment_date": _future_date(95), "appointment_time": "12:00"},
                         headers=user_headers)
        assert r.status_code == 400
        assert "upcoming" in r.json()["detail"].lower()
