import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sourcesApi, syncApi } from '../services/api';
import type { Source } from '../types';
import clsx from 'clsx';

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  // Fetch pending sources
  const { data, isLoading, error } = useQuery({
    queryKey: ['sources', 'pending'],
    queryFn: () => sourcesApi.list({ status: 'pending_review' }),
  });

  // Fetch sources with generated cards awaiting approval
  const { data: cardsGenerated } = useQuery({
    queryKey: ['sources', 'cards_generated'],
    queryFn: () => sourcesApi.list({ status: 'cards_generated' }),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => syncApi.raindrop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  // Generate cards mutation
  const generateMutation = useMutation({
    mutationFn: (sourceId: number) => sourcesApi.generateCards(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (sourceId: number) => sourcesApi.approve(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['dueCards'] });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: (sourceId: number) => sourcesApi.update(sourceId, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });

  const pendingSources = data?.sources || [];
  const cardsGeneratedSources = cardsGenerated?.sources || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
        >
          {syncMutation.isPending ? (
            <>
              <span className="animate-spin">↻</span>
              Syncing...
            </>
          ) : (
            <>
              <span>↻</span>
              Sync Raindrop
            </>
          )}
        </button>
      </div>

      {syncMutation.isSuccess && (
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-4 text-green-300">
          {syncMutation.data.message}
        </div>
      )}

      {syncMutation.isError && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          Sync failed: {(syncMutation.error as Error).message}
        </div>
      )}

      {/* Cards Generated - Awaiting Approval */}
      {cardsGeneratedSources.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Cards Generated - Ready to Approve ({cardsGeneratedSources.length})
          </h2>
          <div className="space-y-4">
            {cardsGeneratedSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                expanded={expandedSource === source.id}
                onToggle={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
                onApprove={() => approveMutation.mutate(source.id)}
                onArchive={() => archiveMutation.mutate(source.id)}
                isApproving={approveMutation.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending Review */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">
          Pending Review ({pendingSources.length})
        </h2>

        {isLoading ? (
          <p className="text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-red-400">Error loading sources</p>
        ) : pendingSources.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-lg">No pending sources!</p>
            <p className="text-gray-500 mt-2">
              Sync from Raindrop or add sources manually to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                expanded={expandedSource === source.id}
                onToggle={() => setExpandedSource(expandedSource === source.id ? null : source.id)}
                onGenerateCards={() => generateMutation.mutate(source.id)}
                onArchive={() => archiveMutation.mutate(source.id)}
                isGenerating={generateMutation.isPending && generateMutation.variables === source.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface SourceCardProps {
  source: Source;
  expanded: boolean;
  onToggle: () => void;
  onGenerateCards?: () => void;
  onApprove?: () => void;
  onArchive: () => void;
  isGenerating?: boolean;
  isApproving?: boolean;
}

function SourceCard({
  source,
  expanded,
  onToggle,
  onGenerateCards,
  onApprove,
  onArchive,
  isGenerating,
  isApproving,
}: SourceCardProps) {
  const highlightColors: Record<string, string> = {
    orange: 'border-orange-500',
    yellow: 'border-yellow-500',
    green: 'border-green-500',
    blue: 'border-blue-500',
    purple: 'border-purple-500',
    red: 'border-red-500',
  };

  const borderColor = source.highlight_color
    ? highlightColors[source.highlight_color] || 'border-gray-600'
    : 'border-gray-600';

  return (
    <div className={clsx('bg-gray-800 rounded-lg border-l-4', borderColor)}>
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white">{source.text}</p>
            {source.source_title && (
              <p className="text-sm text-gray-400 mt-1 truncate">
                From: {source.source_title}
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
              {source.card_count > 0 && (
                <span className="text-xs text-blue-400">
                  {source.card_count} card{source.card_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <span className="text-gray-400 ml-4">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4">
          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-sm block mb-4"
            >
              View original source →
            </a>
          )}

          <div className="flex gap-2">
            {onGenerateCards && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateCards();
                }}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                {isGenerating ? 'Generating...' : 'Generate Cards'}
              </button>
            )}
            {onApprove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove();
                }}
                disabled={isApproving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-md text-sm transition-colors"
              >
                {isApproving ? 'Approving...' : 'Approve & Activate'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Archive
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
