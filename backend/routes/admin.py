"""Admin analytics + management routes."""
import calendar as cal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from core.database import db
from core.deps import get_admin_user

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_doctors = await db.doctors.count_documents({})
    total_appointments = await db.appointments.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    rev_result = await db.transactions.aggregate([
        {"$match": {"payment_state": "COMPLETED"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_revenue = rev_result[0]["total"] / 100 if rev_result else 0

    confirmed = await db.appointments.count_documents({"status": "confirmed"})
    pending = await db.appointments.count_documents({"status": "pending_payment"})
    cancelled = await db.appointments.count_documents({"status": "cancelled"})
    completed = await db.appointments.count_documents({"status": "completed"})

    now = datetime.now(timezone.utc)
    monthly_data = []
    for i in range(5, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        last_day = cal.monthrange(year, month)[1]
        start = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
        end = datetime(year, month, last_day, 23, 59, 59, tzinfo=timezone.utc)
        month_name = start.strftime("%b")
        rev = await db.transactions.aggregate([
            {"$match": {"payment_state": "COMPLETED", "created_at": {"$gte": start, "$lte": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(1)
        appts_count = await db.appointments.count_documents(
            {"created_at": {"$gte": start, "$lte": end}}
        )
        monthly_data.append({
            "month": month_name,
            "revenue": rev[0]["total"] / 100 if rev else 0,
            "appointments": appts_count,
        })

    return {
        "total_doctors": total_doctors,
        "total_appointments": total_appointments,
        "total_users": total_users,
        "total_revenue": total_revenue,
        "appointment_stats": {
            "confirmed": confirmed, "pending": pending,
            "cancelled": cancelled, "completed": completed,
        },
        "monthly_data": monthly_data,
    }


@router.get("/activity")
async def get_activity_logs(admin: dict = Depends(get_admin_user)):
    logs = await db.activity_logs.find().sort("timestamp", -1).limit(50).to_list(50)
    for log in logs:
        log["_id"] = str(log["_id"])
        if isinstance(log.get("timestamp"), datetime):
            log["timestamp"] = log["timestamp"].isoformat()
    return logs


@router.get("/users")
async def list_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    for u in users:
        u["_id"] = str(u["_id"])
        if isinstance(u.get("created_at"), datetime):
            u["created_at"] = u["created_at"].isoformat()
    return users


@router.get("/transactions")
async def list_transactions(admin: dict = Depends(get_admin_user)):
    txns = await db.transactions.find().sort("created_at", -1).to_list(500)
    for t in txns:
        t["_id"] = str(t["_id"])
        for k in ["created_at", "updated_at"]:
            if isinstance(t.get(k), datetime):
                t[k] = t[k].isoformat()
    return txns
