// ============================================
// Sprite Slice - Unified Sprite State Management
// Supports both single character and group chat
// ============================================
//
// ⚠️ SPRITE PRIORITY SYSTEM - CRITICAL - DO NOT MODIFY ⚠️
//
// This module implements the sprite priority system. The rules are:
//
// 1. TRIGGER SPRITE HAS ABSOLUTE PRIORITY
//    - Once set, triggerSpriteUrl MUST NOT be cleared by:
//      * startGenerationForCharacter()
//      * endGenerationForCharacter()
//      * State changes (talk/thinking/idle)
//    - Only cleared by:
//      * Timer expiration (returnToIdleMs > 0)
//      * New trigger replacing it
//      * User manual action
//
// 2. TIMER BEHAVIOR
//    - returnToIdleMs = 0: Trigger persists indefinitely
//    - returnToIdleMs > 0: Trigger clears after X ms
//
// 3. RETURN MODE
//    - 'clear': Clear trigger, show state-based sprite (talk/thinking/idle)
//    - 'idle': Clear trigger, show idle sprite
//    - 'talk': Clear trigger, show talk sprite
//    - 'thinking': Clear trigger, show thinking sprite
//
// See: /docs/SPRITE_PRIORITY_SYSTEM.md for full documentation
//
// ============================================

import type { 
  SpriteState, 
  SpriteLockState, 
  SpriteTriggerHit, 
  SpriteIndex, 
  // NEW V2 Types
  SpritePackV2,
  TriggerCollection,
  TriggerQueueState,
  TriggerQueueEntry,
  ActiveTrigger,
  SpriteChain,
  SoundChain,
} from '@/types';
import { 
  createDefaultSpritePackV2,
  createDefaultTriggerCollection,
  createDefaultTriggerQueueState,
} from '@/types';
import type { SoundChainStep, SoundTrigger, SoundCollection } from '@/types';

import { uuidv4 } from '@/lib/uuid';

// ============================================
// Sound Chain Player
// ============================================

// Active sound chain tracking
const activeSoundChains = new Map<string, { timeouts: NodeJS.Timeout[]; audios: HTMLAudioElement[] }>();

/**
 * Play a sound chain for a character
 * This is called directly when startSoundChain is invoked
 */
function playSoundChainForCharacter(
  characterId: string,
  chain: SoundChain,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[],
  globalVolume: number
): void {
  // Stop any existing chain for this character
  stopSoundChainForCharacter(characterId);
  
  const chainState = { timeouts: [] as NodeJS.Timeout[], audios: [] as HTMLAudioElement[] };
  activeSoundChains.set(characterId, chainState);
  
  const chainVolume = (chain.volume ?? 1) * globalVolume;
  
  console.log('[SpriteSlice] Playing sound chain:', {
    characterId,
    steps: chain.steps.length,
    volume: chainVolume,
  });
  
  chain.steps.forEach((step: SoundChainStep, index: number) => {
    const timeout = setTimeout(() => {
      playSoundChainStep(
        characterId,
        step,
        soundTriggers,
        soundCollections,
        chainVolume
      );
    }, step.delayMs);
    
    chainState.timeouts.push(timeout);
  });
}

/**
 * Play a single sound chain step
 */
function playSoundChainStep(
  characterId: string,
  step: SoundChainStep,
  soundTriggers: SoundTrigger[],
  soundCollections: SoundCollection[],
  chainVolume: number
): void {
  let soundUrl: string | null = null;
  let volume = (step.volume ?? 1) * chainVolume;
  
  // Try sound trigger key first
  if (step.soundTriggerKey) {
    const trigger = soundTriggers.find(t => t.name === step.soundTriggerKey || t.id === step.soundTriggerKey);
    if (trigger) {
      const collection = soundCollections.find(c => c.name === trigger.collection);
      if (collection && collection.files.length > 0) {
        // Pick sound based on play mode
        let soundFile: string;
        if (trigger.playMode === 'random') {
          soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
        } else {
          const index = (trigger.currentIndex || 0) % collection.files.length;
          soundFile = collection.files[index];
        }
        soundUrl = soundFile;
        volume *= trigger.volume;
      }
    }
  }
  // Fall back to direct URL
  else if (step.soundUrl) {
    soundUrl = step.soundUrl;
  }
  
  if (!soundUrl) {
    console.warn('[SpriteSlice] No sound URL for step:', step);
    return;
  }
  
  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.min(1, Math.max(0, volume));
    
    audio.play().catch(e => {
      console.warn('[SpriteSlice] Audio play failed:', e);
    });
    
    // Track the audio
    const chainState = activeSoundChains.get(characterId);
    if (chainState) {
      chainState.audios.push(audio);
    }
    
    audio.onended = () => {
      const state = activeSoundChains.get(characterId);
      if (state) {
        const idx = state.audios.indexOf(audio);
        if (idx > -1) state.audios.splice(idx, 1);
      }
    };
  } catch (error) {
    console.error('[SpriteSlice] Failed to play sound:', error);
  }
}

/**
 * Stop sound chain for a character
 */
function stopSoundChainForCharacter(characterId: string): void {
  const chainState = activeSoundChains.get(characterId);
  if (!chainState) return;
  
  // Clear all timeouts
  chainState.timeouts.forEach(t => clearTimeout(t));
  
  // Stop all audio
  chainState.audios.forEach(a => {
    a.pause();
    a.remove();
  });
  
  activeSoundChains.delete(characterId);
}

// ============================================
// Per-Character Sprite State
// ============================================

export interface CharacterSpriteState {
  // Current sprite from trigger (HIGHEST PRIORITY - DO NOT OVERRIDE)
  triggerSpriteUrl: string | null;
  triggerSpriteLabel: string | null;
  triggerCollectionId: string | null;  // ID of the trigger collection that activated this sprite
  triggerPackId: string | null;  // ID of the sprite pack
  useTimelineSounds: boolean;  // Whether to play timeline sounds for this sprite

  // Return to idle state for this character
  returnToIdle: {
    active: boolean;
    scheduledAt: number;
    returnAt: number;
    triggerSpriteUrl: string;  // URL of trigger sprite (to verify)
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear';  // What state to return to
    returnSpriteUrl: string;     // URL to return to (if mode is idle/talk/thinking)
    returnSpriteLabel: string | null;
  };

  // Track if trigger was activated during current generation
  triggerActivatedDuringGeneration: boolean;
  
  // Current sprite state (thinking/talk/idle)
  spriteState: SpriteState;
  
  // NEW V2: Trigger queue for this character
  triggerQueue: TriggerQueueState;
  
  // NEW V2: Current chain progress (if any)
  chainProgress: {
    active: boolean;
    type: 'sprite' | 'sound';
    currentStep: number;
    totalSteps: number;
    startedAt: number;
    interruptible: boolean;
  } | null;

  // Runtime: actual displayed sprite URL (set by CharacterSprite/GroupSprites)
  // Used by useTimelineSpriteSounds hook to know which timeline to play
  displayedSpriteUrl: string | null;
}

// Default state for a character
export const createDefaultCharacterState = (): CharacterSpriteState => ({
  triggerSpriteUrl: null,
  triggerSpriteLabel: null,
  triggerCollectionId: null,
  triggerPackId: null,
  useTimelineSounds: true,  // Enable timeline sounds by default
  returnToIdle: {
    active: false,
    scheduledAt: 0,
    returnAt: 0,
    triggerSpriteUrl: '',
    returnToMode: 'clear',
    returnSpriteUrl: '',
    returnSpriteLabel: null,
  },
  triggerActivatedDuringGeneration: false,
  spriteState: 'idle',
  // NEW V2 fields
  triggerQueue: createDefaultTriggerQueueState(),
  chainProgress: null,
  displayedSpriteUrl: null,
});

// ============================================
// Sprite Slice Interface
// ============================================

export interface SpriteSlice {
  // Per-character sprite states (UNIFIED SYSTEM)
  characterSpriteStates: Record<string, CharacterSpriteState>;
  
  // Current sprite state for backward compatibility (single chat)
  currentSpriteState: SpriteState;
  
  // Sprite lock state (global, applies to active character)
  spriteLock: SpriteLockState;
  lockIntervalMs: number;
  lockIntervalId: ReturnType<typeof setInterval> | null;

  // Sprite packs and index (global resources)
  spriteIndex: SpriteIndex;

  // Last trigger info (for cooldowns)
  lastSpriteTriggerAt: number;
  lastSpritePackId: string | null;

  // ============================================
  // UNIFIED ACTIONS (work for both single and group)
  // ============================================
  
  // Get sprite state for a specific character
  getCharacterSpriteState: (characterId: string) => CharacterSpriteState;
  
  // Apply trigger for a specific character
  applyTriggerForCharacter: (characterId: string, hit: SpriteTriggerHit) => void;
  
  // Schedule return to idle for a specific character
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    delayMs: number
  ) => void;
  
  // Cancel return to idle for a specific character
  cancelReturnToIdleForCharacter: (characterId: string) => void;
  
  // Execute return to idle immediately for a specific character
  executeReturnToIdleForCharacter: (characterId: string) => void;
  
  // Get return to idle countdown for a character
  getReturnToIdleCountdownForCharacter: (characterId: string) => number;
  
  // Check if return to idle is scheduled for a character
  isReturnToIdleScheduledForCharacter: (characterId: string) => boolean;
  
  // Start generation for a character (resets trigger flag, sets thinking state)
  startGenerationForCharacter: (characterId: string) => void;
  
  // End generation for a character (clears if no trigger, keeps if trigger active)
  endGenerationForCharacter: (characterId: string) => void;
  
  // Clear sprite state for a character
  clearCharacterSpriteState: (characterId: string) => void;
  
  // Set sprite state for a character
  setSpriteStateForCharacter: (characterId: string, state: SpriteState) => void;

  // Set the displayed sprite URL for a character (called by CharacterSprite/GroupSprites)
  setDisplaySpriteUrl: (characterId: string, url: string | null) => void;

  // ============================================
  // NEW V2 ACTIONS - Trigger Queue System
  // ============================================
  
  // Add trigger to queue
  addTriggerToQueue: (characterId: string, entry: Omit<TriggerQueueEntry, 'id' | 'triggeredAt'>) => void;
  
  // Process next trigger in queue
  processNextTriggerInQueue: (characterId: string) => void;
  
  // Clear trigger queue for character
  clearTriggerQueue: (characterId: string) => void;
  
  // Get queue length for character
  getTriggerQueueLength: (characterId: string) => number;
  
  // Check if trigger is currently active
  hasActiveTrigger: (characterId: string) => boolean;
  
  // Reset trigger time (for same trigger re-detection)
  resetTriggerTimer: (characterId: string) => void;

  // ============================================
  // NEW V2 ACTIONS - Chain System
  // ============================================
  
  // Start sprite chain
  startSpriteChain: (characterId: string, chain: SpriteChain) => void;
  
  // Start sound chain
  startSoundChain: (characterId: string, chain: SoundChain) => void;
  
  // Advance chain step
  advanceChainStep: (characterId: string) => void;
  
  // Interrupt chain (if interruptible)
  interruptChain: (characterId: string) => void;
  
  // Get chain progress
  getChainProgress: (characterId: string) => CharacterSpriteState['chainProgress'];

  // ============================================
  // NEW V2 ACTIONS - Sprite Packs V2
  // ============================================
  
  // Sprite Packs V2 state
  spritePacksV2: SpritePackV2[];
  
  // Create new sprite pack
  createSpritePackV2: (name: string, description?: string) => SpritePackV2;
  
  // Update sprite pack
  updateSpritePackV2: (id: string, updates: Partial<SpritePackV2>) => void;
  
  // Delete sprite pack
  deleteSpritePackV2: (id: string) => void;
  
  // Add sprite to pack
  addSpriteToPackV2: (packId: string, sprite: Omit<SpritePackV2['sprites'][0], 'id'>) => void;
  
  // Remove sprite from pack
  removeSpriteFromPackV2: (packId: string, spriteId: string) => void;
  
  // Get pack by ID
  getSpritePackV2ById: (id: string) => SpritePackV2 | undefined;

  // ============================================
  // NEW V2 ACTIONS - Trigger Collections
  // ============================================
  
  // Trigger collections state (stored per character, but managed globally for editor)
  
  // Create trigger collection for character
  createTriggerCollection: (characterId: string, collection: Omit<TriggerCollection, 'id' | 'createdAt' | 'updatedAt'>) => TriggerCollection;
  
  // Update trigger collection
  updateTriggerCollection: (characterId: string, collectionId: string, updates: Partial<TriggerCollection>) => void;
  
  // Delete trigger collection
  deleteTriggerCollection: (characterId: string, collectionId: string) => void;
  
  // Get trigger collections for character
  getTriggerCollectionsForCharacter: (characterId: string) => TriggerCollection[];

  // ============================================
  // LEGACY ACTIONS (for backward compatibility)
  // ============================================
  
  // These work on the "active" character (single chat)
  setSpriteState: (state: SpriteState) => void;
  setSpriteUrl: (url: string | null, label?: string | null) => void;
  currentSpriteUrl: string | null;
  currentSpriteLabel: string | null;
  triggerActivatedDuringGeneration: boolean;
  returnToIdle: CharacterSpriteState['returnToIdle'];
  
  // Lock management (still global)
  setSpriteLock: (lock: Partial<SpriteLockState>) => void;
  clearSpriteLock: () => void;
  applySpriteLock: (url: string, durationMs: number, intervalMs?: number) => void;
  reapplySpriteLock: () => void;
  setLockInterval: (intervalMs: number) => void;
  
  // Legacy return to idle (uses active character)
  scheduleReturnToIdle: (currentUrl: string, idleUrl: string, idleLabel: string | null, delayMs: number) => void;
  cancelReturnToIdle: () => void;
  executeReturnToIdle: () => void;

  // Legacy trigger system
  applySpriteTrigger: (hit: SpriteTriggerHit) => void;
  isSpriteLocked: () => boolean;
  isReturnToIdleScheduled: () => boolean;
  getReturnToIdleCountdown: () => number;

  // Legacy generation tracking
  startGeneration: () => void;
  endGeneration: () => void;
  wasTriggerActivated: () => boolean;

  // Index management
  setSpriteIndex: (index: SpriteIndex) => void;

  // Sprite URL lookup
  getSpriteUrlByLabel: (label: string) => string | null;
}

// ============================================
// Timer Management (per character)
// ============================================

// Map of characterId -> timeoutId for return to idle
const _returnToIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
let _lockIntervalId: ReturnType<typeof setInterval> | null = null;

// Helper to clear timer for a character
const clearReturnToIdleTimer = (characterId: string) => {
  const timer = _returnToIdleTimers.get(characterId);
  if (timer) {
    clearTimeout(timer);
    _returnToIdleTimers.delete(characterId);
  }
};

// Callback for when return to idle executes
let _onReturnToIdle: ((characterId?: string) => void) | null = null;

export const setReturnToIdleCallback = (callback: ((characterId?: string) => void) | null) => {
  _onReturnToIdle = callback;
};

// ============================================
// Slice Creation
// ============================================

export const createSpriteSlice = (set: any, get: any): SpriteSlice => ({
  // ============================================
  // Initial State
  // ============================================
  
  characterSpriteStates: {},
  currentSpriteState: 'idle',
  
  // Legacy state values (for backward compatibility)
  currentSpriteUrl: null,
  currentSpriteLabel: null,
  triggerActivatedDuringGeneration: false,
  returnToIdle: {
    active: false,
    scheduledAt: 0,
    returnAt: 0,
    triggerSpriteUrl: '',
    returnToMode: 'clear',
    returnSpriteUrl: '',
    returnSpriteLabel: null,
  },

  spriteLock: {
    active: false,
    spriteUrl: '',
    until: 0,
    lastApplyAt: 0,
  },

  lockIntervalMs: 0,
  lockIntervalId: null,

  spriteIndex: {
    sprites: [],
    lastUpdated: 0,
    source: '',
  },

  lastSpriteTriggerAt: 0,
  lastSpritePackId: null,

  // ============================================
  // UNIFIED ACTIONS
  // ============================================
  
  getCharacterSpriteState: (characterId: string) => {
    const state = get();
    return state.characterSpriteStates[characterId] || createDefaultCharacterState();
  },
  
  applyTriggerForCharacter: (characterId: string, hit: SpriteTriggerHit) => {
    const now = Date.now();
    
    console.log('[SpriteSlice] applyTriggerForCharacter called:', {
      characterId,
      spriteUrl: hit.spriteUrl,
      spriteLabel: hit.spriteLabel,
      packId: hit.packId,
      collectionId: hit.collectionId,
    });
    
    // Clear any pending return to idle for this character
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: hit.spriteUrl,
            triggerSpriteLabel: hit.spriteLabel,
            triggerCollectionId: hit.collectionId || null,
            triggerPackId: hit.packId || null,
            useTimelineSounds: hit.useTimelineSounds ?? true,  // Enable timeline sounds by default
            triggerActivatedDuringGeneration: true,
            spriteState: 'idle', // Triggers set state to idle
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
            },
          },
        },
        lastSpriteTriggerAt: now,
        lastSpritePackId: hit.packId,
      };
    });
  },
  
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    delayMs: number
  ) => {
    // Clear any existing timer for this character
    clearReturnToIdleTimer(characterId);
    
    const now = Date.now();
    
    // Create new timer
    const timer = setTimeout(() => {
      const state = get();
      const charState = state.characterSpriteStates[characterId];
      
      console.log('[SpriteSlice] Return to idle timer fired:', {
        characterId,
        returnToIdleActive: charState?.returnToIdle.active,
        currentTriggerSpriteUrl: charState?.triggerSpriteUrl,
        expectedTriggerSpriteUrl: charState?.returnToIdle?.triggerSpriteUrl,
        returnToMode,
        returnSpriteUrl: charState?.returnToIdle?.returnSpriteUrl,
      });
      
      // Only execute if the trigger sprite is still the one we scheduled for
      if (charState?.returnToIdle.active && 
          charState.triggerSpriteUrl === charState.returnToIdle.triggerSpriteUrl) {
        
        // Execute return based on mode
        set((state: any) => {
          const currentCharState = state.characterSpriteStates[characterId];
          if (!currentCharState) return state;
          
          // If mode is 'clear', just clear the trigger sprite and let normal logic determine what to show
          // Otherwise, set the trigger sprite to the return sprite
          const shouldClearTrigger = returnToMode === 'clear';
          
          console.log('[SpriteSlice] Executing return to idle:', {
            shouldClearTrigger,
            returnToMode,
            newSpriteUrl: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteUrl,
          });
          
          return {
            characterSpriteStates: {
              ...state.characterSpriteStates,
              [characterId]: {
                ...currentCharState,
                triggerSpriteUrl: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteUrl,
                triggerSpriteLabel: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteLabel,
                returnToIdle: {
                  active: false,
                  scheduledAt: 0,
                  returnAt: 0,
                  triggerSpriteUrl: '',
                  returnToMode: 'clear',
                  returnSpriteUrl: '',
                  returnSpriteLabel: null,
                },
              },
            },
          };
        });
        
        // Call callback if set
        if (_onReturnToIdle) {
          _onReturnToIdle(characterId);
        }
      }
      
      _returnToIdleTimers.delete(characterId);
    }, delayMs);
    
    _returnToIdleTimers.set(characterId, timer);
    
    // Update state
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            returnToIdle: {
              active: true,
              scheduledAt: now,
              returnAt: now + delayMs,
              triggerSpriteUrl: triggerUrl,
              returnToMode,
              returnSpriteUrl,
              returnSpriteLabel,
            },
          },
        },
      };
    });
  },
  
  cancelReturnToIdleForCharacter: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
            },
          },
        },
      };
    });
  },
  
  executeReturnToIdleForCharacter: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState || !currentCharState.returnToIdle.active) return state;
      
      // If mode is 'clear', just clear the trigger sprite and let normal logic determine what to show
      const shouldClearTrigger = currentCharState.returnToIdle.returnToMode === 'clear';
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteUrl,
            triggerSpriteLabel: shouldClearTrigger ? null : currentCharState.returnToIdle.returnSpriteLabel,
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
            },
          },
        },
      };
    });
  },
  
  getReturnToIdleCountdownForCharacter: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    if (!charState?.returnToIdle.active) return 0;
    const remaining = charState.returnToIdle.returnAt - Date.now();
    return Math.max(0, remaining);
  },
  
  isReturnToIdleScheduledForCharacter: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    return charState?.returnToIdle.active || false;
  },
  
  startGenerationForCharacter: (characterId: string) => {
    // DEBUG: Log all current character states before change
    const allStates = get().characterSpriteStates;
    console.log('[SpriteSlice] 🔍 startGenerationForCharacter START:', {
      targetCharacterId: characterId,
      allCharacterStates: Object.entries(allStates).map(([id, state]) => ({
        id: id.substring(0, 8),
        hasTrigger: !!(state as any).triggerSpriteUrl,
        triggerUrl: (state as any).triggerSpriteUrl?.substring(0, 30),
        returnToIdleActive: (state as any).returnToIdle?.active,
      })),
    });
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      // Check if there's an active trigger sprite
      // Trigger sprites have priority over thinking/talk states
      const hasActiveTrigger = currentCharState.triggerSpriteUrl !== null;
      
      console.log('[SpriteSlice] startGenerationForCharacter:', {
        characterId,
        hasActiveTrigger,
        currentTriggerUrl: currentCharState.triggerSpriteUrl,
      });
      
      if (hasActiveTrigger) {
        // Keep the trigger sprite - it has priority
        // The return to idle timer (if any) will handle transitioning back
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              // Keep triggerSpriteUrl and returnToIdle as they are
              spriteState: 'thinking',
              // Reset the flag for new generation (will be set to true if new trigger activates)
              triggerActivatedDuringGeneration: false,
            },
          },
        };
      }
      
      // No active trigger - proceed with normal generation start
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: null,
            triggerSpriteLabel: null,
            triggerActivatedDuringGeneration: false,
            spriteState: 'thinking',
            returnToIdle: {
              active: false,
              scheduledAt: 0,
              returnAt: 0,
              triggerSpriteUrl: '',
              returnToMode: 'clear',
              returnSpriteUrl: '',
              returnSpriteLabel: null,
            },
          },
        },
      };
    });
    
    // DEBUG: Log all states after change
    const allStatesAfter = get().characterSpriteStates;
    console.log('[SpriteSlice] 🔍 startGenerationForCharacter END:', {
      targetCharacterId: characterId,
      allCharacterStates: Object.entries(allStatesAfter).map(([id, state]) => ({
        id: id.substring(0, 8),
        hasTrigger: !!(state as any).triggerSpriteUrl,
        triggerUrl: (state as any).triggerSpriteUrl?.substring(0, 30),
      })),
    });
  },
  
  endGenerationForCharacter: (characterId: string) => {
    // DEBUG: Log all current character states before change
    const allStates = get().characterSpriteStates;
    console.log('[SpriteSlice] 🔍 endGenerationForCharacter START:', {
      targetCharacterId: characterId,
      allCharacterStates: Object.entries(allStates).map(([id, state]) => ({
        id: id.substring(0, 8),
        hasTrigger: !!(state as any).triggerSpriteUrl,
        triggerUrl: (state as any).triggerSpriteUrl?.substring(0, 30),
        returnToIdleActive: (state as any).returnToIdle?.active,
      })),
    });
    
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;
      
      // If there's an active trigger sprite (with or without return to idle),
      // keep it - the return to idle timer will handle transitioning back if scheduled
      const hasActiveTrigger = currentCharState.triggerSpriteUrl !== null;
      
      console.log('[SpriteSlice] endGenerationForCharacter:', {
        characterId,
        hasActiveTrigger,
        currentTriggerUrl: currentCharState.triggerSpriteUrl,
        returnToIdleActive: currentCharState.returnToIdle?.active,
      });
      
      if (hasActiveTrigger) {
        // Trigger sprite is active, keep it
        // The return to idle timer (if any) will handle the transition
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              spriteState: 'idle',
            },
          },
        };
      }
      
      // No trigger active, clear everything
      console.log('[SpriteSlice] endGenerationForCharacter: Clearing trigger for', characterId);
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: null,
            triggerSpriteLabel: null,
            spriteState: 'idle',
          },
        },
      };
    });
  },
  
  clearCharacterSpriteState: (characterId: string) => {
    clearReturnToIdleTimer(characterId);
    
    set((state: any) => {
      const newStates = { ...state.characterSpriteStates };
      delete newStates[characterId];
      return { characterSpriteStates: newStates };
    });
  },
  
  setSpriteStateForCharacter: (characterId: string, spriteState: SpriteState) => {
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            spriteState,
          },
        },
      };
    });
  },

  setDisplaySpriteUrl: (characterId: string, url: string | null) => {
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;

      // Only update if URL actually changed (avoid unnecessary re-renders)
      if (currentCharState.displayedSpriteUrl === url) return state;

      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            displayedSpriteUrl: url,
          },
        },
      };
    });
  },

  // ============================================
  // END GENERATION WITH TTS SUPPORT
  // Like endGenerationForCharacter, but sets 'talk' instead of 'idle'
  // when TTS is expected to play (no trigger active).
  // ============================================
  endGenerationForCharacterWithTTS: (characterId: string, ttsExpected: boolean) => {
    set((state: any) => {
      const currentCharState = state.characterSpriteStates[characterId];
      if (!currentCharState) return state;

      const hasActiveTrigger = currentCharState.triggerSpriteUrl !== null;

      if (hasActiveTrigger) {
        // Trigger sprite is active, keep it — TTS state is irrelevant
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...currentCharState,
              spriteState: 'idle',
            },
          },
        };
      }

      // No trigger active
      // If TTS is expected to play → set 'talk' so CharacterSprite shows talk sprite
      // If TTS is NOT expected → set 'idle' as usual
      const targetState = ttsExpected ? 'talk' : 'idle';

      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...currentCharState,
            triggerSpriteUrl: null,
            triggerSpriteLabel: null,
            spriteState: targetState,
          },
        },
      };
    });
  },

  // ============================================
  // LEGACY ACTIONS (for backward compatibility with single chat)
  // ============================================
  
  setSpriteState: (state: SpriteState) => {
    set({ currentSpriteState: state });
  },

  setSpriteUrl: (url: string | null, label: string | null = null) => {
    // This is now a no-op for the unified system
    // The trigger system handles sprite URLs per character
  },

  // Lock management
  setSpriteLock: (lock: Partial<SpriteLockState>) => set((state: any) => ({
    spriteLock: { ...state.spriteLock, ...lock },
  })),

  clearSpriteLock: () => {
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    set({
      spriteLock: {
        active: false,
        spriteUrl: '',
        until: 0,
        lastApplyAt: 0,
      },
      lockIntervalMs: 0,
      lockIntervalId: null,
    });
  },

  applySpriteLock: (url: string, durationMs: number, intervalMs: number = 0) => {
    const now = Date.now();
    
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    if (intervalMs > 0) {
      _lockIntervalId = setInterval(() => {
        const state = get();
        if (state.spriteLock.active && state.spriteLock.spriteUrl) {
          set({
            spriteLock: {
              ...state.spriteLock,
              lastApplyAt: Date.now(),
            },
          });
        }
      }, intervalMs);
    }
    
    set({
      spriteLock: {
        active: true,
        spriteUrl: url,
        until: durationMs > 0 ? now + durationMs : 0,
        lastApplyAt: now,
      },
      lockIntervalMs: intervalMs,
      lockIntervalId: _lockIntervalId,
    });
  },

  reapplySpriteLock: () => {
    const state = get();
    if (state.spriteLock.active && state.spriteLock.spriteUrl) {
      set({
        spriteLock: {
          ...state.spriteLock,
          lastApplyAt: Date.now(),
        },
      });
    }
  },

  setLockInterval: (intervalMs: number) => {
    if (_lockIntervalId) {
      clearInterval(_lockIntervalId);
      _lockIntervalId = null;
    }
    
    if (intervalMs > 0) {
      _lockIntervalId = setInterval(() => {
        const state = get();
        if (state.spriteLock.active && state.spriteLock.spriteUrl) {
          set({
            spriteLock: {
              ...state.spriteLock,
              lastApplyAt: Date.now(),
            },
          });
        }
      }, intervalMs);
    }
    
    set({ lockIntervalMs: intervalMs, lockIntervalId: _lockIntervalId });
  },

  // Legacy return to idle - now uses active character concept
  scheduleReturnToIdle: (currentUrl: string, idleUrl: string, idleLabel: string | null, delayMs: number) => {
    // This is called by useSpriteTriggers hook
    // We need to find the active character or use a default
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().scheduleReturnToIdleForCharacter(activeCharId, currentUrl, 'clear', idleUrl, idleLabel, delayMs);
    }
  },
  
  cancelReturnToIdle: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().cancelReturnToIdleForCharacter(activeCharId);
    }
  },
  
  executeReturnToIdle: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().executeReturnToIdleForCharacter(activeCharId);
    }
  },

  // Legacy trigger - apply to active character
  applySpriteTrigger: (hit: SpriteTriggerHit) => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      get().applyTriggerForCharacter(activeCharId, hit);
    }
  },

  isSpriteLocked: () => {
    const state = get();
    if (!state.spriteLock.active) return false;
    if (state.spriteLock.until === 0) return true;
    return Date.now() < state.spriteLock.until;
  },

  isReturnToIdleScheduled: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return state.characterSpriteStates[activeCharId]?.returnToIdle.active || false;
    }
    return false;
  },

  getReturnToIdleCountdown: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return get().getReturnToIdleCountdownForCharacter(activeCharId);
    }
    return 0;
  },

  // Legacy generation tracking
  startGeneration: () => {
    // For backward compatibility, we set the global state
    set({
      currentSpriteState: 'thinking',
    });
  },
  
  endGeneration: () => {
    set({
      currentSpriteState: 'idle',
    });
  },
  
  wasTriggerActivated: () => {
    const state = get();
    const activeCharId = Object.keys(state.characterSpriteStates)[0];
    if (activeCharId) {
      return state.characterSpriteStates[activeCharId]?.triggerActivatedDuringGeneration || false;
    }
    return false;
  },

  // Index management
  setSpriteIndex: (index: SpriteIndex) => set({ spriteIndex: index }),

  getSpriteUrlByLabel: (label: string) => {
    const state = get();
    const entry = state.spriteIndex.sprites.find(s => s.label === label);
    return entry?.url || null;
  },

  // ============================================
  // NEW V2 IMPLEMENTATIONS
  // ============================================
  
  // Initial V2 state
  spritePacksV2: [],
  
  // Trigger Queue System
  addTriggerToQueue: (characterId: string, entry) => {
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      const queue = charState.triggerQueue.queue;
      
      // Check if queue is full
      if (queue.length >= charState.triggerQueue.maxQueueSize) {
        return state; // Don't add if queue is full
      }
      
      const newEntry: TriggerQueueEntry = {
        id: uuidv4(),
        ...entry,
        triggeredAt: Date.now(),
      };
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            triggerQueue: {
              ...charState.triggerQueue,
              queue: [...queue, newEntry],
            },
          },
        },
      };
    });
  },
  
  processNextTriggerInQueue: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    
    if (!charState || charState.triggerQueue.queue.length === 0) {
      return;
    }
    
    // Check if there's an active trigger
    if (charState.triggerQueue.active) {
      return; // Wait for current trigger to finish
    }
    
    // Get next trigger from queue
    const [nextEntry, ...remaining] = charState.triggerQueue.queue;
    
    console.log('[SpriteSlice] Processing next trigger from queue:', {
      characterId,
      spriteUrl: nextEntry.spriteUrl,
      spriteLabel: nextEntry.spriteLabel,
      fallbackMode: nextEntry.fallbackMode,
      fallbackDelayMs: nextEntry.fallbackDelayMs,
    });
    
    // Apply the trigger sprite
    get().applyTriggerForCharacter(characterId, {
      spriteUrl: nextEntry.spriteUrl,
      spriteLabel: nextEntry.spriteLabel,
      returnToIdleMs: nextEntry.fallbackDelayMs ?? 0,
    });
    
    // Schedule fallback if configured
    if (nextEntry.fallbackDelayMs && nextEntry.fallbackDelayMs > 0) {
      // Determine returnToMode based on fallbackMode
      let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'idle';
      let returnSpriteUrl = nextEntry.fallbackSpriteUrl || '';

      if (nextEntry.fallbackMode === 'idle_collection') {
        // For 'idle_collection', use 'clear' mode to let normal state logic apply
        returnToMode = 'clear';
        returnSpriteUrl = ''; // Empty is fine for 'clear' mode
      } else if (nextEntry.fallbackSpriteUrl) {
        // For 'custom_sprite' and 'collection_default', apply the sprite
        returnToMode = 'idle';
      } else {
        // Fallback if no sprite URL was resolved - use 'clear' mode
        returnToMode = 'clear';
        returnSpriteUrl = '';
      }

      // Schedule the fallback
      get().scheduleReturnToIdleForCharacter(
        characterId,
        nextEntry.spriteUrl,
        returnToMode,
        returnSpriteUrl,
        null,
        nextEntry.fallbackDelayMs
      );
    }
    
    // Update the queue state
    set((state: any) => ({
      characterSpriteStates: {
        ...state.characterSpriteStates,
        [characterId]: {
          ...state.characterSpriteStates[characterId],
          triggerQueue: {
            ...state.characterSpriteStates[characterId].triggerQueue,
            queue: remaining,
            active: {
              triggerCollectionId: nextEntry.triggerCollectionId,
              spriteId: nextEntry.spriteId || '',
              startedAt: Date.now(),
              fallbackScheduled: !!nextEntry.fallbackDelayMs && nextEntry.fallbackDelayMs > 0,
            },
          },
        },
      },
    }));
  },
  
  clearTriggerQueue: (characterId: string) => {
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId];
      if (!charState) return state;
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            triggerQueue: createDefaultTriggerQueueState(),
          },
        },
      };
    });
  },
  
  getTriggerQueueLength: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    return charState?.triggerQueue.queue.length || 0;
  },
  
  hasActiveTrigger: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    return charState?.triggerQueue.active !== null;
  },
  
  resetTriggerTimer: (characterId: string) => {
    // Reset the return to idle timer (re-trigger same sprite)
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId];
      if (!charState || !charState.returnToIdle.active) return state;
      
      const now = Date.now();
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            returnToIdle: {
              ...charState.returnToIdle,
              scheduledAt: now,
              returnAt: now + (charState.returnToIdle.returnAt - charState.returnToIdle.scheduledAt),
            },
          },
        },
      };
    });
  },
  
  // Chain System
  startSpriteChain: (characterId: string, chain: SpriteChain) => {
    if (!chain.enabled || chain.steps.length === 0) return;
    
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            chainProgress: {
              active: true,
              type: 'sprite',
              currentStep: 0,
              totalSteps: chain.steps.length,
              startedAt: Date.now(),
              interruptible: chain.interruptible,
            },
          },
        },
      };
    });
  },
  
  startSoundChain: (characterId: string, chain: SoundChain) => {
    if (!chain.enabled || chain.steps.length === 0) return;
    
    // Get sound data from state and play
    const state = get();
    const soundTriggers = (state as any).soundTriggers || [];
    const soundCollections = (state as any).soundCollections || [];
    const globalVolume = (state as any).settings?.sound?.globalVolume ?? 0.85;
    
    // Play the sound chain
    playSoundChainForCharacter(characterId, chain, soundTriggers, soundCollections, globalVolume);
    
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId] || createDefaultCharacterState();
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            chainProgress: {
              active: true,
              type: 'sound',
              currentStep: 0,
              totalSteps: chain.steps.length,
              startedAt: Date.now(),
              interruptible: chain.stopOnInterrupt,
            },
          },
        },
      };
    });
  },
  
  advanceChainStep: (characterId: string) => {
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId];
      if (!charState?.chainProgress?.active) return state;
      
      const nextStep = charState.chainProgress.currentStep + 1;
      
      if (nextStep >= charState.chainProgress.totalSteps) {
        // Chain complete
        return {
          characterSpriteStates: {
            ...state.characterSpriteStates,
            [characterId]: {
              ...charState,
              chainProgress: null,
            },
          },
        };
      }
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            chainProgress: {
              ...charState.chainProgress,
              currentStep: nextStep,
            },
          },
        },
      };
    });
  },
  
  interruptChain: (characterId: string) => {
    // Stop any active sound chains
    stopSoundChainForCharacter(characterId);
    
    set((state: any) => {
      const charState = state.characterSpriteStates[characterId];
      if (!charState?.chainProgress?.active || !charState.chainProgress.interruptible) {
        return state;
      }
      
      return {
        characterSpriteStates: {
          ...state.characterSpriteStates,
          [characterId]: {
            ...charState,
            chainProgress: null,
          },
        },
      };
    });
  },
  
  getChainProgress: (characterId: string) => {
    const state = get();
    const charState = state.characterSpriteStates[characterId];
    return charState?.chainProgress || null;
  },
  
  // Sprite Packs V2 Management
  createSpritePackV2: (name: string, description?: string) => {
    const now = new Date().toISOString();
    const newPack: SpritePackV2 = {
      id: uuidv4(),
      name,
      description,
      sprites: [],
      createdAt: now,
      updatedAt: now,
    };
    
    set((state: any) => ({
      spritePacksV2: [...state.spritePacksV2, newPack],
    }));
    
    return newPack;
  },
  
  updateSpritePackV2: (id: string, updates: Partial<SpritePackV2>) => {
    set((state: any) => ({
      spritePacksV2: state.spritePacksV2.map((p: SpritePackV2) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },
  
  deleteSpritePackV2: (id: string) => {
    set((state: any) => ({
      spritePacksV2: state.spritePacksV2.filter((p: SpritePackV2) => p.id !== id),
    }));
  },
  
  addSpriteToPackV2: (packId: string, sprite) => {
    set((state: any) => ({
      spritePacksV2: state.spritePacksV2.map((p: SpritePackV2) => {
        if (p.id !== packId) return p;
        
        return {
          ...p,
          sprites: [...p.sprites, { ...sprite, id: uuidv4() }],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },
  
  removeSpriteFromPackV2: (packId: string, spriteId: string) => {
    set((state: any) => ({
      spritePacksV2: state.spritePacksV2.map((p: SpritePackV2) => {
        if (p.id !== packId) return p;
        
        return {
          ...p,
          sprites: p.sprites.filter(s => s.id !== spriteId),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  },
  
  getSpritePackV2ById: (id: string) => {
    const state = get();
    return state.spritePacksV2.find(p => p.id === id);
  },
  
  // Trigger Collections Management (stored per character)
  createTriggerCollection: (characterId: string, collection) => {
    const now = new Date().toISOString();
    const newCollection: TriggerCollection = {
      ...collection,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    
    // This would typically update the character card's triggerCollections
    // For now, we return the new collection
    return newCollection;
  },
  
  updateTriggerCollection: (characterId: string, collectionId: string, updates: Partial<TriggerCollection>) => {
    // This would update the character card's triggerCollections
    // Implementation depends on how characters are stored
  },
  
  deleteTriggerCollection: (characterId: string, collectionId: string) => {
    // This would delete from character card's triggerCollections
  },
  
  getTriggerCollectionsForCharacter: (characterId: string) => {
    // This would get from character card
    const state = get();
    // For now, return empty array - this will be connected to character data
    return [];
  },
});
// Force recompile
