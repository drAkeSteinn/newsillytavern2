# Task 3: Redesign Fallback System in "Activate Sprite Pack" Reward Type

## Agent: main

## Summary
Redesigned the confusing 3-field fallback system in the "Activate Sprite Pack" reward editor into a unified, clean "Comportamiento al expirar" section.

## Changes Made

### File: `/home/z/my-project/src/components/quests/reward-editor.tsx`

1. **Added helper functions** (after line 240):
   - `getExpiryMode()`: Derives the unified dropdown value from `fallbackPackId` + `fallbackMode`
     - If `fallbackPackId` is set → returns `'fallback_pack'`
     - Otherwise → returns `fallbackMode` (or `'idle_collection'` as default)
   - `handleExpiryModeChange(value)`: Maps the unified dropdown back to data model fields
     - `'fallback_pack'` → sets `fallbackMode: 'custom_sprite'`, preserves/creates `fallbackPackId`
     - `'idle_collection'` or `'collection_default'` → sets `fallbackMode`, clears `fallbackPackId`

2. **Redesigned compact mode** (lines ~439-582):
   - Removed separate "Fallback Pack" dropdown from self mode
   - New layout: Target mode → Pack selector → Duration + "Al expirar" dropdown → Conditional fallback pack
   - "Al expirar" options: ↩️ Idle, ⭐ Default, 📦 Otro Pack (non-target only)
   - Fallback pack selector only shown when "Al expirar" = fallback_pack

3. **Redesigned full mode SELF section** (lines ~970-999):
   - Removed `grid grid-cols-2` layout with Sprite Pack + Fallback Pack
   - Changed to single full-width Sprite Pack selector

4. **Redesigned full mode Common section** (lines ~1104-1180):
   - Replaced old "Volver a Idle (ms)" + "Modo Fallback" grid with new "Comportamiento al expirar" section
   - Section title + help text explaining purpose
   - Two fields in row: Duración (ms) with helper text + "Al expirar" unified dropdown
   - Dropdown options: ↩️ Volver a estado Idle, ⭐ Default del Pack, 📦 Activar otro Pack
   - "Activar otro Pack" only shown for non-target modes (self, all)
   - "Pack alternativo" selector conditionally shown below when dropdown = fallback_pack

5. **Fixed target mode switch handler**: Changed `fallbackPackId: v === 'self'` to `v !== 'target'` to preserve fallbackPackId for both self and all modes.

### No type changes needed
The `TriggerFallbackMode` type (`'idle_collection' | 'custom_sprite' | 'collection_default'`) and `QuestRewardActivateSpritePack` interface remain unchanged. The `'fallback_pack'` value is only a UI-level concept that maps to `fallbackMode: 'custom_sprite'` + `fallbackPackId: <pack_id>` in the data model.

## Lint Result
0 errors
