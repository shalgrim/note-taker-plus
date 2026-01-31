"""
Card Generator Service using Ollama (local LLM).

This service takes a source text (highlight, fact, etc.) and generates
flashcards from it using a local LLM running via Ollama.
"""

import json
import httpx
from typing import Optional

from app.config import settings
from app.models.source import Source


class CardGeneratorService:
    SYSTEM_PROMPT = """You are a flashcard generator. Given a piece of text (a highlight, fact, or concept someone wants to learn), generate 1-5 flashcards that will help them remember the key information.

Rules:
1. Each flashcard should test ONE specific piece of knowledge
2. The "front" should be a clear question or prompt
3. The "back" should be a concise answer
4. If the text contains multiple concepts, create multiple cards
5. Make questions specific, not vague
6. Suggest relevant tags for categorization

Output format (JSON array):
[
  {
    "front": "What is...",
    "back": "The answer is...",
    "hint": "Optional hint",
    "tags": ["tag1", "tag2"]
  }
]

Only output valid JSON, no other text."""

    @classmethod
    async def generate_cards(
        cls, source: Source, model: Optional[str] = None
    ) -> list[dict]:
        """
        Generate flashcards from a source using Ollama.

        Returns a list of card dictionaries with front, back, hint, and tags.
        """
        model = model or settings.ollama_model

        prompt = f"""Generate flashcards from this text:

---
{source.text}
---

Source: {source.source_title or 'Unknown'}
URL: {source.source_url or 'N/A'}

Generate appropriate flashcards as JSON:"""

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "system": cls.SYSTEM_PROMPT,
                        "stream": False,
                        "format": "json",
                    },
                )
                response.raise_for_status()

                result = response.json()
                generated_text = result.get("response", "")

                # Parse the JSON response
                cards = cls._parse_cards(generated_text)
                return cards

        except httpx.ConnectError:
            raise ConnectionError(
                f"Could not connect to Ollama at {settings.ollama_base_url}. "
                "Make sure Ollama is running: `ollama serve`"
            )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama request failed: {e.response.text}")
        except Exception as e:
            raise RuntimeError(f"Card generation failed: {str(e)}")

    @classmethod
    def _parse_cards(cls, text: str) -> list[dict]:
        """Parse the LLM output into card dictionaries."""
        try:
            # Try to parse as JSON directly
            data = json.loads(text)

            # Handle both array and object with "cards" key
            if isinstance(data, list):
                cards = data
            elif isinstance(data, dict) and "cards" in data:
                cards = data["cards"]
            else:
                cards = [data]

            # Validate each card has required fields
            validated = []
            for card in cards:
                if "front" in card and "back" in card:
                    validated.append(
                        {
                            "front": str(card["front"]),
                            "back": str(card["back"]),
                            "hint": card.get("hint"),
                            "tags": card.get("tags", []),
                        }
                    )

            return validated

        except json.JSONDecodeError:
            # Try to extract JSON from the text
            import re

            json_match = re.search(r"\[.*\]", text, re.DOTALL)
            if json_match:
                return cls._parse_cards(json_match.group())

            # Last resort: create a simple card
            return [
                {
                    "front": "What is the key point of this text?",
                    "back": text[:500] if len(text) > 500 else text,
                    "hint": None,
                    "tags": [],
                }
            ]

    @classmethod
    async def check_ollama_available(cls) -> tuple[bool, str]:
        """Check if Ollama is running and the model is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Check if Ollama is running
                response = await client.get(f"{settings.ollama_base_url}/api/tags")
                response.raise_for_status()

                models = response.json().get("models", [])
                model_names = [m["name"] for m in models]

                if settings.ollama_model in model_names or any(
                    settings.ollama_model in name for name in model_names
                ):
                    return True, f"Ollama running with model {settings.ollama_model}"
                else:
                    return False, (
                        f"Ollama running but model '{settings.ollama_model}' not found. "
                        f"Available: {model_names}. Run: `ollama pull {settings.ollama_model}`"
                    )

        except httpx.ConnectError:
            return False, (
                f"Ollama not running at {settings.ollama_base_url}. "
                "Start it with: `ollama serve`"
            )
        except Exception as e:
            return False, f"Error checking Ollama: {str(e)}"
