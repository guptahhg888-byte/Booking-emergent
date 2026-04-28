"""Database seeding + index creation on startup."""
import logging
from datetime import datetime, timezone
from core.config import ADMIN_EMAIL, ADMIN_PASSWORD
from core.database import db
from core.security import hash_password, verify_password

logger = logging.getLogger(__name__)

SAMPLE_DOCTORS = [
    {
        "name": "Dr. Priya Sharma",
        "specialization": "Cardiologist",
        "qualification": "MBBS, MD (Cardiology), DM",
        "experience_years": 15,
        "consultation_fee": 2000,
        "bio": "Dr. Priya Sharma is a renowned cardiologist with 15 years of experience treating complex cardiac conditions. She has performed over 5000 consultations and is known for her patient-first approach and cutting-edge treatment protocols.",
        "image_url": "https://images.pexels.com/photos/7578806/pexels-photo-7578806.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "is_active": True, "rating": 4.9, "total_reviews": 312,
    },
    {
        "name": "Dr. Rahul Verma",
        "specialization": "Neurologist",
        "qualification": "MBBS, MD (Neurology), DM",
        "experience_years": 12,
        "consultation_fee": 2000,
        "bio": "Dr. Rahul Verma specializes in neurological disorders including epilepsy, migraine, and Parkinson's disease. With 12 years of expertise, he brings advanced diagnostic and treatment options to his patients.",
        "image_url": "https://images.pexels.com/photos/4761779/pexels-photo-4761779.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Wednesday", "Friday"],
        "is_active": True, "rating": 4.7, "total_reviews": 198,
    },
    {
        "name": "Dr. Anita Mehta",
        "specialization": "Dermatologist",
        "qualification": "MBBS, MD (Dermatology)",
        "experience_years": 10,
        "consultation_fee": 2000,
        "bio": "Dr. Anita Mehta is a highly skilled dermatologist specializing in skin disorders, cosmetic procedures, and hair treatment. She has helped thousands of patients achieve healthy, glowing skin with personalized care plans.",
        "image_url": "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Tuesday", "Thursday", "Saturday"],
        "is_active": True, "rating": 4.8, "total_reviews": 267,
    },
    {
        "name": "Dr. Suresh Nair",
        "specialization": "Orthopedic Surgeon",
        "qualification": "MBBS, MS (Orthopaedics), MCh",
        "experience_years": 18,
        "consultation_fee": 2000,
        "bio": "Dr. Suresh Nair is a leading orthopedic surgeon with 18 years of experience in joint replacement, sports injuries, and spine surgery. Known for minimally invasive techniques with faster recovery times.",
        "image_url": "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday"],
        "is_active": True, "rating": 4.9, "total_reviews": 445,
    },
    {
        "name": "Dr. Kavitha Rao",
        "specialization": "Pediatrician",
        "qualification": "MBBS, MD (Pediatrics), DCH",
        "experience_years": 8,
        "consultation_fee": 2000,
        "bio": "Dr. Kavitha Rao is a compassionate pediatrician dedicated to the health and well-being of children from newborn to adolescence. Special expertise in developmental pediatrics and childhood nutrition.",
        "image_url": "https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?auto=compress&cs=tinysrgb&w=300",
        "available_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "is_active": True, "rating": 4.8, "total_reviews": 189,
    },
]


async def seed_admin() -> None:
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Platform Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
        )
        logger.info("Admin password updated")


async def seed_sample_doctors() -> None:
    count = await db.doctors.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc)
        docs = [{**d, "created_at": now} for d in SAMPLE_DOCTORS]
        await db.doctors.insert_many(docs)
        logger.info(f"Seeded {len(docs)} sample doctors")


async def ensure_indexes() -> None:
    """Create indexes on hot-path fields for list/filter/auth queries."""
    await db.users.create_index("email", unique=True)
    await db.doctors.create_index("is_active")
    await db.doctors.create_index("specialization")
    await db.appointments.create_index("user_id")
    await db.appointments.create_index("doctor_id")
    await db.appointments.create_index("status")
    await db.appointments.create_index("transaction_id")
    await db.appointments.create_index([("doctor_id", 1), ("appointment_date", 1)])
    await db.transactions.create_index("transaction_id", unique=True)
    await db.transactions.create_index("merchant_order_id")
    await db.transactions.create_index("user_id")
    await db.transactions.create_index([("created_at", -1)])
    await db.activity_logs.create_index([("timestamp", -1)])
    logger.info("MongoDB indexes ensured")
