"""
Raindrop.io Integration Service.

Fetches highlights from Raindrop.io API and creates sources from them.
Orange highlights trigger flashcard generation.
"""

import httpx
from datetime import datetime
from typing import Optional

from app.config import settings


class RaindropService:
    BASE_URL = "https://api.raindrop.io/rest/v1"

    # Highlight color that triggers flashcard generation
    FLASHCARD_COLOR = "orange"

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.raindrop_token

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make an authenticated request to Raindrop API."""
        if not self.token:
            raise ValueError(
                "Raindrop token not configured. Set RAINDROP_TOKEN in .env"
            )

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.BASE_URL}{endpoint}",
                headers={"Authorization": f"Bearer {self.token}"},
                **kwargs,
            )
            response.raise_for_status()
            return response.json()

    async def get_highlights(
        self, page: int = 0, per_page: int = 50, since: Optional[datetime] = None
    ) -> list[dict]:
        """
        Fetch highlights from Raindrop.io.

        Returns list of highlights with their metadata.
        """
        params = {"page": page, "perpage": per_page}

        try:
            data = await self._request("GET", "/highlights", params=params)
            highlights = data.get("items", [])

            # Filter by date if specified
            if since:
                highlights = [
                    h
                    for h in highlights
                    if datetime.fromisoformat(h["created"].replace("Z", "+00:00"))
                    > since
                ]

            return highlights
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise ValueError("Invalid Raindrop token")
            raise

    async def get_raindrop_details(self, raindrop_id: int) -> dict:
        """Get details about a specific raindrop (bookmark)."""
        data = await self._request("GET", f"/raindrop/{raindrop_id}")
        return data.get("item", {})

    def parse_highlight(self, highlight: dict) -> dict:
        """
        Parse a Raindrop highlight into a source-compatible format.

        Returns a dict ready to create a Source.
        """
        return {
            "text": highlight.get("text", ""),
            "external_id": f"raindrop_highlight_{highlight.get('_id')}",
            "highlight_color": highlight.get("color", "yellow"),
            "source_url": highlight.get("link"),
            "source_title": highlight.get("title"),
            "raindrop_id": highlight.get("raindropRef"),
            "created_at": highlight.get("created"),
        }

    def should_generate_cards(self, highlight: dict) -> bool:
        """Check if a highlight should trigger card generation (orange color)."""
        return highlight.get("color", "").lower() == self.FLASHCARD_COLOR

    async def sync_highlights(
        self, since: Optional[datetime] = None
    ) -> tuple[list[dict], list[dict]]:
        """
        Sync highlights from Raindrop.

        Returns (all_highlights, flashcard_highlights) where flashcard_highlights
        are the orange ones that should generate cards.
        """
        all_highlights = []
        flashcard_highlights = []
        page = 0

        while True:
            batch = await self.get_highlights(page=page, since=since)
            if not batch:
                break

            for h in batch:
                parsed = self.parse_highlight(h)
                all_highlights.append(parsed)
                if self.should_generate_cards(h):
                    flashcard_highlights.append(parsed)

            page += 1
            if len(batch) < 50:  # Last page
                break

        return all_highlights, flashcard_highlights

    async def test_connection(self) -> tuple[bool, str]:
        """Test the Raindrop API connection."""
        try:
            # Try to fetch user info
            data = await self._request("GET", "/user")
            user = data.get("user", {})
            return True, f"Connected as {user.get('email', 'unknown')}"
        except ValueError as e:
            return False, str(e)
        except httpx.HTTPStatusError as e:
            return False, f"API error: {e.response.status_code}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
