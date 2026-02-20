"""Sync endpoints for external integrations."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.source import Source, SourceStatus, SourceType
from app.services.raindrop import RaindropService

router = APIRouter(prefix="/sync", tags=["sync"], dependencies=[Depends(verify_api_key)])


@router.post("/raindrop")
async def sync_raindrop(
    since: datetime | None = None,
    auto_generate: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Sync highlights from Raindrop.io.

    - Fetches all highlights (or those since a given date)
    - Creates sources for new highlights
    - Orange highlights are flagged for card generation

    Args:
        since: Only sync highlights created after this datetime
        auto_generate: If True, automatically generate cards for blue highlights
    """
    service = RaindropService()

    # Test connection first
    ok, msg = await service.test_connection()
    if not ok:
        raise HTTPException(status_code=503, detail=msg)

    try:
        all_highlights, flashcard_highlights = await service.sync_highlights(since=since)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    created = 0
    skipped = 0
    flashcard_ready = 0

    for highlight in all_highlights:
        # Check if already exists
        result = await db.execute(
            select(Source).where(Source.external_id == highlight["external_id"])
        )
        if result.scalar_one_or_none():
            skipped += 1
            continue

        # Create new source
        source = Source(
            text=highlight["text"],
            source_type=SourceType.RAINDROP,
            source_url=highlight["source_url"],
            source_title=highlight["source_title"],
            external_id=highlight["external_id"],
            highlight_color=highlight["highlight_color"],
            status=SourceStatus.PENDING_REVIEW,
        )
        db.add(source)
        created += 1

        # Track if this is a flashcard highlight
        if highlight["highlight_color"] == RaindropService.FLASHCARD_COLOR:
            flashcard_ready += 1

    await db.commit()

    return {
        "synced": created,
        "skipped_duplicates": skipped,
        "flashcard_ready": flashcard_ready,
        "total_highlights": len(all_highlights),
        "message": f"Synced {created} new highlights, {flashcard_ready} ready for card generation",
    }


@router.get("/raindrop/status")
async def raindrop_status():
    """Check Raindrop.io connection status."""
    service = RaindropService()
    ok, msg = await service.test_connection()
    return {"connected": ok, "message": msg}
