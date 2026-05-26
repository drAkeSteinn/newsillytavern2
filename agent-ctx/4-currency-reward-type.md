# Task 4: Add "Divisa" (Currency) reward type to RewardEditor, StatsEditor, and quest-reward-utils

## Summary
Added "Divisa" (Currency) as a reward type option in the TavernFlow UI editors, along with the supporting factory function and description handler.

## Files Modified

### 1. `/home/z/my-project/src/lib/quest/quest-reward-utils.ts`
- Added `createCurrencyReward()` factory function (creates a QuestReward with type='currency')
- Added currency handling in `describeReward()` — returns `💰 Divisa: +N` or `💰 Divisa: -N`
- `normalizeReward` and `validateReward` already handled currency — no changes needed

### 2. `/home/z/my-project/src/components/quests/reward-editor.tsx`
- Added `createCurrencyReward` import from quest-reward-utils
- Added `Coins` icon import from lucide-react
- Added `isCurrency` type check alongside `isAttribute` and `isTrigger`
- Updated `handleTypeChange` to accept `'currency'` as a type option
- Added `handleCurrencyChange` handler for currency field updates
- Added currency option to type selector in both compact and full modes
- Added currency config sections (amount input with help text) in both modes

### 3. `/home/z/my-project/src/components/tavern/stats-editor.tsx`
- Added `createCurrencyReward` import from quest-reward-utils
- **SkillEditor activation rewards**: Added "💰 Divisa" button, isCurrency check, card styling, badge text, inline editor
- **AttributeEditor onMinReached**: Added "💰 Divisa" button, isCurrency check, card styling, badge text, inline editor
- **AttributeEditor onMaxReached**: Added "💰 Divisa" button, isCurrency check, card styling, badge text, inline editor

## Verification
- `bun run lint` passes with no errors
- Dev server compiles and serves correctly
