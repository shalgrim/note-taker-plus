"""Sources API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import verify_api_key
from app.database import get_db
from app.models.source import Source, SourceStatus, SourceType
from app.models.card import Card, CardStatus
from app.models.tag import Tag
from app.schemas.source import SourceCreate, SourceUpdate, SourceResponse, SourceListResponse
from app.services.card_generator import CardGeneratorService
from app.services.spaced_repetition import SpacedRepetitionService

router = APIRouter(prefix="/sources", tags=["sources"], dependencies=[Depends(verify_api_key)])


async def get_or_create_tags(db: AsyncSession, tag_names: list[str]) -> list[Tag]:
    """Get existing tags or create new ones."""
    tags = []
    for name in tag_names:
        name = name.strip().lower()
        if not name:
            continue

        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)

        tags.append(tag)

    return tags


@router.get("", response_model=SourceListResponse)
async def list_sources(
    status: SourceStatus | None = None,
    source_type: SourceType | None = None,
    tag: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List sources with optional filtering."""
    query = select(Source).options(selectinload(Source.tags), selectinload(Source.cards))

    if status:
        query = query.where(Source.status == status)
    if source_type:
        query = query.where(Source.source_type == source_type)
    if tag:
        query = query.join(Source.tags).where(Tag.name == tag.lower())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Apply pagination
    query = query.order_by(Source.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    sources = result.scalars().unique().all()

    return SourceListResponse(
        sources=[
            SourceResponse(
                **{
                    **source.__dict__,
                    "tags": source.tags,
                    "card_count": len(source.cards),
                }
            )
            for source in sources
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def create_source(source_in: SourceCreate, db: AsyncSession = Depends(get_db)):
    """Create a new source (highlight/fact to learn)."""
    # Check for duplicate by external_id
    if source_in.external_id:
        result = await db.execute(
            select(Source).where(Source.external_id == source_in.external_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Source with external_id '{source_in.external_id}' already exists",
            )

    # Get or create tags
    tags = await get_or_create_tags(db, source_in.tags)

    source = Source(
        text=source_in.text,
        source_type=source_in.source_type,
        source_url=source_in.source_url,
        source_title=source_in.source_title,
        external_id=source_in.external_id,
        highlight_color=source_in.highlight_color,
        status=SourceStatus.PENDING_REVIEW,
        tags=tags,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    return SourceResponse(
        **{**source.__dict__, "tags": source.tags, "card_count": 0}
    )


@router.get("/{source_id}", response_model=SourceResponse)
async def get_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific source."""
    result = await db.execute(
        select(Source)
        .where(Source.id == source_id)
        .options(selectinload(Source.tags), selectinload(Source.cards))
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    return SourceResponse(
        **{**source.__dict__, "tags": source.tags, "card_count": len(source.cards)}
    )


@router.patch("/{source_id}", response_model=SourceResponse)
async def update_source(
    source_id: int, source_in: SourceUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a source."""
    result = await db.execute(
        select(Source)
        .where(Source.id == source_id)
        .options(selectinload(Source.tags), selectinload(Source.cards))
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    if source_in.text is not None:
        source.text = source_in.text
    if source_in.source_url is not None:
        source.source_url = source_in.source_url
    if source_in.source_title is not None:
        source.source_title = source_in.source_title
    if source_in.status is not None:
        source.status = source_in.status
    if source_in.tags is not None:
        source.tags = await get_or_create_tags(db, source_in.tags)

    await db.commit()
    await db.refresh(source)

    return SourceResponse(
        **{**source.__dict__, "tags": source.tags, "card_count": len(source.cards)}
    )


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a source and its cards."""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    await db.delete(source)
    await db.commit()


@router.post("/{source_id}/generate-cards")
async def generate_cards_for_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Generate flashcards from a source using the local LLM."""
    result = await db.execute(
        select(Source).where(Source.id == source_id).options(selectinload(Source.tags))
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        card_data = await CardGeneratorService.generate_cards(source)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    created_cards = []
    for data in card_data:
        # Get tags from LLM suggestion + source tags
        tag_names = data.get("tags", []) + [t.name for t in source.tags]
        tags = await get_or_create_tags(db, tag_names)

        card = Card(
            front=data["front"],
            back=data["back"],
            hint=data.get("hint"),
            source_id=source.id,
            status=CardStatus.DRAFT,
            tags=tags,
        )
        SpacedRepetitionService.initialize_card(card)
        db.add(card)
        created_cards.append(card)

    source.status = SourceStatus.CARDS_GENERATED
    await db.commit()

    # Refresh to get IDs
    for card in created_cards:
        await db.refresh(card)

    return {
        "source_id": source_id,
        "cards_generated": len(created_cards),
        "cards": [
            {"id": c.id, "front": c.front, "back": c.back, "hint": c.hint}
            for c in created_cards
        ],
    }


@router.post("/{source_id}/approve")
async def approve_source(source_id: int, db: AsyncSession = Depends(get_db)):
    """Approve a source and activate its cards."""
    result = await db.execute(
        select(Source).where(Source.id == source_id).options(selectinload(Source.cards))
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    # Activate all draft cards
    activated = 0
    for card in source.cards:
        if card.status == CardStatus.DRAFT:
            card.status = CardStatus.ACTIVE
            activated += 1

    source.status = SourceStatus.APPROVED
    await db.commit()

    return {"source_id": source_id, "status": "approved", "cards_activated": activated}
