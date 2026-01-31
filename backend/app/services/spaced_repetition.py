"""
Spaced Repetition Service using a simplified SM-2 algorithm.

SM-2 (SuperMemo 2) is the algorithm behind Anki. Here's a simplified version:

1. Each card has:
   - ease_factor: How easy the card is (starts at 2.5, min 1.3)
   - interval: Days until next review
   - repetitions: Successful reviews in a row

2. After each review:
   - AGAIN (0): Reset to beginning, interval = 1 day
   - HARD (1): interval *= 1.2, ease_factor -= 0.15
   - GOOD (2): interval *= ease_factor
   - EASY (3): interval *= ease_factor * 1.3, ease_factor += 0.15

3. First few reviews have fixed intervals:
   - First success: 1 day
   - Second success: 6 days
   - Then use the formula
"""

from datetime import datetime, timedelta
from app.models.card import Card
from app.models.review_log import ReviewRating, ReviewLog


class SpacedRepetitionService:
    MIN_EASE_FACTOR = 1.3
    MAX_EASE_FACTOR = 3.0
    INITIAL_EASE_FACTOR = 2.5

    # Interval bounds
    MIN_INTERVAL = 1  # 1 day minimum
    MAX_INTERVAL = 365  # 1 year maximum

    @classmethod
    def process_review(
        cls, card: Card, rating: ReviewRating, response_time_ms: int | None = None
    ) -> ReviewLog:
        """
        Process a review and update the card's spaced repetition data.
        Returns a ReviewLog for analytics.
        """
        # Store state before review
        ease_before = card.ease_factor
        interval_before = card.interval_days

        # Calculate new values
        if rating == ReviewRating.AGAIN:
            # Failed - reset progress
            card.repetitions = 0
            card.interval_days = cls.MIN_INTERVAL
            card.ease_factor = max(cls.MIN_EASE_FACTOR, card.ease_factor - 0.2)

        elif rating == ReviewRating.HARD:
            # Difficult but correct
            card.repetitions += 1
            card.ease_factor = max(cls.MIN_EASE_FACTOR, card.ease_factor - 0.15)

            if card.repetitions == 1:
                card.interval_days = 1
            elif card.repetitions == 2:
                card.interval_days = 4
            else:
                card.interval_days = int(card.interval_days * 1.2)

        elif rating == ReviewRating.GOOD:
            # Normal success
            card.repetitions += 1

            if card.repetitions == 1:
                card.interval_days = 1
            elif card.repetitions == 2:
                card.interval_days = 6
            else:
                card.interval_days = int(card.interval_days * card.ease_factor)

        elif rating == ReviewRating.EASY:
            # Easy - boost interval
            card.repetitions += 1
            card.ease_factor = min(cls.MAX_EASE_FACTOR, card.ease_factor + 0.15)

            if card.repetitions == 1:
                card.interval_days = 4
            elif card.repetitions == 2:
                card.interval_days = 10
            else:
                card.interval_days = int(card.interval_days * card.ease_factor * 1.3)

        # Clamp interval
        card.interval_days = max(cls.MIN_INTERVAL, min(cls.MAX_INTERVAL, card.interval_days))

        # Set next review date
        card.last_reviewed = datetime.utcnow()
        card.next_review = card.last_reviewed + timedelta(days=card.interval_days)

        # Create review log
        review_log = ReviewLog(
            card_id=card.id,
            rating=rating,
            ease_factor_before=ease_before,
            interval_before=interval_before,
            ease_factor_after=card.ease_factor,
            interval_after=card.interval_days,
            response_time_ms=response_time_ms,
        )

        return review_log

    @classmethod
    def get_due_date(cls, card: Card) -> datetime | None:
        """Get when a card is due for review."""
        return card.next_review

    @classmethod
    def is_due(cls, card: Card) -> bool:
        """Check if a card is due for review."""
        if card.next_review is None:
            return True  # Never reviewed = due now
        return datetime.utcnow() >= card.next_review

    @classmethod
    def initialize_card(cls, card: Card) -> None:
        """Initialize spaced repetition data for a new card."""
        card.ease_factor = cls.INITIAL_EASE_FACTOR
        card.interval_days = 0
        card.repetitions = 0
        card.next_review = datetime.utcnow()  # Due immediately
        card.last_reviewed = None
