/**
 * Ollama Embedding Client
 * 
 * Generates vector embeddings via the Ollama API.
 * Supports retry logic and connection testing.
 */

import type { EmbeddingsConfig } from './types';
import { EmbeddingError } from './types';
import { getConfig } from './config-persistence';

export class OllamaEmbeddingClient {
  private config: EmbeddingsConfig;

  constructor(config?: Partial<EmbeddingsConfig>) {
    let persistentConfig: Partial<EmbeddingsConfig> = {};
    try {
      persistentConfig = getConfig();
    } catch {
      // Use defaults
    }

    this.config = {
      ollamaUrl: persistentConfig.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434',
      model: persistentConfig.model || process.env.EMBEDDING_MODEL || 'bge-m3:567m',
      dimension: persistentConfig.dimension || parseInt(process.env.EMBEDDING_DIMENSION || '1024'),
      similarityThreshold: persistentConfig.similarityThreshold || 0.5,
      maxResults: persistentConfig.maxResults || 5,
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /** Generate embedding for a single text */
  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    return this.retryOperation(async () => {
      const response = await fetch(`${this.config.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, prompt: text }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new EmbeddingError(
          `Ollama server error: ${response.status}`,
          'SERVER_ERROR',
          { status: response.status, text: errorText }
        );
      }

      const data: any = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new EmbeddingError('Invalid server response', 'INVALID_RESPONSE', data);
      }

      return data.embedding;
    });
  }

  /** Generate embeddings for multiple texts (sequential) */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) throw new Error('No texts to process');
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      allEmbeddings.push(await this.embedText(texts[i]));
    }
    return allEmbeddings;
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (error instanceof EmbeddingError &&
            (error.code === 'INVALID_INPUT' || error.code === 'AUTH_ERROR')) {
          throw error;
        }
        if (attempt === this.config.retryCount) break;
        await this.delay(this.config.retryDelay * (attempt + 1));
      }
    }
    throw lastError;
  }

  /** Check Ollama connection */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Get available models from Ollama */
  async getAvailableModels(): Promise<{ name: string; size?: number; modified_at?: string }[]> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];
      const data: any = await response.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  getConfig(): EmbeddingsConfig { return { ...this.config }; }
  updateConfig(updates: Partial<EmbeddingsConfig>): void { this.config = { ...this.config, ...updates }; }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('Vectors must have the same dimension');
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Singleton
let ollamaClientInstance: OllamaEmbeddingClient | null = null;

export function getOllamaClient(config?: Partial<EmbeddingsConfig>): OllamaEmbeddingClient {
  if (!ollamaClientInstance) {
    ollamaClientInstance = new OllamaEmbeddingClient(config);
  } else if (config) {
    ollamaClientInstance.updateConfig(config);
  }
  return ollamaClientInstance;
}

/** Reset the singleton so next getOllamaClient() creates a fresh instance */
export function resetOllamaClient(): void {
  ollamaClientInstance = null;
}

export default OllamaEmbeddingClient;
