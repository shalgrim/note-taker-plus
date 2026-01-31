from datetime import datetime
from enum import Enum
from sqlalchemy import DateTime, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReviewRating(int, Enum):
    """
    Rating scale for card reviews (inspired by SM-2):
    - AGAIN (0): Complete failure, reset progress
    - HARD (1): Significant difficulty, shorter interval
    - GOOD (2): Correct with some effort, normal interval
    - EASY (3): Effortless recall, longer interval
    """

    AGAIN = 0
    HARD = 1
    GOOD = 2
    EASY = 3


class ReviewLog(Base):
    """
    Log of each review session for analytics and algorithm tuning.
    """

    __tablename__ = "review_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    card_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False
    )

    # What the user rated
    rating: Mapped[ReviewRating] = mapped_column(SQLEnum(ReviewRating), nullable=False)

    # State before review (for analytics)
    ease_factor_before: Mapped[float] = mapped_column(Float, nullable=False)
    interval_before: Mapped[int] = mapped_column(Integer, nullable=False)

    # State after review
    ease_factor_after: Mapped[float] = mapped_column(Float, nullable=False)
    interval_after: Mapped[int] = mapped_column(Integer, nullable=False)

    # How long the user took to answer (optional, for future analytics)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    card: Mapped["Card"] = relationship("Card", back_populates="review_logs")

    def __repr__(self) -> str:
        return f"<ReviewLog(id={self.id}, card_id={self.card_id}, rating={self.rating})>"
