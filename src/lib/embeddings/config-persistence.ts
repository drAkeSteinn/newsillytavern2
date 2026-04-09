/**
 * Embeddings Configuration Persistence
 * 
 * Stores embeddings config in data/embeddings-config.json
 * Uses file-based persistence between server restarts.
 */

import fs from 'fs';
import path from 'path';
import type { EmbeddingsConfig } from './types';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'embeddings-config.json');

const DEFAULT_CONFIG: EmbeddingsConfig = {
  ollamaUrl: 'http://localhost:11434',
  model: 'bge-m3:567m',
  dimension: 1024,
  similarityThreshold: 0.5,
  maxResults: 5,
  updatedAt: new Date().toISOString(),
};

let cachedConfig: EmbeddingsConfig | null = null;

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): EmbeddingsConfig {
  if (cachedConfig) return cachedConfig;

  try {
    ensureConfigDir();

    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(content) as EmbeddingsConfig;

      if (!config.ollamaUrl || !config.model) {
        cachedConfig = { ...DEFAULT_CONFIG, ...config };
        return cachedConfig;
      }

      if (config.similarityThreshold === undefined) config.similarityThreshold = DEFAULT_CONFIG.similarityThreshold;
      if (config.maxResults === undefined) config.maxResults = DEFAULT_CONFIG.maxResults;
      if (config.dimension === undefined) config.dimension = DEFAULT_CONFIG.dimension;

      cachedConfig = config;
      return cachedConfig;
    }
  } catch (error) {
    console.error('Error loading embeddings config:', error);
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  saveConfig(cachedConfig);
  return cachedConfig;
}

export function saveConfig(config: Partial<EmbeddingsConfig>): EmbeddingsConfig {
  try {
    ensureConfigDir();

    const currentConfig = cachedConfig || loadConfig();
    const newConfig: EmbeddingsConfig = {
      ...currentConfig,
      ...config,
      updatedAt: new Date().toISOString(),
    };

    newConfig.similarityThreshold = Math.max(0, Math.min(1, newConfig.similarityThreshold));
    newConfig.maxResults = Math.max(1, Math.min(100, newConfig.maxResults));

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    cachedConfig = newConfig;

    // Update runtime env vars so subsequent reads pick them up
    process.env.OLLAMA_URL = newConfig.ollamaUrl;
    process.env.EMBEDDING_MODEL = newConfig.model;
    process.env.EMBEDDING_DIMENSION = newConfig.dimension.toString();

    return newConfig;
  } catch (error) {
    console.error('Error saving embeddings config:', error);
    throw error;
  }
}

export function getConfig(): EmbeddingsConfig {
  return cachedConfig || loadConfig();
}

export function getSimilarityThreshold(): number {
  return getConfig().similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold;
}

export function getMaxResults(): number {
  return getConfig().maxResults ?? DEFAULT_CONFIG.maxResults;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
}

export function resetConfig(): EmbeddingsConfig {
  cachedConfig = { ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() };
  saveConfig(cachedConfig);
  return cachedConfig;
}

// Load config on module import
loadConfig();
