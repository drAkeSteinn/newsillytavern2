# Sprite Priority System

## Overview

This document describes the sprite priority system used in TavernFlow.
**This system must not be modified without explicit understanding of the priority rules.**

## Priority Order (Highest to Lowest)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRIORITY ORDER                              │
├─────────────────────────────────────────────────────────────────┤
│  1. TRIGGER SPRITE (Highest Priority)                           │
│     - Activated by sprite triggers from AI response             │
│     - Persists until:                                           │
│       a) Timer expires (if returnToIdleMs > 0)                  │
│       b) Another trigger replaces it                            │
│     - NOT affected by talk/thinking/idle states                 │
├─────────────────────────────────────────────────────────────────┤
│  2. STATE COLLECTION SPRITES                                    │
│     - Talk sprite (when streaming with content)                 │
│     - Thinking sprite (when generating without content)         │
│     - Only shown when NO trigger sprite is active               │
├─────────────────────────────────────────────────────────────────┤
│  3. LEGACY SPRITES (Fallback)                                   │
│     - From character.spriteConfig.sprites[state]                │
├─────────────────────────────────────────────────────────────────┤
│  4. AVATAR (Lowest Priority)                                    │
│     - Character avatar as final fallback                        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Rules

### Rule 1: Trigger Sprite Priority
Once a trigger sprite is activated, it MUST NOT be replaced by:
- Talk sprites (even if streaming with content)
- Thinking sprites (even if generating)
- Idle sprites (even if generation ends)

The trigger sprite ONLY changes when:
1. Its timer expires (returnToIdleMs > 0)
2. Another trigger activates (replaces it)
3. User manually clears it

### Rule 2: Timer Behavior
- `returnToIdleMs = 0`: Trigger sprite persists indefinitely until another trigger replaces it
- `returnToIdleMs > 0`: After X milliseconds, trigger clears and normal state logic applies

### Rule 3: Return Modes
When timer expires:
- `returnToMode: 'clear'`: Clear trigger, show sprite based on current state (talk/thinking/idle)
- `returnToMode: 'idle'`: Clear trigger, show idle sprite
- `returnToMode: 'talk'`: Clear trigger, show talk sprite
- `returnToMode: 'thinking'`: Clear trigger, show thinking sprite

### Rule 4: Generation Lifecycle
During generation lifecycle (startGeneration → endGeneration):
- If trigger is active at startGeneration: KEEP IT
- If trigger activates during generation: KEEP IT
- If trigger is active at endGeneration: KEEP IT
- Only clear trigger if NO trigger and timer expired

## Code Locations

### Store (spriteSlice.ts)
- `CharacterSpriteState`: State structure for each character
- `applyTriggerForCharacter()`: Activates trigger sprite
- `scheduleReturnToIdleForCharacter()`: Schedules timer
- `startGenerationForCharacter()`: Must preserve trigger
- `endGenerationForCharacter()`: Must preserve trigger

### Display (character-sprite.tsx)
```typescript
// CORRECT priority logic:
const spriteResult = charSpriteState.triggerSpriteUrl 
  ? { url: charSpriteState.triggerSpriteUrl, label: charSpriteState.triggerSpriteLabel }
  : getSpriteUrl(effectiveSpriteState, spriteConfig, avatarUrl);
```

### Trigger Activation (use-sprite-triggers.ts)
- `applyTrigger()`: Sets triggerSpriteUrl with optional timer

## Common Mistakes to Avoid

1. ❌ Clearing trigger sprite on generation start/end
   - ✅ Keep trigger sprite active, let timer handle transition

2. ❌ Checking talk/thinking state before trigger sprite
   - ✅ Always check triggerSpriteUrl FIRST

3. ❌ Setting returnToMode to 'idle' by default
   - ✅ Use 'clear' to respect current state (talk/thinking/idle)

4. ❌ Overriding trigger sprite with state collection
   - ✅ Trigger sprite always wins over state collections

## Testing Checklist

When modifying sprite system, verify:
- [ ] Trigger sprite shows when activated
- [ ] Trigger sprite persists during generation
- [ ] Trigger sprite persists after generation ends
- [ ] Timer correctly clears trigger after X ms
- [ ] Timer=0 keeps trigger indefinitely
- [ ] New trigger replaces old trigger
- [ ] Works in single chat mode
- [ ] Works in group chat mode (each character independent)

## Version History

- 2024-01: Initial documentation
- 2024-01: Added returnToMode 'clear' for state-aware transitions
