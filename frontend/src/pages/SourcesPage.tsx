import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi, tagsApi } from '../services/api';
import type { Source, SourceStatus } from '../types';
import clsx from 'clsx';

const statusLabels: Record<SourceStatus, string> = {
  pending_review: 'Pending',
  cards_generated: 'Cards Generated',
  approved: 'Approved',
  archived: 'Archived',
};

const statusColors: Record<SourceStatus, string> = {
  pending_review: 'bg-yellow-600',
  cards_generated: 'bg-blue-600',
  approved: 'bg-green-600',
  archived: 'bg-gray-600',
};

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<SourceStatus | ''>('');
  const [filterTag, setFilterTag] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch sources
  const { data, isLoading } = useQuery({
    queryKey: ['sources', filterStatus, filterTag],
    queryFn: () =>
      sourcesApi.list({
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
    mutationFn: (id: number) => sourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  const sources = data?.sources || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sources</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          + Add Source
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as SourceStatus | '')}
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

      {/* Sources List */}
      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : sources.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No sources found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onDelete={() => {
                if (confirm('Delete this source and all its cards?')) {
                  deleteMutation.mutate(source.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Add Source Modal */}
      {showAddForm && (
        <AddSourceModal onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
}

function SourceRow({ source, onDelete }: { source: Source; onDelete: () => void }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={clsx(
                'text-xs px-2 py-1 rounded text-white',
                statusColors[source.status]
              )}
            >
              {statusLabels[source.status]}
            </span>
            <span className="text-xs text-gray-400">
              {source.source_type}
            </span>
          </div>
          <p className="text-white">{source.text}</p>
          {source.source_title && (
            <p className="text-sm text-gray-400 mt-1">
              {source.source_title}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {source.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
              >
                {tag.name}
              </span>
            ))}
            <span className="text-xs text-gray-500">
              {source.card_count} cards
            </span>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 ml-4"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function AddSourceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [tags, setTags] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      sourcesApi.create({
        text,
        source_type: 'manual',
        source_url: sourceUrl || undefined,
        source_title: sourceTitle || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">Add Source</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Text / Highlight *
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
              placeholder="The fact or concept you want to learn..."
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Source Title
            </label>
            <input
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
              placeholder="Article or book title"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Source URL
            </label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
              placeholder="https://..."
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
              placeholder="python, programming, ..."
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
              disabled={!text || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
