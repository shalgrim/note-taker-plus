"""Tags API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.tag import Tag, source_tags, card_tags
from app.schemas.tag import TagCreate, TagResponse

router = APIRouter(prefix="/tags", tags=["tags"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=list[TagResponse])
async def list_tags(db: AsyncSession = Depends(get_db)):
    """List all tags."""
    result = await db.execute(select(Tag).order_by(Tag.name))
    tags = result.scalars().all()
    return tags


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(tag_in: TagCreate, db: AsyncSession = Depends(get_db)):
    """Create a new tag."""
    # Check if tag already exists
    result = await db.execute(select(Tag).where(Tag.name == tag_in.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag '{tag_in.name}' already exists",
        )

    tag = Tag(name=tag_in.name, color=tag_in.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(tag_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific tag."""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a tag."""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()


@router.get("/{tag_id}/stats")
async def get_tag_stats(tag_id: int, db: AsyncSession = Depends(get_db)):
    """Get statistics for a tag."""
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Count sources with this tag
    source_count = await db.execute(
        select(func.count()).select_from(source_tags).where(source_tags.c.tag_id == tag_id)
    )
    # Count cards with this tag
    card_count = await db.execute(
        select(func.count()).select_from(card_tags).where(card_tags.c.tag_id == tag_id)
    )

    return {
        "tag": TagResponse.model_validate(tag),
        "source_count": source_count.scalar(),
        "card_count": card_count.scalar(),
    }
