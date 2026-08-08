# Task 2: Auto-detect Embedding Model Context Length

## Summary
Added auto-detection of embedding model context length from Ollama API and persisted it in the embeddings config. All context-length-dependent code now uses the auto-detected value with hardcoded fallbacks.

## Changes Made

### 1. `src/lib/embeddings/types.ts`
- Added `modelContextLength?: number` field to `EmbeddingsConfig` interface
- Added `resolveModelContextLength()` utility function that resolves context length with priority: config value → hardcoded map → base model map → DEFAULT_CONTEXT_LENGTH (512)

### 2. `src/lib/embeddings/ollama-client.ts`
- Added standalone `detectModelContextLength(ollamaUrl, model)` function that queries Ollama `/api/show` endpoint
- Detection priority: `model_info` keys ending in `.context_length` → `parameters.num_ctx` → hardcoded fallback
- Updated `OllamaEmbeddingClient.getMaxContextTokens()` to check `config.modelContextLength` first, then fallback chain

### 3. `src/lib/embeddings/config-persistence.ts`
- Added `modelContextLength: undefined` to `DEFAULT_CONFIG`
- Added `getModelContextLength()` helper that uses `resolveModelContextLength()`
- Imported `resolveModelContextLength` from types

### 4. `src/app/api/embeddings/detect-context/route.ts` (NEW)
- `POST /api/embeddings/detect-context` endpoint
- Body: `{ ollamaUrl?: string, model?: string }`
- Returns: `{ success: true, contextLength: number, model: string }`
- Saves detected value to config and resets embedding client

### 5. `src/app/api/embeddings/config/route.ts`
- When `modelChanged` is true, auto-detects context length via `detectModelContextLength()`
- Saves `modelContextLength` to config before persisting
- Added `contextAutoDetected` flag to response meta

### 6. `src/lib/embeddings/chat-context.ts`
- Replaced direct `MODEL_CONTEXT_LENGTHS[model]` usage with `getModelContextLength()`
- Removed unused imports (`MODEL_CONTEXT_LENGTHS`, `DEFAULT_CONTEXT_LENGTH`)

### 7. `src/lib/embeddings/memory-consolidation.ts`
- Added `getModelContextLength()` and `CHARS_PER_TOKEN` imports
- Truncates facts list in `consolidateGroup()` to 60% of model's context window in chars

### 8. `src/lib/embeddings/memory-extraction.ts`
- Added `getModelContextLength()` and `CHARS_PER_TOKEN` imports
- Truncates `chatContext` to 50% of model's context window before building extraction prompt

### 9. `src/components/embeddings/embeddings-settings-panel.tsx`
- Added `modelContextLength` to `EmbeddingConfig` interface
- Added `detectingContext` state
- Added `handleDetectContext()` function that calls `/api/embeddings/detect-context`
- Updated `handleModelChange()` to clear `modelContextLength` when model changes
- Added context length badge + "Detectar" button below the model selector
