from datetime import datetime
from pydantic import BaseModel, HttpUrl

from app.models.source import SourceType, SourceStatus
from app.schemas.tag import TagResponse


class SourceCreate(BaseModel):
    text: str
    source_type: SourceType = SourceType.MANUAL
    source_url: str | None = None
    source_title: str | None = None
    external_id: str | None = None
    highlight_color: str | None = None
    tags: list[str] = []  # Tag names, will be created if they don't exist


class SourceUpdate(BaseModel):
    text: str | None = None
    source_url: str | None = None
    source_title: str | None = None
    status: SourceStatus | None = None
    tags: list[str] | None = None


class SourceResponse(BaseModel):
    id: int
    text: str
    source_type: SourceType
    source_url: str | None
    source_title: str | None
    external_id: str | None
    highlight_color: str | None
    status: SourceStatus
    created_at: datetime
    updated_at: datetime
    tags: list[TagResponse]
    card_count: int = 0

    class Config:
        from_attributes = True


class SourceListResponse(BaseModel):
    sources: list[SourceResponse]
    total: int
    page: int
    per_page: int
