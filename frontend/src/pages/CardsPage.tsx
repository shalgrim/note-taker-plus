import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cardsApi, tagsApi } from '../services/api';
import type { Card, CardStatus } from '../types';
import clsx from 'clsx';

const statusLabels: Record<CardStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  suspended: 'Suspended',
  mastered: 'Mastered',
};

const statusColors: Record<CardStatus, string> = {
  draft: 'bg-yellow-600',
  active: 'bg-green-600',
  suspended: 'bg-gray-600',
  mastered: 'bg-purple-600',
};

export default function CardsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<CardStatus | ''>('');
  const [filterTag, setFilterTag] = useState('');
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch cards
  const { data, isLoading } = useQuery({
    queryKey: ['cards', filterStatus, filterTag],
    queryFn: () =>
      cardsApi.list({
        status: filterStatus || undefined,
        tag: filterTag || undefined,
        per_page: 50,
      }),
  });

  // Fetch tags for filter
  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => cardsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CardStatus }) =>
      cardsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['dueCards'] });
    },
  });

  const cards = data?.cards || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Cards</h1>
        <div className="flex items-center gap-4">
          <p className="text-gray-400">{data?.total || 0} total cards</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            + New Card
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CardStatus | '')}
          className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
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

      {/* Cards List */}
      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : cards.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No cards found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onEdit={() => setEditingCard(card)}
              onDelete={() => {
                if (confirm('Delete this card?')) {
                  deleteMutation.mutate(card.id);
                }
              }}
              onStatusChange={(status) =>
                statusMutation.mutate({ id: card.id, status })
              }
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCardModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

function CardItem({
  card,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: CardStatus) => void;
}) {
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-xs px-2 py-1 rounded text-white',
              statusColors[card.status]
            )}
          >
            {statusLabels[card.status]}
          </span>
          {card.interval_days > 0 && (
            <span className="text-xs text-gray-400">
              {card.interval_days}d interval
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-white p-1"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 p-1"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="cursor-pointer"
        onClick={() => setShowBack(!showBack)}
      >
        <p className="text-white font-medium">{card.front}</p>
        {showBack && (
          <p className="text-gray-300 mt-2 pt-2 border-t border-gray-700">
            {card.back}
          </p>
        )}
        {!showBack && (
          <p className="text-gray-500 text-sm mt-2">Click to reveal answer</p>
        )}
      </div>

      {card.hint && (
        <p className="text-gray-400 text-sm mt-2 italic">Hint: {card.hint}</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        {card.tags.map((tag) => (
          <span
            key={tag.id}
            className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
          >
            {tag.name}
          </span>
        ))}
      </div>

      {/* Status actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
        {card.status === 'draft' && (
          <button
            onClick={() => onStatusChange('active')}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
          >
            Activate
          </button>
        )}
        {card.status === 'active' && (
          <button
            onClick={() => onStatusChange('suspended')}
            className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded"
          >
            Suspend
          </button>
        )}
        {card.status === 'suspended' && (
          <button
            onClick={() => onStatusChange('active')}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

function EditCardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [hint, setHint] = useState(card.hint || '');
  const [tags, setTags] = useState(card.tags.map((t) => t.name).join(', '));

  const updateMutation = useMutation({
    mutationFn: () =>
      cardsApi.update(card.id, {
        front,
        back,
        hint: hint || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Edit Card</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-300 mb-1">Front *</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Back *</label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Hint</label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateCardModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [tags, setTags] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      cardsApi.create({
        front,
        back,
        hint: hint || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Create Card</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-300 mb-1">Front (Question) *</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
              rows={3}
              placeholder="What do you want to remember?"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Back (Answer) *</label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
              rows={3}
              placeholder="The answer or explanation"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Hint (optional)</label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="A hint to help recall"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="python, programming, basics"
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
