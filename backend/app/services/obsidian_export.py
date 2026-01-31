"""
Obsidian Export Service.

Exports sources and cards to markdown files in the Obsidian vault.
This allows for viewing and searching learnings in Obsidian, and also
provides a git-friendly backup of the data.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.source import Source, SourceStatus
from app.models.card import Card, CardStatus


class ObsidianExportService:
    def __init__(self, vault_path: Optional[str] = None, learnings_folder: Optional[str] = None):
        self.vault_path = Path(vault_path or settings.obsidian_vault_path)
        self.learnings_folder = learnings_folder or settings.obsidian_learnings_folder
        self.base_path = self.vault_path / self.learnings_folder

    def _ensure_directories(self):
        """Create the directory structure if it doesn't exist."""
        (self.base_path / "sources").mkdir(parents=True, exist_ok=True)
        (self.base_path / "cards").mkdir(parents=True, exist_ok=True)

    def _slugify(self, text: str, max_length: int = 50) -> str:
        """Create a safe filename from text."""
        # Remove/replace problematic characters
        slug = text.lower()
        for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '#', '[', ']']:
            slug = slug.replace(char, '-')
        # Collapse multiple dashes
        while '--' in slug:
            slug = slug.replace('--', '-')
        # Trim and limit length
        slug = slug.strip('-')[:max_length].strip('-')
        return slug or 'untitled'

    def _format_source_markdown(self, source: Source) -> str:
        """Format a source as Obsidian-compatible markdown."""
        lines = [
            "---",
            f"id: {source.id}",
            f"type: source",
            f"source_type: {source.source_type}",
            f"status: {source.status}",
            f"created: {source.created_at.isoformat()}",
            f"updated: {source.updated_at.isoformat()}",
        ]

        if source.tags:
            tag_names = [t.name for t in source.tags]
            lines.append(f"tags: [{', '.join(tag_names)}]")

        if source.source_url:
            lines.append(f"url: \"{source.source_url}\"")

        lines.extend([
            "---",
            "",
            f"# {source.source_title or 'Source'}",
            "",
        ])

        if source.source_url:
            lines.append(f"[Original Source]({source.source_url})")
            lines.append("")

        lines.extend([
            "## Highlight",
            "",
            f"> {source.text}",
            "",
        ])

        if source.cards:
            lines.extend([
                "## Generated Cards",
                "",
            ])
            for card in source.cards:
                lines.append(f"- [[cards/{source.id}-{self._slugify(card.front[:30])}|{card.front[:50]}...]]")

        return "\n".join(lines)

    def _format_card_markdown(self, card: Card) -> str:
        """Format a card as Obsidian-compatible markdown."""
        lines = [
            "---",
            f"id: {card.id}",
            f"type: card",
            f"status: {card.status}",
            f"ease_factor: {card.ease_factor}",
            f"interval_days: {card.interval_days}",
            f"repetitions: {card.repetitions}",
            f"created: {card.created_at.isoformat()}",
        ]

        if card.next_review:
            lines.append(f"next_review: {card.next_review.isoformat()}")

        if card.tags:
            tag_names = [t.name for t in card.tags]
            lines.append(f"tags: [{', '.join(tag_names)}]")

        if card.source_id:
            lines.append(f"source_id: {card.source_id}")

        lines.extend([
            "---",
            "",
            "## Question",
            "",
            card.front,
            "",
            "## Answer",
            "",
            card.back,
            "",
        ])

        if card.hint:
            lines.extend([
                "## Hint",
                "",
                card.hint,
                "",
            ])

        if card.source_id:
            lines.extend([
                "## Source",
                "",
                f"![[sources/{card.source_id}]]",
            ])

        return "\n".join(lines)

    async def export_source(self, source: Source) -> Path:
        """Export a single source to markdown."""
        self._ensure_directories()

        filename = f"{source.id}-{self._slugify(source.source_title or source.text[:30])}.md"
        filepath = self.base_path / "sources" / filename

        content = self._format_source_markdown(source)
        filepath.write_text(content, encoding='utf-8')

        return filepath

    async def export_card(self, card: Card) -> Path:
        """Export a single card to markdown."""
        self._ensure_directories()

        source_prefix = f"{card.source_id}-" if card.source_id else ""
        filename = f"{source_prefix}{card.id}-{self._slugify(card.front[:30])}.md"
        filepath = self.base_path / "cards" / filename

        content = self._format_card_markdown(card)
        filepath.write_text(content, encoding='utf-8')

        return filepath

    async def export_all(self, db: AsyncSession) -> dict:
        """Export all approved sources and active cards."""
        if not self.vault_path.exists():
            raise ValueError(f"Obsidian vault not found at {self.vault_path}")

        self._ensure_directories()

        # Export approved sources
        result = await db.execute(
            select(Source)
            .where(Source.status == SourceStatus.APPROVED)
            .options(selectinload(Source.tags), selectinload(Source.cards))
        )
        sources = result.scalars().all()

        source_count = 0
        for source in sources:
            await self.export_source(source)
            source_count += 1

        # Export active cards
        result = await db.execute(
            select(Card)
            .where(Card.status == CardStatus.ACTIVE)
            .options(selectinload(Card.tags))
        )
        cards = result.scalars().all()

        card_count = 0
        for card in cards:
            await self.export_card(card)
            card_count += 1

        # Create index file
        await self._create_index(sources, cards)

        return {
            "sources_exported": source_count,
            "cards_exported": card_count,
            "export_path": str(self.base_path),
        }

    async def _create_index(self, sources: list[Source], cards: list[Card]):
        """Create an index markdown file."""
        lines = [
            "---",
            f"updated: {datetime.utcnow().isoformat()}",
            "---",
            "",
            "# Learnings Index",
            "",
            f"**{len(sources)}** sources | **{len(cards)}** cards",
            "",
            "## Recent Sources",
            "",
        ]

        # List recent sources
        for source in sorted(sources, key=lambda s: s.created_at, reverse=True)[:20]:
            title = source.source_title or source.text[:50]
            lines.append(f"- [[sources/{source.id}-{self._slugify(title)}|{title}]]")

        lines.extend([
            "",
            "## Tags",
            "",
        ])

        # Collect all tags
        all_tags = set()
        for source in sources:
            for tag in source.tags:
                all_tags.add(tag.name)
        for card in cards:
            for tag in card.tags:
                all_tags.add(tag.name)

        for tag in sorted(all_tags):
            lines.append(f"- #{tag}")

        index_path = self.base_path / "index.md"
        index_path.write_text("\n".join(lines), encoding='utf-8')
