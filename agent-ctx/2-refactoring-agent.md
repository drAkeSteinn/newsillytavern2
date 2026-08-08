# Task 2: Refactor memory-settings-panel.tsx

## Summary
Merged the ContextoTab into ExtraccionTab, replacing duplicated constant with shared import and reducing tab count from 4 to 3.

## Changes Made
1. **Replaced `DEFAULT_EMBEDDINGS_CHAT`**: Removed local constant (was lines 72-97), now imported from `@/lib/embeddings/constants`
2. **Removed `ContextoTab` function**: Entire function deleted (was lines 1239-1460)
3. **Expanded `ExtraccionTab`**: Added `settings` store selector, `contextSettings` with defaults, `updateContextSettings` helper, and two new Cards:
   - "Límites de Contexto" (Database icon, cyan-500) — sliders for max messages/tokens, inputs for keep first/last N, info box
   - "Contexto de Embeddings en Chat" (Brain icon, purple-500) — toggle, namespace strategy, token budget, info box
4. **Updated `MemorySettingsPanel`**: `grid-cols-4` → `grid-cols-3`, removed Contexto tab trigger and content, renamed Extracción → "Extracción y Contexto" / "Ext. Ctx."
5. **No unused imports**: All imports still used after refactoring

## Files Modified
- `/home/z/my-project/src/components/memory/memory-settings-panel.tsx`
- `/home/z/my-project/worklog.md` (appended)

## Verification
- `bun run lint` passes cleanly
- Dev server compiles without errors
