/**
 * Types for the Embeddings System
 * Vector search using LanceDB + Ollama
 */

/** Stored embedding record */
export interface Embedding {
  id: string;
  content: string;
  vector?: number[];
  metadata: Record<string, any>;
  namespace: string;
  source_type?: string;
  source_id?: string;
  model_name: string;
  created_at: Date;
  updated_at: Date;
}

/** Embedding API response */
export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  tokens?: number;
}

/** Parameters to create a single embedding */
export interface CreateEmbeddingParams {
  content: string;
  metadata?: Record<string, any>;
  namespace?: string;
  source_type?: string;
  source_id?: string;
}

/** Parameters for batch creation */
export interface CreateEmbeddingBatchParams {
  items: CreateEmbeddingParams[];
  namespace?: string;
}

/** Vector search parameters */
export interface SearchParams {
  query?: string;
  queryVector?: number[];
  namespace?: string;
  limit?: number;
  threshold?: number;
  source_type?: string;
  source_id?: string;
}

/** Search result with similarity score */
export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  namespace: string;
  source_type?: string;
  source_id?: string;
  similarity: number;
}

/** Namespace for organizing embeddings */
export interface RecordNamespace {
  id: string;
  namespace: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  embedding_count?: number;
}

/** Namespace upsert params */
export interface UpsertNamespaceParams {
  namespace: string;
  description?: string;
  metadata?: Record<string, any>;
}

/** System-wide embedding statistics */
export interface EmbeddingStats {
  totalEmbeddings: number;
  totalNamespaces: number;
  embeddingsByNamespace: Record<string, number>;
  embeddingsBySourceType: Record<string, number>;
}

/** Source types for embeddings */
export type SourceType =
  | 'character'
  | 'world'
  | 'lorebook'
  | 'session'
  | 'memory'
  | 'custom';

/** Embedding configuration (persisted to JSON) */
export interface EmbeddingsConfig {
  ollamaUrl: string;
  model: string;
  dimension: number;
  similarityThreshold: number;
  maxResults: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  updatedAt?: string;
}

/** Embedding error class */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/** Known embedding models and their dimensions */
export const MODEL_DIMENSIONS: Record<string, number> = {
  'bge-m3': 1024,
  'bge-m3:567m': 1024,
  'bge-m3:latest': 1024,
  'nomic-embed-text': 768,
  'nomic-embed-text:latest': 768,
  'mxbai-embed-large': 1024,
  'mxbai-embed-large:latest': 1024,
  'all-minilm': 384,
  'all-minilm:latest': 384,
  'snowflake-arctic-embed': 1024,
  'snowflake-arctic-embed:latest': 1024,
  'llama3.1:8b': 4096,
  'phi3:mini': 3072,
};
