// ─────────────────────────────────────────────────────────────
// RepoFlow Shared Types
// Shared between @repoflow/backend and @repoflow/frontend
// ─────────────────────────────────────────────────────────────

// ── API Response Envelope ────────────────────────────────────

/** Standard success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Unified API response type */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Health Check ─────────────────────────────────────────────

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  database: 'connected' | 'disconnected';
}

// ── Ingestion Status ─────────────────────────────────────────

export type IngestionStatus =
  | 'PENDING'
  | 'FETCHING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'COMPLETED'
  | 'FAILED';

// ── Repository ───────────────────────────────────────────────

export interface Repository {
  id: string;
  githubUrl: string;
  owner: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  license: string | null;
  status: IngestionStatus;
  statusMessage: string | null;
  totalFiles: number;
  totalChunks: number;
  ingestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Chunk Types ──────────────────────────────────────────────

export type ChunkType = 'FUNCTION' | 'CLASS' | 'HEADING_SECTION' | 'SLIDING_WINDOW' | 'FULL_FILE';

export interface Chunk {
  id: string;
  repoId: string;
  fileId: string;
  content: string;
  filePath: string;
  language: string | null;
  startLine: number;
  endLine: number;
  chunkIndex: number;
  chunkType: ChunkType;
  tokenCount: number;
}

// ── Chat ─────────────────────────────────────────────────────

export type MessageRole = 'USER' | 'ASSISTANT';

export interface Citation {
  rank: number;
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  snippet: string;
  similarityScore: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  citations: Citation[] | null;
  confidenceScore: number | null;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  repoId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── API Request/Response Types ───────────────────────────────

export interface IngestRepoRequest {
  githubUrl: string;
}

export interface IngestRepoResponse {
  repoId: string;
  owner: string;
  name: string;
  status: IngestionStatus;
  message: string;
}

export interface ChatRequest {
  sessionId?: string;
  question: string;
  stream?: boolean;
}

export interface ChatResponse {
  messageId: string;
  sessionId: string;
  answer: string;
  confidenceScore: number;
  citations: Citation[];
  promptTokens: number;
  completionTokens: number;
}
