"""Cards API endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import verify_api_key
from app.database import get_db
from app.models.card import Card, CardStatus
from app.models.tag import Tag
from app.schemas.card import (
    CardCreate,
    CardUpdate,
    CardResponse,
    CardReview,
    CardListResponse,
    DueCardsResponse,
)
from app.services.spaced_repetition import SpacedRepetitionService

router = APIRouter(prefix="/cards", tags=["cards"], dependencies=[Depends(verify_api_key)])


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


@router.get("", response_model=CardListResponse)
async def list_cards(
    status: CardStatus | None = None,
    tag: str | None = None,
    source_id: int | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List cards with optional filtering."""
    query = select(Card).options(selectinload(Card.tags))

    if status:
        query = query.where(Card.status == status)
    if source_id:
        query = query.where(Card.source_id == source_id)
    if tag:
        query = query.join(Card.tags).where(Tag.name == tag.lower())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Apply pagination
    query = query.order_by(Card.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    cards = result.scalars().unique().all()

    return CardListResponse(
        cards=[CardResponse.model_validate(c) for c in cards],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/due", response_model=DueCardsResponse)
async def get_due_cards(
    tag: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get cards that are due for review."""
    now = datetime.utcnow()

    query = (
        select(Card)
        .options(selectinload(Card.tags))
        .where(Card.status == CardStatus.ACTIVE)
        .where(or_(Card.next_review <= now, Card.next_review.is_(None)))
    )

    if tag:
        query = query.join(Card.tags).where(Tag.name == tag.lower())

    query = query.order_by(Card.next_review.asc().nullsfirst()).limit(limit)

    result = await db.execute(query)
    cards = result.scalars().unique().all()

    # Also get total count of due cards
    count_query = (
        select(func.count())
        .select_from(Card)
        .where(Card.status == CardStatus.ACTIVE)
        .where(or_(Card.next_review <= now, Card.next_review.is_(None)))
    )
    total_due = (await db.execute(count_query)).scalar()

    return DueCardsResponse(
        cards=[CardResponse.model_validate(c) for c in cards],
        total_due=total_due,
    )


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(card_in: CardCreate, db: AsyncSession = Depends(get_db)):
    """Create a new card manually."""
    tags = await get_or_create_tags(db, card_in.tags)

    card = Card(
        front=card_in.front,
        back=card_in.back,
        hint=card_in.hint,
        source_id=card_in.source_id,
        status=CardStatus.ACTIVE,  # Manual cards are active immediately
        tags=tags,
    )
    SpacedRepetitionService.initialize_card(card)

    db.add(card)
    await db.commit()
    await db.refresh(card)

    return CardResponse.model_validate(card)


@router.get("/{card_id}", response_model=CardResponse)
async def get_card(card_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific card."""
    result = await db.execute(
        select(Card).where(Card.id == card_id).options(selectinload(Card.tags))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return CardResponse.model_validate(card)


@router.patch("/{card_id}", response_model=CardResponse)
async def update_card(card_id: int, card_in: CardUpdate, db: AsyncSession = Depends(get_db)):
    """Update a card."""
    result = await db.execute(
        select(Card).where(Card.id == card_id).options(selectinload(Card.tags))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if card_in.front is not None:
        card.front = card_in.front
    if card_in.back is not None:
        card.back = card_in.back
    if card_in.hint is not None:
        card.hint = card_in.hint
    if card_in.status is not None:
        card.status = card_in.status
    if card_in.tags is not None:
        card.tags = await get_or_create_tags(db, card_in.tags)

    await db.commit()
    await db.refresh(card)

    return CardResponse.model_validate(card)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(card_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a card."""
    result = await db.execute(select(Card).where(Card.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    await db.delete(card)
    await db.commit()


@router.post("/{card_id}/review", response_model=CardResponse)
async def review_card(card_id: int, review: CardReview, db: AsyncSession = Depends(get_db)):
    """Submit a review for a card and update spaced repetition data."""
    result = await db.execute(
        select(Card).where(Card.id == card_id).options(selectinload(Card.tags))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if card.status != CardStatus.ACTIVE:
        raise HTTPException(
            status_code=400, detail=f"Cannot review card with status '{card.status}'"
        )

    # Process the review
    review_log = SpacedRepetitionService.process_review(
        card, review.rating, review.response_time_ms
    )

    db.add(review_log)
    await db.commit()
    await db.refresh(card)

    return CardResponse.model_validate(card)


@router.get("/{card_id}/history")
async def get_card_history(card_id: int, db: AsyncSession = Depends(get_db)):
    """Get review history for a card."""
    result = await db.execute(
        select(Card).where(Card.id == card_id).options(selectinload(Card.review_logs))
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    return {
        "card_id": card_id,
        "total_reviews": len(card.review_logs),
        "reviews": [
            {
                "rating": log.rating.name,
                "interval_before": log.interval_before,
                "interval_after": log.interval_after,
                "reviewed_at": log.reviewed_at,
            }
            for log in sorted(card.review_logs, key=lambda x: x.reviewed_at, reverse=True)
        ],
    }
