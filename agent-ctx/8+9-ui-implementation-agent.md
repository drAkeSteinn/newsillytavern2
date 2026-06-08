# Task 8+9: UI Implementation for activate_sprite_pack Reward Type

## Summary
Implemented the UI for the `activate_sprite_pack` reward type across three files:
- `stats-editor.tsx` (Task 8)
- `reward-editor.tsx` (Task 9)
- `character-editor.tsx` (prop pass-through)

## Changes Made

### stats-editor.tsx
- Added imports: SpritePackV2, TriggerFallbackMode, Package, GitBranch, createActivateSpritePackReward
- Added `spritePacksV2?: SpritePackV2[]` prop to StatsEditorProps and SkillEditorProps
- Added "🎨 Sprite Pack" button in rewards section
- Added isActivateSpritePack variable and purple styling for badge/container
- Added complete inline editor with: pack selector, target mode, idle timer, fallback mode, conditional mode info
- Passed spritePacksV2 through to both SkillEditor renderings (skills and intentions)

### reward-editor.tsx
- Added imports: QuestRewardActivateSpritePack, createActivateSpritePackReward, Package
- Added `availableSpritePacks` prop to RewardEditorProps
- Added isActivateSpritePack computed variable
- Extended handleTypeChange to include 'activate_sprite_pack'
- Added handleActivateSpritePackChange handler
- Compact mode: Added "🎨 Sprite Pack" dropdown option and config section
- Full mode: Added Sprite Pack dropdown option with Package icon and detailed config section with purple styling

### character-editor.tsx
- Added `spritePacksV2={character.spritePacksV2}` prop to StatsEditor

## Verification
- ESLint: 0 errors
- Dev server: compiles successfully
