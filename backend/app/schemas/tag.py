from datetime import datetime
from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str | None
    created_at: datetime

    class Config:
        from_attributes = True
