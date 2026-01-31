from datetime import datetime
from enum import Enum
from sqlalchemy import String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.tag import source_tags


class SourceType(str, Enum):
    RAINDROP = "raindrop"
    READWISE = "readwise"
    CHROME_EXTENSION = "chrome_extension"
    MANUAL = "manual"
    ALFRED = "alfred"
    IOS_SHORTCUT = "ios_shortcut"


class SourceStatus(str, Enum):
    PENDING_REVIEW = "pending_review"  # Just captured, cards not yet generated
    CARDS_GENERATED = "cards_generated"  # Cards generated, awaiting approval
    APPROVED = "approved"  # User approved, cards are active
    ARCHIVED = "archived"  # User dismissed/archived this source


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)

    # The original text/highlight/fact
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Where it came from
    source_type: Mapped[SourceType] = mapped_column(
        SQLEnum(SourceType), default=SourceType.MANUAL
    )
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # External IDs for deduplication
    external_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )  # e.g., Raindrop highlight ID

    # Highlight color (for Raindrop integration)
    highlight_color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Status
    status: Mapped[SourceStatus] = mapped_column(
        SQLEnum(SourceStatus), default=SourceStatus.PENDING_REVIEW
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", secondary=source_tags, back_populates="sources"
    )
    cards: Mapped[list["Card"]] = relationship(
        "Card", back_populates="source", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Source(id={self.id}, type={self.source_type}, status={self.status})>"
