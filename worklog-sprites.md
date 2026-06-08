---
Task ID: 1-8
Agent: Main Coordinator
Task: Implement complete conditional sprite system (attribute-driven sprites)

Work Log:
- Phase 1: Added new TypeScript types (ConditionalStateVariant, ConditionalSpriteEntry, QuestRewardConditionalSpriteCollection) to src/types/index.ts
- Phase 2: Created condition evaluator at src/lib/sprites/condition-evaluator.ts with evaluateStatConditions, evaluateConditionalVariants, evaluateConditionalEntries
- Phase 2: Modified character-sprite.tsx to accept sessionStats and evaluate conditional variants during sprite resolution
- Phase 3: Added conditional_sprite_collection reward execution in quest-reward-executor.ts and quest-reward-utils.ts
- Phase 4: Added conditional variants UI to state-collection-editor-v2.tsx with preview simulator
- Phase 5: Added conditional mode UI to trigger-collection-editor.tsx with conditional entries and preview simulator
- Phase 6: Added conditional_sprite_collection type to reward-editor.tsx
- Phase 7: Character sprite now reacts to sessionStats changes for automatic re-evaluation
- Phase 8: Lint passes, dev server runs, browser verification shows no errors

Stage Summary:
- Complete conditional sprite system implemented across all layers
- State collections now support conditional variants (idle/talk/thinking change based on attributes)
- Trigger collections now support conditional mode (attribute-driven sprite selection)
- New reward type: conditional_sprite_collection for Skills/Actions
- Preview simulator in both editors allows testing conditions
- Priority system: higher priority wins when multiple conditions match
- Cross-character support: conditions can reference other characters or persona attributes
- Auto re-evaluation: sprites update immediately when attributes change
