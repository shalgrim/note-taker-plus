// Source types
export type SourceType = 'raindrop' | 'readwise' | 'chrome_extension' | 'manual' | 'alfred' | 'ios_shortcut';
export type SourceStatus = 'pending_review' | 'cards_generated' | 'approved' | 'archived';

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Source {
  id: number;
  text: string;
  source_type: SourceType;
  source_url: string | null;
  source_title: string | null;
  external_id: string | null;
  highlight_color: string | null;
  status: SourceStatus;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  card_count: number;
}

export interface SourceListResponse {
  sources: Source[];
  total: number;
  page: number;
  per_page: number;
}

// Card types
export type CardStatus = 'draft' | 'active' | 'suspended' | 'mastered';
export type ReviewRating = 0 | 1 | 2 | 3; // AGAIN, HARD, GOOD, EASY

export interface Card {
  id: number;
  front: string;
  back: string;
  hint: string | null;
  source_id: number | null;
  status: CardStatus;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string | null;
  last_reviewed: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface CardListResponse {
  cards: Card[];
  total: number;
  page: number;
  per_page: number;
}

export interface DueCardsResponse {
  cards: Card[];
  total_due: number;
}

// API request types
export interface CreateSourceRequest {
  text: string;
  source_type?: SourceType;
  source_url?: string;
  source_title?: string;
  tags?: string[];
}

export interface CreateCardRequest {
  front: string;
  back: string;
  hint?: string;
  source_id?: number;
  tags?: string[];
}

export interface ReviewCardRequest {
  rating: ReviewRating;
  response_time_ms?: number;
}

// Sync types
export interface SyncResult {
  synced: number;
  skipped_duplicates: number;
  flashcard_ready: number;
  total_highlights: number;
  message: string;
}
