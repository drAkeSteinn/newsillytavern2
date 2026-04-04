/**
 * Unified Embedding Client
 * 
 * Combines Ollama (vector generation) + LanceDB (vector storage).
 * Provides a high-level API for creating, searching, and managing embeddings.
 */

import { OllamaEmbeddingClient, getOllamaClient, resetOllamaClient } from './ollama-client';
import { LanceDBWrapper } from './lancedb-db';
import type {
  CreateEmbeddingParams,
  SearchParams,
  SearchResult,
  RecordNamespace,
  EmbeddingStats,
  SourceType,
} from './types';

export class EmbeddingClient {
  private ollamaClient: OllamaEmbeddingClient;
  private db = LanceDBWrapper;

  constructor(config?: any) {
    this.ollamaClient = getOllamaClient(config);
  }

  getActiveClient() { return this.ollamaClient; }

  /**
   * Ensure the Ollama client uses the latest persisted config.
   * If the model changed, reset the singleton and create a fresh client.
   * Uses require() for sync access (loadConfig is already lazy-cached).
   */
  private refreshOllamaClient(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadConfig } = require('./config-persistence');
      const cfg = loadConfig();
      const currentModel = this.getActiveClient().getConfig().model;
      if (currentModel !== cfg.model) {
        resetOllamaClient();
        const fresh = getOllamaClient({
          ollamaUrl: cfg.ollamaUrl,
          model: cfg.model,
          dimension: cfg.dimension,
          similarityThreshold: cfg.similarityThreshold,
          maxResults: cfg.maxResults,
        });
        (this as any).ollamaClient = fresh;
      }
    } catch { /* proceed with existing client */ }
  }

  /** Create a new embedding (generate vector + store) */
  async createEmbedding(params: CreateEmbeddingParams): Promise<string> {
    const { content, metadata = {}, namespace, source_type, source_id } = params;

    // Always ensure the Ollama client uses the latest persisted config
    this.refreshOllamaClient();

    const vector = await this.getActiveClient().embedText(content);

    const embeddingId = await this.db.insertEmbedding({
      content,
      vector,
      metadata: { ...metadata, created_at: new Date().toISOString(), source_type, source_id },
      namespace: namespace || 'default',
      source_type,
      source_id,
      model_name: this.getActiveClient().getConfig().model,
    });

    return embeddingId;
  }

  /** Create multiple embeddings in batch */
  async createBatchEmbeddings(items: CreateEmbeddingParams[], namespace?: string): Promise<string[]> {
    if (items.length === 0) throw new Error('No items to process');

    const texts = items.map(item => item.content);
    const vectors = await this.getActiveClient().embedBatch(texts);
    const embeddingIds: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const vector = vectors[i];

      const embeddingId = await this.db.insertEmbedding({
        content: item.content,
        vector,
        metadata: {
          ...(item.metadata || {}),
          created_at: new Date().toISOString(),
          source_type: item.source_type,
          source_id: item.source_id,
        },
        namespace: namespace || item.namespace || 'default',
        source_type: item.source_type,
        source_id: item.source_id,
        model_name: this.getActiveClient().getConfig().model,
      });

      embeddingIds.push(embeddingId);
    }

    return embeddingIds;
  }

  /** Search similar embeddings (by text or vector) */
  async searchSimilar(params: SearchParams): Promise<SearchResult[]> {
    const { query, queryVector, namespace, limit, threshold, source_type, source_id } = params;

    // Always load the latest persisted config for defaults
    let configThreshold = 0.3;
    let configMaxResults = 10;
    try {
      const { getConfig } = await import('./config-persistence');
      const persistedConfig = getConfig();
      configThreshold = persistedConfig.similarityThreshold ?? 0.3;
      configMaxResults = persistedConfig.maxResults ?? 10;
    } catch { /* use defaults */ }

    // Ensure the Ollama client uses the latest model from persisted config
    this.refreshOllamaClient();

    let vector: number[];
    if (queryVector) {
      vector = queryVector;
    } else if (query) {
      vector = await this.getActiveClient().embedText(query);
    } else {
      throw new Error('Must provide query or queryVector');
    }

    const results = await this.db.searchSimilar({
      queryVector: vector,
      namespace,
      limit: limit || configMaxResults,
      threshold: threshold ?? configThreshold,
    });

    let filtered = results;
    if (source_type) filtered = filtered.filter(r => r.source_type === source_type);
    if (source_id) filtered = filtered.filter(r => r.source_id === source_id);

    return filtered;
  }

  /** Create embedding and add to namespace */
  async createAndAddToNamespace(params: {
    content: string;
    namespace: string;
    metadata?: Record<string, any>;
    source_type?: SourceType;
    source_id?: string;
  }): Promise<{ embeddingId: string; namespaceId: string }> {
    const { content, namespace, metadata, source_type, source_id } = params;

    const embeddingId = await this.createEmbedding({
      content, metadata, namespace, source_type, source_id,
    });

    await this.db.addEmbeddingToNamespace(namespace, embeddingId);

    const namespaces = await this.db.getAllNamespaces();
    const ns = namespaces.find(n => n.namespace === namespace);

    return { embeddingId, namespaceId: ns?.id || '' };
  }

  async getEmbedding(id: string) { return this.db.getEmbeddingById(id); }
  async deleteEmbedding(id: string): Promise<boolean> { return this.db.deleteEmbedding(id); }
  async deleteBySource(source_type: SourceType, source_id: string): Promise<number> {
    return this.db.deleteBySource(source_type, source_id);
  }

  async updateEmbedding(id: string, content: string, metadata?: Record<string, any>): Promise<void> {
    await this.db.deleteEmbedding(id);
    const vector = await this.getActiveClient().embedText(content);

    // We need the old embedding info, but we just deleted it...
    // This is a known limitation - for full update, fetch before delete
    throw new Error('Update not yet implemented. Delete and recreate instead.');
  }

  // ========== Namespace Methods ==========

  async upsertNamespace(params: {
    namespace: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<RecordNamespace> {
    return this.db.upsertNamespace(params);
  }

  async addToNamespace(namespace: string, embeddingId: string): Promise<void> {
    return this.db.addEmbeddingToNamespace(namespace, embeddingId);
  }

  async getNamespaceEmbeddings(namespace: string, limit: number = 100) {
    return this.db.getNamespaceEmbeddings(namespace, limit);
  }

  async searchInNamespace(params: {
    namespace: string;
    query: string;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    const { namespace, query, limit, threshold } = params;
    // Ensure latest model config
    this.refreshOllamaClient();
    const vector = await this.getActiveClient().embedText(query);
    return this.db.searchInNamespace({ namespace, queryVector: vector, limit: limit || 10, threshold: threshold || 0.5 });
  }

  async deleteNamespace(namespace: string): Promise<boolean> {
    return this.db.deleteNamespace(namespace);
  }

  async getAllNamespaces(): Promise<RecordNamespace[]> {
    return this.db.getAllNamespaces();
  }

  // ========== Utility Methods ==========

  async checkConnections(): Promise<{ db: boolean; ollama: boolean }> {
    const [dbConn, ollamaConn] = await Promise.all([
      LanceDBWrapper.checkConnection(),
      this.ollamaClient.checkConnection(),
    ]);
    return { db: dbConn, ollama: ollamaConn };
  }

  async getStats(): Promise<EmbeddingStats> {
    return this.db.getStats();
  }

  async close(): Promise<void> {
    await LanceDBWrapper.close();
  }
}

// Singleton
let embeddingClientInstance: EmbeddingClient | null = null;

export function getEmbeddingClient(config?: any): EmbeddingClient {
  if (!embeddingClientInstance) {
    embeddingClientInstance = new EmbeddingClient(config);
  } else if (config) {
    const ollamaClient = getOllamaClient(config);
    (embeddingClientInstance as any).ollamaClient = ollamaClient;
  }
  return embeddingClientInstance;
}

export function resetEmbeddingClient(config?: any): EmbeddingClient {
  // Reset Ollama singleton so a fresh one is created with the new config
  resetOllamaClient();
  embeddingClientInstance = new EmbeddingClient(config);
  return embeddingClientInstance;
}

export default EmbeddingClient;
