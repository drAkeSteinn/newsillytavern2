# Task 2-c: Deduplicate between embeddings context and character memory in prompt

## Summary
Implemented deduplication logic to prevent the same memory from appearing twice in the LLM prompt — once from Character Memory (Zustand store) and once from LanceDB embeddings.

## Changes Made

### 1. `src/lib/embeddings/chat-context.ts`
- Added `existingMemoryEvents` optional parameter to `retrieveEmbeddingsContext()`
- Added deduplication logic after sorting/trimming results:
  - Only filters `source_type === 'memory'` embeddings (lore/world content untouched)
  - Word-level overlap comparison (words >3 chars to avoid stop-word noise)
  - 60% overlap threshold → embedding is considered duplicate
  - Logs each skipped embedding and total removals

### 2. `src/app/api/chat/stream/route.ts`
- Maps `characterMemory?.events` → `{ content, importance }[]`
- Passes as `existingMemoryEvents` to `retrieveEmbeddingsContext()`

### 3. `src/app/api/chat/regenerate/route.ts`
- Same pattern as stream route

### 4. `src/app/api/chat/proactive/route.ts`
- Same pattern as stream route

### 5. `src/app/api/chat/group-stream/route.ts`
- Added `characterMemoryMap` extraction from body (Record<string, CharacterMemory>)
- Passes per-responder memory events in the character loop

## Lint Status
All lint checks pass.
