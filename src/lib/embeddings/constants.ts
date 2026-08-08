import { DEFAULT_MEMORY_EXTRACTION_PROMPT, DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT } from './memory-extraction-prompts';

/**
 * Shared default settings for embeddings chat integration.
 * Single source of truth — used by MemorySettingsPanel, EmbeddingsSettingsPanel, and store defaults.
 */
export const DEFAULT_EMBEDDINGS_CHAT = {
  enabled: false,
  maxTokenBudget: 1024,
  namespaceStrategy: 'character' as const,
  showInPromptViewer: true,
  // Memory extraction settings
  memoryExtractionEnabled: false,
  memoryExtractionFrequency: 5,
  memoryExtractionMinImportance: 2,
  // Memory consolidation settings
  memoryConsolidationEnabled: false,
  memoryConsolidationThreshold: 50,
  memoryConsolidationKeepRecent: 10,
  memoryConsolidationKeepHighImportance: 4,
  // Custom memory extraction prompts
  memoryExtractionPrompt: DEFAULT_MEMORY_EXTRACTION_PROMPT,
  groupMemoryExtractionPrompt: DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT,
  // Context depth for memory extraction (0 = only last response, N = include N recent messages)
  memoryExtractionContextDepth: 2,
  // Context depth for embedding search query (0 = only user message, N = include N recent messages)
  searchContextDepth: 2,
  // Group dynamics extraction
  groupDynamicsExtraction: false,
  // Memory reinforcement settings
  memoryReinforcementEnabled: false,
  memoryReinforcementThreshold: 0.7,
  // User message extraction settings
  memoryExtractionFromUserEnabled: false,
  // Separate extraction model
  extractionModelEnabled: false,
  extractionModelProvider: 'ollama',
  extractionModelEndpoint: 'http://localhost:11434',
  extractionModelApiKey: '',
  extractionModelName: 'llama3.1:8b',
};
