# Task 3+5: Target selection when equipping items + Character targets in item editor

## Summary
Implemented two related features for the TavernFlow inventory system:
1. Dynamic character targets in the item editor (effects can target session characters, not just persona)
2. Target selection dialog when equipping/using items that have effects targeting characters

## Changes Made

### types/index.ts
- Added `targetOverrideId?: string` to `PersonaInventoryEntry` interface

### inventorySlice.ts
- Added `pendingEquipAction` state to `InventorySlice` interface
- Added 5 new actions: `requestEquipItem`, `requestUseItem`, `clearPendingEquipAction`, `executeEquipWithTarget`, `executeUseWithTarget`
- `executeEquipWithTarget` stores `targetOverrideId` on the inventory entry
- `executeUseWithTarget` overrides targetId in consumable effects at creation time
- Updated `applyInventoryEffectsToSessionStats` to respect `targetOverrideId` from equipped item entries (uses `entry.targetOverrideId || effect.targetId`)

### item-editor.tsx
- Added `useTargetOptions` hook that reads characters from the store and builds dynamic target options from the active session
- Replaced static `TARGET_OPTIONS` with the dynamic hook
- Updated effect target selector to use `targetOptions` from the hook

### inventory-panel.tsx
- Added target picker dialog with persona + session characters as selectable options
- Modified `handleEquipItem` and `handleUseConsumable` to check if item needs target picker
- If item has effects targeting characters (not just __user__), shows target picker dialog
- If item has no effects or all target __user__, skips dialog and equips/uses directly

## Lint Status
All checks pass cleanly.
