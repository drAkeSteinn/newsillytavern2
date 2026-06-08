# Task 4 - Conditional Variants Editor Agent

## Task
Modify the State Collection Editor V2 to add support for Conditional State Variants with a preview/simulation feature.

## File Modified
- `/home/z/my-project/src/components/tavern/state-collection-editor-v2.tsx`

## Summary of Changes
- Added Conditional Variants collapsible section to each state card (idle/talk/thinking)
- Variant cards with: name, priority, enabled toggle, pack selector, behavior selector, principal sprite selector, conditions editor
- Conditions editor supports all 9 operators with attribute dropdown from statsConfig
- Preview Simulator with attribute sliders and evaluation results display
- Added useTavernStore integration for session stats
- Added evaluateConditionalVariants/evaluateStatConditions/getAttributeValueFromStats imports
- All handler functions implemented (add/update/delete variant, add/update/delete condition, reorder)
- Lint passes with 0 errors
