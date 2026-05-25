# Task 2-a: Make auto-extracted memories sync to Character Memory

## Summary
Successfully implemented client-side memory extraction that syncs auto-extracted memories to the Character Memory (Zustand store) in addition to LanceDB.

## Files Modified

### Backend
1. **`/home/z/my-project/src/lib/embeddings/memory-extraction.ts`**
   - Added `savedFacts: MemoryFact[]` to `MemoryExtractionResult` interface
   - Updated `extractAndSaveMemories()` to destructure and return `savedFacts`
   - Updated empty result to include `savedFacts: []`

2. **`/home/z/my-project/src/app/api/embeddings/extract-memory/route.ts`**
   - Added `MEMORY_TYPE_TO_EVENT_TYPE` mapping constant
   - Added `memoryActivations` array to the API response
   - For each saved fact, generates a `{ type: 'save_memory', characterId, eventData: { id, type, content, importance, embeddingId, sessionId } }` object

3. **`/home/z/my-project/src/app/api/chat/stream/route.ts`**
   - Removed `memory_extracting` SSE event
   - Removed ~65 lines of `setTimeout` block that called extract-memory from server
   - Added `shouldExtract` flag to the `done` SSE event

4. **`/home/z/my-project/src/app/api/chat/group-stream/route.ts`**
   - Removed `memory_extracting` SSE event
   - Removed ~115 lines of `setTimeout` block (including group dynamics extraction)
   - Added `shouldExtract` flag to the `done` SSE event

5. **`/home/z/my-project/src/app/api/chat/proactive/route.ts`**
   - Removed `memory_extracting` SSE event
   - Removed ~65 lines of `setTimeout` block
   - Added `shouldExtract` flag to the `done` SSE event

### Frontend
6. **`/home/z/my-project/src/components/tavern/chat-panel.tsx`**
   - Single chat: After `done` event, if `parsed.shouldExtract`, calls `/api/embeddings/extract-memory` from the client, syncs `memoryActivations` to Character Memory, shows toast
   - Group chat: Added `done` event handler in group SSE loop. After reader loop, triggers extraction for each character (including group dynamics)
   - Added `groupShouldExtract` and `groupResponses` variables for tracking group extraction state

7. **`/home/z/my-project/src/hooks/use-proactive-messages.tsx`**
   - After `done` event, if `parsed.shouldExtract`, calls extract-memory from client, syncs to Character Memory, shows toast

## Architecture Change
- **Before**: Server → setTimeout → fire-and-forget extract-memory API → LanceDB only (user can't see in Character Memory panel)
- **After**: Server sends `shouldExtract` in `done` → Client calls extract-memory API → LanceDB + memoryActivations response → Client syncs to Character Memory via `store.addMemoryEvent()`

## Type Mapping
| MemoryType (Spanish, from LLM) | MemoryEvent type (English, for store) |
|-------------------------------|---------------------------------------|
| hecho                         | fact                                  |
| evento                        | event                                 |
| relacion                      | relationship                          |
| preferencia                   | fact                                  |
| secreto                       | fact                                  |
| otro                          | emotion                               |
