from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.tag import card_tags


class CardStatus(str, Enum):
    DRAFT = "draft"  # Generated but not yet approved
    ACTIVE = "active"  # In the review rotation
    SUSPENDED = "suspended"  # Temporarily disabled
    MASTERED = "mastered"  # User knows this well (very long intervals)


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The flashcard content
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional context/hint
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Link to source
    source_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="SET NULL"), nullable=True
    )

    # Status
    status: Mapped[CardStatus] = mapped_column(SQLEnum(CardStatus), default=CardStatus.DRAFT)

    # Spaced Repetition Data (SM-2 algorithm inspired)
    # See: https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)  # Difficulty multiplier
    interval_days: Mapped[int] = mapped_column(Integer, default=0)  # Days until next review
    repetitions: Mapped[int] = mapped_column(Integer, default=0)  # Successful reviews in a row
    next_review: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    source: Mapped["Source"] = relationship("Source", back_populates="cards")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=card_tags, back_populates="cards")
    review_logs: Mapped[list["ReviewLog"]] = relationship(
        "ReviewLog", back_populates="card", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Card(id={self.id}, status={self.status}, next_review={self.next_review})>"
