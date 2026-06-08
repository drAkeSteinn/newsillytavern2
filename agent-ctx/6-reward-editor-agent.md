# Task 6 - Reward Editor Agent

## Task
Modify the Reward Editor component to add support for the `conditional_sprite_collection` reward type.

## Summary
Successfully added full `conditional_sprite_collection` reward type support to the RewardEditor component, including:

- Type imports: `TriggerFallbackMode`, `createConditionalSpriteCollectionReward`, `GitBranch` icon
- New prop: `availableConditionalCollections` for listing conditional trigger collections
- New handler: `handleConditionalSpriteCollectionChange` for updating the reward config
- Type selector updates in both compact and full mode
- Full configuration UI with collection selector, target mode, return to idle, and fallback mode
- Lint passes with 0 errors
