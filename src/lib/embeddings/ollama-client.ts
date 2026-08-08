/**
 * Ollama Embedding Client
 * 
 * Generates vector embeddings via the Ollama API.
 * Supports retry logic and connection testing.
 * 
 * Key design: One-shot token estimation and truncation.
 * No progressive retries on context-length errors — we estimate tokens
 * client-side and truncate the input BEFORE sending it to Ollama.
 */

import type { EmbeddingsConfig } from './types';
import { EmbeddingError, MODEL_CONTEXT_LENGTHS, DEFAULT_CONTEXT_LENGTH, CHARS_PER_TOKEN } from './types';
import { getConfig } from './config-persistence';

/**
 * Auto-detect a model's context length by querying Ollama's /api/show endpoint.
 *
 * Priority:
 * 1. model_info keys ending in .context_length (e.g. bert.context_length, nomic.context_length)
 * 2. parameters.num_ctx (older Ollama versions)
 * 3. Falls back to MODEL_CONTEXT_LENGTHS map → DEFAULT_CONTEXT_LENGTH (512)
 *
 * @param ollamaUrl - Base URL of the Ollama server (e.g. http://localhost:11434)
 * @param model - Model name (e.g. "bge-m3:567m")
 * @returns Detected context length in tokens
 */
export async function detectModelContextLength(ollamaUrl: string, model: string): Promise<number> {
  // Hardcoded fallback first
  const hardcodedFallback = MODEL_CONTEXT_LENGTHS[model]
    || MODEL_CONTEXT_LENGTHS[model.split(':')[0]]
    || DEFAULT_CONTEXT_LENGTH;

  try {
    const response = await fetch(`${ollamaUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return hardcodedFallback;

    const data: any = await response.json();

    // 1. Check model_info for keys ending in .context_length
    const modelInfo = data?.model_info || {};
    for (const [key, value] of Object.entries(modelInfo as Record<string, unknown>)) {
      if (key.endsWith('.context_length') || key.endsWith('.context_length ')) {
        const numValue = Number(value);
        if (numValue > 0 && numValue <= 1000000) {
          console.log(`[Embeddings] Auto-detected context length for "${model}": ${numValue} tokens (from ${key})`);
          return numValue;
        }
      }
    }

    // 2. Check parameters for num_ctx (older Ollama versions return string)
    const params = data?.parameters;
    if (params) {
      if (typeof params === 'object' && params.num_ctx) {
        const numCtx = Number(params.num_ctx);
        if (numCtx > 0 && numCtx <= 1000000) {
          console.log(`[Embeddings] Auto-detected context length for "${model}": ${numCtx} tokens (from parameters.num_ctx)`);
          return numCtx;
        }
      }
      if (typeof params === 'string') {
        const numCtxMatch = params.match(/num_ctx\s+(\d+)/);
        if (numCtxMatch) {
          const numCtx = parseInt(numCtxMatch[1]);
          if (numCtx > 0 && numCtx <= 1000000) {
            console.log(`[Embeddings] Auto-detected context length for "${model}": ${numCtx} tokens (from parameters string)`);
            return numCtx;
          }
        }
      }
    }

    return hardcodedFallback;
  } catch (error) {
    console.warn(`[Embeddings] Failed to detect context length for "${model}":`, error);
    return hardcodedFallback;
  }
}

export class OllamaEmbeddingClient {
  private config: EmbeddingsConfig;
  /** Cached max context length for the current model (in tokens) */
  private cachedMaxContextTokens: number | null = null;

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

  /**
   * Get the maximum context length in tokens for the current model.
   *
   * Priority:
   * 1. Config's modelContextLength (auto-detected and persisted)
   * 2. Cached value from previous detection
   * 3. Known MODEL_CONTEXT_LENGTHS map
   * 4. Query Ollama /api/show via detectModelContextLength()
   * 5. Conservative DEFAULT_CONTEXT_LENGTH (512 tokens)
   */
  async getMaxContextTokens(): Promise<number> {
    if (this.cachedMaxContextTokens) return this.cachedMaxContextTokens;

    // 1. Use persisted config value if available
    if (this.config.modelContextLength && this.config.modelContextLength > 0) {
      this.cachedMaxContextTokens = this.config.modelContextLength;
      return this.cachedMaxContextTokens;
    }

    // 2. Try known models map
    const modelKey = this.config.model;
    if (MODEL_CONTEXT_LENGTHS[modelKey]) {
      this.cachedMaxContextTokens = MODEL_CONTEXT_LENGTHS[modelKey];
      return this.cachedMaxContextTokens;
    }

    // 3. Try base model name (strip :tag)
    const baseModel = modelKey.split(':')[0];
    if (MODEL_CONTEXT_LENGTHS[baseModel]) {
      this.cachedMaxContextTokens = MODEL_CONTEXT_LENGTHS[baseModel];
      return this.cachedMaxContextTokens;
    }

    // 4. Query Ollama /api/show via the shared detection function
    this.cachedMaxContextTokens = await detectModelContextLength(
      this.config.ollamaUrl,
      this.config.model,
    );
    return this.cachedMaxContextTokens;
  }

  /**
   * Estimate the number of tokens in a text.
   * Uses a conservative chars-per-token ratio for mixed/Spanish text.
   * This is intentionally conservative (overestimates) to avoid context-length errors.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Truncate text to fit within a given token budget.
   * Returns the truncated text.
   */
  truncateToTokenBudget(text: string, maxTokens: number): string {
    const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  }

  /** Generate embedding for a single text */
  async embedText(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // ONE-SHOT: Estimate tokens and truncate before sending to Ollama.
    // Use 75% of the model's context window to leave room for special tokens
    // and tokenization differences.
    const maxContextTokens = await this.getMaxContextTokens();
    const safeTokenBudget = Math.floor(maxContextTokens * 0.75);
    const truncatedText = this.truncateToTokenBudget(text, safeTokenBudget);

    if (truncatedText.length < text.length) {
      console.warn(
        `[Embeddings] Truncated input from ${text.length} to ${truncatedText.length} chars ` +
        `(model: ${this.config.model}, context: ${maxContextTokens} tokens, ` +
        `safe budget: ${safeTokenBudget} tokens ≈ ${Math.floor(safeTokenBudget * CHARS_PER_TOKEN)} chars)`
      );
    }

    // Send to Ollama with standard retry (for transient errors only)
    return this.retryOperation(async () => {
      const response = await fetch(`${this.config.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, prompt: truncatedText }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // If we STILL get a context-length error despite our estimation,
        // do ONE emergency retry at half the size (should never happen,
        // but protects against estimation errors)
        if (
          response.status === 500 &&
          typeof errorText === 'string' &&
          errorText.includes('exceeds the context length')
        ) {
          const emergencyText = truncatedText.slice(0, Math.floor(truncatedText.length / 2));
          console.warn(
            `[Embeddings] Emergency retry: context-length error despite truncation. ` +
            `Retrying with ${emergencyText.length} chars (was ${truncatedText.length})`
          );

          const retryResponse = await fetch(`${this.config.ollamaUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.config.model, prompt: emergencyText }),
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            throw new EmbeddingError(
              `Ollama server error: ${retryResponse.status}`,
              'SERVER_ERROR',
              { status: retryResponse.status, text: retryErrorText }
            );
          }

          const retryData: any = await retryResponse.json();
          if (!retryData.embedding || !Array.isArray(retryData.embedding)) {
            throw new EmbeddingError('Invalid server response', 'INVALID_RESPONSE', retryData);
          }

          // Update cache with a smaller context for future calls
          this.cachedMaxContextTokens = Math.floor(this.estimateTokens(emergencyText) / 0.75);
          console.warn(
            `[Embeddings] Updated model context estimate to ${this.cachedMaxContextTokens} tokens after emergency retry`
          );

          return retryData.embedding;
        }

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
    for (let attempt = 0; attempt <= this.config.retryCount!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (error instanceof EmbeddingError &&
            (error.code === 'INVALID_INPUT' || error.code === 'AUTH_ERROR')) {
          throw error;
        }
        if (attempt === this.config.retryCount!) break;
        await this.delay(this.config.retryDelay! * (attempt + 1));
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
  updateConfig(updates: Partial<EmbeddingsConfig>): void {
    const oldModel = this.config.model;
    this.config = { ...this.config, ...updates };
    // Reset cached context when model changes
    if (updates.model && updates.model !== oldModel) {
      this.cachedMaxContextTokens = null;
    }
  }

  /** Reset the cached model context length (call after model change) */
  resetModelCache(): void {
    this.cachedMaxContextTokens = null;
  }

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
