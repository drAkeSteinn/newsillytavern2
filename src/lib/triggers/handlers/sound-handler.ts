// ============================================
// Sound Handler - Handles Sound Triggers
// ============================================
//
// @deprecated Use SoundKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new SoundKeyHandler provides:
// - Per-character audio queues for group chat
// - Better cooldown tracking
// - Unified KeyHandler interface
// - Better streaming support
//
// Migration: Use createSoundKeyHandler() from './sound-key-handler'

import type { TriggerMatch, TriggerMatchResult } from '../types';
import type { DetectedToken } from '../token-detector';
import type { DetectedKey } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type { SoundTrigger, SoundCollection, SoundSequenceTrigger } from '@/types';
import { getCooldownManager } from '../cooldown-manager';
import { normalizeKey } from '../key-detector';

// ============================================
// Audio Queue System
// ============================================

interface QueueItem {
  src: string;
  volume: number;
  triggerName: string;
  keyword: string;
}

const audioQueue: QueueItem[] = [];
let isPlaying = false;

async function processAudioQueue(): Promise<void> {
  if (isPlaying || audioQueue.length === 0) return;
  
  isPlaying = true;
  
  while (audioQueue.length > 0) {
    const item = audioQueue.shift();
    if (!item) break;
    
    try {
      console.log(`[SoundHandler] Playing: ${item.triggerName} (keyword: ${item.keyword})`);
      const audio = new Audio(item.src);
      audio.volume = Math.min(1, Math.max(0, item.volume));
      
      await audio.play();
      
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        setTimeout(() => resolve(), 5000);
      });
      
      // Small gap between sounds
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      console.warn('[SoundHandler] Failed to play:', item.src, error);
    }
  }
  
  isPlaying = false;
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

function getRandomIndex(maxFiles: number): number {
  return Math.floor(Math.random() * maxFiles);
}

// ============================================
// Sound Handler State
// ============================================

export interface SoundHandlerState {
  soundCountPerMessage: Map<string, number>;
  triggeredPositions: Map<string, Set<number>>;
}

export function createSoundHandlerState(): SoundHandlerState {
  return {
    soundCountPerMessage: new Map(),
    triggeredPositions: new Map(),
  };
}

// ============================================
// Sound Trigger Context
// ============================================

export interface SoundTriggerContext extends TriggerContext {
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown: number;
  };
  cooldownContextKey?: string;  // Key for cooldown tracking (e.g., character ID)
}

export interface SoundHandlerResult {
  matched: boolean;
  triggers: Array<{
    trigger: TriggerMatch;
    tokens: DetectedToken[];
  }>;
}

// ============================================
// Sound Handler Functions
// ============================================

/**
 * Check sound triggers - Returns ALL matches found
 * 
 * Cooldown behavior:
 * - globalCooldown=0: No global cooldown (sounds play freely)
 * - trigger.cooldown=0: No per-trigger cooldown
 * - Both >0: Both cooldowns are enforced
 */
export function checkSoundTriggers(
  tokens: DetectedToken[],
  context: SoundTriggerContext,
  state: SoundHandlerState,
  maxSoundsPerMessage: number = 10
): SoundHandlerResult {
  const { soundTriggers, soundCollections, soundSettings, cooldownContextKey } = context;
  
  const result: SoundHandlerResult = {
    matched: false,
    triggers: [],
  };
  
  // Check if sound is enabled
  if (!soundSettings?.enabled) {
    return result;
  }
  
  // Get cooldown manager and config
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  const globalCooldown = soundSettings.globalCooldown ?? 0;
  
  // Get current count (mutable reference for this call)
  let currentCount = state.soundCountPerMessage.get(context.messageKey) ?? 0;
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  const activeTriggers = soundTriggers.filter(t => t.active);
  
  console.log(`[SoundHandler] Processing ${tokens.length} tokens, globalCooldown=${globalCooldown}ms`);
  
  // Process ALL tokens and find ALL matches
  for (const token of tokens) {
    // Stop if we've hit the max sounds limit
    if (currentCount >= maxSoundsPerMessage) {
      console.log(`[SoundHandler] Max sounds per message reached: ${maxSoundsPerMessage}`);
      break;
    }
    
    // Skip if this position already triggered
    if (triggered.has(token.wordPosition)) {
      continue;
    }
    
    for (const trigger of activeTriggers) {
      // Stop if we've hit the max sounds limit
      if (currentCount >= maxSoundsPerMessage) {
        break;
      }
      
      // Check keywords
      const matchingKeyword = trigger.keywords.find(kw => {
        // Check if keyword is disabled
        if (trigger.keywordsEnabled?.[kw] === false) {
          return false;
        }
        return checkTokenMatch(token, kw);
      });
      
      if (!matchingKeyword) continue;
      
      // Check cooldown ONLY if cooldown values > 0
      // If cooldown is 0, sounds play freely without restriction
      const triggerCooldown = trigger.cooldown ?? 0;
      
      if (globalCooldown > 0 || triggerCooldown > 0) {
        const isReady = cooldownManager.isReady(cooldownKey, trigger.id, {
          global: globalCooldown,
          perTrigger: triggerCooldown,
        });
        
        if (!isReady) {
          console.log(`[SoundHandler] Trigger "${trigger.name}" on cooldown, skipping`);
          continue;
        }
      }
      
      // Get sound file
      const soundFile = getSoundFile(trigger, soundCollections);
      if (!soundFile) continue;
      
      // Mark as triggered
      triggered.add(token.wordPosition);
      
      // Mark cooldown as fired (if cooldown is enabled)
      if (globalCooldown > 0 || triggerCooldown > 0) {
        cooldownManager.markFired(cooldownKey, trigger.id);
      }
      
      // Increment count
      currentCount++;
      
      // Add to results
      result.triggers.push({
        trigger: {
          triggerId: trigger.id,
          triggerType: 'sound',
          keyword: matchingKeyword,
          data: {
            soundUrl: soundFile,
            volume: (trigger.volume ?? 1) * soundSettings.globalVolume,
            triggerName: trigger.name,
          },
        },
        tokens: [token],
      });
      
      result.matched = true;
      
      console.log(`[SoundHandler] Queued: "${trigger.name}" (keyword: ${matchingKeyword})`);
      
      // Break inner loop to continue with next token (one trigger per token position)
      break;
    }
  }
  
  // Update state with new count and triggered positions
  state.soundCountPerMessage.set(context.messageKey, currentCount);
  state.triggeredPositions.set(context.messageKey, triggered);
  
  if (result.triggers.length > 0) {
    console.log(`[SoundHandler] Total sounds queued: ${result.triggers.length}`);
  }
  
  return result;
}

/**
 * Execute sound trigger - Adds to queue
 */
export function executeSoundTrigger(match: TriggerMatch, context: TriggerContext): void {
  const { soundUrl, volume, triggerName, keyword } = match.data as {
    soundUrl: string;
    volume: number;
    triggerName: string;
    keyword?: string;
  };
  
  // Log source for debugging
  const source = context.fullText?.substring(0, 50) || 'unknown';
  console.log(`[SoundHandler] Queueing sound "${triggerName}" (keyword: ${keyword || 'none'}) from: ${source}...`);
  
  // Add to queue
  audioQueue.push({
    src: soundUrl,
    volume,
    triggerName,
    keyword: keyword || '',
  });
  
  // Process queue if not already playing
  if (!isPlaying) {
    processAudioQueue();
  }
}

/**
 * Execute all sound triggers from a result
 */
export function executeAllSoundTriggers(
  result: SoundHandlerResult, 
  context: TriggerContext
): void {
  if (!result.matched || result.triggers.length === 0) return;
  
  console.log(`[SoundHandler] Queueing ${result.triggers.length} sound(s)`);
  
  for (const { trigger } of result.triggers) {
    executeSoundTrigger(trigger, context);
  }
}

/**
 * Reset state for new message
 */
export function resetSoundHandlerState(state: SoundHandlerState, messageKey: string): void {
  state.soundCountPerMessage.set(messageKey, 0);
  state.triggeredPositions.delete(messageKey);
}

/**
 * Clear all sound handler state
 */
export function clearSoundHandlerState(state: SoundHandlerState): void {
  state.soundCountPerMessage.clear();
  state.triggeredPositions.clear();
  clearAllSoundCooldowns();
  clearAudioQueue();
}

/**
 * Reset cooldown for a context (call when changing characters/sessions)
 */
export function resetSoundCooldowns(contextKey: string): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.reset(contextKey);
}

/**
 * Clear all sound cooldowns
 */
export function clearAllSoundCooldowns(): void {
  const cooldownManager = getCooldownManager();
  cooldownManager.resetAll();
}

/**
 * Clear the audio queue (stop pending sounds)
 */
export function clearAudioQueue(): void {
  audioQueue.length = 0;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get sound file from trigger's collection
 * 
 * IMPORTANT: The files array already contains FULL URLs (e.g., "/sounds/glohg/glohg46.wav")
 * The collection.path is also a full path, but we just need the filename from the files array.
 * 
 * Note: We return just the file entry from the array, which is already a complete URL.
 */
function getSoundFile(trigger: SoundTrigger, collections: SoundCollection[]): string | null {
  const collection = collections.find(c => c.name === trigger.collection);
  
  if (!collection || collection.files.length === 0) {
    return null;
  }
  
  let soundIndex: number;
  if (trigger.playMode === 'random') {
    soundIndex = getRandomIndex(collection.files.length);
  } else {
    soundIndex = getCycleIndex(trigger.id, collection.files.length);
  }
  
  // Files array already contains full URLs like "/sounds/collection/file.mp3"
  return collection.files[soundIndex] || null;
}

/**
 * Check if token matches keyword
 * 
 * Matching rules:
 * - Single-word keyword: Requires EXACT match (no partial matches)
 * - Multi-word keyword: Checks if all words appear in token or if keyword appears as substring
 * 
 * This prevents false positives like:
 * - "marisa" triggering "risa" (no longer matches)
 * - "alegría" triggering "ale" (no longer matches)
 */
function checkTokenMatch(token: DetectedToken, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const normalizedToken = token.token.toLowerCase();
  
  if (!normalizedKeyword || !normalizedToken) return false;
  
  // For single-word keywords, require EXACT match
  // This prevents false positives like "marisa" matching "risa"
  const keywordWords = normalizedKeyword.split(/\s+/);
  if (keywordWords.length === 1) {
    return normalizedToken === normalizedKeyword;
  }
  
  // For multi-word keywords, check if all words appear in token
  // or if the full phrase appears as substring
  const allWordsMatch = keywordWords.every(word => normalizedToken.includes(word));
  if (allWordsMatch) return true;
  
  // Also check if the full keyword phrase appears in token
  return normalizedToken.includes(normalizedKeyword);
}

// ============================================
// Sound Sequence Trigger System
// ============================================

export interface SoundSequenceContext extends TriggerContext {
  soundSequenceTriggers: SoundSequenceTrigger[];
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown: number;
  };
  cooldownContextKey?: string;
}

export interface SoundSequenceResult {
  matched: boolean;
  sequences: Array<{
    sequence: SoundSequenceTrigger;
    matchedKey: string;
    matchedToken: string;
  }>;
}

/**
 * Check if a token matches a sequence trigger's activation key
 * Similar to skill activation key matching
 */
function tokenMatchesSequenceKey(
  token: DetectedToken,
  activationKey: string,
  caseSensitive: boolean = false
): boolean {
  const normalizedToken = caseSensitive ? token.token : token.token.toLowerCase();
  const normalizedKey = caseSensitive ? activationKey : activationKey.toLowerCase();
  
  if (!normalizedKey || !normalizedToken) return false;
  
  // 1. Exact match
  if (normalizedToken === normalizedKey) return true;
  
  // 2. Key:value format
  if (normalizedToken.includes(':')) {
    const [keyPart] = normalizedToken.split(':');
    if (keyPart === normalizedKey) return true;
  }
  
  // 3. Key=value format
  if (normalizedToken.includes('=')) {
    const [keyPart] = normalizedToken.split('=');
    if (keyPart === normalizedKey) return true;
  }
  
  // 4. Key_suffix format
  if (normalizedToken.startsWith(normalizedKey + '_')) return true;
  
  // 5. Token starts with key followed by separator or number
  if (normalizedToken.startsWith(normalizedKey) && normalizedToken.length > normalizedKey.length) {
    const afterKey = normalizedToken.slice(normalizedKey.length);
    if (/^[_:=-]/.test(afterKey) || /^\d/.test(afterKey)) return true;
  }
  
  return false;
}

/**
 * Check for sound sequence triggers in tokens
 */
export function checkSoundSequenceTriggers(
  tokens: DetectedToken[],
  context: SoundSequenceContext
): SoundSequenceResult {
  const result: SoundSequenceResult = {
    matched: false,
    sequences: [],
  };
  
  const { soundSequenceTriggers, soundSettings, cooldownContextKey } = context;
  
  if (!soundSettings?.enabled) return result;
  
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  
  // Filter active sequence triggers with activation keys
  const activeSequences = soundSequenceTriggers.filter(
    s => s.active && s.activationKey
  );
  
  for (const token of tokens) {
    for (const sequence of activeSequences) {
      // Skip if already matched this sequence
      if (result.sequences.some(s => s.sequence.id === sequence.id)) continue;
      
      const caseSensitive = sequence.activationKeyCaseSensitive ?? false;
      
      // Check primary activation key
      let matched = tokenMatchesSequenceKey(token, sequence.activationKey, caseSensitive);
      let matchedKey = sequence.activationKey;
      
      // Check alternative keys if primary didn't match
      if (!matched && sequence.activationKeys) {
        for (const altKey of sequence.activationKeys) {
          if (tokenMatchesSequenceKey(token, altKey, caseSensitive)) {
            matched = true;
            matchedKey = altKey;
            break;
          }
        }
      }
      
      if (!matched) continue;
      
      // Check cooldown
      const sequenceCooldown = sequence.cooldown ?? 0;
      if (sequenceCooldown > 0) {
        const isReady = cooldownManager.isReady(cooldownKey, `seq_${sequence.id}`, {
          global: 0,
          perTrigger: sequenceCooldown,
        });
        
        if (!isReady) {
          console.log(`[SoundHandler] Sequence "${sequence.name}" on cooldown, skipping`);
          continue;
        }
      }
      
      // Mark cooldown as fired
      if (sequenceCooldown > 0) {
        cooldownManager.markFired(cooldownKey, `seq_${sequence.id}`);
      }
      
      result.sequences.push({
        sequence,
        matchedKey,
        matchedToken: token.original,
      });
      
      result.matched = true;
    }
  }
  
  return result;
}

/**
 * Execute a sound sequence trigger
 * Plays all sounds in the sequence, respecting each trigger's play mode
 */
export async function executeSoundSequence(
  sequenceMatch: SoundSequenceResult['sequences'][0],
  context: SoundSequenceContext
): Promise<void> {
  const { sequence } = sequenceMatch;
  const { soundTriggers, soundCollections, soundSettings } = context;
  
  console.log(`[SoundHandler] Executing sequence "${sequence.name}" with ${sequence.sequence.length} sounds`);
  
  // Get the cycle indexes map for tracking cyclic mode
  const cycleIndexes = new Map<string, number>();
  
  for (const keyword of sequence.sequence) {
    // Find the sound trigger by keyword
    const trigger = soundTriggers.find(t => 
      t.active && t.keywords.includes(keyword) && t.keywordsEnabled?.[keyword] !== false
    );
    
    if (!trigger) {
      console.warn(`[SoundHandler] Sequence: No trigger found for keyword "${keyword}"`);
      continue;
    }
    
    // Get the collection
    const collection = soundCollections.find(c => c.name === trigger.collection);
    if (!collection || collection.files.length === 0) {
      console.warn(`[SoundHandler] Sequence: No collection "${trigger.collection}" for trigger "${trigger.name}"`);
      continue;
    }
    
    // Get sound file based on trigger's play mode
    let soundFile: string;
    if (trigger.playMode === 'random') {
      soundFile = collection.files[getRandomIndex(collection.files.length)];
    } else {
      // Cyclic mode - track index per trigger
      const currentIdx = cycleIndexes.get(trigger.id) ?? trigger.currentIndex ?? 0;
      soundFile = collection.files[currentIdx];
      cycleIndexes.set(trigger.id, (currentIdx + 1) % collection.files.length);
    }
    
    if (!soundFile) continue;
    
    // Calculate volume: sequence volume * trigger volume * global volume
    const sequenceVolume = sequence.volume ?? 1;
    const triggerVolume = trigger.volume ?? 1;
    const globalVolume = soundSettings.globalVolume ?? 1;
    const finalVolume = sequenceVolume * triggerVolume * globalVolume;
    
    // Add to queue
    audioQueue.push({
      src: soundFile,
      volume: Math.min(1, Math.max(0, finalVolume)),
      triggerName: `${sequence.name} → ${trigger.name}`,
      keyword: keyword,
    });
    
    console.log(`[SoundHandler] Sequence: Queued "${trigger.name}" (${keyword})`);
    
    // Wait for delay between sounds if specified
    const delayBetween = sequence.delayBetween ?? 0;
    if (delayBetween > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }
  
  // Start processing queue if not already playing
  if (!isPlaying) {
    processAudioQueue();
  }
}

/**
 * Execute all sound sequence triggers
 */
export function executeAllSoundSequenceTriggers(
  result: SoundSequenceResult,
  context: SoundSequenceContext
): void {
  if (!result.matched || result.sequences.length === 0) return;
  
  console.log(`[SoundHandler] Executing ${result.sequences.length} sound sequence(s)`);
  
  // Execute sequences sequentially
  for (const sequenceMatch of result.sequences) {
    executeSoundSequence(sequenceMatch, context);
  }
}

// ============================================
// NEW: Key-based Sound Detection (Unified System)
// ============================================

/**
 * Check if a detected key matches a trigger keyword
 * 
 * Matching rules (same as token matching):
 * - Single-word keyword: Requires EXACT match (no partial matches)
 * - Multi-word keyword: Checks if all words appear or if keyword appears as substring
 */
export function keyMatchesSoundKeyword(
  key: DetectedKey,
  keyword: string,
  caseSensitive: boolean = false
): boolean {
  // Normalize both key and keyword using the unified normalizer
  const normalizedKeyword = normalizeKey(keyword);
  const normalizedDetectedKey = normalizeKey(key.key);
  
  if (!normalizedKeyword || !normalizedDetectedKey) return false;
  
  // For single-word keywords, require EXACT match
  const keywordWords = normalizedKeyword.split(/\s+/);
  if (keywordWords.length === 1) {
    return normalizedDetectedKey === normalizedKeyword;
  }
  
  // For multi-word keywords, check if all words appear
  const allWordsMatch = keywordWords.every(word => normalizedDetectedKey.includes(word));
  if (allWordsMatch) return true;
  
  // Also check if the full keyword phrase appears
  return normalizedDetectedKey.includes(normalizedKeyword);
}

/**
 * Sound Handler Result for Keys (new unified system)
 */
export interface SoundKeyHandlerResult {
  matched: boolean;
  triggers: Array<{
    trigger: TriggerMatch;
    key: DetectedKey;
  }>;
}

/**
 * Check sound triggers using DetectedKey[] (NEW unified system)
 * 
 * This is the preferred method for checking sound triggers.
 * Works with all key formats: [key], |key|, Peticion:key, key:value, etc.
 */
export function checkSoundTriggersWithKeys(
  keys: DetectedKey[],
  context: SoundTriggerContext,
  state: SoundHandlerState,
  maxSoundsPerMessage: number = 10
): SoundKeyHandlerResult {
  const { soundTriggers, soundCollections, soundSettings, cooldownContextKey } = context;
  
  const result: SoundKeyHandlerResult = {
    matched: false,
    triggers: [],
  };
  
  // Check if sound is enabled
  if (!soundSettings?.enabled) {
    return result;
  }
  
  // Get cooldown manager and config
  const cooldownManager = getCooldownManager();
  const cooldownKey = cooldownContextKey || 'default';
  const globalCooldown = soundSettings.globalCooldown ?? 0;
  
  // Get current count
  let currentCount = state.soundCountPerMessage.get(context.messageKey) ?? 0;
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set<number>();
  
  const activeTriggers = soundTriggers.filter(t => t.active);
  
  console.log(`[SoundHandler] Processing ${keys.length} keys, globalCooldown=${globalCooldown}ms`);
  
  // Process keys in order of appearance (already sorted by position)
  for (const key of keys) {
    // Stop if we've hit the max sounds limit
    if (currentCount >= maxSoundsPerMessage) {
      console.log(`[SoundHandler] Max sounds per message reached: ${maxSoundsPerMessage}`);
      break;
    }
    
    // Skip if this position already triggered
    if (triggered.has(key.position)) {
      continue;
    }
    
    for (const trigger of activeTriggers) {
      // Stop if we've hit the max sounds limit
      if (currentCount >= maxSoundsPerMessage) {
        break;
      }
      
      // Check keywords
      const matchingKeyword = trigger.keywords.find(kw => {
        // Check if keyword is disabled
        if (trigger.keywordsEnabled?.[kw] === false) {
          return false;
        }
        return keyMatchesSoundKeyword(key, kw);
      });
      
      if (!matchingKeyword) continue;
      
      // Check cooldown ONLY if cooldown values > 0
      const triggerCooldown = trigger.cooldown ?? 0;
      
      if (globalCooldown > 0 || triggerCooldown > 0) {
        const isReady = cooldownManager.isReady(cooldownKey, trigger.id, {
          global: globalCooldown,
          perTrigger: triggerCooldown,
        });
        
        if (!isReady) {
          console.log(`[SoundHandler] Trigger "${trigger.name}" on cooldown, skipping`);
          continue;
        }
      }
      
      // Get sound file
      const soundFile = getSoundFile(trigger, soundCollections);
      if (!soundFile) continue;
      
      // Mark as triggered
      triggered.add(key.position);
      
      // Mark cooldown as fired (if cooldown is enabled)
      if (globalCooldown > 0 || triggerCooldown > 0) {
        cooldownManager.markFired(cooldownKey, trigger.id);
      }
      
      // Increment count
      currentCount++;
      
      // Add to results
      result.triggers.push({
        trigger: {
          triggerId: trigger.id,
          triggerType: 'sound',
          keyword: matchingKeyword,
          data: {
            soundUrl: soundFile,
            volume: (trigger.volume ?? 1) * soundSettings.globalVolume,
            triggerName: trigger.name,
          },
        },
        key,
      });
      
      result.matched = true;
      
      console.log(`[SoundHandler] Queued: "${trigger.name}" (keyword: ${matchingKeyword}, format: ${key.format})`);
      
      // Break inner loop to continue with next key (one trigger per key position)
      break;
    }
  }
  
  // Update state
  state.soundCountPerMessage.set(context.messageKey, currentCount);
  state.triggeredPositions.set(context.messageKey, triggered);
  
  if (result.triggers.length > 0) {
    console.log(`[SoundHandler] Total sounds queued: ${result.triggers.length}`);
  }
  
  return result;
}

/**
 * Execute all sound triggers from a key-based result
 */
export function executeAllSoundKeyTriggers(
  result: SoundKeyHandlerResult, 
  context: TriggerContext
): void {
  if (!result.matched || result.triggers.length === 0) return;
  
  console.log(`[SoundHandler] Queueing ${result.triggers.length} sound(s) from keys`);
  
  for (const { trigger } of result.triggers) {
    executeSoundTrigger(trigger, context);
  }
}
