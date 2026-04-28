"""Activity log helper."""
from datetime import datetime, timezone
from typing import Optional
from core.database import db


async def log_activity(user_id: str, user_name: str, action: str, details: Optional[str] = None) -> None:
    await db.activity_logs.insert_one({
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc),
    })
