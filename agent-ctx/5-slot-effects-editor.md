# Task 5 - Slot-Based Effects Editor

## Summary
Replaced the old effects system (target+attribute) with a new slot-based effects system in `/home/z/my-project/src/components/inventory/item-editor.tsx`.

## Changes Made

### Imports Updated
- **Removed**: `CostOperator`, `AttributeDefinition`, `AttributeType` from `@/types`; `User`, `Drama` from `lucide-react`
- **Added**: `ItemSlotEffect`, `EquipmentSlotDefinition` from `@/types`

### Constants Removed
- `EQUIPMENT_SLOTS: ItemSlot[]` - hardcoded slot list
- `SLOT_LABELS: Record<string, string>` - hardcoded slot labels
- `useTargetOptions()` hook - built persona/character target options
- `OPERATORS_BY_TYPE` - operators filtered by attribute type
- `ATTR_TYPE_INFO` - type labels and icons for attributes
- `ALL_OPERATORS` - fallback operators list

### State Changes
- **EditorState**: Added `slotEffects: ItemSlotEffect[]`; changed `slot` from `ItemSlot` to `string`
- **getInitialState**: Added `slotEffects: item?.slotEffects ?? []`

### Component Changes
- **Removed**: `targetOptions`, `characters`, `personas`, `activePersonaId` selectors; `targetAttributesCache`, `getAttributeType`, `getFilteredOperators` helpers; `addEffect`, `updateEffect`, `removeEffect` functions
- **Added**: `equipmentSlots` store selector; `availableSlots` memo; `addSlotEffect`, `updateSlotEffect`, `removeSlotEffect` functions

### Effects Tab - Complete Replacement
Old: target dropdown → attribute dropdown → mode → operator → value → fallback
New: slot selection (from user-defined equipmentSlots) → free-text effect description

Features:
- Orange-themed card headers with slot icon, name, and `{{key}}` badge
- Slot selector dropdown for changing the assigned slot
- Free-text Textarea for effect description
- Empty state when no equipment slots configured (with guidance)
- Empty state when no effects defined
- Backward compat warning for items with legacy `attributeEffects`

### Config Tab Updated
- Equipment slot selector now uses `equipmentSlots` from store instead of hardcoded `EQUIPMENT_SLOTS`/`SLOT_LABELS`

### Save Handler Updated
- Added `slotEffects: state.slotEffects` to both `createConsumableItem` and `createEquipmentItem` options
- `state.slot` cast to `ItemSlot` for backward compat with existing type

### Code Reduction
- File reduced from 1017 lines to ~400 lines (~60% reduction)
- Removed ~400 lines of old effects-related code

## Verification
- Lint check: passes with no errors
- Dev server: compiles successfully
