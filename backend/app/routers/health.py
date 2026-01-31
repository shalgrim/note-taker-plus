"""Health check endpoints."""

from fastapi import APIRouter

from app.services.card_generator import CardGeneratorService
from app.services.raindrop import RaindropService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """Basic health check."""
    return {"status": "ok"}


@router.get("/services")
async def service_health():
    """Check the status of external services."""
    ollama_ok, ollama_msg = await CardGeneratorService.check_ollama_available()
    raindrop_ok, raindrop_msg = await RaindropService().test_connection()

    return {
        "ollama": {"ok": ollama_ok, "message": ollama_msg},
        "raindrop": {"ok": raindrop_ok, "message": raindrop_msg},
    }
