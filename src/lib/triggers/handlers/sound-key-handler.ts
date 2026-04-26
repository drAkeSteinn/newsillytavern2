// ============================================
// Sound Key Handler - Unified Implementation
// ============================================
//
// Handles ALL sound trigger detection and execution using the unified
// KeyHandler interface. Works with DetectedKey[] from KeyDetector.
//
// Supports:
// - Sound triggers with keywords
// - Sound sequences (multi-sound triggers)
// - Random/Cyclic play modes
// - Cooldown management
// - Audio queue for sequential playback

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { SoundTrigger, SoundCollection, SoundSequenceTrigger } from '@/types';
import { isGloballyMuted } from '@/lib/global-audio-mute';
import { 
  normalizeKey,
  keyMatches,
  classifyKey,
} from '../key-detector';
import { 
  logHandler, 
  logMatch, 
  createMatch, 
  successResult, 
  failResult,
  CooldownTracker,
  selectRandom,
  selectCycle,
  calculateVolume,
} from '../utils';

// ============================================
// Types
// ============================================

export interface SoundKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSequenceTriggers?: SoundSequenceTrigger[];
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown?: number;
  };
  cooldownContextKey?: string;
  playSound?: (url: string, volume: number) => void;
}

// ============================================
// Audio Queue System - Per-Character Queues
// ============================================

interface AudioQueueItem {
  src: string;
  volume: number;
  triggerName: string;
  keyword: string;
  characterId?: string;
}

// Per-character audio queues for independent playback
// Each character has their own queue that plays independently
const characterAudioQueues = new Map<string, AudioQueueItem[]>();
const characterIsPlaying = new Map<string, boolean>();

// Fallback global queue for messages without characterId
const globalAudioQueue: AudioQueueItem[] = [];
let globalIsPlaying = false;

/**
 * Get or create a queue for a character
 */
function getCharacterQueue(characterId: string | undefined): {
  queue: AudioQueueItem[];
  isPlaying: boolean;
  isGlobal: boolean;
} {
  if (characterId) {
    if (!characterAudioQueues.has(characterId)) {
      characterAudioQueues.set(characterId, []);
    }
    return {
      queue: characterAudioQueues.get(characterId)!,
      isPlaying: characterIsPlaying.get(characterId) || false,
      isGlobal: false,
    };
  }
  return {
    queue: globalAudioQueue,
    isPlaying: globalIsPlaying,
    isGlobal: true,
  };
}

/**
 * Process audio queue for a specific character or global queue
 */
async function processAudioQueue(
  playSound?: (url: string, volume: number) => void,
  characterId?: string
): Promise<void> {
  // Skip if globally muted
  if (isGloballyMuted()) return;

  const { queue, isPlaying, isGlobal } = getCharacterQueue(characterId);
  
  if (isPlaying || queue.length === 0) return;
  
  // Mark as playing for this character
  if (characterId) {
    characterIsPlaying.set(characterId, true);
  } else {
    globalIsPlaying = true;
  }
  
  logHandler('SoundKeyHandler', 'Processing queue', {
    characterId: characterId || 'global',
    queueLength: queue.length,
    isGlobal
  });
  
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    
    try {
      logHandler('SoundKeyHandler', 'Playing', { 
        trigger: item.triggerName, 
        keyword: item.keyword,
        volume: item.volume,
        characterId: item.characterId,
        queueRemaining: queue.length
      });
      
      if (playSound) {
        playSound(item.src, item.volume);
      } else {
        // Fallback to direct Audio API
        const audio = new Audio(item.src);
        audio.volume = Math.min(1, Math.max(0, item.volume));
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          setTimeout(() => resolve(), 5000); // Safety timeout
        });
      }
      
      // Small delay between sounds
      await new Promise(resolve => setTimeout(resolve, 80));
    } catch (error) {
      console.warn('[SoundKeyHandler] Failed to play:', item.src, error);
    }
  }
  
  // Mark as done for this character
  if (characterId) {
    characterIsPlaying.set(characterId, false);
  } else {
    globalIsPlaying = false;
  }
}

/**
 * Queue a sound for playback
 */
function queueSound(
  item: AudioQueueItem, 
  playSound?: (url: string, volume: number) => void
): void {
  const characterId = item.characterId;
  const { queue, isPlaying, isGlobal } = getCharacterQueue(characterId);
  
  queue.push(item);
  
  logHandler('SoundKeyHandler', 'Queued', { 
    trigger: item.triggerName, 
    characterId: characterId || 'global',
    queueLength: queue.length,
    isPlaying
  });
  
  // Start processing if not already playing for this character/global queue
  if (!isPlaying) {
    processAudioQueue(playSound, characterId);
  }
}

// ============================================
// Cycle Index Tracking
// ============================================

const triggerCycleIndexes = new Map<string, number>();

function getCycleIndex(triggerId: string, maxFiles: number): number {
  const current = triggerCycleIndexes.get(triggerId) || 0;
  const nextIndex = (current + 1) % maxFiles;
  triggerCycleIndexes.set(triggerId, nextIndex);
  return current;
}

// ============================================
// Sound Key Handler Class
// ============================================

export class SoundKeyHandler implements KeyHandler {
  readonly id = 'sound-key-handler';
  readonly type = 'sound' as const;
  readonly priority = 100; // High priority - sounds should trigger quickly
  
  private cooldownTracker: CooldownTracker;
  private maxSoundsPerMessage: number;
  private soundCountPerMessage: Map<string, number>;
  private triggeredPositions: Map<string, Set<number>>;
  
  constructor(maxSoundsPerMessage: number = 10) {
    this.maxSoundsPerMessage = maxSoundsPerMessage;
    this.cooldownTracker = new CooldownTracker();
    this.soundCountPerMessage = new Map();
    this.triggeredPositions = new Map();
  }
  
  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const soundContext = context as Partial<SoundKeyHandlerContext>;
    
    // Check if sound is enabled
    if (!soundContext.soundSettings?.enabled) {
      return false;
    }
    
    // Check if category hint is sound
    const category = classifyKey(key);
    if (category === 'sound') {
      return true;
    }
    
    // Check if any sound trigger matches this key
    const activeTriggers = soundContext.soundTriggers?.filter(t => t.active) || [];
    
    for (const trigger of activeTriggers) {
      for (const keyword of trigger.keywords) {
        if (this.keyMatchesTrigger(key, keyword)) {
          return true;
        }
      }
    }
    
    // Check sound sequences
    const activeSequences = soundContext.soundSequenceTriggers?.filter(s => s.active) || [];
    for (const sequence of activeSequences) {
      const allKeys = [sequence.activationKey, ...(sequence.activationKeys || [])];
      for (const actKey of allKeys) {
        if (keyMatches(key.key, actKey)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const soundContext = context as SoundKeyHandlerContext;
    const messageKey = context.messageKey;
    
    // Check max sounds limit
    const currentCount = this.soundCountPerMessage.get(messageKey) ?? 0;
    if (currentCount >= this.maxSoundsPerMessage) {
      return null;
    }
    
    // Check if position already triggered
    const triggered = this.triggeredPositions.get(messageKey) ?? new Set<number>();
    if (triggered.has(key.position)) {
      return null;
    }
    
    // For type-indicator keys like "sound:value", use the value for matching
    // e.g., sound:laugh -> key="sound", value="laugh" -> match with "laugh"
    const effectiveKey = this.getEffectiveKey(key);
    
    // Try sound triggers first
    const result = this.findMatchingSound(effectiveKey, soundContext);
    if (result) {
      // Mark position
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      
      // Increment count
      this.soundCountPerMessage.set(messageKey, currentCount + 1);
      
      return result;
    }
    
    // Try sound sequences
    const sequenceResult = this.findMatchingSequence(effectiveKey, soundContext);
    if (sequenceResult) {
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      this.soundCountPerMessage.set(messageKey, currentCount + 1);
      return sequenceResult;
    }
    
    return null;
  }
  
  /**
   * Get effective key for matching
   * For type-indicator keys like "sound:value", returns the value
   * Otherwise returns the original key
   */
  private getEffectiveKey(key: DetectedKey): DetectedKey {
    // Type indicators that signal the value should be used for matching
    const typeIndicators = ['sound', 'sonido', 'sfx'];
    
    if (key.format === 'key_value' && key.value && typeIndicators.includes(key.key.toLowerCase())) {
      // Create a new DetectedKey with the value as the key
      return {
        ...key,
        key: normalizeKey(key.value),
        original: key.value,
        // Keep the original key info for reference
        value: undefined,
      };
    }
    
    return key;
  }
  
  /**
   * Execute the trigger action immediately
   */
  execute(match: TriggerMatch, context: TriggerContext): void {
    const soundContext = context as SoundKeyHandlerContext;
    const characterId = soundContext.characterId;
    const { soundUrl, volume, triggerName, keyword, isSequence, sequenceSounds } = match.data as {
      soundUrl?: string;
      volume?: number;
      triggerName?: string;
      keyword?: string;
      isSequence?: boolean;
      sequenceSounds?: Array<{ soundUrl: string; volume: number; triggerName: string; keyword: string }>;
    };
    
    if (isSequence && sequenceSounds) {
      // Queue all sounds from sequence
      for (const sound of sequenceSounds) {
        queueSound({
          src: sound.soundUrl,
          volume: sound.volume,
          triggerName: sound.triggerName,
          keyword: sound.keyword,
          characterId,
        }, soundContext.playSound);
      }
    } else if (soundUrl) {
      queueSound({
        src: soundUrl,
        volume: volume ?? 0.8,
        triggerName: triggerName ?? 'Unknown',
        keyword: keyword ?? '',
        characterId,
      }, soundContext.playSound);
    }
  }
  
  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): RegisteredKey[] {
    const soundContext = context as Partial<SoundKeyHandlerContext>;
    const keys: RegisteredKey[] = [];
    
    const activeTriggers = soundContext.soundTriggers?.filter(t => t.active) || [];
    for (const trigger of activeTriggers) {
      for (const keyword of trigger.keywords) {
        keys.push({
          key: keyword,
          category: 'sound',
          config: { triggerId: trigger.id, triggerName: trigger.name },
        });
      }
    }
    
    const activeSequences = soundContext.soundSequenceTriggers?.filter(s => s.active) || [];
    for (const sequence of activeSequences) {
      if (sequence.activationKey) {
        keys.push({
          key: sequence.activationKey,
          category: 'sound',
          config: { sequenceId: sequence.id, sequenceName: sequence.name },
        });
      }
      for (const key of sequence.activationKeys || []) {
        keys.push({
          key,
          category: 'sound',
          config: { sequenceId: sequence.id, sequenceName: sequence.name },
        });
      }
    }
    
    return keys;
  }
  
  /**
   * Reset state for new message
   * Only clears position tracking and count, NOT cooldowns (to preserve per-character isolation)
   */
  reset(messageKey: string): void {
    this.soundCountPerMessage.delete(messageKey);
    this.triggeredPositions.delete(messageKey);
    // Don't reset cooldown tracker - cooldowns are per-character and should persist
    // across messages within the same streaming session
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.soundCountPerMessage.clear();
    this.triggeredPositions.clear();
    this.cooldownTracker.reset();
    // Clear all character queues
    characterAudioQueues.clear();
    characterIsPlaying.clear();
    // Clear global queue
    globalAudioQueue.length = 0;
    globalIsPlaying = false;
    triggerCycleIndexes.clear();
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  /**
   * Check if key matches a trigger keyword
   */
  private keyMatchesTrigger(key: DetectedKey, keyword: string): boolean {
    const normalizedKey = normalizeKey(key.key);
    const normalizedKeyword = normalizeKey(keyword);
    
    if (!normalizedKey || !normalizedKeyword) return false;
    
    // For single-word keywords, require exact match
    const keywordWords = normalizedKeyword.split(/\s+/);
    if (keywordWords.length === 1) {
      return normalizedKey === normalizedKeyword;
    }
    
    // For multi-word keywords, check if all words appear
    return keywordWords.every(word => normalizedKey.includes(word));
  }
  
  /**
   * Find matching sound trigger
   */
  private findMatchingSound(
    key: DetectedKey,
    context: SoundKeyHandlerContext
  ): TriggerMatchResult | null {
    const { soundTriggers, soundCollections, soundSettings, cooldownContextKey } = context;
    
    const activeTriggers = soundTriggers.filter(t => t.active);
    const cooldownKey = cooldownContextKey || 'default';
    const globalCooldown = soundSettings.globalCooldown ?? 0;
    
    for (const trigger of activeTriggers) {
      // Check keywords
      const matchingKeyword = trigger.keywords.find(kw => {
        if (trigger.keywordsEnabled?.[kw] === false) {
          return false;
        }
        return this.keyMatchesTrigger(key, kw);
      });
      
      if (!matchingKeyword) continue;
      
      // Check cooldown
      const triggerCooldown = trigger.cooldown ?? 0;
      if (!this.cooldownTracker.isReady(
        `${cooldownKey}:${trigger.id}`,
        triggerCooldown,
        globalCooldown
      )) {
        logMatch(this.id, matchingKeyword, false, { reason: 'cooldown' });
        continue;
      }
      
      // Get sound file
      const soundFile = this.getSoundFile(trigger, soundCollections);
      if (!soundFile) continue;
      
      // Mark cooldown
      this.cooldownTracker.markTriggered(`${cooldownKey}:${trigger.id}`);
      
      const volume = calculateVolume(
        trigger.volume ?? 1,
        soundSettings.globalVolume
      );
      
      logMatch(this.id, matchingKeyword, true, { 
        trigger: trigger.name, 
        soundFile,
        volume 
      });
      
      return successResult(key, createMatch('sound', matchingKeyword, {
        soundUrl: soundFile,
        volume,
        triggerName: trigger.name,
        keyword: matchingKeyword,
        triggerId: trigger.id,
      }));
    }
    
    return null;
  }
  
  /**
   * Find matching sound sequence
   */
  private findMatchingSequence(
    key: DetectedKey,
    context: SoundKeyHandlerContext
  ): TriggerMatchResult | null {
    const { soundSequenceTriggers, soundTriggers, soundCollections, soundSettings } = context;
    
    if (!soundSequenceTriggers || soundSequenceTriggers.length === 0) {
      return null;
    }
    
    const activeSequences = soundSequenceTriggers.filter(s => s.active);
    
    for (const sequence of activeSequences) {
      const allKeys = [sequence.activationKey, ...(sequence.activationKeys || [])];
      const matchedKey = allKeys.find(k => keyMatches(key.key, k));
      
      if (!matchedKey) continue;
      
      // Check cooldown
      if (sequence.cooldown && sequence.cooldown > 0) {
        if (!this.cooldownTracker.isReady(`seq:${sequence.id}`, sequence.cooldown, 0)) {
          logMatch(this.id, matchedKey, false, { reason: 'sequence cooldown' });
          continue;
        }
        this.cooldownTracker.markTriggered(`seq:${sequence.id}`);
      }
      
      // Build sound list for sequence
      const sequenceSounds: Array<{ soundUrl: string; volume: number; triggerName: string; keyword: string }> = [];
      
      for (const keyword of sequence.sequence) {
        const trigger = soundTriggers.find(t => 
          t.active && t.keywords.includes(keyword) && t.keywordsEnabled?.[keyword] !== false
        );
        
        if (!trigger) continue;
        
        const collection = soundCollections.find(c => c.name === trigger.collection);
        if (!collection || collection.files.length === 0) continue;
        
        let soundFile: string;
        if (trigger.playMode === 'random') {
          soundFile = collection.files[Math.floor(Math.random() * collection.files.length)];
        } else {
          const idx = getCycleIndex(trigger.id, collection.files.length);
          soundFile = collection.files[idx];
        }
        
        const volume = calculateVolume(
          sequence.volume ?? 1,
          trigger.volume ?? 1,
          soundSettings.globalVolume
        );
        
        sequenceSounds.push({
          soundUrl: soundFile,
          volume,
          triggerName: `${sequence.name} → ${trigger.name}`,
          keyword,
        });
      }
      
      if (sequenceSounds.length === 0) continue;
      
      logMatch(this.id, matchedKey, true, { 
        sequence: sequence.name,
        soundCount: sequenceSounds.length 
      });
      
      return successResult(key, createMatch('sound', matchedKey, {
        isSequence: true,
        sequenceSounds,
        triggerName: sequence.name,
        keyword: matchedKey,
      }));
    }
    
    return null;
  }
  
  /**
   * Get sound file from trigger's collection
   */
  private getSoundFile(trigger: SoundTrigger, collections: SoundCollection[]): string | null {
    const collection = collections.find(c => c.name === trigger.collection);
    
    if (!collection || collection.files.length === 0) {
      return null;
    }
    
    let soundIndex: number;
    if (trigger.playMode === 'random') {
      soundIndex = Math.floor(Math.random() * collection.files.length);
    } else {
      soundIndex = getCycleIndex(trigger.id, collection.files.length);
    }
    
    return collection.files[soundIndex] || null;
  }
}

// ============================================
// Factory Function
// ============================================

let soundKeyHandlerInstance: SoundKeyHandler | null = null;

export function createSoundKeyHandler(maxSoundsPerMessage: number = 10): SoundKeyHandler {
  if (!soundKeyHandlerInstance) {
    soundKeyHandlerInstance = new SoundKeyHandler(maxSoundsPerMessage);
  }
  return soundKeyHandlerInstance;
}

export function resetSoundKeyHandler(): void {
  soundKeyHandlerInstance?.cleanup();
  soundKeyHandlerInstance = null;
}
