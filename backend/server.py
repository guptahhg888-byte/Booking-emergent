"""FastAPI entrypoint — mounts routers, registers CORS, handles startup/shutdown.

All domain logic lives in `core/`, `services/`, `routes/`, `seed.py`.
"""
import logging
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from core.database import mongo_client
from routes.auth import router as auth_router
from routes.doctors import router as doctors_router
from routes.appointments import router as appointments_router
from routes.payments import router as payments_router
from routes.admin import router as admin_router
from seed import seed_admin, seed_sample_doctors, ensure_indexes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MediConsult API", version="2.0.0")

# Mount all domain routers under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(doctors_router)
api_router.include_router(appointments_router)
api_router.include_router(payments_router)
api_router.include_router(admin_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await ensure_indexes()
    await seed_admin()
    await seed_sample_doctors()
    logger.info("MediConsult API v2 started")


@app.on_event("shutdown")
async def shutdown() -> None:
    mongo_client.close()
