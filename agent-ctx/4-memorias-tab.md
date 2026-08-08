# Task 4: Improve Memorias Tab Unified View

## Agent: memorias-tab

## Summary
Redesigned the "Memorias" tab in `novel-chat-box.tsx` to show a unified view of all memory types (summaries, semantic memories, character memory) with a system status indicator.

## Changes Made

### File: `/home/z/my-project/src/components/tavern/novel-chat-box.tsx`

1. **Import additions**:
   - Added `Collapsible, CollapsibleTrigger, CollapsibleContent` from `@/components/ui/collapsible`

2. **New state variables** (after existing memories state):
   - `localSummaries` - summaries from Zustand store filtered by session
   - `characterMemList` - character memory events from Zustand
   - `characterRelationships` - character relationships from Zustand
   - `characterNotes` - character notes from Zustand
   - `embeddingsStatus` - 'unknown' | 'connected' | 'disconnected' for Ollama/LanceDB
   - `summaryEmbeddings` - LanceDB embeddings with source_type='summary'
   - `expandedMemSections` - controls which collapsible sections are open
   - `expandedSummaryId` - tracks which summary card is expanded

3. **New store selectors** added to `useTavernStore()` destructuring:
   - `summaries` (aliased as `storeSummaries`)
   - `getSessionSummaries`
   - `getCharacterMemory`
   - `summarySettings`
   - `deleteSummary`
   - `removeMemoryEvent`

4. **New constant** `CHARACTER_MEM_EVENT_TYPE_CONFIG`:
   - Maps event types (fact, relationship, event, emotion, location, item, state_change) to labels, colors, and bar colors

5. **New load functions** (after `loadMemories`):
   - `loadSummaries()` - loads from Zustand, filtered by sessionId
   - `loadCharacterMemory()` - loads events, relationships, notes from Zustand for active character
   - `checkEmbeddingsStatus()` - checks `/api/embeddings/stats` for connectivity
   - `loadSummaryEmbeddings()` - loads `source_type='summary'` LanceDB embeddings

6. **Updated useEffect** for tab loading to call all 5 load functions

7. **Redesigned Memorias tab** with 3 collapsible sections + status indicator:
   - **System Status**: green/red/gray dot + Ollama/LanceDB status + retry button
   - **📊 Resúmenes**: Expandable summary cards with token counts, dates, delete
   - **🧠 Memorias Semánticas**: Existing memories + summary embeddings sub-section
   - **📝 Memoria del Personaje**: Events, relationships, notes with delete buttons

## Testing
- Lint passes cleanly (`bun run lint`)
- Dev server returns 200 on all routes
- All existing functionality preserved (add memory dialog, delete, group mode)
