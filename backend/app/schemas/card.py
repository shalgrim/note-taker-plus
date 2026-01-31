from datetime import datetime
from pydantic import BaseModel

from app.models.card import CardStatus
from app.models.review_log import ReviewRating
from app.schemas.tag import TagResponse


class CardCreate(BaseModel):
    front: str
    back: str
    hint: str | None = None
    source_id: int | None = None
    tags: list[str] = []  # Tag names


class CardUpdate(BaseModel):
    front: str | None = None
    back: str | None = None
    hint: str | None = None
    status: CardStatus | None = None
    tags: list[str] | None = None


class CardResponse(BaseModel):
    id: int
    front: str
    back: str
    hint: str | None
    source_id: int | None
    status: CardStatus
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review: datetime | None
    last_reviewed: datetime | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse]

    class Config:
        from_attributes = True


class CardReview(BaseModel):
    """Submit a review for a card"""

    rating: ReviewRating
    response_time_ms: int | None = None


class CardListResponse(BaseModel):
    cards: list[CardResponse]
    total: int
    page: int
    per_page: int


class DueCardsResponse(BaseModel):
    """Cards that are due for review"""

    cards: list[CardResponse]
    total_due: int
