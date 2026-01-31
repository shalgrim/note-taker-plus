from datetime import datetime
from sqlalchemy import Column, ForeignKey, Table, String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Association tables for many-to-many relationships
source_tags = Table(
    "source_tags",
    Base.metadata,
    Column("source_id", Integer, ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

card_tags = Table(
    "card_tags",
    Base.metadata,
    Column("card_id", Integer, ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)  # For UI display
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    sources: Mapped[list["Source"]] = relationship(
        "Source", secondary=source_tags, back_populates="tags"
    )
    cards: Mapped[list["Card"]] = relationship(
        "Card", secondary=card_tags, back_populates="tags"
    )

    def __repr__(self) -> str:
        return f"<Tag(id={self.id}, name='{self.name}')>"
