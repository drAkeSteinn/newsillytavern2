# Task 2: Inventory V2 Integration into Prompt Builder and Chat System

## Summary
Integrated the Inventory V2 system into the TavernFlow prompt builder and chat system. This enables inventory data (items, equipment, effects, currency) to be included in AI prompts and resolved via template keys.

## Files Modified

### 1. `/home/z/my-project/src/types/index.ts`
- Added `'inventory'` to the `PromptSection.type` union type
- Added V2 fields to `Item` interface:
  - `type?: InventoryItemType` (consumable/equipment classification)
  - `attributeEffects?: ItemAttributeEffect[]` (how item modifies attributes)
  - `duration?: number` (consumable duration in turns)
  - `price?: number` (shop purchase price)
  - `useMessage?: string` (message when used/equipped)
  - `expireMessage?: string` (message when consumable expires)
  - `unequipMessage?: string` (message when unequipped)

### 2. `/home/z/my-project/src/lib/llm/prompt-builder.ts`
- Added `inventory` color to `SECTION_COLORS` (teal)
- Imported inventory types: `Item`, `PersonaInventoryEntry`, `ItemAttributeEffect`, `ActiveConsumableEffect`, `InventoryV2Settings`
- Added `InventoryPromptData` interface with all required fields
- Added `inventoryData` field to `PromptBuildOptions` interface
- Created `buildInventorySection()` function that:
  - Accepts `InventoryPromptData` and optional `KeyResolutionContext`
  - Builds text showing items, equipped items, active effects, and currency
  - Uses `inventorySettings.promptTemplate` for formatting
  - Returns a `PromptSection` with type `'inventory'` and teal color
  - Returns `null` if no inventory data to show
- Modified `buildSystemPrompt()`:
  - Added `inventoryData?: InventoryPromptData` parameter (at end, optional)
  - Injects inventory section AFTER persona, BEFORE character description
  - Only injects when `inventoryData.inventorySettings.enabled && promptInclude` are true
- Modified `buildGroupSystemPrompt()`:
  - Added `inventoryData?: InventoryPromptData` parameter (at end, optional)
  - Same injection logic as `buildSystemPrompt()`

### 3. `/home/z/my-project/src/lib/key-resolver.ts`
- Added inventory types to imports
- Added `inventoryData` field to `KeyResolutionContext` interface
- Created `resolveInventoryKeys()` function (Phase 6.5) that:
  - Resolves `{{inventory}}` key → full inventory text (items, equipment, effects, currency)
  - Resolves `{{currency}}` key → currency display string (e.g., "💰 Divisa: 100")
  - Returns empty string if inventory data is missing or disabled
- Added Phase 6.5 to `resolveAllKeys()` between lorebook attribute keys and cleanup
- Added `inventoryData` parameter to `buildKeyResolutionContext()`
- Added `inventoryData` parameter to `buildGroupKeyResolutionContext()`

### 4. `/home/z/my-project/src/lib/llm/index.ts`
- Added `resolveInventoryKeys` to the re-exports from `@/lib/key-resolver`

### 5. `/home/z/my-project/src/app/api/chat/stream/route.ts`
- Added inventory types to imports from `@/types`
- Added `buildInventorySection` and `InventoryPromptData` to imports from `@/lib/llm`
- Extracted `inventoryData` from request body: `body.inventoryData`
- Passed `inventoryData` to `buildSystemPrompt()` as last parameter
- Passed `inventoryData` to `buildKeyResolutionContext()` as last parameter

### 6. `/home/z/my-project/src/app/api/chat/group-stream/route.ts`
- Added inventory types to imports from `@/types`
- Added `buildInventorySection` and `InventoryPromptData` to imports from `@/lib/llm`
- Extracted `inventoryData` from request body: `body.inventoryData`
- Passed `inventoryData` to `buildGroupSystemPrompt()` as last parameter
- Passed `inventoryData` to `buildKeyResolutionContext()` as last parameter

## Backward Compatibility
- All new parameters are optional
- Existing function signatures are unchanged (new params added at end)
- No changes to existing behavior when `inventoryData` is not provided
- `PromptSection.type` union is extended (not modified)

## Key Resolution Chain
The inventory keys are resolved in the following order within `resolveAllKeys()`:
1. Template variables ({{user}}, {{char}}, etc.)
2. Stats keys ({{resistencia}}, etc.)
3. Event keys ({{solicitante}}, etc.)
4. Sound keys ({{sonidos}})
5. Quest keys ({{activeQuests}}, etc.)
6. Lorebook attribute keys ({{injectionKey}})
7. **Inventory keys ({{inventory}}, {{currency}})** ← NEW
8. Cleanup remaining keys

## Lint Status
✅ All lint checks pass with no errors
