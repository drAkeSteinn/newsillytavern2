# Task 6 - State Editor Cleanup Agent

## Task
Update state-collection-editor-v2.tsx: Remove Conditional Variants section and improve sprite preview with horizontal slider

## Work Completed

### A. Removed ALL Conditional Variants Code
- Removed `simulatedValues` and `variantsOpen` state declarations
- Removed `sessionStats` selector from useTavernStore
- Removed `evaluateConditionalVariants`, `evaluateStatConditions`, `getAttributeValueFromStats` imports
- Removed `ConditionalStateVariant`, `StatRequirement`, `RequirementOperator`, `AttributeDefinition`, `SessionStats` type imports
- Removed `OPERATOR_OPTIONS` constant
- Removed `updateStateCollection` helper function
- Removed all variant handlers (add, update, delete, move up/down)
- Removed all condition handlers (add, update, delete)
- Removed `getUniqueAttributeKeys`, `buildSimulatedStats`, `formatConditionResult` helper functions
- Removed entire Conditional Variants collapsible section, Preview Simulator, and hint section
- Removed `useTavernStore`, `Collapsible`, `Input`, `Switch`, `Slider`, `ScrollArea` imports
- Removed `Sliders`, `ChevronDown`, `ChevronRight`, `ArrowUp`, `ArrowDown`, `Plus`, `Trash2`, `Star` icon imports

### B. Updated handlePackChange
- Removed `conditionalVariants` field from new collection object
- Added comment explaining conditions are now at pack level

### C. Replaced Principal Sprite Selector with Horizontal Slider
- Uses `flex gap-3 overflow-x-auto` with `w-28` shrink-0 cards
- Full-size sprite preview with check badge overlay on selection
- Better visual feedback with border-2 and ring styling

### D. Replaced Small Preview with Full Pack Horizontal Slider
- Shows ALL sprites from pack in horizontal scrollable slider
- Conditional badges (P:priority), Default badges (★ Default), Crown for selected
- Proper color coding: amber for selected, purple for conditional, amber for default
- Header shows sprite count and conditional mode indicator

### E. Updated Header Badges
- Replaced variants count badge with conditional mode indicator
- Shows "Condicional" with GitBranch icon when pack has conditionalMode

### F. Cleaned Up Imports
- Kept only essential imports as specified

## Results
- File reduced from 1331 lines to ~390 lines
- ESLint passes with 0 errors
- Dev server compiles successfully
