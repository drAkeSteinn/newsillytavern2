---
Task ID: 1
Agent: Main Agent
Task: Clone and integrate newsillytavern repository into main project

Work Log:
- Cloned https://github.com/drAkeSteinn/newsillytavern to temporary location
- Analyzed full project structure (115 components, 85 lib files, 24 store files, 38 API routes)
- Cleaned old project source files while preserving sandbox configs (.zscripts, Caddyfile, .git)
- Copied all new source files: src/, prisma/, public/, data/, db/, docs/, download/, examples/, mini-services/
- Copied config files: components.json, tailwind.config.ts, postcss.config.mjs, eslint.config.mjs, tsconfig.json, next.config.ts, package.json, bun.lock
- Updated dev script to include `tee dev.log` for sandbox compatibility
- Fixed Prisma version mismatch: pinned prisma CLI to 6.19.2 (was ^7.6.0) to match @prisma/client
- Ran `prisma generate` and `prisma db push` - database synced successfully
- Installed all dependencies with bun (881 packages)
- Started dev server - Next.js 16.1.3 (Turbopack) running on port 3000
- Verified: GET / returns 200, API routes functional (backgrounds, tts, persistence, quest-templates)

Stage Summary:
- TavernFlow (newsillytavern) successfully integrated into main project
- All 15+ feature systems migrated: Character Chat, Group Chat, Sprite System V2, Unified Triggers, RAG/Embeddings, Quest System, RPG Stats, Atmosphere, Backgrounds, Sounds, Memory, Dialogue, Inventory, TTS/STT, HUD
- 5 LLM providers supported: Z.ai, OpenAI, Anthropic, Ollama, Text-Gen-WebUI
- Dev server running at localhost:3000, proxying through Caddy on port 81

---
## Task ID: 2 - embeddings-ui-restructure
### Work Task
Rewrite `src/components/embeddings/embeddings-settings-panel.tsx` to: (1) move the "Upload & Create Embeddings" collapsible section into a new "Archivos" tab, (2) translate all English UI text to Spanish, (3) update tab layout to 4 columns, (4) remove unused `uploadSectionOpen` state.

### Work Summary
- Moved the entire file upload section (previously a standalone Collapsible between Chat Integration and Tabs) into a new TabsContent with value="archivos"
- Tabs now have 4 items: Búsqueda (Search), Archivos (Files), Namespaces, Examinar (Browse) with `grid-cols-4`
- Added `archivos` case to `handleTabChange` function to reload namespaces
- Removed `uploadSectionOpen` state variable and its `Collapsible` wrapper
- Translated all user-facing strings to Spanish including: header banner, config section labels/buttons/toast messages, upload section labels/buttons/placeholders, search tab, namespaces tab, browse tab, all 3 dialogs (Create Embedding, Create Namespace, Reset All), SPLITTER_OPTIONS constants, and the EmbeddingsChatIntegration sub-component
- Preserved all imports, interfaces, types, constants structure, API calls, state management, and component logic
- File reduced from 1724 to 1712 lines (removed Collapsible wrapper overhead)
- ESLint passes with zero errors

---
## Task ID: 3 - embeddings-reliability-fixes
### Work Task
Fix three reliability issues in the embeddings system: (1) config persistence and client singleton reset, (2) auto-create namespace on file upload, (3) search always uses latest persisted config and model.

### Work Summary
**Config persistence (already working):**
- Verified config saves to `data/embeddings-config.json` via `config-persistence.ts` `saveConfig()`
- Verified `loadConfig()` reads from disk on server restart
- Verified `PUT /api/embeddings/config` correctly invalidates cache, saves to disk, and resets client singleton
- Tested full round-trip: save → verify on disk → read via API — all consistent

**Bug fix: Ollama client singleton stale model (`ollama-client.ts`, `client.ts`):**
- Added `resetOllamaClient()` export to `ollama-client.ts` that sets `ollamaClientInstance = null`
- Updated `resetEmbeddingClient()` in `client.ts` to call `resetOllamaClient()` before creating new client, ensuring a fresh Ollama client with the latest model on every config change
- Before fix: `resetEmbeddingClient` only updated the existing singleton's config, which could lead to stale model being used for embedding generation

**Bug fix: Search uses wrong model (`client.ts` searchSimilar):**
- Added model drift detection: before embedding the search query, compares current client model against persisted config model
- If models differ, resets Ollama client and creates fresh one with persisted config
- Search now always loads `maxResults` and `similarityThreshold` from persisted config (not just defaults)
- Before fix: if model was changed without server restart, search would embed query with old model causing dimension mismatch

**Bug fix: Namespace not auto-created on file upload (`create-from-file/route.ts`):**
- Added `client.upsertNamespace({ namespace })` call before creating embeddings from file
- Before fix: if the selected namespace didn't exist in the namespaces table, embeddings were stored with a namespace field that had no corresponding record, making the namespace tab show inconsistent counts

---
## Task ID: 4 - embeddings-examinar-layout-and-search-fix
### Work Task
Fix two issues: (1) Examinar tab embeddings overlapping on refresh, (2) Search not returning results because silent error handling bug and model mismatch.

### Work Summary

**Fix 1: Examinar tab overlapping display (`embeddings-settings-panel.tsx`):**
- Added `refreshingEmbeddings` state variable for loading indicator during refresh
- Created `refreshEmbeddingsTab()` function that sets loading state, calls all three data loaders, then clears loading
- Updated `handleTabChange` to use `refreshEmbeddingsTab()` for the embeddings tab
- Replaced `ScrollArea` with direct `max-h-[400px] overflow-y-auto` div for better scroll containment
- Added loading spinner with "Cargando embeddings..." text while refreshing
- "Actualizar" button now shows spinner and is disabled during refresh

**Fix 2: Silent error handling bug in search (`embeddings-settings-panel.tsx`):**
- **Critical bug found**: `handleSearch()` checked `data.success` but had NO `else` branch — server errors (500) were silently ignored!
- Added `else` branch that shows error toast with `data.error` message from server
- This means users can now see actual Ollama connection errors, model not found errors, etc.

**Fix 3: Search uses configured Ollama model (`search/route.ts`, `create-from-file/route.ts`, `embeddings/route.ts`):**
- Updated search route to explicitly reset the embedding client before every search, ensuring the persisted config model is used
- Added model mismatch warning logging when frontend-sent model differs from persisted config
- Search response now includes `meta` object with model, threshold, limit, namespace for transparency
- Updated `create-from-file` route to reset client with persisted config before creating embeddings
- Updated main `POST /api/embeddings` route to reset client with persisted config before creating single embeddings
- Frontend now passes `model: config.model` in search request body as a safety check

**Fix 4: Search metadata display (`embeddings-settings-panel.tsx`):**
- Added `SearchMeta` interface for type safety
- Added `searchMeta` state to store search response metadata
- Search results header now shows badges with "Modelo: X" and "Umbral: Y%" for user transparency

---
## Task ID: 5 - lanceDB-dimension-mismatch-fix
### Work Task
Fix LanceDB error "No vector column found to match with the query vector dimension: 768" when user switches embedding model from 1024D to 768D (nomic-embed-text-v2-moe).

### Root Cause
LanceDB table schema is immutable once created. The embeddings table was created with 1024D vectors (bge-m3:567m model). When user switched to nomic-embed-text-v2-moe (768D), the search query vector (768D) couldn't match the table's 1024D vector column.

### Work Summary

**Fix 1: Added nomic-embed-text-v2-moe to KNOWN_MODELS (`embeddings-settings-panel.tsx`):**
- Model uses Matryoshka Embeddings with flexible dimensions 256-768 (default 768)
- Added both `nomic-embed-text-v2-moe` and `nomic-embed-text-v2-moe:latest` entries with dimension 768

**Fix 2: LanceDB auto-detect and recreate table on dimension mismatch (`lancedb-db.ts`):**
- Added `tableDimension` tracker variable to track current table's vector dimension
- Added `getTableDimension()` export for external dimension checking
- Modified `initializeTables()` to read the first row's vector after opening existing table
- If existing vector dimension differs from config dimension, automatically drops and recreates the table
- Also drops namespace-specific tables that might have wrong dimensions
- Empty tables are also recreated to ensure correct schema
- Added `forceReinit` parameter to `initLanceDB()` to bypass cached initialization check
- `closeLanceDB()` now resets `tableDimension` tracker

**Fix 3: Config save triggers LanceDB reinit (`config/route.ts`):**
- On PUT, compares old vs new model/dimension to detect dimension-affecting changes
- Calls `initLanceDB(undefined, true)` with force flag when model/dimension changed
- Response includes `meta` object with `modelChanged`, `dimensionChanged`, `dimensionMismatch`, `oldDimension`, `newDimension`
- GET response now includes `tableDimension` for UI comparison

**Fix 4: UI dimension mismatch warning (`embeddings-settings-panel.tsx`):**
- Added `tableDimension` to `EmbeddingConfig` interface
- Save handler now reads response meta and shows contextual toast messages
- Dimension mismatch: "Tabla de embeddings recreada" with specific dimension change info
- Model change (same dimension): Warning about potential incompatibility
- Added amber warning banner in config section when `tableDimension !== config.dimension`
- Banner says "Incompatibilidad de dimensiones detectada" with explanation and fix instruction

---
## Task ID: 6 - embeddings-chat-integration-verification
### Work Task
Verify and fix embeddings chat integration in normal chat, group chat, and regenerate when "integración con chat" is enabled in configuration.

### Work Summary

**Verification Results:**
- ✅ **Normal chat (stream route)**: Fully implemented — `retrieveEmbeddingsContext()` called, context injected into system prompt, SSE `embeddings_context` event sent, shown in prompt viewer
- ✅ **Group chat (group-stream route)**: Fully implemented — per-character embedding retrieval using each responder's ID, context injected into per-character system prompt, SSE event with `characterId`
- ❌ **Regenerate route**: Was completely missing embeddings integration

**Bug fix: Regenerate route missing embeddings integration (`regenerate/route.ts`, `chat-panel.tsx`):**

Frontend (`chat-panel.tsx`):
- Added `characterId: activeCharacter?.id` to regenerate fetch body
- Added `embeddingsChat: settings.embeddingsChat` to regenerate fetch body (was missing — other handlers had it)
- Added `summary: currentSession?.summary` for memory/context compression support

Backend (`regenerate/route.ts`):
- Added imports: `EmbeddingsChatSettings` type, `retrieveEmbeddingsContext()`, `formatEmbeddingsForSSE()`
- Added `characterId`, `embeddingsChat`, `summary` to validation function and destructuring
- Added embeddings context retrieval using the **last user message before the assistant message** as search query
- Added embeddings section to `allPromptSections` array (between system sections and chat history)
- Created `finalSystemPrompt` variable that appends embeddings context to base system prompt
- Replaced all `systemPrompt` references in LLM provider switch with `finalSystemPrompt` (z-ai, openai, anthropic, ollama, text-generation-webui)
- Added `embeddings_context` SSE event transmission for frontend UI display
- Added server-side logging when embeddings are found

**Impact:**
- Before fix: Regenerating a message would produce a different response because the original had embeddings context but the regeneration did not
- After fix: Regeneration uses the same embeddings context as the original message, producing consistent results

---
## Task ID: 7 - embeddings-context-position-and-editor-layout
### Work Task
(1) Move embeddings [CONTEXTO] section to appear right after "User's Persona" in the prompt. (2) Adjust character and group editor layouts for full-screen mode.

### Work Summary

**Part 1: Embeddings CONTEXTO position in prompt:**
- Changed label from `'Embeddings Context'` to `'CONTEXTO'` in `chat-context.ts`
- Removed `[Relevant Context from Embeddings]` prefix from `buildContextString()` — now only the embedding entries appear
- Updated all 3 routes (`stream`, `group-stream`, `regenerate`) to insert embeddings section after "User's Persona" using `findIndex('persona')` + split
- Section only appears if embeddings were found (conditional spread)

**Part 2: Editor layout adjustments for full-screen:**

Character Editor (`character-editor.tsx`):
- Added `max-w-5xl mx-auto` wrapper inside the main scrollable content area
- Made Info tab name/tags grid responsive: `grid-cols-3` → `grid grid-cols-1 md:grid-cols-3`
- Made Description tab grid responsive: `grid-cols-3` → `grid grid-cols-1 lg:grid-cols-3`, col-span updated to `lg:col-span-2`
- Made Dialogue tab grid responsive: `grid-cols-2` → `grid grid-cols-1 lg:grid-cols-2`
- Made Prompts tab grid responsive: `grid-cols-2` → `grid grid-cols-1 lg:grid-cols-2`

Group Editor (`group-editor.tsx`):
- Added `max-w-5xl mx-auto` wrapper inside the main scrollable content area
- Changed member list heights from hardcoded `max-h-[500px]` to viewport-relative `max-h-[60vh]`
- Grid layouts already had responsive `lg:` breakpoints (no changes needed)

Settings Panel: Already well-structured, kept as reference (no changes)

---
## Task ID: 8 - embedding-namespace-assignment
### Work Task
Add namespace selection to Character and Group editors so each can specify which embedding namespaces to search during chat, overriding the global strategy.

### Work Summary

**Types (`src/types/index.ts`):**
- Added `embeddingNamespaces?: string[]` field to `CharacterCard` interface
- Added `embeddingNamespaces?: string[]` field to `CharacterGroup` interface
- Added `customNamespaces?: string[]` field to `EmbeddingsChatSettings` interface

**New Component (`src/components/tavern/namespace-selector.tsx`):**
- Created `NamespaceSelector` component following same pattern as `QuestSelector`/`LorebookSelector`
- Fetches available namespaces from `GET /api/embeddings/namespaces` on mount
- Multi-select dropdown with checkboxes, badges showing selected namespaces with embedding counts
- Shows description and embedding count per namespace
- "Limpiar" button to clear all selections
- Info text: "Sin seleccionar — se usará la estrategia definida en la configuración"
- Handles states: loading, DB unavailable, empty namespaces

**Character Editor (`src/components/tavern/character-editor.tsx`):**
- Added `NamespaceSelector` to the "Asignaciones" section after Quest selector
- Uses `character.embeddingNamespaces` as value, updates via `setCharacter`
- Icon: `Database` in violet color

**Group Editor (`src/components/tavern/group-editor.tsx`):**
- Added `NamespaceSelector` to the "Asignaciones" section after Quest selector
- Added `embeddingNamespaces` to initial values extraction from existing group
- Added state: `const [embeddingNamespaces, setEmbeddingNamespaces]`
- Included in `handleSave` data payload

**Chat Context Logic (`src/lib/embeddings/chat-context.ts`):**
- Updated `retrieveEmbeddingsContext()` to check for `settings.customNamespaces` first
- If `customNamespaces` is provided and non-empty, it overrides the strategy-based namespace resolution
- Falls back to `getNamespacesForStrategy()` when no custom namespaces are set

**Frontend Chat Integration (`src/components/tavern/chat-panel.tsx`):**
- Normal chat: passes `customNamespaces: activeCharacter?.embeddingNamespaces` in embeddingsChat
- Group chat: passes `customNamespaces: activeGroup?.embeddingNamespaces` in embeddingsChat
- Both merge with spread: `{...settings.embeddingsChat, customNamespaces: ...}`

---
## Task ID: 9 - group-chat-character-namespace-fallback
### Work Task
In group chat, if the group has no custom embedding namespaces, fall back to each responding character's own namespaces when that character generates a response.

### Work Summary

**File changed:** `src/app/api/chat/group-stream/route.ts`

**Logic added (per-character loop, around line 495):**
- Check `group.embeddingNamespaces` (group-level override)
- If group has namespaces → use those for all characters
- If group has NO namespaces → check `responder.embeddingNamespaces` (character-level)
- If character has namespaces → use those
- If neither has namespaces → use global strategy (default behavior)

```typescript
const effectiveEmbeddingsChat = (groupNamespaces?.length > 0)
  ? { ...embeddingsChat, customNamespaces: groupNamespaces }
  : (characterNamespaces?.length > 0)
    ? { ...embeddingsChat, customNamespaces: characterNamespaces }
    : embeddingsChat;
```

**Priority chain for group chat:**
| Priority | Source | Condition |
|---|---|---|
| 1 | Group namespaces | Group has `embeddingNamespaces` set |
| 2 | Character namespaces | Group has none, character has `embeddingNamespaces` |
| 3 | Global strategy | Neither group nor character has namespaces |

---
## Task ID: 10 - avatar-file-storage-and-group-avatar
### Work Task
(1) Change character avatar upload from base64 to file-based storage via /api/upload. (2) Add avatar upload capability to group editor.

### Work Summary

**Character Editor (`src/components/tavern/character-editor.tsx`):**
- Replaced `FileReader.readAsDataURL()` (base64) with `fetch('/api/upload')` POST
- File is now saved to `public/uploads/avatar/{timestamp}-{random}.{ext}`
- Avatar value stored in JSON is now a relative URL (`/uploads/avatar/...`) instead of a base64 data URL
- Increased max size from 2MB to 5MB
- Added image type validation (JPEG, PNG, GIF, WebP)
- Existing base64 avatars (from imported characters) continue to work since `<img src>` accepts both formats

**Group Editor (`src/components/tavern/group-editor.tsx`):**
- Added avatar upload UI with click-to-upload pattern
- Added states: `avatarUploading`, `avatarUrl`, `avatarFileInputRef`
- Added `handleAvatarUpload()` function using `fetch('/api/upload')` with type `group-avatar`
- Updated avatar display: shows uploaded image, loading spinner, or gradient fallback with Users icon
- Added hover overlay with Camera icon for visual feedback
- Updated `handleSave` to use `avatarUrl` state instead of `existingGroup?.avatar`
- Without custom avatar: shows gradient with Users icon (same as before)
- Text: "Clic para subir avatar" / "Avatar del grupo (clic para cambiar)"

**Impact on persistence:**
- `data/characters.json`: New character avatars are lightweight URLs (~50 chars) instead of base64 (~500KB-2MB)
- `data/groups.json`: Groups now store avatar URL when uploaded, empty string when not

---
## Task ID: 11 - character-editor-selection-fix
### Work Task
Fix character editor not loading correct character data (name, avatar, etc.) when editing an existing character.

### Work Summary

**Root Cause:**
- `CharacterEditor` in `character-panel.tsx` had no `key` prop, so React reused the same component instance when switching between characters
- `useState(getInitialCharacter)` only runs once at mount, so switching `characterId` while the component was mounted would not update the form data
- Compare: `GroupEditor` already had `key={editingGroupId || 'new-group'}` and worked correctly

**Fix (`src/components/tavern/character-panel.tsx`):**
- Added `key={editingCharacterId || 'new-character'}` to `CharacterEditor` component
- This forces React to fully unmount and remount the editor when the character ID changes
- All fields (name, avatar, description, tags, etc.) now correctly load from the store for the selected character

**Before:** Opening editor for Character A, closing, then opening for Character B would show Character A's data
**After:** Each character edit opens with the correct character's data loaded fresh

---
## Task ID: 12 - namespace-type-grouping
### Work Task
Add "Tipo" (Type) field to namespaces so embeddings are grouped by type in the LLM prompt with headers like [MEMORIA DEL PERSONAJE], [EVENTOS RECIENTES], [LORE DEL MUNDO].

### Work Summary

**Namespace Type Field (`embeddings-settings-panel.tsx`):**
- Added `type?: string` to `NamespaceRecord` interface
- Added `type` to `newNamespace` state and `editingNamespace` state
- Create Namespace Dialog: Added "Tipo" dropdown with 5 predefined types + custom option:
  - 🧠 Memoria del Personaje
  - 📅 Eventos Recientes
  - 🌍 Lore del Mundo
  - ⚙️ Reglas y Mecánicas
  - 👥 Relaciones
  - ✏️ Tipo personalizado (free-form input)
- Edit Namespace Dialog: New dialog for editing type/description of existing namespaces (name is read-only)
- Added edit button (Pencil icon) to each namespace in the list
- Type stored in namespace's `metadata.type` field (LanceDB JSON column)
- `loadNamespaces()` extracts `type` from `metadata.type` for display
- Type badge shown next to namespace name with violet styling

**Grouped Context Format (`chat-context.ts`):**
- Complete rewrite of `buildContextString()` → `buildGroupedContextString()`
- New `getNamespaceTypesMap()` function loads namespace type info from LanceDB
- Embeddings grouped by namespace type into sections with `[TYPE]` headers
- Each entry formatted as `- content` (bullet list style) instead of `[source_type] content`
- Format example:
  ```
  [CONTEXTO RELEVANTE]

  [MEMORIA DEL PERSONAJE]
  - Alvar recuerda que el jugador sobrevivió varias expediciones peligrosas.
  - Alvar sospecha que el jugador evita pagar sus deudas.

  [EVENTOS RECIENTES]
  - Un grupo desapareció en el bosque al norte del pueblo.
  ```
- Results without a type go into `[OTRO CONTEXTO]` section (or plain list if no types exist at all)
- Token budget respected across all groups
- `EmbeddingsContextResult` now includes `typeGroups?: Record<string, number>` for UI display
- `formatEmbeddingsForSSE()` updated to include `typeGroups` in SSE events

**Type Fix (`types/index.ts`):**
- Added `'memory'` to `PromptSection.type` union (was missing, causing type mismatch)

**Impact:**
- Namespaces can now be categorized by type for organized context injection
- Multiple namespaces can share the same type for merged grouping
- LLM receives well-structured, grouped context instead of flat list
- Existing namespaces without a type continue to work (grouped as "OTRO CONTEXTO" or ungrouped)

---
## Task ID: 13 - memory-extraction-phase1
### Work Task
Implement Phase 1 of automatic memory extraction: LLM-powered fact extraction from chat messages, robust JSON parsing, embedding storage, and integration into chat routes + UI settings.

### Work Summary

**Memory Extraction Utility (`src/lib/embeddings/memory-extraction.ts`) - NEW:**
- `extractMemories()` — Calls LLM with extraction prompt to analyze last assistant message
- `saveMemoriesAsEmbeddings()` — Saves extracted facts as embeddings to LanceDB
- `extractAndSaveMemories()` — Combined pipeline: extract → save → return result
- `shouldExtractMemory()` — Check if extraction should trigger based on message count
- Robust JSON Parser with 5 fallback layers:
  - Layer 1: Direct `JSON.parse()`
  - Layer 2: Extract from markdown code fences (```json ... ```)
  - Layer 3: Find `[...]` array anywhere in text
  - Layer 4: Parse individual JSON objects line by line (handles broken JSON)
  - Layer 5: Simple line format fallback (`HECHO | importance | tipo | descripcion`)
- Validation: clamps importance 1-5, normalizes memory types (with Spanish aliases), max 200 chars per fact
- LLM prompt in Spanish, asks for concise facts only (returns `[]` if nothing memorable)

**API Route (`src/app/api/embeddings/extract-memory/route.ts`) - NEW:**
- `POST /api/embeddings/extract-memory` — Receives message + character info + LLM config
- Dynamic import to avoid loading heavy modules at startup
- Returns: `{ success, count, facts, saved, namespace, embeddingIds }`

**Type Updates (`src/types/index.ts`):**
- Added to `EmbeddingsChatSettings`:
  - `memoryExtractionEnabled?: boolean` — Toggle auto-extraction
  - `memoryExtractionFrequency?: number` — Every N messages (default: 5)
  - `memoryExtractionMinImportance?: number` — Min importance to save (default: 2)

**Chat Route Integration (`src/app/api/chat/stream/route.ts`):**
- Accumulates full response content during streaming (`accumulatedContent`)
- After `done` signal, fires async extraction via `setTimeout(0)` (fire-and-forget)
- Triggers when: enabled AND response > 50 chars AND message count % frequency === 0
- Calls `/api/embeddings/extract-memory` with LLM config subset (provider, endpoint, apiKey, model, parameters)

**Group Chat Integration (`src/app/api/chat/group-stream/route.ts`):**
- Same pattern but iterates over `responsesThisTurn` array (multiple responders)
- Passes `groupId: group.id` so memories are saved to `group-{groupId}` namespace

**UI Settings (`embeddings-settings-panel.tsx`):**
- Added "🧠 Extracción Automática de Memoria" section in Integración con Chat
- Toggle switch to enable/disable
- Frequency slider: every 2-20 messages (default: 5)
- Min importance slider: 1-5 (default: 2)
- Info box explaining: auto namespaces (character-{id}/group-{id}), importance filter, async (non-blocking)
- Default settings: disabled, frequency 5, min importance 2

**Architecture:**
- Extraction is ASYNC and FIRE-AND-FORGET — never blocks chat response
- Uses the same LLM provider configured for chat (with temperature 0.1 for consistency)
- Namespaces: `character-{id}` for normal chat, `group-{id}` for group chat
- source_type: `memory` for all auto-extracted embeddings

---
## Task ID: 14 - memory-extraction-phase2-visual-feedback
### Work Task
Fix critical bugs and add visual feedback for the memory extraction system.

### Work Summary

**Bug Fix: JSX `{id}` reference error (`embeddings-settings-panel.tsx`):**
- Line 2056 had `(character-{id} o group-{id})` which JSX parsed as JavaScript expression `id` (undefined variable)
- Fixed by escaping: `(character-{'{id}'} o group-{'{id}'})` so curly braces render as literal text

**Bug Fix: `allMessages` undefined in group-stream (`group-stream/route.ts`):**
- Line 853 referenced `allMessages` which doesn't exist in group-stream scope
- Changed to `messages` (the destructured variable from request body)
- This was a silent runtime error that would crash memory extraction in group chat

**Enhancement: SSE `memory_extracting` event (stream + group-stream routes):**
- Moved the extraction condition check BEFORE `controller.close()` so we can send SSE events
- Both routes now send `{ type: 'memory_extracting', characterName/characterNames }` event before `done` event
- Stream route: sends single `characterName`
- Group-stream route: sends `characterNames` array of extractable characters (content > 50 chars)
- Extraction still runs async via `setTimeout(0)` after stream close

**Enhancement: Visual memory extraction indicator (chat-panel.tsx):**
- Added `memoryExtractingInfo` state: `{ active: boolean, characterNames: string }`
- Handlers in both group and single chat SSE parsing sections
- On `memory_extracting` event: shows indicator, auto-hides after 8 seconds
- UI: Fixed-position pill at bottom-center with spinner animation
  - Violet background with white text
  - Shows "Extrayendo memoria — {character names}"
  - Smooth fade-in slide-up animation
  - Non-intrusive, doesn't block interaction

### Files Modified:
- `src/components/embeddings/embeddings-settings-panel.tsx` — Fixed JSX `{id}` error
- `src/app/api/chat/group-stream/route.ts` — Fixed `allMessages` bug + added SSE event
- `src/app/api/chat/stream/route.ts` — Added SSE `memory_extracting` event
- `src/components/tavern/chat-panel.tsx` — Added state, SSE handlers, visual indicator

---
## Task ID: 15 - group-editor-optimization
### Work Task
Optimize the group editor component (`src/components/tavern/group-editor.tsx`, 1515 lines) with 10 targeted improvements: bug fixes, code cleanup, UI refinements, and toast notifications.

### Work Summary

**Files modified:**
- `src/components/tavern/group-editor.tsx` — 10 optimizations applied (1515 → ~1315 lines)
- `src/components/tavern/character-panel.tsx` — Group avatar display in sidebar

**1. Fixed critical bug: Avatar not in initialValues**
- Added `avatar: existingGroup?.avatar || ''` to the existing group return path in `initialValues` useMemo
- Added `avatar: ''` to the default (new group) return path
- Before fix: `useState(initialValues.avatar || '')` always got `undefined`, so editing an existing group would lose its avatar

**2. Removed duplicate "Estilo de Conversación" from Info tab**
- Removed the Conversation Style selector from the Info tab (lines 528-563 in original)
- Kept the one in the Strategy tab (lines 997-1038) where it belongs with activation strategy config

**3. Replaced all alert() calls with useToast()**
- Added `import { useToast } from '@/hooks/use-toast'` and `const { toast } = useToast()`
- Replaced 6 `alert()` calls with proper toast notifications using `variant: 'destructive'` for errors:
  - `handleAvatarUpload`: Image too large, unsupported format, upload error, connection error
  - `handleSave`: Name required, at least one member required

**4. Removed redundant "Resumen" card from Info tab**
- Removed the entire "Resumen" card (lines 630-656 in original) that duplicated info visible in the Strategy tab
- Cleaner avatar section without the redundant stats card

**5. Removed unused `selectedCharacterId` state and `handleAddMember`**
- Removed `const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')`
- Removed the entire `handleAddMember` function (was never called — members tab uses inline buttons)

**6. Fixed embeddingNamespaces initialization for new groups**
- Added `embeddingNamespaces: []` to the default (new group) return path in `initialValues`

**7. Simplified verbose strategy color classes with helper function**
- Created `getStrategyColorClasses(color)` helper at module level with a colorMap for emerald/blue/purple/amber/cyan
- Returns `{ bg, border, text, bgLight, bgSelected }` classes for each color
- Replaced verbose multi-line `cn()` conditionals in 3 locations:
  - Strategy tip box in strategy tab
  - Strategy info card at bottom of strategy tab
  - Per-strategy icon color in strategy selector

**8. Improved Info tab layout**
- Changed from 3-column (`lg:grid-cols-3`) to 2-column (`lg:grid-cols-2`) layout
- Left column: Name + Description (cleaner without Conversation Style)
- Right column: Avatar upload (horizontal layout) + Assignments section
- Avatar now displays inline with description text instead of being a standalone column

**9. Show group avatar in character-panel.tsx sidebar**
- Updated group list item rendering to conditionally show the group's uploaded avatar
- Shows `<img>` when `group.avatar` is set, falls back to violet gradient + Users icon

**10. Removed unused imports**
- Removed `Eye` and `EyeOff` from lucide-react imports (never used in the component)

**ESLint:** Passes with zero errors

---
## Task ID: 16 - embeddings-recency-primacy-injection
### Work Task
Change WHERE memory embeddings are injected into the LLM prompt. Previously they were appended inside the system prompt text (after User's Persona). Now they are injected as a SEPARATE system message RIGHT BEFORE the chat history, which is more effective because LLMs pay more attention to recent context.

### Work Summary

**Problem:** Memory embeddings were being concatenated into the `finalSystemPrompt` string, burying them deep in the system message where LLMs tend to pay less attention. LLMs exhibit recency bias — they attend more to context closer to the generation point.

**Solution:** Extract embeddings from the system prompt string and inject them as a separate system message positioned right before the chat history, maximizing their influence on the LLM response.

**Files Modified:**

1. **`src/lib/llm/types.ts`** — Added `embeddingsContext?: string` to `CompletionPromptConfig` interface

2. **`src/lib/llm/prompt-builder.ts`** — Three function updates:
   - `buildChatMessages()`: Added 8th parameter `embeddingsContext?: string`. Injects as a separate `role: 'system'` message at position 1.5 (between system prompt and chat history)
   - `buildCompletionPrompt()`: Added `embeddingsContext` to config destructuring. Injects between system prompt separator (`\n---\n`) and chat messages
   - `buildGroupChatMessages()`: Added 10th parameter `embeddingsContext?: string`. Injects as a separate `role: 'system'` message at position 1.5

3. **`src/app/api/chat/stream/route.ts`** — Normal chat route:
   - Removed `finalSystemPrompt += ... embeddingsResult.section ...` (no longer appended to system prompt)
   - Built separate `embeddingsContextString` variable
   - Updated all 5 provider calls (z-ai, openai/vllm/custom, anthropic, ollama, text-generation-webui/koboldcpp) to pass `embeddingsContextString`
   - Moved embeddings section in prompt viewer from after persona to before chat history

4. **`src/app/api/chat/group-stream/route.ts`** — Group chat route:
   - Removed embeddings from `finalSystemPrompt` concatenation
   - Built separate `embeddingsContextString` variable
   - Updated `buildGroupChatMessages()` call to pass `embeddingsContextString` as last parameter
   - Moved embeddings section in prompt viewer from after persona to before chat history

5. **`src/app/api/chat/regenerate/route.ts`** — Regenerate route:
   - Removed `finalSystemPrompt += ... embeddingsResult.section ...`
   - Built separate `embeddingsContextString` variable
   - Updated all 5 provider calls to pass `embeddingsContextString`
   - Moved embeddings section in prompt viewer to before chat history

**New Prompt Message Order:**
```
[System Prompt]           ← position 1 (persona, description, scenario, etc.)
[Embeddings Context]      ← NEW position 1.5 (separate system message, recency primacy)
[Chat History]            ← position 2+ (user/assistant messages)
[Author's Note]           ← after chat history
[Post-History Instructions] ← last, before generation
```

**Unchanged:**
- SSE `embeddings_context` events remain the same (client UI unchanged)
- Memory extraction logic unchanged
- Embeddings retrieval logic unchanged
- Only the POSITION in the final LLM messages array changed

**ESLint:** Passes with zero errors

---
## Task ID: 17 - background-gallery-fullscreen-fix
### Work Task
Convert Background Gallery and Collection Manager dialogs from broken Dialog-based layout to proper fullscreen overlay using motion.div pattern (same as Settings Panel).

### Work Summary

**Problem:**
- Both `BackgroundGallery` and `BackgroundCollectionManager` used `<Dialog fullscreen>` but `DialogContent` doesn't support a `fullscreen` prop
- The `fullscreen` attribute passed through as unknown HTML attribute with no effect
- Both components rendered at default `sm:max-w-lg` width, not filling the viewport
- Layout was cramped and didn't match the app's fullscreen panel style

**Solution:**
- Replaced `Dialog`/`DialogContent` with `AnimatePresence` + `motion.div` overlay matching Settings Panel
- Used `fixed inset-0 z-50 bg-background` for true fullscreen coverage
- Added smooth entrance/exit animations (opacity + y-axis) with staggered delays

**BackgroundGallery (`src/components/tavern/background-gallery.tsx`):**
- Converted from Dialog to motion.div fullscreen overlay with AnimatePresence
- Header: Fixed h-14 with title, file count, fit mode selector, manage button, refresh, close
- Sidebar: Responsive `w-14 md:w-56` (icon-only on mobile, full labels on desktop) with tooltips
- Main content: Search bar + responsive grid (2-8 columns depending on viewport)
- Preview modal: AnimatePresence with z-[60] (above gallery's z-50)
- Translated all UI text to Spanish
- Improved card hover effects with subtle scale animation

**BackgroundCollectionManager (`src/components/tavern/background-collection-manager.tsx`):**
- Converted from Dialog to motion.div fullscreen overlay (z-[55])
- Header: Fixed h-14 with title, unsaved changes badge, save, refresh, close
- Sidebar: Responsive `w-14 md:w-64` with tooltips on mobile
- Nested dialogs (Create, Delete) kept as regular Dialog components
- Translated all UI text to Spanish

**ESLint:** Passes with zero errors
**Dev server:** GET / 200

---
## Task ID: 18 - tts-autoplay-policy-fix
### Work Task
Fix TTS playback error: "play() failed because the user didn't interact with the document first" — browser autoplay policy blocks audio auto-play when TTS auto-generates speech on new messages.

### Work Summary

**Problem:**
- Browser autoplay policy requires a user gesture (click/tap/keydown) before any audio can play
- TTS auto-generation triggers `audio.play()` without a user gesture, causing the error
- The error was logged as a generic playback error with no recovery mechanism
- Audio items were marked as 'error' and discarded instead of being queued for retry

**Solution — Multi-layer fix across 5 files:**

**1. Audio Unlock Utility (`src/lib/tts/tts-service.ts`):**
- Added `unlockAudio()` — creates/resumes a silent AudioContext on user gesture to unlock browser audio
- Added `isAudioReady()` — checks if audio is currently unlocked
- Added `onAudioUnlocked(cb)` — queues callbacks to run after unlock
- Added global event listeners (click, keydown, touchstart) that auto-unlock audio on first interaction
- Exported `unlockAudio`, `isAudioReady`, `onAudioUnlocked` for use by other components

**2. TTS Service autoplay handling (`src/lib/tts/tts-service.ts`):**
- Added `autoplayBlocked` state tracking to TTSService class
- New queue item status: `'autoplay_blocked'` — marks items that can't play due to policy
- `playItem()` now catches `NotAllowedError` / "user didn't interact" errors specifically:
  - Sets item status to `autoplay_blocked` instead of `'error'`
  - Keeps item in queue (doesn't discard it)
  - Registers one-time click/keydown/touchstart listener to retry playback after user interaction
  - Fires `onAutoplayBlocked` callback for UI notification
- `resume()` now attempts `unlockAudio()` first if play fails due to autoplay
- `stop()` resets `autoplayBlocked` flag
- `retryBlockedItems()` method resets blocked items to 'pending' and re-processes the queue

**3. TTS Types (`src/lib/tts/types.ts`):**
- Added `'autoplay_blocked'` to `TTSQueueItem.status` union type

**4. useTTS Hook (`src/hooks/use-tts.ts`):**
- Added `autoplayBlocked` state with 10-second auto-clear timeout
- Added `unlockAudio` action (exposed from service)
- `onPlaybackError` callback now suppresses error logging for `autoplay_blocked` items (expected behavior, not an error)
- `onAutoplayBlocked` callback sets state and logs warning

**5. TTS Playback Controls (`src/components/tavern/tts-playback-controls.tsx`):**
- Added `VolumeX`, `MousePointerClick` icons for blocked state
- Compact mode: amber pill with "Haz clic para activar audio" + Play button
- Full mode: amber card with "Audio bloqueado por el navegador" + "Activar Audio" button
- Floating indicator: amber border + "Audio bloqueado" / "Clic para activar" text
- `autoplay_blocked` status now recognized as a current item for display purposes

**6. TTS Settings Panel (`src/components/tavern/tts-settings-panel.tsx`):**
- `handleTestTTS()` now wraps `audio.play()` in `.catch()` with autoplay error detection
- Autoplay errors show a `console.warn` instead of crashing silently
- Sets `isPlaying(false)` on autoplay error so the UI stays in sync

**Behavior:**
- First auto-TTS message → autoplay blocked → amber indicator shows → user clicks anywhere → audio unlocks → blocked items retry automatically
- Subsequent auto-TTS messages play normally (audio already unlocked)
- Test TTS in settings: if blocked, user clicks Play button (which is a gesture) to hear the test

**ESLint:** All TTS files pass with zero errors
**Dev server:** GET / 200, TTS config API working

---
Task ID: 5-a
Agent: Main Agent
Task: Fix TTS autoplay error and KWS/TTS conflict

Work Log:
- Analyzed TTS service (`tts-service.ts`) and hook (`use-tts.ts`) to understand audio playback flow
- Identified root cause of autoplay error: `onerror` handler on HTMLAudioElement fires alongside play() promise rejection, overriding `autoplay_blocked` status to `error` and triggering `onPlaybackError`
- Fixed TTS service: Added guard in `onerror` handler to skip error reporting when `item.status === 'autoplay_blocked'` (autoplay side-effect)
- Added `safeResolve()` pattern to prevent Promise resolve from being called multiple times
- Fixed autoplay retry: Changed retry handler to use `this.processQueue()` instead of direct `this.playItem()` to properly handle queue state
- Analyzed KWS (`use-wake-word-detection.ts`) and TTS interaction in `novel-chat-box.tsx`
- Identified KWS conflict: When TTS plays audio through speakers, Speech Recognition picks up speaker echo causing false positives and interference
- Added `ttsPlaying` option to `useWakeWordDetection` hook
- Implemented TTS/KWS coordination: When TTS starts, KWS recognition is paused; when TTS stops, recognition auto-resumes with 300ms delay
- Added `isPausedByTTS` state and `isActive` computed state to hook return
- Passed `isTTSPlaying` from `chat-panel.tsx` → `NovelChatBox` → `useWakeWordDetection`
- Updated KWS button UI: amber icon (VolumeX) when paused by TTS, green (Radio) when active, gray (Ear) when inactive
- Updated KWS status indicator: shows "🔇 EN PAUSA" when paused by TTS, "🎧 ESCUCHANDO" when active
- Cleaned up unused `useTTS` import in `novel-chat-box.tsx`
- Used `queueMicrotask` for state updates in effect to satisfy ESLint rules

Stage Summary:
- TTS autoplay error: Fixed — `onerror` handler no longer overrides `autoplay_blocked` status
- KWS/TTS conflict: Fixed — KWS automatically pauses/resumes based on TTS playback state
- Files modified: `src/lib/tts/tts-service.ts`, `src/hooks/use-wake-word-detection.ts`, `src/components/tavern/novel-chat-box.tsx`, `src/components/tavern/chat-panel.tsx`
- ESLint: Clean (only pre-existing errors in unrelated files)
- Dev server: GET / 200, TTS config API working
---
## Task ID: 19 - chat-and-tts-error-fixes
### Work Task
Fix 3 errors: (1) fetch failed in SSE stream, (2) Generation error logging with empty object, (3) TTS empty audio response.

### Work Summary

**Error 1 & 2: SSE stream error handling (`chat-panel.tsx`):**
- Root cause: When the LLM provider API call fails during streaming, the server sends an SSE `{ type: 'error', error: 'fetch failed' }` event. The client threw immediately, discarding any partial response content that was already streamed.
- Fix: Before throwing, check if `accumulatedContent` has content. If so, save the partial response as an assistant message (cleaning character name prefix). This preserves partial responses instead of losing them entirely.
- Applied to both single chat (line ~776) and group chat (line ~631) SSE error handlers.
- Added fallback error message: `parsed.error || 'Error en la generación del servidor'`
- Group chat error handler now logs partial content length as a warning before throwing.

**Error 3: TTS empty audio — retry logic (`tts-service.ts`):**
- Root cause: TTS-WebUI server occasionally returns empty or very small audio blobs (0 bytes). The previous code had no retry mechanism.
- Fix 1: Added retry loop in `processQueue()` with up to 2 retries (3 total attempts) for retryable errors:
  - `empty audio` — server returned 0 bytes
  - `too small` — audio blob under 1KB (likely invalid)
  - `fetch failed` — network error to TTS server
  - `NetworkError` / `ECONNREFUSED` — connection errors
- Retry delay: 1s × attempt number (1s, 2s between retries)
- Added `MIN_AUDIO_SIZE` constant (1024 bytes) to reject suspiciously small audio blobs
- Non-retryable errors (invalid voice, bad request) fail immediately without retry
- Fix 2: Added minimum text length check in `addToQueue()` — skips items with < 2 characters of text to avoid sending trivial content that might produce empty audio
- Changed `addToQueue` return type from `string` to `string | null` (returns null when skipped)

**Files Modified:**
- `src/components/tavern/chat-panel.tsx` — SSE error handling (preserve partial response)
- `src/lib/tts/tts-service.ts` — Retry logic, min audio size, min text length

**ESLint:** Only pre-existing error (fullscreen-editor.tsx setState-in-effect)

---
## Task ID: 20 - sprite-collection-create-fix
### Work Task
Fix sprite collection creation failing with "No se pudo crear la colección" error.

### Root Cause
The frontend calls `POST /api/sprites/collections` to create a collection, but the route file only had `GET` and `PUT` handlers. The `POST` handler existed in `/api/sprites/manage/route.ts` but the frontend doesn't use that endpoint. Similarly, `DELETE` and `PATCH` (rename) handlers were missing from the collections route.

### Work Summary

**File: `src/app/api/sprites/collections/route.ts`:**
- Added `POST` handler for creating new sprite collections:
  - Sanitizes name (supports Latin characters: áéíóúñÑüÜ)
  - Creates collection directory under `public/sprites/`
  - Creates initial `metadata.json` with version, name, timestamps
  - Returns collection data on success
  - Validates: name required, no empty after sanitization, no duplicates
- Added `PATCH` handler for renaming collections:
  - Renames directory using `fs.rename()`
  - Updates `metadata.json` with new collection name
  - Validates: both params required, collection must exist, no name collision
- Added `DELETE` handler for deleting collections:
  - Reads `collectionId` from query params
  - Deletes all files in collection directory, then removes directory
  - Validates: collectionId required, collection must exist
- Added `existsSync` import from `fs`

**File: `src/components/tavern/sprite-general-panel.tsx`:**
- Updated error toasts for create, rename, and delete to show the actual server error message instead of generic text
- Before: `description: 'No se pudo crear la colección'`
- After: `description: error instanceof Error ? error.message : 'No se pudo crear la colección'`

**ESLint:** Only pre-existing error (fullscreen-editor.tsx)

---
## Task ID: 21 - app-refresh-caused-by-module-warnings
### Work Task
Fix app refreshing/reloading unexpectedly as if browser were being refreshed.

### Root Cause
`src/lib/quest/index.ts` was re-exporting 5 functions that don't exist in `quest-reward-executor.ts`:
- `executeSpriteReward`
- `executeSoundReward`
- `executeBackgroundReward`
- `executeItemReward`
- `executeCustomReward`

Turbopack printed 6 module warnings (one per missing export × import chain) on EVERY page request/compilation cycle. The import chain: `page.tsx` → `settings-panel.tsx` → `quests/index.ts` → `QuestSettingsPanel` → `QuestTemplateManager` → `@/lib/quest` → `quest-reward-executor`. 

These constant module resolution warnings (~30 lines per page load, hundreds of times) caused Turbopack's HMR to detect the module graph as unstable, triggering full page reloads instead of Hot Module Replacement. The dev.log grew to 22,000+ lines of repeated warnings.

### Work Summary

**File: `src/lib/quest/index.ts`:**
- Removed 5 non-existent re-exports from the `quest-reward-executor` block:
  - `executeSpriteReward`, `executeSoundReward`, `executeBackgroundReward`, `executeItemReward`, `executeCustomReward`
- Verified these functions are not imported anywhere else in the codebase
- Kept only the actually existing exports: `executeAttributeReward`, `executeReward`, `executeAllRewards`, etc.

**Result:**
- Dev log went from 22,000+ lines of repeated warnings to clean HTTP request logs
- No more Turbopack module resolution warnings
- App should no longer experience unexpected full page refreshes from HMR instability

**ESLint:** Only pre-existing error (fullscreen-editor.tsx)

---
## Task ID: 27 - persistence-save-error-fix
### Work Task
Fix "Failed to save persistent data" console error appearing when entering TTS/Voice settings when TTS server is unavailable.

### Root Cause
Next.js 16 has a devtools error interceptor that catches `console.error` calls and displays them as error overlays to the user. The `use-persistence-sync.ts` hook used `console.error` for non-critical background save failures, which triggered the Next.js error overlay.

### Work Summary

**File 1: `src/hooks/use-persistence-sync.ts`:**
- Changed all `console.error` to `console.warn` throughout the file (loadFromServer, saveToServer, quest templates)
- Added retry logic to `saveToServer`: up to 2 retries for 5xx server errors and network errors with exponential backoff (1s × attempt)
- Added data serialization safety check: `JSON.stringify` wrapped in try-catch before fetch to catch non-serializable values early
- Better error messages with `[Persistence]` prefix and attempt tracking

**File 2: `src/app/api/persistence/route.ts`:**
- Added `safeWritePersistentData()` helper that validates data serializability before writing
- Changed all `writePersistentData` calls in PUT handler to `safeWritePersistentData`
- Changed partial failure behavior: returns HTTP 200 with warnings array instead of 500
- Only returns 500 if ALL data writes fail (total failure)
- Changed server-side `console.error` to `console.warn` for non-critical failures

**Result:**
- Persistence save failures are now logged as warnings (not errors), avoiding Next.js error overlay
- Transient failures are retried automatically with backoff
- Non-serializable data is detected early and skipped gracefully
- Partial save failures no longer cause 500 responses

**ESLint:** Passes with zero new errors (1 pre-existing error in fullscreen-editor.tsx)

---
## Task ID: 28 - tts-connection-spam-fix
### Work Task
Fix repeated `ERR_CONNECTION_REFUSED` errors spamming browser console when TTS server (localhost:7778) is not running. Also investigate `A-bmDw4j.js` chat metadata logs.

### Root Cause
1. **Connection check spam**: `testConnection()` in `tts-service.ts` made a direct `fetch()` to `localhost:7778/v1/audio/voices` every time `speak()`, `speakWithDualVoice()`, or the 30-second interval fired. No caching or cooldown — every call hit the network.
2. **`A-bmDw4j.js` logs**: This is the sandbox IM gateway SDK (`z-ai-web-dev-sdk`) logging chat metadata — completely normal internal logging, not from our code.

### Work Summary

**File 1: `src/lib/tts/tts-service.ts`:**
- Added connection status cache: `connectionStatus` ('online'|'offline'|'unknown'), `lastConnectionCheck` timestamp
- Adaptive cooldown: 5s (unknown) → 30s (online) → 120s (offline)
- `testConnection()` now checks cache before making network requests (unless `forceCheck=true`)
- Added `getCachedConnectionStatus()` for instant status lookup without network
- Added `resetConnectionStatus()` to force fresh check when config changes
- `setConfig()` auto-resets cache when `baseUrl` changes
- Added `AbortSignal.timeout(5000)` to prevent hanging connections
- Changed `console.error` → `console.warn` for expected offline errors

**File 2: `src/hooks/use-tts.ts`:**
- `checkConnection()` now accepts `forceCheck` parameter
- `speak()` and `speakWithDualVoice()` check `getCachedConnectionStatus()` first — skip entirely if offline
- Removed verbose warning logs for "TTS service is not connected" (silent skip when cached offline)
- Changed all `console.error` → `console.warn`

**File 3: `src/components/tavern/tts-settings-panel.tsx`:**
- Changed all `console.error` → `console.warn` (load config, save config, test TTS, load voices)

**File 4: `src/components/tavern/character-voice-panel.tsx`:**
- Changed `loadVoices()` from direct `fetch(baseUrl/v1/audio/voices)` to server-side proxy `fetch(/api/tts/available-voices?endpoint=...)`
- Eliminates client-side `ERR_CONNECTION_REFUSED` errors — server handles the connection attempt

**Result:**
- When TTS server is offline: 1st check fails → cached as offline → no more network requests for 2 minutes
- `speak()`/`speakWithDualVoice()` silently return when cached offline (no console spam)
- Interval timer calls are deduplicated by the cache (no actual fetch within cooldown)
- `A-bmDw4j.js` logs confirmed as normal IM SDK behavior

**ESLint:** Only pre-existing error (fullscreen-editor.tsx)

---
## Task ID: 29 - tts-auto-generation-not-firing
### Work Task
Fix TTS auto-generation not triggering when character responds, despite TTS server being available and connection showing online.

### Root Cause
The `useTTSAutoGeneration` hook used a `setTimeout(500ms)` to delay the TTS call. When any dependency of the useEffect changed during those 500ms (e.g., `speakWithDualVoice` getting a new reference from `useCallback`, `isConnected` updating, `ttsConfig` loading), the effect cleanup would `clearTimeout`, cancelling the pending TTS call. The message was already marked as "processed" via `lastProcessedIdRef`, so it would never retry.

Additionally, the effect body started by clearing any pending timeout (`clearTimeout(timeoutRef.current)`), which meant even re-runs triggered by other dep changes would destroy pending TTS calls.

The user's console confirmed this: `[Fast Refresh] rebuilding` appeared right after the auto-generation log, meaning HMR/file changes triggered a re-render during the 500ms window.

### Work Summary

**File: `src/hooks/use-tts.ts` — Complete rewrite of `useTTSAutoGeneration`:**

Key changes:
1. **Removed setTimeout entirely** — TTS now fires synchronously from the effect body
2. **Uses refs for function references** (`speakRef`, `speakWithDualVoiceRef`, `charactersRef`) to avoid stale closures when deps change
3. **No cleanup function** — since TTS fires synchronously, there's nothing to cancel. `addToQueue` is a synchronous operation that commits the TTS to the queue before React can re-render
4. **Pre-checks connection cache** — `ttsService.getCachedConnectionStatus()` returns 'online' immediately without network request when within cooldown
5. **Removed `characters` from deps** — uses `charactersRef` instead, preventing unnecessary re-runs
6. **Narrower deps** — only `ttsConfig?.enabled`, `ttsConfig?.autoGeneration` instead of full `ttsConfig` object
7. **Kept `delay` in interface** for backward compatibility (ignored)

**Why this works:**
- `speakWithDualVoice` is async, but its synchronous portion (cache check + `processTextForDualVoice` + `addToQueue`) runs before any `await`
- `addToQueue` adds the item to the queue and calls `processQueue()` — both synchronous
- The async TTS API call happens in `processQueue` which runs independently
- Even if React re-renders and the effect cleanup runs, the queue item is already committed

**ESLint:** Only pre-existing error (fullscreen-editor.tsx)
---
## Task ID: 19 - sprite-state-behavior-fix
### Work Task
Fix sprite state behaviors: remove "Principal" from Talk/Thinking states (only Lista and Aleatorio), implement list mode rotation so sprites cycle on each activation.

### Work Summary

**1. State Collection Editor (`src/components/tavern/state-collection-editor-v2.tsx`):**
- Replaced flat `BEHAVIOR_CONFIG` array with `BEHAVIOR_BY_STATE` record that maps each state to its allowed behaviors
- **Idle**: 3 behaviors (Principal, Aleatorio, Lista) — unchanged
- **Talk**: 2 behaviors (Lista, Aleatorio) — "Principal" removed
- **Thinking**: 2 behaviors (Lista, Aleatorio) — "Principal" removed
- Updated info banner to explain per-state behavior differences
- Default behavior for new Talk/Thinking collections is now "list" (was "principal")
- Updated all references from `BEHAVIOR_CONFIG` to `getBehaviorsForState(state)`

**2. Character Sprite Rotation (`src/components/tavern/character-sprite.tsx`):**
- Added module-level `_spriteRotationIndex` Map to track rotation per character per state (no store/persistence noise)
- Added `getRotationIndex()` and `advanceRotationIndex()` helper functions
- Updated `getSpriteFromStateCollectionV2()` to accept `characterId` parameter and use rotation tracker for "list" mode (with modulo wrap)
- Updated `getSpriteUrl()` to pass `characterId` through to the sprite selection function
- Added `useEffect` that detects state transitions to talk/thinking and calls `advanceRotationIndex()` only when entering from a non-talk/thinking state

**3. Group Sprites Rotation (`src/components/tavern/group-sprites.tsx`):**
- Added same rotation tracker (Map + helpers) for consistency
- Updated `getSpriteFromStateCollectionV2()` and `getSpriteUrl()` with characterId parameter
- Added `useEffect` that detects when a character starts streaming (talk) and advances its rotation index
- Updated `getSpriteUrl()` call to pass `character.id`

**Design Decisions:**
- Rotation indices stored in module-level Map (not in Zustand store) to avoid triggering persistence saves and unnecessary re-renders
- Rotation only advances on state ENTRY (idle → talk), not on continuous talk rendering
- Modulo ensures rotation wraps around when exceeding pack length
- Talk and Thinking states use the same rotation tracker (independent per state per character)

**ESLint:** Passes with zero new errors

---
Task ID: 19 - tab-refresh-fix
Agent: Main Agent
Task: Fix entire app refreshing when switching to Stats/Sprites tabs in character editor

Work Log:
- Investigated the root cause of full app refresh when switching tabs
- Found `const store = useTavernStore()` in `use-persistence-sync.ts` line 46 — dead code that subscribed the entire app (via PersistenceProvider in layout.tsx) to ALL store changes
- Found full store subscriptions without selectors in: page.tsx, character-panel.tsx, character-editor.tsx, sessions-sidebar.tsx
- Identified cascade re-render chain: store change → PersistenceProvider re-renders → page.tsx re-renders → ALL children re-render
- Removed dead `const store = useTavernStore()` from use-persistence-sync.ts (variable was never referenced)
- Converted all `useTavernStore()` calls to individual selectors in: page.tsx, character-panel.tsx, character-editor.tsx, sessions-sidebar.tsx
- Added `type="button"` to tab navigation buttons in character-editor.tsx (defensive fix)
- Verified with lint (no new errors) and dev log (compilation stable)

Stage Summary:
- **Root cause**: `PersistenceProvider` wraps the entire app in root layout. It called `usePersistenceSync()` which had `const store = useTavernStore()` (full store subscription). Every store change re-rendered the entire app.
- **Files modified**: use-persistence-sync.ts, page.tsx, character-panel.tsx, character-editor.tsx, sessions-sidebar.tsx
- **Fix impact**: Tab switching now only re-renders the CharacterEditor component, not the entire app
- **Note**: settings-panel.tsx still has full store subscription (73 references) but only renders when settings are open — lower priority for future optimization
---
Task ID: 20 - tts-sprite-state-integration
Agent: Main Agent
Task: When TTS is active, modify sprite state flow: thinking during streaming, talk during TTS playback, idle when TTS ends. Triggers keep absolute priority.

Work Log:
- Explored the full sprite state system: CharacterSprite resolution, spriteSlice actions, TTS hook, chat-panel streaming flow
- Confirmed NO existing integration between TTS playback and sprite states
- Modified `character-sprite.tsx`:
  - Added `isTTSPlaying` prop
  - Changed `effectiveSpriteState` logic: Trigger > TTS Talk > Streaming Thinking > Store State
  - Added `setSpriteStateForCharacter` import
  - Added `useEffect` to sync sprite state back to `idle` when TTS stops playing (only if no trigger active and not streaming)
- Modified `spriteSlice.ts`:
  - Added `endGenerationForCharacterWithTTS(characterId, ttsExpected)` action
  - When `ttsExpected=true` and no trigger active → sets `spriteState: 'talk'` instead of `'idle'`
  - When trigger is active → always keeps trigger regardless of TTS
- Modified `chat-panel.tsx`:
  - Imported `endSpriteGenerationForCharacterWithTTS`
  - Changed all 4 call sites (normal stream, group stream, regenerate, replay) to use the new action
  - `ttsExpected = ttsConfig?.enabled && ttsConfig?.autoGeneration && isTTSConnected`
  - Passed `isTTSPlaying={isTTSPlaying}` to both `CharacterSprite` and `GroupSprites`
- Modified `group-sprites.tsx`:
  - Added `isTTSPlaying` prop
  - Updated sprite state resolution: Trigger > TTS Talk > Streaming Thinking > Store State

Stage Summary:
- **New flow with TTS active**: User sends → `thinking` → tokens arrive (triggers may override) → streaming ends → `talk` (TTS expected) → TTS plays with `talk` sprite → TTS ends → `idle`
- **Trigger priority preserved**: If any trigger activated during generation, it overrides ALL automatic state transitions. TTS state changes are ignored while trigger is active.
- **No TTS**: Behavior unchanged (thinking during streaming → idle when done)
- Files: character-sprite.tsx, group-sprites.tsx, spriteSlice.ts, chat-panel.tsx
---
Task ID: 19
Agent: Main Agent
Task: Agregar LM Studio como proveedor LLM

Work Log:
- Analizado el sistema completo de proveedores LLM (tipos, streaming, generation, UI, rutas API)
- LM Studio es OpenAI-compatible, por lo que se reutiliza el handler existente de streamOpenAICompatible/callOpenAICompatible
- Agregado `'lm-studio'` al tipo `LLMProvider` en `src/types/index.ts`
- Agregado `'lm-studio'` al array `SUPPORTED_PROVIDERS` en `src/lib/llm/types.ts`
- Agregado `case 'lm-studio':` al switch en `src/lib/llm/streaming.ts` (grupo openai/vllm/lm-studio/custom)
- Agregado `case 'lm-studio':` al switch en `src/lib/llm/generation.ts` (grupo openai/vllm/lm-studio/custom)
- Agregada entrada LM Studio al array `LLM_PROVIDERS` en `src/components/tavern/settings-panel.tsx` (label, defaultEndpoint: http://localhost:1234/v1, description)
- Agregado `case 'lm-studio':` al switch en `src/app/api/chat/stream/route.ts`
- Agregado `case 'lm-studio':` al switch en `src/app/api/chat/group-stream/route.ts`
- Agregado `case 'lm-studio':` al switch en `src/app/api/chat/regenerate/route.ts`
- Agregado `case 'lm-studio':` al switch en `src/app/api/chat/generate/route.ts`
- Lint pasado (error pre-existente en fullscreen-editor.tsx, no relacionado)
- Servidor de desarrollo funcionando correctamente

Stage Summary:
- LM Studio agregado exitosamente como proveedor LLM en 9 archivos
- Endpoint por defecto: http://localhost:1234/v1
- Reutiliza el handler OpenAI-compatible existente (sin código duplicado)
- Disponible en todas las rutas: stream, group-stream, regenerate, generate
- Visible en el panel de configuración con label "LM Studio" y descripción en español
---
Task ID: 20
Agent: Main Agent
Task: Corregir auto-activación TTS y optimizar cola con pre-generación en paralelo

Work Log:
- Analizado sistema completo de TTS (hook, service, cola, conexión)
- Identificada causa raíz del Problema 1: `isConnected` de React inicia como `false`, y el effect de auto-generation lo comprueba antes de que el primer check async complete. Si llega un mensaje antes, se salta el TTS.
- Identificada causa raíz del Problema 2: `processQueue()` es estrictamente secuencial: genera → reproduce → genera el siguiente. No hay superposición entre generación y reproducción.

**Fix 1 - Auto-activación TTS (`src/hooks/use-tts.ts`):**
- Cambiado `useTTSAutoGeneration` para usar `ttsService.getCachedConnectionStatus()` directamente en vez de `isConnected` de React
- Solo se salta si el status es 'offline' (confirmadamente no hay servidor)
- Si status es 'unknown' o 'online', procede — el servicio maneja errores de conexión
- Removido `isConnected` del array de dependencias del effect
- Optimizado `speak()` y `speakWithDualVoice()`: cuando status es 'online', saltan el check async y proceden directamente al addToQueue

**Fix 2 - Pre-generación en paralelo (`src/lib/tts/tts-service.ts`):**
- Agregado flag `isGenerating` para rastrear si hay pre-generación en curso
- Nuevo método `pregenerateNext()`: busca el siguiente item 'pending' en la cola y lo genera en background mientras el actual se reproduce
- Modificado `processQueue()`: después de generar el audio actual, llama `pregenerateNext()` ANTES de `await playItem()`
- Modificado `processQueue()`: si el siguiente item ya está 'ready' (pre-generado), salta la generación y va directo a reproducción
- Actualizado `stop()`: resetea `isGenerating` además de `isPlaying`
- Actualizado `playNext()`: comentarios aclaratorios sobre el flujo pre-gen → play

**Flujo optimizado:**
```
Antes: generate(2s) → play(5s) → generate(2s) → play(4s) → ...  Total: 13s para 2 items
Después: generate(2s) → [play(5s) + generate(2s) en paralelo] → play(4s) inmediata  Total: 9s para 2 items
```

Stage Summary:
- Auto-TTS ahora se activa inmediatamente sin necesidad de prueba de voz previa
- Cola TTS ahora pre-genera el siguiente audio mientras reproduce el actual
- Para mensajes con múltiples segmentos, el tiempo total se reduce significativamente
- Lint limpio (solo error pre-existente en fullscreen-editor.tsx)
---
Task ID: 21
Agent: Main Agent
Task: Revisar y corregir serialización de peticiones TTS + fix race condition

Work Log:
- Analizado el flujo completo de la cola TTS para verificar serialización
- Encontrado bug de race condition: si un audio termina de reproducirse ANTES de que pregenerateNext() termine de generar el siguiente, la cola se quedaba estancada
- Identificado que las peticiones TTS YA estaban serializadas correctamente (isGenerating previene overlap), pero faltaba el mecanismo de recuperación

**Fix - Race condition en pregenerateNext():**
- Cuando pregenerateNext() termina de generar un item, ahora verifica si ese item pasó a ser el primero en la cola (porque el anterior terminó de reproducirse durante la generación)
- Si `this.queue[0] === nextItem && !this.isPlaying` → llama processQueue() para reproducir inmediatamente
- También aplica el mismo check en el catch (por si la generación falló pero el item ya está en posición 0)

**Fix - processQueue() case para 'generating':**
- Agregado caso explícito: si queue[0].status === 'generating' → return (esperar a que pregenerateNext termine y dispare processQueue)
- Antes se caía en el `if (item.status !== 'pending') return` genérico, que era correcto pero silencioso

**Diseño final del pipeline serial:**
```
Solo 1 petición TTS a la vez (serializado):

[processQueue]                  [pregenerateNext]
     │                                │
     ├─ await generateSpeech(#1)      │
     │                                │
     ├─ status='ready'                │
     ├─ pregenerateNext() ───────────►├─ await generateSpeech(#2)
     ├─ await playItem(#1)            │
     │         │                       ├─ status='ready'
     │         │◄──────────────────────┤  (si #1 terminó: processQueue())
     │         ▼                       │
     ├─ playItem(#2) inmediato        │  (si #1 sigue: esperar)
     │         │                       │
     ...
```

State machine por item:
  pending → generating → ready → playing → completed
                              ↑          ↑
                              └──────────┘ (pre-generated, 0ms wait)

Stage Summary:
- Las peticiones TTS están serializadas: solo 1 petición al servidor a la vez
- Los audios generados se cachean como blobs para reproducción inmediata
- Race condition corregida: si el audio actual termina antes de que el siguiente se genere, el sistema se recupera automáticamente
- La pre-generación permite que la reproducción sea continua sin pausas entre segmentos
---
Task ID: 22
Agent: Main Agent
Task: Selector de modelos LM Studio con dropdown y botón de refrescar

Work Log:
- Analizado cómo LM Studio expone modelos: GET /v1/models devuelve { data: [{ id: "..." }] }
- LM Studio acepta model: "loaded" para usar el modelo cargado actualmente
- Creado componente LMStudioModelSelector en settings-panel.tsx
- Dropdown con modelos obtenidos de LM Studio + opción "Por defecto (cargado en LM Studio)"
- Botón de refrescar (RefreshCw icon) con spinner de carga
- Auto-fetch de modelos cuando el endpoint cambia
- Input manual para escribir un nombre de modelo personalizado
- Indicador visual cuando se usa "loaded" (modelo por defecto)
- Mensajes de error cuando no hay conexión o no hay modelos
- Importados Select, SelectSeparator de shadcn/ui; RefreshCw, Loader2 de lucide-react

**Comportamiento:**
- Al seleccionar LM Studio como proveedor y configurar endpoint → auto-fetch de modelos
- "Por defecto" → envía model: "loaded" → LM Studio usa el que esté cargado
- Seleccionar un modelo específico → lo envía tal cual en la petición
- Input manual permite escribir cualquier nombre → se envía directamente
- Botón de refrescar re-fetch modelos (útil al cambiar de modelo en LM Studio)
- Los nombres de modelo se muestran limpios (solo el nombre, sin la ruta completa)

Stage Summary:
- LM Studio ahora tiene selector de modelos con dropdown refrescable
- Opción "Por defecto" usa el modelo cargado en LM Studio sin necesidad de saber el nombre
- Los usuarios pueden refrescar la lista al cambiar de modelo en LM Studio
---
Task ID: 2
Agent: Main Agent
Task: Change memory extraction from per-message to per-turn counting + configure chat history limits

Work Log:
- Analyzed full memory extraction flow: memory-extraction.ts → stream/route.ts → group-stream/route.ts
- Analyzed context manager: context-manager.ts with sliding window (maxMessages=50, maxTokens=4096, keepFirstN=1, keepLastN=20)
- Analyzed memory-settings-panel.tsx for existing context limit UI
- Changed stream/route.ts: extraction now counts by user messages (turns) instead of all messages
- Changed group-stream/route.ts: same turn-based counting for group chats
- Updated memory-extraction.ts: shouldExtractMemory() documentation now references turns
- Updated embeddings-settings-panel.tsx: label changed from "mensajes" to "turnos", min=1, description updated
- Confirmed context limits (maxMessages, maxTokens, keepFirstN, keepLastN) are already configurable via UI and persisted in localStorage via Zustand store

Stage Summary:
- Memory extraction now counts by TURNS (user messages) not individual messages
- A turn = 1 user message + N responses (consistent for both normal and group chats)
- Context history limits already exist in Configuración → Memoria → Límites de Contexto
- Settings persist via Zustand → localStorage (survives browser restart)

---
## Task ID: 19 - embeddings-panel-restructure-7tabs
### Work Task
Reorganize the embeddings settings panel from a collapsible-based layout into a 7-tab structure, add a new Prompts tab for custom memory extraction prompt editing, and wire up the custom prompt through the full stack.

### Work Summary

**Files Modified:**

1. **`src/types/index.ts`** — Added `memoryExtractionPrompt?: string` to `EmbeddingsChatSettings` interface

2. **`src/store/defaults.ts`** — Added `memoryExtractionPrompt` default value (full Spanish extraction prompt with `{characterName}` and `{lastMessage}` variables) to the `embeddingsChat` object in `defaultSettings`

3. **`src/lib/embeddings/memory-extraction.ts`** — Three changes:
   - Exported `MEMORY_EXTRACTION_PROMPT` constant so the UI can use it for "Restore Default"
   - Added `customPrompt?: string` parameter to `extractMemories()` — uses custom prompt if provided and non-empty, falls back to default
   - Added `customPrompt?: string` to `extractAndSaveMemories()` options — passes through to `extractMemories()`

4. **`src/app/api/embeddings/extract-memory/route.ts`** — Added `customPrompt` to destructured body, passes it through to `extractAndSaveMemories()`

5. **`src/app/api/chat/stream/route.ts`** — Added `customPrompt: embeddingsChat.memoryExtractionPrompt` to the extract-memory fetch body

6. **`src/app/api/chat/group-stream/route.ts`** — Added `customPrompt: embeddingsChat.memoryExtractionPrompt` to the extract-memory fetch body

7. **`src/components/embeddings/embeddings-settings-panel.tsx`** — Complete restructure:
   - Removed outer collapsible wrappers (Configuración, Integración con Chat)
   - Converted `EmbeddingsChatIntegration` from a Collapsible component to `EmbeddingsChatIntegrationContent` (flat Card, no wrapper)
   - Created new `PromptsTabContent` sub-component with textarea, preview, save/restore buttons
   - Reorganized into 7 tabs with `grid-cols-7` layout:
     - Tab 1: Configuración (Settings) — Service status cards + Ollama URL + model + thresholds + advanced + save/test
     - Tab 2: Integración — Chat integration settings, memory extraction, memory consolidation
     - Tab 3: Búsqueda — Semantic search
     - Tab 4: Archivos — File upload + chunking
     - Tab 5: Namespaces — Namespace management
     - Tab 6: Examinar — Browse embeddings
     - Tab 7: Prompts (NEW) — Custom memory extraction prompt editor with:
       - Textarea for editing the prompt
       - Preview button showing variables replaced with example values
       - "Restore Default" button
       - Character count and unsaved changes indicator
       - Save button
   - Removed `configOpen` state (no longer needed since config is in a tab)
   - Header info banner kept above tabs
   - All dialogs remain outside tabs
   - Added imports: `RotateCcw`, `Pencil`, `MEMORY_EXTRACTION_PROMPT`

**ESLint:** Zero new errors introduced (only pre-existing error in `fullscreen-editor.tsx` remains)
---
Task ID: 3
Agent: Main Agent
Task: Review embeddings flow, reorganize panel tabs, add configurable extraction prompt

Work Log:
- Reviewed full embeddings retrieval flow: retrieveEmbeddingsContext() in chat-context.ts
- Confirmed: only user message (sanitizedMessage) is used as search query — NOT chat history
- Confirmed: group chat calls retrieveEmbeddingsContext per-responder with responder.id, so each character's memories are found
- Reorganized embeddings panel from 4 tabs + 2 collapsibles into 7 flat tabs:
  1. Configuración (service status, Ollama URL, model, thresholds)
  2. Integración (chat integration, memory extraction, consolidation — flattened from Collapsible)
  3. Búsqueda (semantic search — unchanged)
  4. Archivos (file upload — unchanged)
  5. Namespaces (namespace management — unchanged)
  6. Examinar (browse embeddings — unchanged)
  7. Prompts (NEW — custom memory extraction prompt with preview, save, restore default)
- Created clean prompts file: src/lib/embeddings/memory-extraction-prompts.ts (no server imports, client-safe)
- Added memoryExtractionPrompt to EmbeddingsChatSettings type and store defaults
- Modified extractMemories/extractAndSaveMemories to accept customPrompt parameter
- Updated extract-memory API route to pass customPrompt through
- Updated stream/group-stream routes to send customPrompt from settings
- Fixed browser-side crash: extracted prompt constant to separate file to avoid importing lancedb in client bundle

Stage Summary:
- Embeddings retrieval confirmed working for both normal and group chat
- Search query = user message only (not chat history) — this is correct for semantic search
- 7-tab layout implemented with all existing functionality preserved
- Custom extraction prompt fully configurable and persisted in localStorage

---
Task ID: 1
Agent: Main
Task: Fix app not visible in browser - CORS and dev server issues

Work Log:
- Diagnosed app not rendering: dev server was not running after context reset
- Found CORS blocking issue: `allowedDevOrigins` in next.config.ts had old session ID
- Added current session ID `preview-chat-0874b2c1-f82e-468f-93c9-02daabc4ba05.space.z.ai` and `*.space.z.ai` wildcard
- Cleared `.next` cache and restarted dev server
- Verified HTTP 200 response (26KB HTML), no CORS warnings
- Renamed "Integración" tab to "Integración del chat" in embeddings panel

Stage Summary:
- App now renders correctly in preview panel (HTTP 200, no CORS errors)
- Embeddings panel tabs: Configuración, Integración del chat, Búsqueda, Archivos, Namespaces, Examinar, Prompts
- All 7 tabs fully implemented with sub-components
- Server compiles in ~4.5s after cache warm

---
Task ID: 2
Agent: Main
Task: Implement context-aware embeddings improvements

Work Log:
- Added 3 new settings to EmbeddingsChatSettings type: memoryExtractionContextDepth, searchContextDepth, groupDynamicsExtraction
- Updated defaults.ts with new settings (context depth 2, search depth 1, group dynamics off)
- Updated memory-extraction-prompts.ts: added {chatContext} variable, updated default prompt with context examples, added DEFAULT_GROUP_DYNAMICS_PROMPT
- Modified memory-extraction.ts: extractMemories() now accepts optional chatContext, added extractGroupDynamics() function
- Modified extract-memory API route to accept chatContext parameter
- Created /api/embeddings/extract-group-dynamics API route for group dynamics extraction
- Modified stream/route.ts: enriched search query with searchContextDepth, pass chatContext to extraction
- Modified group-stream/route.ts: enriched search query, pass turn context to each character extraction, added group dynamics extraction call
- Updated embeddings-settings-panel.tsx UI: added Context Depth slider, Search Context slider, Group Dynamics toggle, updated info boxes
- Fixed duplicate 'preferencia' key in TYPE_ALIASES
- Fixed TS2322 error in setEditCustomTypeText

Stage Summary:
- Chat normal: memories now extracted with N recent messages as context (configurable 0-5)
- Chat grupal: each character sees the full turn context + group dynamics extraction available
- Search: enriched query includes recent messages for better semantic matching
- All new settings configurable in "Integración del chat" tab
- App compiles successfully (HTTP 200)
---
Task ID: 7
Agent: main
Task: Implement two separate editable prompts for memory extraction (normal chat + group chat)

Work Log:
- Created DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT in memory-extraction-prompts.ts with group-optimized instructions (focus on inter-character dynamics, reactions, opinions about others)
- Created GROUP_MEMORY_PROMPT_VARIABLES export for documentation
- Added groupMemoryExtractionPrompt field to EmbeddingsChatSettings type (types/index.ts)
- Added groupMemoryExtractionPrompt to DEFAULT_EMBEDDINGS_CHAT default values (embeddings-settings-panel.tsx)
- Rewrote PromptsTabContent with internal sub-tabs: "Chat Normal" and "Chat Grupo"
  - Each tab has its own local state for editing
  - Amber dot indicator when a prompt has been customized
  - Different preview data per tab type (normal preview vs multi-character group preview)
  - Different info box per tab explaining the prompt's purpose
  - Save and Restore Default buttons work independently per tab
- Updated group-stream/route.ts to use groupMemoryExtractionPrompt (fallback to memoryExtractionPrompt) for individual character extraction in group chats
- Normal chat (stream/route.ts) continues using memoryExtractionPrompt (no changes needed)
- Lint passes clean on all modified files (pre-existing error in fullscreen-editor.tsx unrelated)

Stage Summary:
- Two independent editable prompts: one for 1:1 chat, one for group chat individual extraction
- Group prompt optimized for inter-character awareness (names, reactions, opinions, agreements/disagreements)
- UI has clean tab switcher with customization indicators
- Group dynamics prompt (DEFAULT_GROUP_DYNAMICS_PROMPT) remains separate and unchanged (analyzes full turn, not individual response)
---
Task ID: 8
Agent: main
Task: Fix memory extraction pipeline — namespaces, model config, and search strategy

Work Log:
- Fixed namespace pattern to include sessionId: `character-{characterId}-{sessionId}` and `group-{groupId}-{sessionId}`
  - Prevents memory leaking between different chat sessions of the same character
  - Updated descriptions to include session info
- Updated getNamespacesForStrategy() to search BOTH session-specific AND generic namespaces
  - character strategy: searches character-{id}-{sid}, character-{id}, default, world, world-building
  - session strategy: searches character-{id}-{sid}, group-{gid}-{sid}, session-{sid}, character-{id}, group-{gid}, default, world
  - Added groupId parameter to retrieveEmbeddingsContext() and getNamespacesForStrategy()
  - group-stream/route.ts now passes group.id to retrieveEmbeddingsContext()
- Fixed Ollama client model refresh: added refreshOllamaClient() method
  - Called before createEmbedding(), searchSimilar(), and searchInNamespace()
  - Compares current model with persisted config and resets singleton if changed
  - Eliminates duplicate code in searchSimilar
- Verified sessionId flows correctly from stream routes to extract-memory endpoint
- Verified both stream/route.ts (normal chat) and group-stream/route.ts (group chat) pass sessionId

Stage Summary:
- Memories now isolated per session (namespace includes sessionId)
- Search covers both session-specific and generic namespaces
- Group chats search in both group-{gid}-{sid} and character-{id}-{sid} namespaces
- Ollama model always uses latest configured model (no stale singleton)
- Lint clean on all modified files
---
Task ID: 9
Agent: main
Task: Fix critical bug — Memories tab UI not finding saved memories (namespace mismatch)

Work Log:
- Diagnosed root cause: Backend saves memories with sessionId in namespace (`character-{id}-{sessionId}`), but UI fetches without it (`character-{id}`)
- Added `sessionId` prop to `NovelChatBoxProps` interface
- Updated `loadMemories()` callback to include sessionId in namespace fetch pattern
  - Single mode: fetches `character-{id}-{sessionId}` (primary) + `character-{id}` (fallback for backward compat)
  - Group mode: fetches `group-{gid}-{sessionId}` + `character-{id}-{sessionId}` per member (primary) + generic namespaces (fallback)
  - Added deduplication of both namespaces and memory IDs across fetch results
- Updated memory reset effect to trigger on sessionId change (not just character/group change)
- Updated namespace footer display to show session-scoped namespace with truncated sessionId
- Passed `activeSessionId` from chat-panel.tsx to NovelChatBox component

Stage Summary:
- Critical bug fixed: Memories tab now finds and displays memories saved by the extraction system
- Session-scoped namespaces prevent cross-session memory leakage
- Backward compatible: still fetches generic namespaces as fallback for manually created lore
---
Task ID: 1
Agent: Main Agent
Task: Clonar repositorio de referencia y aplicar sistema de Tool Calling nativo

Work Log:
- Clonado https://github.com/drAkeSteinn/newsillytavern.git a /home/z/newsillytavern-ref
- Analizado el sistema completo de tools del repositorio de referencia
- Copiados todos los archivos del sistema de tools: types, definitions, parsers (native + prompt), executor, tool-registry, 7 tool implementations
- Copiados providers actualizados (openai.ts, ollama.ts, anthropic.ts) con funciones WithTools
- Copiadas rutas de streaming actualizadas (stream/route.ts, group-stream/route.ts) con loop de tool calling
- Agregados tipos de ToolsSettings a src/types/index.ts (ToolCategory, ToolPermissionMode, ToolParameterDef, ToolParameterSchema, ToolDefinition, CharacterToolConfig, ToolsSettings, DEFAULT_TOOLS_SETTINGS)
- Agregado campo `tools?: ToolsSettings` a AppSettings
- Copiados componentes UI: tools-settings-panel.tsx, tool-call-notification.tsx
- Agregado tab "Herramientas" al settings-panel con icono Wrench
- Agregado manejo de eventos SSE (tool_call_start, tool_call_result, tool_call_error) al chat-panel
- Agregado componente ToolCallNotification al chat-panel

Stage Summary:
- Sistema de Tool Calling nativo completo copiado del repositorio de referencia
- Soporta 3 proveedores con tool calling nativo: OpenAI-compatible, Ollama, Anthropic
- 7 herramientas disponibles: roll_dice, search_memory, get_weather, search_web, set_reminder, modify_stat, check_stat
- Loop de tool calling implementado en stream route (maxToolRounds configurable)
- UI de configuración de tools integrada en el panel de settings
- Notificaciones visuales de tool calls en el chat panel
- Lint pasa correctamente (solo error preexistente en fullscreen-editor.tsx)
---
## Task ID: 19 - group-chat-native-tool-calling-fix
### Work Task
Fix native tool calling in group chat (group-stream route). Previously, the group stream route only used regular streaming functions without tool support, and referenced a non-existent `buildGroupCompletionPrompt` function.

### Work Summary

**Problem Analysis:**
1. **Group stream (group-stream/route.ts)**: Used `streamOpenAICompatible` and `streamAnthropic` (NO tools support) instead of `streamOpenAIWithTools` and `streamAnthropicWithTools`
2. **No tool execution loop**: When the LLM responded with tool calls, they were ignored
3. **Fake tool comment**: Lines 871-880 had a misleading comment saying tools were "handled internally" when they weren't
4. **`buildGroupCompletionPrompt`**: Referenced but never existed (would cause ReferenceError at runtime for Ollama/text-generation-webui)
5. **Normal chat (stream/route.ts)**: Already had complete working tool calling

**Changes Made to `/src/app/api/chat/group-stream/route.ts`:**

1. **Added missing imports:**
   - `buildCompletionPrompt` from `@/lib/llm` (for Ollama/text-gen fallback)
   - `type NativeToolCall` from `@/lib/tools` (for executeGroupToolCalls helper)

2. **Added `executeGroupToolCalls` helper function:**
   - Executes detected tool calls for group chat
   - Sends `tool_call_start` and `tool_call_result` SSE events for each tool
   - Returns `{ results, shouldContinue }`

3. **Replaced provider switch cases with tool-aware streaming:**
   - **OpenAI/vLLM/lm-studio/custom**: Uses `streamOpenAIWithTools` + `createToolCallAccumulator` when tools enabled, with follow-up `streamOpenAICompatible` call
   - **Anthropic**: Uses `streamAnthropicWithTools` + `createAnthropicToolState` when tools enabled, with follow-up `streamAnthropic` call
   - **Ollama**: Uses `streamOllamaWithTools` when tools enabled, with follow-up completion prompt; falls back to `buildCompletionPrompt` without tools
   - **text-generation-webui/koboldcpp/default**: Uses `buildCompletionPrompt` (no tool support)

4. **Removed dead code:**
   - Deleted fake tool handling comment block
   - Deleted unused `buildGroupCompletionPrompt` function definition
   - Changed `generator` type to `AsyncGenerator<string> | undefined` with `if (generator)` guard

**Frontend (already working):**
- `ToolCallNotification` component renders in chat-panel for both normal and group chat
- SSE events `tool_call_start`, `tool_call_result`, `tool_call_error` handled in both chat paths
- Visual notification shows tool name, icon, parameters during execution and result after completion

**ESLint:** Only pre-existing error in `fullscreen-editor.tsx` (unrelated)
**Dev server:** Compiles successfully
---
Task ID: 3
Agent: Main Agent
Task: Fix tool calling for models that output JSON as text content instead of native tool_calls

Work Log:
- Analyzed console logs: LLM (anubis-mini-8b-v1 via LM Studio) outputs tool call JSON as `delta.content` instead of `delta.tool_calls`
- The content `{"type": "function", "name": "search_web", "parameters": {...}}` was being streamed as text to the client
- Enhanced `src/lib/tools/parsers/prompt-parser.ts` with:
  - `mightContainToolCall()` fast pre-check function
  - `splitIntoChunks()` helper for replaying buffered content
  - Improved regex patterns for LM Studio format (`"type": "function"` prefix, `"arguments"` alternative key)
  - Embedded JSON detection (tool call within text)
- Modified `src/app/api/chat/stream/route.ts` (OpenAI, Anthropic, Ollama cases):
  - Changed from streaming directly to client to BUFFERING content during first tool round
  - After buffering: check native tool calls → text-based tool calls → regular text
  - Text-based tool calls emit proper `tool_call_start`/`tool_call_result` SSE events
  - Tool results injected as user message for follow-up call
- Modified `src/app/api/chat/group-stream/route.ts` (same logic for all 3 providers)
- Exported new functions from `src/lib/tools/index.ts`

Stage Summary:
- Tool calling now works for models that output JSON as text (LM Studio, small models)
- Text-based tool call detection: parses JSON, strips from display, executes, sends notification SSE
- Notifications (tool_call_start/result/error) now properly emitted for both native AND text-based tool calls
- Regular text responses are buffered then replayed as small chunks (minor latency, no flash)
- ESLint: only pre-existing error in fullscreen-editor.tsx

---
Task ID: 5
Agent: general-purpose
Task: Update group-stream/route.ts with tool calling fixes

Work Log:
- Added cleanModelArtifacts to imports from @/lib/tools
- Updated 3 text-based tool call fallback sections (OpenAI, Anthropic, Ollama)
- Updated follow-up response streaming to buffer and clean for tool rounds
- Added better logging

Stage Summary:
- All tool call fallback paths now clean model artifacts
- Follow-up responses in tool rounds are buffered and cleaned before streaming
- Tool context messages include instruction to not mention tools

---
## Task ID: 19 - tool-calling-fallback-fix
### Work Task
Fix tool calling system to properly handle models that output tool calls as text content (like LM Studio with anubis-mini-8b-v1). Clean model special tokens from all responses and add better debug logging.

### Root Cause
The model `anubis-mini-8b-v1` via LM Studio receives the `tools` array correctly but responds with tool call JSON as `delta.content` instead of `delta.tool_calls`. While TavernFlow already had a text-based fallback parser, two problems existed:
1. Model special tokens (`<|reservedspecialtoken4|>`, `<|startheader_id|>assistant:`) were not being cleaned from responses
2. Follow-up responses after tool execution also contained special tokens

### Work Summary

**New utility: `cleanModelArtifacts()` (`src/lib/tools/parsers/prompt-parser.ts`):**
- Cleans LLaMA special tokens: `<|reserved_special_token_N|>`, `<|startheader_id|>`, `<|endheader_id|>`, `<|eot_id|>`
- Cleans ChatML/GPT-NeoX tokens: `<|im_start|>`, `<|im_end|>`
- Cleans generic special tokens: `<|anything|>`
- Cleans Mistral tokens: `<s>`, `</s>`
- Cleans LLaMA instruction tokens: `[INST]`, `[/INST]`, `<<SYS>>`, `<</SYS>>`
- Cleans up multiple consecutive newlines from stripping
- Exported from `src/lib/tools/index.ts`

**Updated `stripToolCallFromText()` (`prompt-parser.ts`):**
- Now calls `cleanModelArtifacts()` after removing tool call JSON
- Ensures no special tokens leak through in the cleaned content

**Improved `mightContainToolCall()` (`prompt-parser.ts`):**
- More flexible detection: no longer requires JSON to start at beginning of text
- Added check for `"name"` + `"parameters"/"arguments"` anywhere in content with JSON-like structure

**Better logging in stream route (`src/app/api/chat/stream/route.ts`):**
- Added logging after Round 0 buffer: content length, finish reason, native tool call count
- Added content preview logging when text-based tool call might be detected
- Added ✓/✗ symbols for quick visual scanning of tool call detection results
- Added follow-up round content length comparison (before/after cleaning)

**Clean follow-up responses (`src/app/api/chat/stream/route.ts`):**
- Tool round follow-up responses are now buffered → cleaned → streamed
- Normal responses stream directly in real-time (no delay)
- Tool context message now includes "No menciones las herramientas ni el proceso interno" instruction

**All provider fallback paths updated (stream route):**
- OpenAI/lm-studio/vllm/custom: ✓ clean artifacts on parse failure and regular text
- Anthropic: ✓ same
- Ollama: ✓ same

**Group stream route (`src/app/api/chat/group-stream/route.ts`):**
- All 6 follow-up streaming paths (native + text-based × OpenAI + Anthropic + Ollama) now buffer → clean → stream
- All 6 fallback paths (parse failure + regular text × 3 providers) now clean artifacts
- Removed dead `isToolRound` variable (group-stream doesn't use tool round loop)
- Added `cleanModelArtifacts` to imports

### Answer to User's Question about LM Studio Configuration
LM Studio does NOT need special configuration for tools. TavernFlow sends the `tools` array via the standard OpenAI-compatible API body parameter. Whether the model uses them properly depends on the model itself. The fallback system now handles models that output tool calls as text.

### Files Modified:
- `src/lib/tools/parsers/prompt-parser.ts` — Added `cleanModelArtifacts()`, improved `mightContainToolCall()`, updated `stripToolCallFromText()`
- `src/lib/tools/index.ts` — Exported `cleanModelArtifacts`
- `src/app/api/chat/stream/route.ts` — Better logging, clean artifacts on all paths, buffer+clean follow-up responses
- `src/app/api/chat/group-stream/route.ts` — Same fixes for group chat, clean all 6 follow-up streaming paths
---
Task ID: 1-3
Agent: Main
Task: Fix tool calling - JSON crudo visible como texto en LM Studio models

Work Log:
- Read route.ts, openai.ts, native-parser.ts, prompt-parser.ts, executor.ts, types.ts
- Identified root cause: regex patterns in `parseToolCallFromText` use `[^{}]*` which CANNOT match nested JSON objects like `{"parameters": {"query": "..."}}`
- Rewrote `prompt-parser.ts` with brace-counting JSON extraction (`extractJsonObject`, `findAllToolCallJsonObjects`)
- Added `parseAllToolCallsFromText()` function to handle MULTIPLE tool calls in single response
- Updated `stripToolCallFromText()` to use brace-counting for proper nested JSON removal
- Updated `index.ts` to export new function
- Updated `stream/route.ts` (3 occurrences: OpenAI, Anthropic, Ollama) to use `parseAllToolCallsFromText` and execute multiple tools
- Updated `group-stream/route.ts` (3 occurrences) with same fixes
- Verified no remaining `parseToolCallFromText` references
- Lint passes (1 pre-existing error in fullscreen-editor.tsx, unrelated)

Stage Summary:
- Fixed: Tool call JSON with nested objects now properly detected and parsed
- Fixed: Multiple tool calls in single response supported
- Fixed: JSON tool calls stripped from visible output before sending to frontend
- The model outputs like `{"type":"function","name":"search_web","parameters":{"query":"..."}}` are now correctly intercepted

---
Task ID: 19 - tool-calling-prompt-injection-fix
Agent: Main Agent
Task: Fix tool calling for models that dont support native tool calling (Anubis, Rocinante via LM Studio)

Work Log:
- Analyzed the complete tool calling flow: stream/route.ts, openai.ts, native-parser.ts, prompt-parser.ts, tool-registry.ts
- Identified root cause: `buildPromptBasedToolsSection()` existed in tool-registry.ts but was NOT exported from index.ts and NOT used in either route
- Comment in route.ts explicitly said: "Tools are NOT injected into the system prompt"
- Models like Anubis/Rocinante via LM Studio ignore the `tools` API parameter and have NO knowledge of available tools
- LM Studio warning confirms: "[SamplingSwitch] Config for switch mistralToolsSamplingSwitch has no end strings defined"
- The existing content-fallback parser (mightContainToolCall + parseAllToolCallsFromText) was already implemented but could never trigger because the model never output tool calls

- Exported `buildPromptBasedToolsSection` from `src/lib/tools/index.ts`
- Imported and injected tool instructions into `finalSystemPrompt` in `src/app/api/chat/stream/route.ts`
- Imported and injected tool instructions into `finalSystemPrompt` in `src/app/api/chat/group-stream/route.ts`
- Improved `buildPromptBasedToolsSection()` with clearer instructions for small models:
  - Added example of correct usage with search_web
  - Added "REGLAS IMPORTANTES" section (4 rules)
  - Instructions tell model to output ONLY the tool_call block (no extra text)
  - Instructions tell model NOT to use tool_call for normal conversation
  - Instructions tell model NEVER to fabricate data when tools are available

Stage Summary:
- Fixed: Models now know about tools via system prompt injection
- Fixed: buildPromptBasedToolsSection exported and used in both stream and group-stream routes
- The existing content-fallback parser will detect ```tool_call``` blocks from the model output
- When tool calls are detected, they are executed and results are injected for a follow-up response
- No changes to frontend needed - SSE events (tool_call_start, tool_call_result) already implemented

