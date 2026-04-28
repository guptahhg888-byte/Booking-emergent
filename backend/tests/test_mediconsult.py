"""MediConsult API Backend Tests - full flow coverage"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

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
    # Try to register (might already exist)
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
    """Authentication endpoint tests"""

    def test_register_new_user(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "newtest_register@test.com",
            "password": "Test@1234",
            "name": "New Test User"
        })
        # Either 200 (success) or 400 (already exists)
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


# --- DOCTOR TESTS ---
class TestDoctors:
    """Doctor listing and CRUD tests"""

    def test_list_doctors_public(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected at least 5 seeded doctors, got {len(data)}"

    def test_get_doctor_by_id(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        assert resp.status_code == 200
        doctors = resp.json()
        doctor_id = doctors[0]["_id"]
        detail_resp = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}")
        assert detail_resp.status_code == 200
        doc = detail_resp.json()
        assert doc["_id"] == doctor_id

    def test_get_available_slots(self):
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctors = resp.json()
        doctor_id = doctors[0]["_id"]
        slot_resp = requests.get(f"{BASE_URL}/api/doctors/{doctor_id}/available-slots", params={"date": "2025-06-15"})
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
        assert "_id" in data
        # Store for later cleanup
        TestDoctors.created_doctor_id = data["_id"]

    def test_create_doctor_unauthorized(self, user_headers):
        resp = requests.post(f"{BASE_URL}/api/doctors", json={
            "name": "Unauthorized Doc",
            "specialization": "Test",
            "qualification": "MBBS",
            "experience_years": 3
        }, headers=user_headers)
        assert resp.status_code == 403

    def test_update_doctor_as_admin(self, admin_headers):
        if not hasattr(TestDoctors, 'created_doctor_id'):
            pytest.skip("No doctor created to update")
        resp = requests.put(f"{BASE_URL}/api/doctors/{TestDoctors.created_doctor_id}",
                            json={"experience_years": 6}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["experience_years"] == 6

    def test_delete_doctor_as_admin(self, admin_headers):
        if not hasattr(TestDoctors, 'created_doctor_id'):
            pytest.skip("No doctor created to delete")
        resp = requests.delete(f"{BASE_URL}/api/doctors/{TestDoctors.created_doctor_id}", headers=admin_headers)
        assert resp.status_code == 200


# --- APPOINTMENT TESTS ---
class TestAppointments:
    """Appointment booking and management tests"""

    @pytest.fixture(scope="class", autouse=True)
    def setup_doctor(self, admin_headers):
        """Get a valid doctor ID for testing"""
        resp = requests.get(f"{BASE_URL}/api/doctors")
        TestAppointments.doctor_id = resp.json()[0]["_id"]

    def test_create_appointment(self, user_headers):
        resp = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": TestAppointments.doctor_id,
            "appointment_date": "2025-12-01",
            "appointment_time": "09:00",
            "notes": "Test appointment"
        }, headers=user_headers)
        assert resp.status_code == 200
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
        data = resp.json()
        assert isinstance(data, list)

    def test_get_appointment(self, user_headers):
        if not hasattr(TestAppointments, 'appointment_id'):
            pytest.skip("No appointment created")
        resp = requests.get(f"{BASE_URL}/api/appointments/{TestAppointments.appointment_id}", headers=user_headers)
        assert resp.status_code == 200

    def test_list_appointments_no_auth(self):
        resp = requests.get(f"{BASE_URL}/api/appointments")
        assert resp.status_code == 401


# --- PAYMENT TESTS ---
class TestPayments:
    """Payment initiation and simulation tests"""

    def test_initiate_payment(self, user_headers):
        # Create fresh appointment for payment
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctor_id = resp.json()[0]["_id"]
        appt_resp = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": doctor_id,
            "appointment_date": "2025-12-02",
            "appointment_time": "10:00"
        }, headers=user_headers)
        if appt_resp.status_code != 200:
            pytest.skip("Could not create appointment for payment test")
        appt_id = appt_resp.json()["_id"]

        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        assert pay_resp.status_code == 200
        data = pay_resp.json()
        assert "checkout_url" in data
        assert "transaction_id" in data
        TestPayments.txn_id = data["transaction_id"]
        # Should use simulation since real PhonePe UAT unavailable
        assert data["is_simulation"] == True or "simulate" in data["checkout_url"]

    def test_get_payment_status(self):
        if not hasattr(TestPayments, 'txn_id'):
            pytest.skip("No transaction created")
        resp = requests.get(f"{BASE_URL}/api/payments/status/{TestPayments.txn_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "payment_state" in data
        assert data["transaction_id"] == TestPayments.txn_id

    def test_simulate_payment_success(self):
        if not hasattr(TestPayments, 'txn_id'):
            pytest.skip("No transaction created")
        resp = requests.post(f"{BASE_URL}/api/payments/simulate/{TestPayments.txn_id}/success")
        assert resp.status_code == 200
        data = resp.json()
        assert data["transaction_id"] == TestPayments.txn_id

    def test_payment_status_after_success(self):
        if not hasattr(TestPayments, 'txn_id'):
            pytest.skip("No transaction created")
        resp = requests.get(f"{BASE_URL}/api/payments/status/{TestPayments.txn_id}")
        assert resp.status_code == 200
        assert resp.json()["payment_state"] == "COMPLETED"

    def test_simulate_payment_failure(self, user_headers):
        # Create another appointment for failure test
        resp = requests.get(f"{BASE_URL}/api/doctors")
        doctor_id = resp.json()[0]["_id"]
        appt_resp = requests.post(f"{BASE_URL}/api/appointments", json={
            "doctor_id": doctor_id,
            "appointment_date": "2025-12-03",
            "appointment_time": "11:00"
        }, headers=user_headers)
        if appt_resp.status_code != 200:
            pytest.skip("Could not create appointment")
        appt_id = appt_resp.json()["_id"]
        pay_resp = requests.post(f"{BASE_URL}/api/payments/initiate",
                                 json={"appointment_id": appt_id}, headers=user_headers)
        txn_id = pay_resp.json()["transaction_id"]
        fail_resp = requests.post(f"{BASE_URL}/api/payments/simulate/{txn_id}/failure")
        assert fail_resp.status_code == 200

    def test_payment_invalid_txn(self):
        resp = requests.get(f"{BASE_URL}/api/payments/status/INVALID_TXN_ID")
        assert resp.status_code == 404


# --- ADMIN TESTS ---
class TestAdmin:
    """Admin CRM endpoints"""

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
