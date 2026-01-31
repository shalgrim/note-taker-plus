import type {
  Source,
  SourceListResponse,
  Card,
  CardListResponse,
  DueCardsResponse,
  Tag,
  CreateSourceRequest,
  CreateCardRequest,
  ReviewCardRequest,
  SyncResult,
  SourceStatus,
  CardStatus,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = localStorage.getItem('apiKey');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { 'X-API-Key': apiKey }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// Sources API
export const sourcesApi = {
  list: (params?: {
    status?: SourceStatus;
    tag?: string;
    page?: number;
    per_page?: number;
  }): Promise<SourceListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());

    const query = searchParams.toString();
    return request(`/sources${query ? `?${query}` : ''}`);
  },

  get: (id: number): Promise<Source> => request(`/sources/${id}`),

  create: (data: CreateSourceRequest): Promise<Source> =>
    request('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<CreateSourceRequest & { status: SourceStatus }>): Promise<Source> =>
    request(`/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    request(`/sources/${id}`, { method: 'DELETE' }),

  generateCards: (id: number): Promise<{ source_id: number; cards_generated: number; cards: Card[] }> =>
    request(`/sources/${id}/generate-cards`, { method: 'POST' }),

  approve: (id: number): Promise<{ source_id: number; status: string; cards_activated: number }> =>
    request(`/sources/${id}/approve`, { method: 'POST' }),
};

// Cards API
export const cardsApi = {
  list: (params?: {
    status?: CardStatus;
    tag?: string;
    source_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<CardListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.source_id) searchParams.set('source_id', params.source_id.toString());
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());

    const query = searchParams.toString();
    return request(`/cards${query ? `?${query}` : ''}`);
  },

  getDue: (params?: { tag?: string; limit?: number }): Promise<DueCardsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const query = searchParams.toString();
    return request(`/cards/due${query ? `?${query}` : ''}`);
  },

  get: (id: number): Promise<Card> => request(`/cards/${id}`),

  create: (data: CreateCardRequest): Promise<Card> =>
    request('/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<CreateCardRequest & { status: CardStatus }>): Promise<Card> =>
    request(`/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    request(`/cards/${id}`, { method: 'DELETE' }),

  review: (id: number, data: ReviewCardRequest): Promise<Card> =>
    request(`/cards/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHistory: (id: number): Promise<{ card_id: number; total_reviews: number; reviews: unknown[] }> =>
    request(`/cards/${id}/history`),
};

// Tags API
export const tagsApi = {
  list: (): Promise<Tag[]> => request('/tags'),

  create: (data: { name: string; color?: string }): Promise<Tag> =>
    request('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number): Promise<void> =>
    request(`/tags/${id}`, { method: 'DELETE' }),
};

// Sync API
export const syncApi = {
  raindrop: (params?: { since?: string; auto_generate?: boolean }): Promise<SyncResult> => {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set('since', params.since);
    if (params?.auto_generate) searchParams.set('auto_generate', 'true');

    const query = searchParams.toString();
    return request(`/sync/raindrop${query ? `?${query}` : ''}`, { method: 'POST' });
  },

  raindropStatus: (): Promise<{ connected: boolean; message: string }> =>
    request('/sync/raindrop/status'),
};

// Health API
export const healthApi = {
  check: (): Promise<{ status: string }> => request('/health'),

  services: (): Promise<{
    ollama: { ok: boolean; message: string };
    raindrop: { ok: boolean; message: string };
  }> => request('/health/services'),
};
