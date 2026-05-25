# Task 2-b: Make search_memory tool include Character Memory data

## Agent: full-stack-developer

## Summary
Successfully updated the `search_memory` tool to include Character Memory data (events, relationships, notes from the Zustand store) alongside LanceDB embeddings in its search results.

## Changes Made

### 1. Added `characterMemory` to ToolContext (`src/lib/tools/types.ts`)
- Added `characterMemory?: import('@/types').CharacterMemory;` to the `ToolContext` interface
- Optional field for backward compatibility

### 2. Passed `characterMemory` in executeTool calls
- **`src/app/api/chat/stream/route.ts`**: Added `characterMemory` to the context object passed to `executeTool()`
- **`src/app/api/chat/proactive/route.ts`**: Same change
- **`src/app/api/chat/group-stream/route.ts`**: Added `CharacterMemory` import, extracted `characterMemory` from request body, and added it to the context object

### 3. Rewrote `search_memory` tool (`src/lib/tools/tools/search-memory.ts`)
- **Part 1: LanceDB search** — Same logic as before, but now wrapped in try/catch so LanceDB failure doesn't prevent Character Memory search
- **Part 2: Character Memory search** — New section that searches events, relationships, and notes using keyword matching
  - Deduplication: events with `embeddingId` matching LanceDB results are skipped
  - Type mapping: Spanish `memory_type` values (hecho→fact, evento→event, relacion→relationship, etc.)
  - Subject filtering: relationships resolve to "usuario" or "otro" based on targetId
  - Fixed similarity scores: events=0.8, relationships=0.75, notes=0.7
  - Results include `source` field ('lancedb' | 'character_memory') for identification

### 4. Display differentiation
- LanceDB results show `[LanceDB]` label
- Character Memory results show `[Memoria Local]` label

## Verification
- All lint checks pass
- Backward compatible (characterMemory is optional)
- Graceful fallback when LanceDB is unavailable
