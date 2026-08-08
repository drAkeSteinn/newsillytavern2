# Task 4 - Refactoring Agent: embeddings-settings-panel.tsx cleanup

## Task
Refactor `/home/z/my-project/src/components/embeddings/embeddings-settings-panel.tsx` to remove duplicated constants and dead components.

## Changes Made

### 1. Removed local `DEFAULT_EMBEDDINGS_CHAT` constant (lines 187-212)
- The shared constant already exists in `@/lib/embeddings/constants.ts`
- Initially added import, then removed it entirely since it's not used by any remaining code

### 2. Removed `EmbeddingsChatIntegrationContent` function (lines 218-791)
- ~570 lines of dead code — was never rendered (tabs already removed in prior refactor)
- Chat integration settings now handled in MemorySettingsPanel

### 3. Removed `PromptsTabContent` function + preview constants (lines 797-979)
- ~180 lines of dead code — was never rendered
- Prompt editing now handled in MemorySettingsPanel

### 4. Updated info card text
- Changed to: "💡 La configuración de integración con chat, extracción de memoria, consolidación y prompts se encuentra en Configuración → Memoria → Extracción y Contexto."

### 5. Cleaned up unused imports
- Removed lucide icons: `MessageSquare`, `Globe`, `BarChart3`, `FileCode`, `RotateCcw`
- Removed from Card import: `CardDescription`, `CardHeader`, `CardTitle`
- Removed: `Switch` import (only used in removed components)
- Removed: `useTavernStore` (only used in removed components)
- Removed: `DEFAULT_MEMORY_EXTRACTION_PROMPT`, `DEFAULT_GROUP_MEMORY_EXTRACTION_PROMPT`, `MEMORY_PROMPT_VARIABLES`, `GROUP_MEMORY_PROMPT_VARIABLES`
- Removed: `DEFAULT_EMBEDDINGS_CHAT` import (not used in remaining code)

## Result
- File reduced from 2857 lines to 2056 lines (~800 lines removed)
- Lint passes cleanly
- Remaining tabs unchanged: Configuración, Búsqueda, Archivos, Namespaces, Examinar
