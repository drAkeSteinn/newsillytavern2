---
Task ID: 1
Agent: main
Task: Review and fix template key resolution in tool calling system

Work Log:
- Analyzed the complete tool calling system: 11 built-in tools, native + prompt-based tool calling
- Traced the full flow: tool definitions → toOpenAITools()/buildPromptBasedToolsSection() → LLM → executor → result messages → follow-up call
- Found that `toOpenAITools()` and `buildPromptBasedToolsSection()` did NOT resolve `{{keys}}` in tool descriptions or parameter descriptions
- Verified that executor results (displayMessages) DO resolve keys: manage-action, manage-quest, manage-solicitud use resolveAllKeys()
- Added `resolveToolDefinitionsKeys()` function in tool-registry.ts that resolves all {{keys}} in tool descriptions and parameter descriptions before sending to LLM
- Updated stream route (single chat) to call `resolveToolDefinitionsKeys(availableTools, keyContext)` after filtering tools
- Updated group-stream route with the same fix
- Both native tool calling (OpenAI format) and prompt-based fallback now have resolved tool descriptions
- Lint passes clean with no errors

Stage Summary:
- Created `resolveToolDefinitionsKeys()` in `/home/z/my-project/src/lib/tools/tool-registry.ts`
- Exported from `/home/z/my-project/src/lib/tools/index.ts`
- Applied in `/home/z/my-project/src/app/api/chat/stream/route.ts` and group-stream route
- All 11 tools' descriptions and parameter descriptions now have {{user}}, {{char}}, etc. properly resolved

---
Task ID: 2
Agent: main
Task: Add Timeline export/import functionality to the Sprite Timeline Editor

Work Log:
- Explored the complete Timeline and Sprites codebase: types, store, UI components, persistence
- Understood the data model: SpriteTimelineData contains tracks, markers, loop, volume settings
- Identified the timeline editor component (sprite-timeline-editor.tsx) and its toolbar section
- Implemented two new handlers: handleExportTimeline and handleImportTimeline
- Export creates a .timeline.json file with metadata header (_format, _exportedAt, _sourceSprite) and the full timeline data
- Import supports both the wrapped format and raw SpriteTimelineData
- Import regenerates all track and keyframe IDs to avoid collisions
- Added hidden file input for timeline import
- Added Export/Import buttons to the sprite toolbar between Save and Add Track buttons
- Added SpriteTimelineData to type imports
- Lint passes clean with no errors

Stage Summary:
- Modified `/home/z/my-project/src/components/tavern/sprite-timeline-editor.tsx`:
  - Added `handleExportTimeline()` callback (exports .timeline.json)
  - Added `handleImportTimeline()` callback (imports .timeline.json with validation)
  - Added `timelineImportInputRef` for file input
  - Added hidden `<input type="file">` for timeline import
  - Added Export and Import buttons in the sprite toolbar
  - Added `SpriteTimelineData` to type imports
- Export format: `tavernflow-timeline-v1` with metadata wrapper
- Import is flexible: accepts both wrapped and raw SpriteTimelineData formats
- IDs are regenerated on import to prevent collisions

---
Task ID: 3
Agent: main
Task: Fix duplicate user message bug — LLM sees "hola" twice when tool calling is triggered

Work Log:
- Investigated the full message flow: frontend (chat-panel.tsx) → backend (stream/generate routes)
- Found root cause: Frontend calls `addMessage()` FIRST (line 479), then reads `currentMessages` (which includes the just-added message) and sends it to backend
- In single-stream route, `allMessages = [...contextWindow.messages, createUserMessage(sanitizedMessage)]` always added the message again → duplicate
- In `buildChatMessages`, consecutive same-role messages are merged: `last.content += '\n' + msg.content` → LLM sees "hola\nhola"
- Group-stream route already had the fix (lines 859-862) but single-stream and generate routes did NOT
- Applied the same duplicate-prevention check to single-stream route (stream/route.ts)
- Applied the same fix to generate route (generate/route.ts)
- The check compares `lastCtxMessage.content === sanitizedMessage` to detect if the message is already present

Stage Summary:
- Fixed `/home/z/my-project/src/app/api/chat/stream/route.ts`:
  - Added duplicate detection before `createUserMessage()` at the message preparation step
- Fixed `/home/z/my-project/src/app/api/chat/generate/route.ts`:
  - Added the same duplicate detection logic
- Lint passes clean with no errors

---
Task ID: 4
Agent: main
Task: Fix {{activeQuests}} key showing two formats — active AND available quests mixed

Work Log:
- Traced the full resolution path: resolveAllKeys() → Phase 5 → resolveQuestKeys() → buildQuestPromptSection()
- Found that buildQuestPromptSection() for regular (non-narrator) characters was outputting BOTH:
  - [MISIONES ACTIVAS]: detailed YAML-like format for active quests
  - [MISIONES DISPONIBLES]: simplified numbered format for available quests
- The function's own comment said "Regular character format - shows active AND available quests"
- This is wrong: {{activeQuests}} should ONLY show active quests; {{availableQuests}} already exists as a separate key
- Removed the availableQuests filtering and output section from buildQuestPromptSection()
- Updated comment in resolveAvailableQuestsKey() that incorrectly said "Use {{activeQuests}} for both active + available"
- buildQuestPromptForLLM() (unused) was already passing only activeQuests, so it's consistent

Stage Summary:
- Fixed `/home/z/my-project/src/lib/triggers/handlers/quest-handler.ts`:
  - buildQuestPromptSection() now only outputs [MISIONES ACTIVAS] with active quests
  - Removed the [MISIONES DISPONIBLES] section from active quests output
  - Available quests remain accessible via {{availableQuests}} key (handled by resolveAvailableQuestsKey in key-resolver.ts)
- Fixed `/home/z/my-project/src/lib/key-resolver.ts`:
  - Updated doc comment to reflect correct separation: {{activeQuests}} = active only, {{availableQuests}} = available only
- Lint passes clean with no errors

---
Task ID: 5
Agent: main
Task: Review and fix problems in the embeddings system

Work Log:
- Explored all embeddings-related files (30+ files across lib, api, components)
- Identified 20 bugs/issues across critical, significant, and minor categories
- Fixed 9 bugs across 4 files

BUG 1 - updateEmbedding() dead code: Fully implemented (fetch→delete→recreate with preserved metadata)
BUG 3 - deleteBySource() always returns 1: Now counts before deletion, returns actual count
BUG 4 - SQL injection in LanceDB filters: Added escapeFilterValue() helper, applied everywhere
BUG 8 - getStats() loads all vectors: Now counts per-namespace, scans only source_type
BUG 10 - resetAll() slow: Uses db.dropTable() + initializeTables() instead of individual deletes
BUG 12 - Memory reinforcement garbage: Now uses updateEmbedding() to actually update importance
BUG 13 - l2ToCosineSimilarity wrong: LanceDB returns L2², formula fixed to 1 - d/2
BUG 14 - Missing refreshOllamaClient() in batch: Added to createBatchEmbeddings()
BUG 17 - Missing model: Added nomic-embed-text-v2-moe (768D) to MODEL_DIMENSIONS

Stage Summary:
- Files modified: client.ts, lancedb-db.ts, memory-reinforcement.ts, types.ts
- Lint passes clean

---
Task ID: 6
Agent: main
Task: Review and fix problems in the lorebook system

Work Log:
- Explored all lorebook-related files (20+ files)
- Fixed 6 bugs across 7 files

BUG 4 - {{outlet::name}} macro not implemented: Added outlet resolution in key-resolver.ts and prompt-builder.ts.
BUG 6 - Token budget uses first lorebook only: Changed to use minimum budget across all active lorebooks.
BUG 7 - Group scoring not implemented: Ported applyGroupScoring() into scanner.ts.
BUG 8 - checkWholeWord() ASCII-only: Changed to Unicode-aware regex with \p{L}.
BUG 9 - Unused globalActiveLorebookIds subscription: Removed dead variable.
BUG 17 - Token budget hardcoded: Removed hardcoded tokenBudget from all API routes.

Stage Summary:
- Files modified: scanner.ts, injector.ts, key-resolver.ts, prompt-builder.ts, chat-panel.tsx, stream/route.ts, generate/route.ts, regenerate/route.ts, group-stream/route.ts
- Lint passes clean

---
Task ID: 7
Agent: main
Task: Lorebooks overhaul - dead code removal + attribute entries with {{key}} injection

Work Log:
- Deleted entire dead `src/lib/pre-llm/` directory (6 files never used externally)
- Removed unused exports: getEntriesByPosition, getEntriesByOutlet from scanner; combineLorebookSections, hasActiveLorebookEntries, getTotalEntryCount, DEFAULT_INJECT_OPTIONS from injector
- Added `injectionKey: string` to LorebookAttributeConfig type
- Rewrote attribute-resolver.ts: new `resolveLorebookAttributeKeys()` returns Record<injectionKey, content> map
- Scanner skips attribute-type entries (they use key injection, not position)
- Injector no longer pre-processes attribute entries (removed attributeContext param)
- Added Phase 6 to key-resolver: `resolveLorebookAttributeKeys()` replaces {{injectionKey}} in text
- Updated buildSystemPrompt and buildGroupSystemPrompt to accept lorebookAttributeKeys
- Updated all 4 API routes to pass lorebookAttributeKeys through pipeline
- Frontend: added injectionKey field, show {{key}} badge in list, hide position/order/group/constant for attribute entries
- Store: default injectionKey in attribute config creation

Stage Summary:
- Attribute entries now use {{injectionKey}} template resolution instead of position-based injection
- Flow: API route → resolveLorebookAttributeKeys() → KeyResolutionContext → key-resolver replaces {{key}}
- Traditional entries unchanged (keyword scanning + position injection)
- Dead code removed: ~500 lines across 6 pre-llm files + unused exports
- All lint checks pass

---
Task ID: 8
Agent: main
Task: Fix LanceDB Windows module resolution error - "could not resolve @lancedb/lancedb-win32-x64-msvc"

Work Log:
- Investigated root cause: @lancedb/lancedb was NOT in package.json dependencies
- The package was installed transiently before but never persisted to package.json
- Turbopack statically analyzes dynamic `import('@lancedb/lancedb')` at dev time
- When Turbopack tries to resolve the import chain, it attempts to load platform-specific native bindings (e.g., @lancedb/lancedb-win32-x64-msvc)
- On platforms where the matching native binding isn't installed, this causes the "could not resolve" error
- Added @lancedb/lancedb v0.27.2 to package.json dependencies via `bun add`
- Added `serverExternalPackages: ["@lancedb/lancedb", "apache-arrow"]` to next.config.ts
- This tells Turbopack to NOT bundle these native modules — they are loaded at runtime instead
- Dev server starts successfully with no LanceDB resolution errors

Stage Summary:
- Modified `/home/z/my-project/package.json`: Added @lancedb/lancedb ^0.27.2 dependency
- Modified `/home/z/my-project/next.config.ts`: Added serverExternalPackages for @lancedb/lancedb and apache-arrow
- On Windows, `bun install` will install @lancedb/lancedb-win32-x64-msvc as an optional platform dependency
- On Linux, it installs lancedb-linux-x64-gnu/musl variants
- serverExternalPackages ensures Turbopack doesn't try to bundle native platform-specific bindings
- Lint passes clean with no errors

---
Task ID: 9
Agent: main
Task: Comprehensive review of embeddings system — find and fix bugs

Work Log:
- Explored ALL 51 files in the embeddings system (~12,334 lines of code)
- Found and fixed 4 bugs:

BUG 1 (HIGH) — accumulatedContent dirty for memory extraction/reinforcement (stream/route.ts)
- When tools are enabled but no tool calls detected, cleanModelArtifacts() cleans roundContent for streaming but accumulatedContent keeps raw version
- Memory extraction and reinforcement then operate on dirty content with model artifacts, XML tags, tool syntax
- Fixed in ALL 5 provider paths: OpenAI/vllm/lm-studio/custom, Z.ai, Anthropic, Ollama, Grok, TextGenWebUI
- Also fixed Grok path which was NOT calling cleanModelArtifacts at all

BUG 2 (MEDIUM) — Missing keyContext in generate/route.ts
- buildHUDContextSection called without keyContext — template variables never resolved
- Added buildKeyResolutionContext() construction and passed it to buildHUDContextSection

BUG 3 (MEDIUM) — Missing keyContext in regenerate/route.ts
- Same issue for buildHUDContextSection and buildPostHistorySection
- Added keyContext to both functions

BUG 4 (MEDIUM) — Missing memory reinforcement in group-stream/route.ts
- Group chat had no memory reinforcement at all
- Added full reinforcement logic mirroring stream/route.ts pattern
- Builds memory namespaces from session context, combines all responder outputs

Stage Summary:
- Modified stream/route.ts, generate/route.ts, regenerate/route.ts, group-stream/route.ts
- All lint checks pass, dev server compiles cleanly

---
Task ID: 10
Agent: main
Task: Review and fix lorebook attribute key resolution across all API routes

Work Log:
- Audited the complete lorebook attribute system: types, attribute-resolver, scanner, injector, key-resolver, prompt-builder
- Verified attribute-resolver.ts correctly evaluates conditions against sessionStats.characterStats and returns injectionKey→content map
- Verified Phase 6 of key-resolver.ts correctly replaces {{injectionKey}} patterns in text
- Verified resolveStatsInText() leaves unknown keys intact (returns match, not empty string) — no conflict with lorebook keys
- Found that sections INSIDE buildSystemPrompt() (description, personality, scenario, persona, characterNote, exampleDialogue) correctly resolve lorebook attribute keys because the internal keyContext includes lorebookAttributeKeys

CRITICAL BUGS FOUND AND FIXED:

BUG 1 (HIGH) — Stream route keyContext missing lorebookAttributeKeys
- File: src/app/api/chat/stream/route.ts line 434-442
- The keyContext used for post-history instructions, HUD context, and other sections built OUTSIDE buildSystemPrompt was missing:
  - lorebookAttributeKeys → {{injectionKey}} in post-history, HUD content never resolved
  - personaResolvedStats → persona attribute keys never resolved
  - questTemplates, sessionQuests, questSettings → quest keys never resolved
  - outletSections → outlet macros never resolved
- Fixed: Added all missing arguments to buildKeyResolutionContext(), built outletSections map from lorebookPlan

BUG 2 (HIGH) — Generate route keyContext missing lorebookAttributeKeys + type mismatch
- File: src/app/api/chat/generate/route.ts line 163-171
- Same missing arguments as BUG 1
- Additional issue: typedSessionStats (SessionStats type) was passed as resolvedStats (ResolvedStats type expected) — type mismatch
- Fixed: Added resolveStats() calls to produce proper ResolvedStats, added all missing arguments, added resolveStats import

BUG 3 (HIGH) — Regenerate route keyContext missing lorebookAttributeKeys + type mismatch
- File: src/app/api/chat/regenerate/route.ts line 210-218
- Same issues as BUG 2
- Fixed: Same pattern as BUG 2, added QuestSettings type import and DEFAULT_QUEST_SETTINGS import

BUG 4 (HIGH) — Group-stream route keyContext missing lorebookAttributeKeys
- File: src/app/api/chat/group-stream/route.ts line 783-789
- Missing lorebookAttributeKeys, personaResolvedStats, quest data, outlet sections
- Fixed: Added resolveStats() for proper ResolvedStats, built outletSections, added all missing arguments

VERIFICATION:
- resolveStatsInText() (stats-resolver.ts line 872-873) correctly returns unknown keys as-is
- Phase 6 resolveLorebookAttributeKeys() (key-resolver.ts line 568-596) correctly replaces {{injectionKey}} patterns
- All lint checks pass cleanly, dev server compiles without errors

Stage Summary:
- Modified 4 API route files: stream/route.ts, generate/route.ts, regenerate/route.ts, group-stream/route.ts
- {{injectionKey}} from attribute-type lorebook entries now resolves correctly in ALL sections:
  ✅ Character description, personality, scenario, characterNote, persona (inside buildSystemPrompt)
  ✅ Post-history instructions (now fixed in all routes)
  ✅ HUD context (now fixed in all routes)
  ✅ Actions block ({{acciones}}) — works via Phase 6 resolving injected block content
  ✅ Requests block ({{peticiones}}) — works via Phase 6 resolving injected block content

---
Task ID: 11
Agent: main
Task: Fix lorebook attribute key resolution — keys not resolving + resolve to empty when condition not met

Work Log:
- Traced the complete data flow: session → sessionStats → attribute-resolver → key-resolver → prompt
- Verified SessionStats type: characterStats[characterId].attributeValues[attributeKey] — CORRECT
- Verified store initialization: createDefaultCharacterStats populates from statsConfig.attributes[].defaultValue
- Verified updateCharacterStat writes to the same path — CORRECT
- Verified validation.ts passes sessionStats through — CORRECT
- Verified lorebook filtering in chat-panel.tsx: only lorebooks configured for character/group — CORRECT
- Verified lorebook panel UI correctly sets entryType, attributeConfig.characterId, attributeConfig.injectionKey — CORRECT
- Verified attributeConfig.characterId options: __user__, __char__, specific character.id — CORRECT

CRITICAL BUG FOUND AND FIXED:

BUG: When attribute condition NOT met, {{injectionKey}} left as literal text
- File: src/lib/lorebook/attribute-resolver.ts
- Root cause: resolveLorebookAttributeKeys() only added keys to the result map when conditions WERE met
- When conditions not met (or attribute not found), the key was NOT added to the map
- Phase 6 in key-resolver.ts only replaces keys that exist in the map
- Result: {{injectionKey}} remained as literal text in the final prompt
- User's expected behavior: "si no se cumple entonces debe resolverse la key como vacio"
- Fix: ALWAYS add the key to the map, using empty string when condition is not met
  Before: `if (resolved !== null) { result[key] = resolved; }`
  After: `result[key] = resolved || '';`

DEBUG LOGGING ADDED:
- attribute-resolver.ts: Logs sessionStats structure, available characterStats, attribute lookup details, condition evaluation results, final key map
- key-resolver.ts Phase 6: Logs available keys, text preview, each replacement
- stream/route.ts: Logs attribute entries found in lorebooks, sessionStats structure, resolved lorebookAttributeKeys

Stage Summary:
- Fixed critical bug in attribute-resolver.ts — keys now ALWAYS resolve (content or empty string)
- Added comprehensive debug logging across 3 files for tracing
- All lint checks pass, dev server compiles cleanly

---
Task ID: 12
Agent: lorebook-attribute-fix
Task: Fix lorebook attribute keys not resolving

Work Log:
- Fixed STATS_KEY_PATTERN global regex state issue in stats-resolver.ts
- Enhanced debug logging in attribute-resolver.ts
- Enhanced Phase 6 logging in key-resolver.ts

Stage Summary:
- Changed STATS_KEY_PATTERN to STATS_KEY_PATTERN_SOURCE (string constant) to avoid shared regex lastIndex state across resolveStatsInText/extractStatsKeys/hasStatsKeys
- Added per-lorebook scan logging (active status, entry counts, entryType breakdown) in attribute-resolver.ts
- Added per-entry classification logging (entryType, disable, hasAttributeConfig, injectionKey) in attribute-resolver.ts
- Added explicit persona (__user__) attribute stats logging in resolveSingleAttributeEntry
- Enhanced Phase 6 in key-resolver.ts: logs full lorebookAttributeKeys map, keysCount, text preview at start
- Logs each replacement with occurrence count and truncated content
- Logs when a key pattern is NOT found in text
- Added safety net: warns if known keys still remain after replacement
- Added remaining {{...}} pattern detection after all replacements
- All changes compile cleanly with no new TypeScript errors

---
Task ID: 13
Agent: main
Task: Follow-up fix for lorebook attribute key resolution — regex escaping + final verification

Work Log:
- Verified STATS_KEY_PATTERN_SOURCE string escaping was correct
- Original subagent used single-backslash `'\{\{...\}\}'` which resolves to literal `{{` in JS strings
- Fixed to double-backslash `'\\{\\{...\\}\\}'` which properly escapes braces for new RegExp()
- Verified no remaining references to old STATS_KEY_PATTERN constant
- Ran lint: clean, no errors
- Confirmed all Phase 6 changes are correct: test()+replace() sequence with lastIndex reset is safe

Stage Summary:
- Fixed STATS_KEY_PATTERN_SOURCE regex escaping in stats-resolver.ts
- All 3 modified files are correct: stats-resolver.ts, attribute-resolver.ts, key-resolver.ts
- Comprehensive debug logging now covers the full chain from lorebook entry → attribute evaluation → key resolution
- Next step: user should trigger a chat to see debug logs in server console and identify the exact cause

---
Task ID: 14
Agent: main
Task: Fix lorebook attribute keys not resolving — diagnosis and Phase 7 cleanup

Work Log:
- User reported {{testloreb}} appearing literally in prompt (not even resolved to empty)
- Added diagnostic _debug_ fields to prompt_data SSE event to trace the issue from frontend
- Added frontend debug logs for lorebook filtering (store count, effective IDs, character IDs)
- Root cause identified: lorebooksReceived was empty because the lorebook was NOT assigned to the character
- User assigned the lorebook to the character → system immediately worked
- Confirmed working: lorebookAttributeKeys = {testloreb: 'esto es el lorebook test'}
- Confirmed persona attribute checking works: __user__.orgasmo checked and condition met

Phase 7 — Cleanup of unresolved keys:
- Added `resolveRemainingKeys()` function as Phase 7 in resolveAllKeys()
- After all 6 resolution phases, scans for any remaining {{key}} patterns
- Known character/persona stat attribute keys are KEPT as-is (for debugging)
- All other unresolved keys are replaced with empty string
- This ensures the LLM never sees raw {{key}} text in the prompt

Code cleanup:
- Removed all temporary _debug_ fields from prompt_data SSE event (stream/route.ts)
- Removed verbose frontend debug console.logs (chat-panel.tsx)
- Removed verbose backend debug logs in attribute-resolver.ts
- Removed verbose Phase 6 debug logging in key-resolver.ts
- Removed sessionStats event fields debug log in stream route
- Lint passes clean

Stage Summary:
- Root cause was user error: lorebook not assigned to character (lorebookIds empty)
- Added Phase 7 resolveRemainingKeys() as safety net in key-resolver.ts
- Cleaned up all temporary debug logging across 4 files
- System verified working: attribute entries resolve correctly for both character and persona attributes
- Files modified: key-resolver.ts, stream/route.ts, chat-panel.tsx, attribute-resolver.ts

---
Task ID: 15
Agent: main
Task: Fix lorebook attribute condition evaluation for text attributes (case sensitivity) + fix import

Work Log:
- Found and fixed bug: importSillyTavernLorebook was missing entryType and attributeConfig fields
- Reviewed evaluateCondition() for text attribute handling
- Found == and != were case-sensitive while contains/not_contains were case-insensitive (inconsistent)
- Fixed: == and != now use case-insensitive comparison for text attributes (both values lowered before compare)
- Fixed: numeric operators (<, <=, >, >=) with text values now return false explicitly instead of relying on NaN fallback
- Improved logic: tries numeric comparison first only when BOTH values are numeric; otherwise uses text comparison
- Updated UI labels for contains/not_contains to show "(sin mayúsc.)" hint

Stage Summary:
- Files modified: lorebookSlice.ts (import fix), attribute-resolver.ts (case-insensitive == / !=), lorebook-panel.tsx (labels)
- Text attributes like "casa" now correctly match "CASA" with == operator
- All lint checks pass

---
Task ID: 16
Agent: main
Task: Add browser-side debug logging for lorebook attribute dynamic condition resolution

Work Log:
- User reported that dynamic content conditions with text attributes (persona "lugar" = "escritorio") don't work
- User requested browser-side debug logging since server logs are not accessible
- Modified attribute-resolver.ts to return detailed per-entry debug info alongside the keys map:
  - New LorebookAttrDebugEntry interface with injectionKey, characterId, resolvedCharId, attributeKey, attributeValue, mode, conditionResults (with evaluationDetail), finalResult
  - New formatEvalDetail() helper produces human-readable evaluation strings like "'escritorio' == 'escritorio' → true"
  - resolveLorebookAttributeKeys() now returns { keys, debugEntries } instead of just Record<string, string>
- Updated buildLorebookSectionForPrompt() to return lorebookDebugEntries alongside lorebookAttributeKeys
- Updated prompt-builder.ts return type and destructuring
- Added lorebook_debug SSE event type in stream/route.ts that sends:
  - lorebookAttributeKeys (final key→content map)
  - debugEntries (per-entry resolution details with condition evaluation)
  - availableStats (raw sessionStats.characterStats from backend)
- Added comprehensive frontend debug logging in chat-panel.tsx:
  - Before fetch: logs active lorebooks (attribute entries with config), sessionStats (__user__ and character attributes), allCharactersWithPersona
  - On SSE: receives lorebook_debug event and displays color-coded status for each entry (✓ MATCHED, ✗ NO MATCH, ⚠ NOT FOUND)
  - Each condition shows evaluation detail like "'escritorio' == 'escritorio' → true" with green/red coloring

Stage Summary:
- Files modified: attribute-resolver.ts, prompt-builder.ts, lorebook/index.ts, stream/route.ts, chat-panel.tsx
- User can now open browser DevTools console and see complete trace of attribute resolution for each chat message
- Debug info shows exactly what attribute value was found, what conditions were evaluated, and whether they matched
- All lint checks pass
- IMPORTANT: This debug logging is left in place for user testing. Once the bug is identified, it should be cleaned up.

---
Task ID: 17
Agent: main
Task: Fix active lorebooks filter producing empty array despite lorebooks being active and assigned

Work Log:
- User shared browser debug logs showing: characterLorebookIds: Array(2), effectiveLorebookIds: Array(2), but Active Lorebooks: []
- Traced the filtering logic in chat-panel.tsx line 845: `lorebooks.filter(lb => effectiveLorebookIds.includes(lb.id) && lb.active)`
- Two conditions: (1) ID must be in effectiveLorebookIds ✓, (2) lb.active must be truthy ✗
- Found the `lorebooks` come from `useTavernStore((state) => state.lorebooks)` — the Zustand persisted store
- Investigated `lorebookSlice.ts`:
  - `addLorebook()` did NOT set `active: true` — it just spread `...lorebook`, relying on caller
  - `importSillyTavernLorebook()` correctly set `active: true`
  - `toggleLorebook()` set `lb.active = !lb.active` — if active was undefined, `!undefined = true`
  - `getActiveLorebooks()` used `activeLorebookIds.includes(l.id)` (not `lb.active`) — inconsistent!
- The store has TWO tracking mechanisms: `activeLorebookIds: string[]` (authoritative array) and `lorebooks[].active` (per-object boolean)
- BUG: `addLorebook()` could create lorebooks with `active: undefined` (falsy), causing the filter to exclude them
- The filter used `lb.active` which could be `undefined`, while the toggle and UI used `activeLorebookIds.includes(id)`

FIX 1 — lorebookSlice.ts `addLorebook()`: Added `active: lorebook.active ?? true` to ensure new lorebooks default to active
FIX 2 — chat-panel.tsx: Changed all 3 filter locations from `lb.active` to `activeLorebookIds.includes(lb.id)` for consistency with the rest of the store
FIX 3 — store/index.ts merge: Added migration logic to fix existing lorebooks with undefined `active` property:
  - Sets `active` based on whether ID is in `activeLorebookIds` 
  - Syncs `finalActiveLorebookIds` if missing
FIX 4 — Added `activeLorebookIds` to the debug log output in chat-panel.tsx

Stage Summary:
- Root cause: dual tracking desync — filter used `lb.active` (per-object, could be undefined) while UI/toggle used `activeLorebookIds` (authoritative array)
- Files modified: lorebookSlice.ts, chat-panel.tsx, store/index.ts
- New lorebooks now always default to `active: true`
- Filter now uses authoritative `activeLorebookIds` instead of unreliable `lb.active`
- Existing persisted lorebooks with undefined `active` are migrated on store load
- All lint checks pass

---
Task ID: 1
Agent: main
Task: Implement Proactive Messages feature for TavernFlow

Work Log:
- Added ProactiveMessagesConfig type and ProactiveMessageInfo type to src/types/index.ts
- Added proactiveMessages field to CharacterCard interface
- Added proactiveInfo field to MessageMetadata interface
- Created DEFAULT_PROACTIVE_MESSAGES_CONFIG constant
- Created API endpoint /api/chat/proactive/route.ts for generating proactive messages
- Created useProactiveMessages hook (src/hooks/use-proactive-messages.tsx) with timer logic
- Created ProactiveMessagesPanel component (src/components/tavern/proactive-messages-panel.tsx)
- Added "Proactivo" tab to character editor (character-editor.tsx)
- Integrated proactive messages hook into chat-panel.tsx with visual indicator
- Added proactive message badge to chat-message.tsx (Sparkles icon + "Proactivo" badge)

Stage Summary:
- Feature complete: Characters can now send messages without user input based on configurable timers
- Configuration: enabled/disabled toggle, interval (30s-60min with presets), min messages before start, max per session, trigger states (idle/user_away), custom prompt
- Visual feedback: Amber indicator in bottom-right of chat showing timer countdown, badge on proactive messages, toast notification when proactive message received
- API: Non-streaming endpoint that reuses existing prompt building infrastructure
- Only works in single-character chat (disabled in group chat mode)
- Timer resets on any user activity (click, type, scroll)
- All lint checks pass

---
Task ID: 2
Agent: main
Task: Fix proactive messages — inactivity by time between messages, English system prompt, Spanish nudge with {{char}}

Work Log:
- Changed inactivity measurement from DOM events (keydown, mousedown, scroll, etc.) to time between messages in chat
- Removed DOM event listeners entirely — timer now only resets when a new message (user or assistant) appears
- Renamed `lastActivityRef` → `lastMessageTimeRef` throughout the hook
- Added proper `allowedStates` check: skips generation if current state (idle/user_away) not in config
- Updated default system prompt instruction to English with mention of available actions (e.g. *moves closer*, *looks around*)
- Changed nudge from `[The scene continues. {name} decides to speak or act.]` to `[La escena continúa. {{char}} decide hablar o actuar.]` with server-side {{char}} resolution
- Updated panel UI descriptions to reflect new inactivity behavior (time between messages)
- Fixed pre-existing lint error in lorebook-panel.tsx (useMemo dependency)
- All lint checks pass

Stage Summary:
- Proactive inactivity now correctly measures time between chat messages, not user interaction
- System prompt instruction is in English and mentions actions
- Nudge message is in Spanish with {{char}} template key resolved server-side
- Files modified: use-proactive-messages.tsx, proactive/route.ts, proactive-messages-panel.tsx, lorebook-panel.tsx
