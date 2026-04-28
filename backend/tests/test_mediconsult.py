"""MediConsult API Backend Tests - full flow + PhonePe v2 OAuth + Google auth (Iter 3 refactor)"""
import pytest
import requests
import os
import json
import random
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def _unique_slot():
    """Return (date, time) tuple guaranteed unique to avoid seed-conflict 400s."""
    yr = random.randint(2030, 2040)
    mo = random.randint(1, 12)
    dy = random.randint(1, 28)
    hr = random.randint(8, 17)
    mn = random.choice(["00", "15", "30", "45"])
    return f"{yr:04d}-{mo:02d}-{dy:02d}", f"{hr:02d}:{mn}"

ADMIN_EMAIL = "admin@platform.com"
ADMIN_PASSWORD = "Admin@123"
TEST_USER_EMAIL = "testuser_api@test.com"
TEST_USER_PASSWORD = "Test@1234"
TEST_USER_NAME = "Test User API"


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD, "name": TEST_USER_NAME
    })
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD})
    assert resp.status_code == 200, f"User login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# --- AUTH TESTS ---
class TestAuth:
    def test_register_new_user(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "newtest_register@test.com",
            "password": "Test@1234",
            "name": "New Test User"
        })
        assert resp.status_code in [200, 400]
        if resp.status_code == 200:
            data = resp.json()
            assert "token" in data
            assert data["user"]["email"] == "newtest_register@test.com"
            assert data["user"]["role"] == "user"

    def test_admin_login(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"

    def test_login_invalid_credentials(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@test.com", "password": "wrongpass"})
        assert resp.status_code == 401

    def test_get_me_with_token(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_get_me_no_token(self):
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401

    def test_google_auth_invalid_session(self):
        """Google OAuth with invalid session_id must reject with 401"""
        resp = requests.post(f"{BASE_URL}/api/auth/google", json={"session_id": "INVALID_SESSION_ID_xyz"})
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"

    def test_google_auth_missing_session(self):
        resp = requests.post(f"{BASE_URL}/api/auth/google", json={})
        assert resp.status_code in [400, 422]


# --- DOCTOR TESTS ---
class TestDoctors:
    def test_list_doctors_public(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 5

    def test_get_doctor_by_id(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctors = resp.json()
        doctor_id = doctors[0]["_id"]
        detail_resp = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}")
        assert detail_resp.status_code == 200
        assert detail_resp.json()["_id"] == doctor_id

    def test_get_available_slots(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctor_id = resp.json()[0]["_id"]
        slot_resp = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}/available-slots", params={"date": "2026-06-15"})
        assert slot_resp.status_code == 200
        assert "available_slots" in slot_resp.json()

    def test_create_doctor_as_admin(self, admin_headers):
        resp = requests.post(f"{BASE_URL}/api/doctors", json={
            "name": "TEST_Dr. Backend Test",
            "specialization": "Test Specialty",
            "qualification": "MBBS",
            "experience_years": 5,
            "consultation_fee": 2000
        }, headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "TEST_Dr. Backend Test"
        TestDoctors.created_doctor_id = data["_id"]

    def test_create_doctor_unauthorized(self, user_headers):
        resp = requests.post(f"{BASE_URL}/api/doctors", json={
            "name": "Unauthorized Doc", "specialization": "Test",
            "qualification": "MBBS", "experience_years": 3
        }, headers=user_headers)
        assert resp.status_code == 403

    def test_update_doctor_as_admin(self, admin_headers):
        if not hasattr(TestDoctors, 'created_doctor_id'):
            pytest.skip("No doctor created")
        resp = requests.put(f"{BASE_URL}/api/doctors/{TestDoctors.created_doctor_id}",
                            json={"experience_years": 6}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["experience_years"] == 6

    def test_delete_doctor_as_admin(self, admin_headers):
        if not hasattr(TestDoctors, 'created_doctor_id'):
            pytest.skip("No doctor created")
        resp = requests.delete(f"{BASE_URL}/api/doctors/{TestDoctors.created_doctor_id}", headers=admin_headers)
        assert resp.status_code == 200


# --- APPOINTMENT TESTS ---
class TestAppointments:
    @pytest.fixture(scope="class", autouse=True)
    def setup_doctor(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        TestAppointments.doctor_id = resp.json()[0]["_id"]

    def test_create_appointment(self, user_headers):
        date, time = _unique_slot()
        resp = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": TestAppointments.doctor_id,
            "appointment_date": date,
            "appointment_time": time,
            "notes": "Test appointment"
        }, headers=user_headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "pending_payment"
        assert data["payment_status"] == "pending"
        TestAppointments.appointment_id = data["_id"]

    def test_list_appointments_user(self, user_headers):
        resp = requests.get(f"{BASE_URL}/api/appointments", headers=user_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_appointments_admin(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/appointments", headers=admin_headers)
        assert resp.status_code == 200

    def test_get_appointment(self, user_headers):
        if not hasattr(TestAppointments, 'appointment_id'):
            pytest.skip("No appointment")
        resp = requests.get(f"{BASE_URL}/api/appointments/{TestAppointments.appointment_id}", headers=user_headers)
        assert resp.status_code == 200

    def test_list_appointments_no_auth(self):
        resp = requests.get(f"{BASE_URL}/api/appointments")
        assert resp.status_code == 401


# --- PAYMENT TESTS (PhonePe v2 OAuth) ---
class TestPayments:
    """Verify PhonePe v2 OAuth real checkout URL + webhook"""

    def _create_appointment(self, user_headers, time=None, date=None):
        if not date or not time:
            date, time = _unique_slot()
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctor_id = resp.json()[0]["_id"]
        appt_resp = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": doctor_id,
            "appointment_date": date,
            "appointment_time": time
        }, headers=user_headers)
        assert appt_resp.status_code == 200, f"Appointment create failed: {appt_resp.text}"
        return appt_resp.json()["_id"]

    def test_initiate_payment_real_phonepe_v2(self, user_headers):
        """v2 OAuth must return a real mercury-uat.phonepe.com checkout URL (is_simulation=false)"""
        appt_id = self._create_appointment(user_headers)
        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        assert pay_resp.status_code == 200, f"Payment initiate failed: {pay_resp.text}"
        data = pay_resp.json()
        assert "checkout_url" in data
        assert "transaction_id" in data
        assert "merchant_order_id" in data
        TestPayments.txn_id = data["transaction_id"]
        TestPayments.merchant_order_id = data["merchant_order_id"]
        TestPayments.checkout_url = data["checkout_url"]
        TestPayments.is_simulation = data["is_simulation"]
        # Critical: must be real PhonePe URL, not simulation fallback
        assert data["is_simulation"] is False, (
            f"Expected real PhonePe URL but got simulation. checkout_url={data['checkout_url']}"
        )
        assert "mercury-uat.phonepe.com" in data["checkout_url"] or "phonepe.com" in data["checkout_url"], (
            f"checkout_url is not a PhonePe domain: {data['checkout_url']}"
        )

    def test_get_payment_status_pending(self):
        if not hasattr(TestPayments, 'txn_id'):
            pytest.skip("No transaction")
        resp = requests.get(f"{BASE_URL}/api/payments/status/{TestPayments.txn_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["transaction_id"] == TestPayments.txn_id
        assert data["merchant_order_id"] == TestPayments.merchant_order_id
        # State should be PENDING since payment hasn't been completed at PhonePe side
        assert data["payment_state"] in ["PENDING", "COMPLETED", "FAILED"]

    def test_webhook_marks_completed(self, user_headers):
        """Webhook with v2 event must mark transaction COMPLETED + appointment confirmed"""
        # Create fresh appt + payment so we have a clean transaction
        appt_id = self._create_appointment(user_headers)
        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        assert pay_resp.status_code == 200
        merchant_order_id = pay_resp.json()["merchant_order_id"]
        txn_id = pay_resp.json()["transaction_id"]

        # Send v2 webhook payload
        webhook_body = {
            "event": "checkout.order.completed",
            "payload": {
                "merchantOrderId": merchant_order_id,
                "state": "COMPLETED",
                "amount": 200000,
            }
        }
        wh_resp = requests.post(f"{BASE_URL}/api/payments/webhook", json=webhook_body)
        assert wh_resp.status_code == 200, f"Webhook failed: {wh_resp.text}"
        assert wh_resp.json().get("status") == "received"

        # Verify transaction state is COMPLETED
        status_resp = requests.get(f"{BASE_URL}/api/payments/status/{txn_id}")
        assert status_resp.status_code == 200
        assert status_resp.json()["payment_state"] == "COMPLETED", (
            f"Webhook did not mark COMPLETED: {status_resp.json()}"
        )

        # Verify appointment confirmed
        appt_resp = requests.get(f"{BASE_URL}/api/appointments/{appt_id}", headers=user_headers)
        assert appt_resp.status_code == 200
        appt_data = appt_resp.json()
        assert appt_data["status"] == "confirmed", f"Appointment not confirmed: {appt_data}"
        assert appt_data["payment_status"] == "paid"

    def test_webhook_marks_failed(self, user_headers):
        """Webhook with FAILED state must mark transaction FAILED + appointment cancelled"""
        appt_id = self._create_appointment(user_headers)
        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        merchant_order_id = pay_resp.json()["merchant_order_id"]
        txn_id = pay_resp.json()["transaction_id"]

        webhook_body = {
            "event": "checkout.order.failed",
            "payload": {"merchantOrderId": merchant_order_id, "state": "FAILED"}
        }
        wh_resp = requests.post(f"{BASE_URL}/api/payments/webhook", json=webhook_body)
        assert wh_resp.status_code == 200

        status_resp = requests.get(f"{BASE_URL}/api/payments/status/{txn_id}")
        assert status_resp.json()["payment_state"] == "FAILED"

    def test_payment_invalid_txn(self):
        resp = requests.get(f"{BASE_URL}/api/payments/status/INVALID_TXN_ID")
        assert resp.status_code == 404

    def test_simulate_endpoint_still_works(self, user_headers):
        """Legacy simulate endpoints should still function"""
        appt_id = self._create_appointment(user_headers)
        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        txn_id = pay_resp.json()["transaction_id"]
        ok_resp = requests.post(f"{BASE_URL}/api/payments/simulate/{txn_id}/success")
        assert ok_resp.status_code == 200


# --- ADMIN TESTS ---
class TestAdmin:
    def test_get_admin_stats(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_doctors" in data
        assert "total_appointments" in data
        assert "total_users" in data
        assert "total_revenue" in data

    def test_admin_stats_unauthorized(self, user_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/stats", headers=user_headers)
        assert resp.status_code == 403

    def test_list_users_admin(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_transactions_admin(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/transactions", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_activity_logs(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/activity", headers=admin_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)



# --- WEBHOOK SIGNATURE VALIDATION (NEW iter 3) ---
class TestWebhookSignature:
    """Verifies dev-mode (empty creds) webhook accepts unauthenticated POST.

    NOTE: With PHONEPE_WEBHOOK_USERNAME / PHONEPE_WEBHOOK_PASSWORD blank in
    .env (current state), the webhook endpoint must accept ANY POST and
    return 200 {status:received|ignored}. Enforcement is only enabled when
    both env vars are set.
    """

    def test_webhook_dev_mode_no_auth_header(self):
        resp = requests.post(f"{BASE_URL}/api/payments/webhook", json={
            "event": "checkout.order.completed",
            "payload": {"merchantOrderId": "FAKE_TEST_ID_NOT_EXIST", "state": "COMPLETED"}
        })
        assert resp.status_code == 200, f"Dev-mode webhook must accept: {resp.text}"
        # Unknown order id -> ignored, but still 200
        assert resp.json().get("status") in ("received", "ignored")

    def test_webhook_dev_mode_with_random_auth_header(self):
        # Even garbage auth header should be accepted in dev mode
        resp = requests.post(
            f"{BASE_URL}/api/payments/webhook",
            json={"event": "test", "payload": {}},
            headers={"Authorization": "garbage_signature"},
        )
        assert resp.status_code == 200
