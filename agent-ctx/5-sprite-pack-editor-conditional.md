# Task 5 - Sprite Pack Editor V2: Conditional Mode & Horizontal Slider

## Summary
Updated `/home/z/my-project/src/components/tavern/sprite-pack-editor-v2.tsx` to add conditional mode for sprite packs and replace the cramped 4-column grid with a horizontal scrollable slider.

## Changes Made

### 1. New Imports
- Added `GitBranch`, `HelpCircle` from `lucide-react`
- Added `Switch` from `@/components/ui/switch`
- Added `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@/components/ui/tooltip`
- Added `AttributeDefinition`, `StatRequirement`, `RequirementOperator` from `@/types`

### 2. OPERATOR_OPTIONS Constant
- Array of 9 operator options with `value`, `label`, and `symbol` for the condition editor dropdowns
- Supports: <, <=, >, >=, ==, !=, between, contains, not_contains

### 3. SpriteConditionEditor Component
- Inline component for editing conditions on a per-sprite basis
- Each condition row: attribute selector, operator selector, value input, optional valueMax (for 'between')
- Add/delete condition buttons
- Reads available attributes from character's statsConfig

### 4. availableAttributes Computation
- `useMemo` that extracts `character.statsConfig?.attributes || []`

### 5. Helper Functions
- `handleUpdateSpriteInPack(packId, spriteId, updates)` - Partial updates to a sprite within a pack
- `handleSetDefaultSprite(packId, spriteId)` - Sets/unsets the default sprite for a pack

### 6. Conditional Mode Section (inside each pack accordion)
- Purple-themed card with `GitBranch` icon and "Modo Condicional" label
- `Switch` toggle to enable/disable conditional mode on the pack
- `Tooltip` with help text explaining conditional mode
- Description text shown when conditional mode is enabled
- "Condicional" badge shown in the accordion header when conditional mode is active

### 7. Horizontal Slider for Sprite Preview
- Replaced `grid grid-cols-4 gap-2` with `flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory`
- Each sprite card: fixed `w-36` width, `shrink-0 snap-start`
- Conditional styling: purple border/bg when `conditionalEnabled`, amber border/bg when `isDefault`
- Overlapping badges: Video/Film type indicators, GitBranch conditional indicator, ★ default indicator
- Conditional mode controls per sprite (when pack.conditionalMode is on):
  - Priority number input (P:)
  - Conditional enabled Switch (scale-50)
  - Default star button (★)
  - SpriteConditionEditor when conditionalEnabled is true

### 8. Add Sprites Dialog Update
- Changed from `grid grid-cols-4 gap-2` to `flex gap-3 flex-wrap` with `w-36 shrink-0` cards
- Consistent card sizing with the main pack slider
- Fixed quote escaping (using `&quot;` for JSX)

### 9. TooltipProvider Wrapper
- Wrapped entire component output in `<TooltipProvider>` for tooltip support

## Verification
- `bun run lint` passes with 0 errors
- Dev server compiles successfully (no type errors)
