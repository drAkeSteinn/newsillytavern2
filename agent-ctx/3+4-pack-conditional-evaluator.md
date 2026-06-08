# Task 3+4: Pack-Level Conditional Sprite Evaluation

## Task A: Update condition-evaluator.ts

### Changes Made:
1. **Added `SpritePackEntryV2` to imports** (line 20) alongside existing `StatRequirement`, `SessionStats`, `ConditionalStateVariant`, `ConditionalSpriteEntry`

2. **Added new exported function `evaluatePackConditionalSprites`** (lines 278-301):
   - Evaluates conditional sprites at the **pack level** (instead of the state variant level)
   - Filters sprites with `conditionalEnabled = true` and non-empty `conditions`
   - Sorts by priority DESC (highest priority first)
   - Returns the first sprite whose conditions all match
   - Returns `null` if no conditional sprite matches (caller should use `defaultSpriteId` or behavior-based resolution)
   - Uses `SpritePackEntryV2[]` as input type (the pack's sprites array)
   - Reuses `evaluateStatConditions` for the actual condition checking

## Task B: Update character-sprite.tsx

### Changes Made:
1. **Updated import**: Replaced `evaluateConditionalVariants` with `evaluatePackConditionalSprites` from `@/lib/sprites/condition-evaluator`

2. **Replaced `getSpriteFromStateCollectionV2` function** with pack-level conditional evaluation:
   - **Old flow**: Found state collection → evaluated `conditionalVariants` on the state collection → used winning variant's packId/behavior
   - **New flow**: Found state collection → found pack by packId → if `pack.conditionalMode`, evaluate pack-level conditional sprites via `evaluatePackConditionalSprites` → if winner found, return its url/label → if no winner, try `pack.defaultSpriteId` → try sprites marked `isDefault` → fall through to behavior-based resolution

### Key behavioral differences:
- Conditions are now defined on **SpritePackEntryV2** entries within a pack (not on ConditionalStateVariant objects)
- The pack lookup happens **before** conditional evaluation (old code looked up pack after variant matched)
- Three fallback levels when no conditional sprite matches: `defaultSpriteId` → `isDefault` sprite → behavior-based resolution
- The existing `evaluateConditionalVariants` function is still exported from condition-evaluator.ts (used by other components like state-collection-editor-v2.tsx)

## Verification
- `bun run lint` passes with 0 errors
- Dev server compiles successfully (only pre-existing LanceDB error visible in logs)
