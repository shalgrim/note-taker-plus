"""Export endpoints for Obsidian integration."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.config import settings
from app.database import get_db
from app.services.obsidian_export import ObsidianExportService

router = APIRouter(prefix="/export", tags=["export"], dependencies=[Depends(verify_api_key)])


@router.post("/obsidian")
async def export_to_obsidian(db: AsyncSession = Depends(get_db)):
    """
    Export all approved sources and active cards to Obsidian vault.

    Creates/updates markdown files in the configured Obsidian vault path.
    """
    if not settings.obsidian_vault_path:
        raise HTTPException(
            status_code=400,
            detail="Obsidian vault path not configured. Set OBSIDIAN_VAULT_PATH in .env",
        )

    service = ObsidianExportService()

    try:
        result = await service.export_all(db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/obsidian/status")
async def obsidian_status():
    """Check Obsidian export configuration."""
    vault_path = settings.obsidian_vault_path
    if not vault_path:
        return {
            "configured": False,
            "message": "OBSIDIAN_VAULT_PATH not set in .env",
        }

    from pathlib import Path

    if not Path(vault_path).exists():
        return {
            "configured": True,
            "path": vault_path,
            "exists": False,
            "message": f"Vault path does not exist: {vault_path}",
        }

    return {
        "configured": True,
        "path": vault_path,
        "exists": True,
        "learnings_folder": settings.obsidian_learnings_folder,
        "message": "Ready to export",
    }
