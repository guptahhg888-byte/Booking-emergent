"""MongoDB client singleton."""
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME

mongo_client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
db = mongo_client[DB_NAME]
