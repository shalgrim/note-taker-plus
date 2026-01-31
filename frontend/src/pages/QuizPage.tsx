import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cardsApi, tagsApi } from '../services/api';
import { useStore } from '../hooks/useStore';
import type { Card, ReviewRating } from '../types';
import clsx from 'clsx';

const ratingLabels: Record<ReviewRating, { label: string; color: string; key: string }> = {
  0: { label: 'Again', color: 'bg-red-600 hover:bg-red-700', key: '1' },
  1: { label: 'Hard', color: 'bg-orange-600 hover:bg-orange-700', key: '2' },
  2: { label: 'Good', color: 'bg-green-600 hover:bg-green-700', key: '3' },
  3: { label: 'Easy', color: 'bg-blue-600 hover:bg-blue-700', key: '4' },
};

export default function QuizPage() {
  const queryClient = useQueryClient();
  const { currentQuizTag, setCurrentQuizTag, showHints } = useStore();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });

  // Fetch tags for filter
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  });

  // Fetch due cards
  const { data: dueCards, isLoading, refetch } = useQuery({
    queryKey: ['dueCards', currentQuizTag],
    queryFn: () => cardsApi.getDue({ tag: currentQuizTag || undefined, limit: 50 }),
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ cardId, rating, responseTime }: { cardId: number; rating: ReviewRating; responseTime: number }) =>
      cardsApi.review(cardId, { rating, response_time_ms: responseTime }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dueCards'] });
      setSessionStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        [['again', 'hard', 'good', 'easy'][variables.rating]]: prev[['again', 'hard', 'good', 'easy'][variables.rating] as keyof typeof prev] + 1,
      }));
    },
  });

  const cards = dueCards?.cards || [];
  const currentCard = cards[currentCardIndex];

  // Reset when changing tags
  useEffect(() => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSessionStats({ reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 });
  }, [currentQuizTag]);

  // Start timer when card appears
  useEffect(() => {
    if (currentCard && !showAnswer) {
      setStartTime(Date.now());
    }
  }, [currentCard, showAnswer, currentCardIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCard) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!showAnswer) {
          setShowAnswer(true);
        }
      } else if (showAnswer) {
        const keyToRating: Record<string, ReviewRating> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
        };
        if (e.key in keyToRating) {
          handleReview(keyToRating[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, showAnswer]);

  const handleReview = (rating: ReviewRating) => {
    if (!currentCard || !startTime) return;

    const responseTime = Date.now() - startTime;
    reviewMutation.mutate(
      { cardId: currentCard.id, rating, responseTime },
      {
        onSuccess: () => {
          // Move to next card or refetch
          if (currentCardIndex < cards.length - 1) {
            setCurrentCardIndex((prev) => prev + 1);
          } else {
            setCurrentCardIndex(0);
            refetch();
          }
          setShowAnswer(false);
          setStartTime(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Quiz</h1>
        <select
          value={currentQuizTag || ''}
          onChange={(e) => setCurrentQuizTag(e.target.value || null)}
          className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
        >
          <option value="">All Tags</option>
          {tags?.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <span className="text-gray-400">Due: </span>
          <span className="text-white font-bold">{dueCards?.total_due || 0}</span>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-400">
            Session: <span className="text-white">{sessionStats.reviewed}</span>
          </span>
          {sessionStats.reviewed > 0 && (
            <>
              <span className="text-red-400">{sessionStats.again}</span>
              <span className="text-orange-400">{sessionStats.hard}</span>
              <span className="text-green-400">{sessionStats.good}</span>
              <span className="text-blue-400">{sessionStats.easy}</span>
            </>
          )}
        </div>
      </div>

      {/* Card */}
      {!currentCard ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <p className="text-2xl text-gray-400 mb-4">No cards due!</p>
          <p className="text-gray-500">
            {dueCards?.total_due === 0
              ? 'All caught up. Check back later.'
              : 'Select a different tag or wait for more cards.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {/* Question */}
          <div className="p-8">
            <p className="text-xl text-white text-center">{currentCard.front}</p>
            {showHints && currentCard.hint && !showAnswer && (
              <p className="text-gray-400 text-center mt-4 italic">
                Hint: {currentCard.hint}
              </p>
            )}
          </div>

          {/* Answer */}
          {showAnswer ? (
            <>
              <div className="border-t border-gray-700 p-8 bg-gray-750">
                <p className="text-xl text-green-400 text-center">{currentCard.back}</p>
              </div>

              {/* Rating buttons */}
              <div className="border-t border-gray-700 p-4">
                <p className="text-gray-400 text-center text-sm mb-4">
                  How well did you remember?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 1, 2, 3] as ReviewRating[]).map((rating) => (
                    <button
                      key={rating}
                      onClick={() => handleReview(rating)}
                      disabled={reviewMutation.isPending}
                      className={clsx(
                        'py-3 rounded-md text-white font-medium transition-colors',
                        ratingLabels[rating].color,
                        reviewMutation.isPending && 'opacity-50'
                      )}
                    >
                      <span className="block">{ratingLabels[rating].label}</span>
                      <span className="text-xs opacity-75">({ratingLabels[rating].key})</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="border-t border-gray-700 p-4">
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Show Answer (Space)
              </button>
            </div>
          )}

          {/* Tags */}
          <div className="border-t border-gray-700 p-4 flex items-center gap-2">
            {currentCard.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
              >
                {tag.name}
              </span>
            ))}
            <span className="text-xs text-gray-500 ml-auto">
              Card {currentCardIndex + 1} of {cards.length}
            </span>
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      <p className="text-center text-gray-500 text-sm">
        Keyboard: Space/Enter to reveal, 1-4 to rate
      </p>
    </div>
  );
}
