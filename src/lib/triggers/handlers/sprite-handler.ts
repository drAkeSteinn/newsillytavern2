// ============================================
// Sprite Handler - Handles Sprite Triggers
// Supports Legacy System and V2 Trigger Collections
// ============================================
//
// @deprecated Use SpriteKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new SpriteKeyHandler provides:
// - V2 Trigger Collections support
// - State Collections V2 (idle/talk/thinking)
// - Per-character sprite state for group chat
// - Unified KeyHandler interface
//
// Migration: Use createSpriteKeyHandler() from './sprite-key-handler'

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { 
  SpritePack, 
  SpritePackItem, 
  CharacterCard,
  CharacterSpriteTrigger,
  SpriteLibraryEntry,
  // V2 Types
  TriggerCollection,
  SpritePackV2,
  SpritePackEntryV2,
  SpriteTriggerConfig,
  SpriteChain,
  SoundChain,
  TriggerQueueEntry,
  ActiveTrigger,
} from '@/types';

// ============================================
// Sprite Handler State
// ============================================

export interface SpriteHandlerState {
  triggeredPositions: Map<string, Set<number>>;
  lastPackMatches: Map<string, string>;
}

export function createSpriteHandlerState(): SpriteHandlerState {
  return {
    triggeredPositions: new Map(),
    lastPackMatches: new Map(),
  };
}

// ============================================
// Sprite Trigger Context
// ============================================

export interface SpriteTriggerContext extends TriggerContext {
  spritePacks: SpritePack[];
  spriteTriggers: CharacterSpriteTrigger[];
  spriteIndex: { sprites: Array<{ label: string; url: string }> };
  spriteLibraries: {
    actions: SpriteLibraryEntry[];
    poses: SpriteLibraryEntry[];
    clothes: SpriteLibraryEntry[];
  };
  isSpriteLocked: boolean;
}

// ============================================
// V2 Trigger Collections Context
// ============================================

/**
 * V2 Sprite Trigger Context - For Trigger Collections system
 */
export interface SpriteTriggerContextV2 extends TriggerContext {
  // V2 Sprite Packs (simple containers)
  spritePacksV2: SpritePackV2[];
  
  // V2 Trigger Collections
  triggerCollections: TriggerCollection[];
  
  // Legacy support
  spriteIndex: { sprites: Array<{ label: string; url: string }> };
  
  // Current character
  character: CharacterCard | null;
  
  // Chain execution callbacks
  onSpriteChainStart?: (characterId: string, chain: SpriteChain) => void;
  onSoundChainStart?: (characterId: string, chain: SoundChain) => void;
}

/**
 * V2 Trigger Match Result
 */
export interface TriggerCollectionMatchResult {
  matched: boolean;
  trigger: {
    triggerId: string;
    triggerType: 'sprite';
    keyword: string;
    data: {
      spriteUrl: string;
      spriteLabel: string | null;
      characterId?: string;
      collectionId: string;
      packId: string;
      spriteId: string;
      triggerName: string;
      priority: number;
      fallbackMode?: string;
      fallbackSpriteId?: string;
      fallbackDelayMs?: number;
      matchSource: 'collection_key' | 'sprite_key';
      hasSpriteChain: boolean;
      hasSoundChain: boolean;
    };
  };
  tokens: DetectedToken[];
  
  // V2 specific data
  collection: TriggerCollection;
  spritePack: SpritePackV2;
  selectedSprite: SpritePackEntryV2;
  spriteConfig?: SpriteTriggerConfig;  // If matched via individual sprite key
  matchSource: 'collection_key' | 'sprite_key';
  
  // Chain data
  spriteChain?: SpriteChain;
  soundChain?: SoundChain;
}

export interface SpriteHandlerResult {
  matched: boolean;
  trigger: TriggerMatch;
  tokens: DetectedToken[];
}

// ============================================
// V2 Queue System Types
// ============================================

/**
 * Queue entry for trigger processing
 */
export interface TriggerQueueProcessorState {
  characterId: string;
  queue: TriggerQueueEntry[];
  active: ActiveTrigger | null;
  lastProcessedAt: number;
}

// ============================================
// Key Extraction Helper
// ============================================

/**
 * Get all keys from a trigger (main key + alternatives + legacy keywords)
 * Supports both new key/keys system and legacy keywords field
 */
function getAllTriggerKeys(trigger: CharacterSpriteTrigger): string[] {
  const allKeys: string[] = [];
  
  // New system: main key
  if (trigger.key) {
    allKeys.push(trigger.key);
  }
  
  // New system: alternative keys
  if (trigger.keys && trigger.keys.length > 0) {
    allKeys.push(...trigger.keys);
  }
  
  // Legacy: keywords (only if no new keys defined)
  if (allKeys.length === 0 && trigger.keywords && trigger.keywords.length > 0) {
    allKeys.push(...trigger.keywords);
  }
  
  return allKeys;
}

// ============================================
// Sprite Handler Functions
// ============================================

/**
 * Check sprite triggers
 */
export function checkSpriteTriggers(
  tokens: DetectedToken[],
  context: SpriteTriggerContext,
  state: SpriteHandlerState
): SpriteHandlerResult | null {
  const { spritePacks, spriteTriggers, spriteIndex, spriteLibraries, isSpriteLocked, character } = context;
  
  // Check if sprite is locked
  if (isSpriteLocked) {
    return null;
  }
  
  if (!character) {
    return null;
  }
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set();
  
  // Try sprite packs first (higher priority)
  const packResult = checkSpritePacks(
    tokens, 
    spritePacks, 
    spriteIndex, 
    spriteLibraries, 
    triggered, 
    context
  );
  
  if (packResult) {
    if (packResult.tokens[0]?.wordPosition !== undefined) {
      triggered.add(packResult.tokens[0].wordPosition);
      state.triggeredPositions.set(context.messageKey, triggered);
    }
    return packResult;
  }
  
  // Try simple triggers
  const simpleResult = checkSimpleTriggers(
    tokens, 
    spriteTriggers, 
    triggered, 
    context
  );
  
  if (simpleResult) {
    if (simpleResult.tokens[0]?.wordPosition !== undefined) {
      triggered.add(simpleResult.tokens[0].wordPosition);
      state.triggeredPositions.set(context.messageKey, triggered);
    }
    return simpleResult;
  }
  
  return null;
}

/**
 * Check sprite packs (ANY pack keyword + ALL item keys)
 */
function checkSpritePacks(
  tokens: DetectedToken[],
  packs: SpritePack[],
  spriteIndex: { sprites: Array<{ label: string; url: string }> },
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  triggeredPositions: Set<number>,
  context: SpriteTriggerContext
): SpriteHandlerResult | null {
  const activePacks = packs.filter(p => p.active);
  
  for (const token of tokens) {
    if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
    
    for (const pack of activePacks) {
      // Check pack keywords (ANY keyword must match)
      const matchingKeyword = pack.keywords.find(kw => 
        tokenMatchesKeyword(token, kw, pack.caseSensitive ?? false)
      );
      
      if (!matchingKeyword) continue;
      
      // Find best matching item (ALL keys must match)
      const bestItem = findBestMatchingItem(
        tokens,
        pack.items?.filter(i => i.enabled !== false) ?? [],
        libraries,
        pack.caseSensitive ?? false,
        pack.requirePipes ?? false
      );
      
      if (!bestItem) continue;
      
      // Get sprite URL
      const spriteUrl = getSpriteUrl(bestItem, spriteIndex);
      if (!spriteUrl) continue;
      
      return {
        matched: true,
        trigger: {
          triggerId: pack.id,
          triggerType: 'sprite',
          keyword: matchingKeyword,
          data: {
            spriteUrl,
            spriteLabel: bestItem.spriteLabel,
            returnToIdleMs: bestItem.returnToIdleMs ?? 0,
            characterId: context.character?.id,
            packId: pack.id,
            triggerName: pack.name,
          },
        },
        tokens: [token],
      };
    }
  }
  
  return null;
}

/**
 * Check simple sprite triggers (ANY key)
 * 
 * PRIORITY SYSTEM:
 * - Triggers are sorted by priority (descending)
 * - Higher priority triggers match first
 * - requirePipes: If true, keyword must be in |pipes| format
 * - Supports new key/keys system AND legacy keywords field
 */
function checkSimpleTriggers(
  tokens: DetectedToken[],
  triggers: CharacterSpriteTrigger[],
  triggeredPositions: Set<number>,
  context: SpriteTriggerContext
): SpriteHandlerResult | null {
  // Filter active triggers and sort by priority (highest first)
  const activeTriggers = triggers
    .filter(t => t.active)
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
  
  // Separate tokens by type
  const pipeTokens = tokens.filter(t => t.type === 'pipe');
  const allTokens = tokens;
  
  for (const trigger of activeTriggers) {
    // Determine which tokens to check based on requirePipes
    const tokensToCheck = trigger.requirePipes ? pipeTokens : allTokens;
    
    // Get all keys (new key/keys system + legacy keywords)
    const allKeys = getAllTriggerKeys(trigger);
    
    for (const token of tokensToCheck) {
      if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
      
      const matchingKey = allKeys.find(key =>
        tokenMatchesKeyword(token, key, trigger.caseSensitive ?? false)
      );
      
      if (!matchingKey) continue;
      
      // Verify sprite URL exists
      const spriteUrl = trigger.spriteUrl;
      if (!spriteUrl) continue;
      
      return {
        matched: true,
        trigger: {
          triggerId: trigger.id,
          triggerType: 'sprite',
          keyword: matchingKey,
          data: {
            spriteUrl,
            spriteLabel: trigger.spriteState,
            returnToIdleMs: trigger.returnToIdleMs ?? 0,
            characterId: context.character?.id,
            returnToMode: trigger.returnToMode,
            returnToSpriteUrl: trigger.returnToSpriteUrl,
            priority: trigger.priority ?? 1,
          },
        },
        tokens: [token],
      };
    }
  }
  
  return null;
}

/**
 * Find best matching item from pack (ALL keys must match)
 */
function findBestMatchingItem(
  tokens: DetectedToken[],
  items: SpritePackItem[],
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] },
  caseSensitive: boolean,
  requirePipes: boolean
): SpritePackItem | null {
  let bestItem: SpritePackItem | null = null;
  let bestKeyCount = 0;
  
  for (const item of items) {
    if (!item.spriteLabel && !item.spriteUrl) continue;
    
    const keys = buildItemKeys(item, libraries);
    
    // If no keys, item matches on pack keyword alone
    if (keys.length === 0) {
      if (!bestItem) {
        bestItem = item;
      }
      continue;
    }
    
    // ALL keys must match
    const allKeysMatch = keys.every(key => {
      const tokensToCheck = requirePipes 
        ? tokens.filter(t => t.type === 'pipe') 
        : tokens;
      return tokensToCheck.some(t => tokenMatchesKeyword(t, key, caseSensitive));
    });
    
    if (allKeysMatch && keys.length > bestKeyCount) {
      bestItem = item;
      bestKeyCount = keys.length;
    }
  }
  
  return bestItem;
}

/**
 * Build keys from item libraries + manual keys
 */
function buildItemKeys(
  item: SpritePackItem,
  libraries: { actions: SpriteLibraryEntry[]; poses: SpriteLibraryEntry[]; clothes: SpriteLibraryEntry[] }
): string[] {
  const keys: string[] = [];
  
  // Library keys
  const action = libraries.actions.find(a => a.id === item.actionId);
  const pose = libraries.poses.find(p => p.id === item.poseId);
  const clothes = libraries.clothes.find(c => c.id === item.clothesId);
  
  if (action) keys.push(`${action.prefix}${action.name}`);
  if (pose) keys.push(`${pose.prefix}${pose.name}`);
  if (clothes) keys.push(`${clothes.prefix}${clothes.name}`);
  
  // Manual keys
  if (item.keys) {
    keys.push(...item.keys.split(',').map(k => k.trim()).filter(Boolean));
  }
  
  return [...new Set(keys)]; // Deduplicate
}

/**
 * Get sprite URL from item
 */
function getSpriteUrl(
  item: SpritePackItem,
  spriteIndex: { sprites: Array<{ label: string; url: string }> }
): string | null {
  if (item.spriteUrl) return item.spriteUrl;
  
  if (item.spriteLabel) {
    const entry = spriteIndex.sprites.find(s => s.label === item.spriteLabel);
    return entry?.url || null;
  }
  
  return null;
}

/**
 * Normalize a keyword for matching (same as token normalization)
 * - Lowercase (unless caseSensitive)
 * - Remove accents
 * - Keep only letters, numbers, spaces, underscores, hyphens
 */
function normalizeKeyword(keyword: string, caseSensitive: boolean): string {
  let result = keyword.trim();
  if (!result) return '';
  
  // Lowercase if not case sensitive
  if (!caseSensitive) {
    result = result.toLowerCase();
  }
  
  // Remove accents
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Keep letters, numbers, spaces, underscores, hyphens
  // This matches the normalization in token-detector.ts
  result = result.replace(/[^\p{L}\p{N}\s_-]/gu, '');
  
  return result.trim();
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
function tokenMatchesKeyword(token: DetectedToken, keyword: string, caseSensitive: boolean): boolean {
  // Normalize BOTH the token and keyword the same way
  const kw = normalizeKeyword(keyword, caseSensitive);
  const tk = caseSensitive ? token.token : token.token.toLowerCase();
  
  if (!kw || !tk) return false;
  
  // For single-word keywords, require EXACT match
  // This prevents false positives like "marisa" matching "risa"
  const keywordWords = kw.split(/\s+/);
  if (keywordWords.length === 1) {
    return tk === kw;
  }
  
  // For multi-word keywords, check if all words appear in token
  // or if the full phrase appears as substring
  const allWordsMatch = keywordWords.every(word => tk.includes(word));
  if (allWordsMatch) return true;
  
  // Also check if the full keyword phrase appears in token
  return tk.includes(kw);
}

/**
 * Execute sprite trigger - applies the sprite to the store
 */
export function executeSpriteTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions: {
    applyTriggerForCharacter: (characterId: string, hit: {
      spriteUrl: string;
      spriteLabel: string | null;
      returnToIdleMs?: number;
    }) => void;
    scheduleReturnToIdleForCharacter: (
      characterId: string,
      triggerSpriteUrl: string,
      returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
      returnSpriteUrl: string,
      returnSpriteLabel: string | null,
      returnToIdleMs: number
    ) => void;
  },
  getIdleSpriteUrl: () => string | null
): void {
  const { spriteUrl, spriteLabel, returnToIdleMs, characterId } = match.data as {
    spriteUrl: string;
    spriteLabel: string | null;
    returnToIdleMs: number;
    characterId: string;
  };
  
  if (!characterId || !spriteUrl) return;
  
  // Apply the trigger sprite
  storeActions.applyTriggerForCharacter(characterId, {
    spriteUrl,
    spriteLabel,
    returnToIdleMs,
  });
  
  // Schedule return to idle if configured
  // Use 'clear' mode to let normal logic determine what sprite to show
  if (returnToIdleMs > 0) {
    const idleUrl = getIdleSpriteUrl();
    if (idleUrl) {
      storeActions.scheduleReturnToIdleForCharacter(
        characterId,
        spriteUrl,
        'clear',  // Let normal logic determine what to show (talk/thinking/idle)
        idleUrl,
        spriteLabel,
        returnToIdleMs
      );
    }
  }
}

/**
 * Reset state for new message
 */
export function resetSpriteHandlerState(state: SpriteHandlerState, messageKey: string): void {
  state.triggeredPositions.delete(messageKey);
  state.lastPackMatches.delete(messageKey);
}

/**
 * Clear all sprite handler state
 */
export function clearSpriteHandlerState(state: SpriteHandlerState): void {
  state.triggeredPositions.clear();
  state.lastPackMatches.clear();
}

// ============================================
// V2 TRIGGER COLLECTIONS SYSTEM
// ============================================

/**
 * Check Trigger Collections for matches
 * 
 * Priority system:
 * 1. Filter active collections
 * 2. Sort by priority (descending)
 * 3. Check collection-level keys first
 * 4. Then check individual sprite keys
 * 5. Return ALL matches (for queue processing)
 */
export function checkTriggerCollections(
  tokens: DetectedToken[],
  context: SpriteTriggerContextV2,
  state: SpriteHandlerState,
  queueState?: TriggerQueueProcessorState
): TriggerCollectionMatchResult[] {
  const { triggerCollections, spritePacksV2, character, isSpriteLocked } = context;
  
  // Check if sprite is locked
  if (isSpriteLocked) {
    console.log('[SpriteHandler] Sprite is locked, skipping trigger check');
    return [];
  }
  
  if (!character) {
    console.log('[SpriteHandler] No character in context, skipping trigger check');
    return [];
  }
  
  // Check if there's already an active non-interruptible chain
  if (queueState?.active) {
    // Check if current chain is interruptible
    // This is stored in the chain progress, not directly in ActiveTrigger
    // For now, we allow new triggers to queue up
  }
  
  // Get triggered positions for this message
  const triggered = state.triggeredPositions.get(context.messageKey) ?? new Set();
  
  // Filter active collections and sort by priority (descending)
  const activeCollections = triggerCollections
    .filter(c => c.active)
    .sort((a, b) => b.priority - a.priority);
  
  console.log('[SpriteHandler] checkTriggerCollections:', {
    tokenCount: tokens.length,
    tokens: tokens.map(t => ({ token: t.token, original: t.original, type: t.type })),
    collectionCount: triggerCollections.length,
    activeCollectionCount: activeCollections.length,
    characterId: character.id,
    characterName: character.name,
  });
  
  const allResults: TriggerCollectionMatchResult[] = [];
  
  for (const collection of activeCollections) {
    // Get the sprite pack for this collection
    const spritePack = spritePacksV2.find(p => p.id === collection.packId);
    if (!spritePack || spritePack.sprites.length === 0) continue;
    
    // Check cooldown
    if (!isCollectionCooldownReady(collection, state)) continue;
    
    // Try to match collection-level keys first
    const collectionKeyResults = matchCollectionKey(
      tokens,
      collection,
      spritePack,
      triggered,
      context
    );
    
    // Add all collection-level matches
    for (const collectionKeyResult of collectionKeyResults) {
      const result = buildTriggerCollectionResult(
        collection,
        spritePack,
        collectionKeyResult.sprite,
        undefined, // No sprite config for collection key match
        'collection_key',
        collectionKeyResult.token,
        collectionKeyResult.matchedKey
      );
      
      allResults.push(result);
    }
    
    // Try individual sprite keys
    const spriteKeyResults = matchSpriteKeys(
      tokens,
      collection,
      spritePack,
      triggered,
      context
    );
    
    // Add all sprite-level matches
    for (const spriteKeyResult of spriteKeyResults) {
      const result = buildTriggerCollectionResult(
        collection,
        spritePack,
        spriteKeyResult.sprite,
        spriteKeyResult.spriteConfig,
        'sprite_key',
        spriteKeyResult.token,
        spriteKeyResult.matchedKey
      );
      
      allResults.push(result);
    }
  }
  
  // Update triggered positions
  if (allResults.length > 0) {
    state.triggeredPositions.set(context.messageKey, triggered);
  }
  
  // Sort by priority (descending), then by position (ascending)
  allResults.sort((a, b) => {
    if (a.collection.priority !== b.collection.priority) {
      return b.collection.priority - a.collection.priority;
    }
    const aPos = a.tokens[0]?.wordPosition ?? 0;
    const bPos = b.tokens[0]?.wordPosition ?? 0;
    return aPos - bPos;
  });
  
  return allResults;
}

/**
 * Match collection-level key
 * Returns ALL matches found (not just the first)
 */
function matchCollectionKey(
  tokens: DetectedToken[],
  collection: TriggerCollection,
  spritePack: SpritePackV2,
  triggeredPositions: Set<number>,
  context: SpriteTriggerContextV2
): Array<{ sprite: SpritePackEntryV2; token: DetectedToken; matchedKey: string }> {
  const results: Array<{ sprite: SpritePackEntryV2; token: DetectedToken; matchedKey: string }> = [];
  const caseSensitive = collection.collectionKeyCaseSensitive ?? false;
  const requirePipes = collection.collectionKeyRequirePipes ?? false;
  
  // Get all collection keys (main + alternatives)
  const allKeys = [collection.collectionKey];
  if (collection.collectionKeys && collection.collectionKeys.length > 0) {
    allKeys.push(...collection.collectionKeys);
  }
  
  console.log('[SpriteHandler] matchCollectionKey checking:', {
    collectionName: collection.name,
    keys: allKeys,
    caseSensitive,
    requirePipes,
    tokenCount: tokens.length,
  });
  
  for (const token of tokens) {
    if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
    
    // Check if token is in pipes if required
    if (requirePipes && token.type !== 'pipe') continue;
    
    for (const key of allKeys) {
      const normalizedKey = normalizeKeyword(key, caseSensitive);
      const matches = tokenMatchesKeyword(token, key, caseSensitive);
      
      if (matches) {
        console.log('[SpriteHandler] Collection key matched:', {
          key,
          normalizedKey,
          token: token.token,
          tokenType: token.type,
        });
        
        // Select sprite based on collection behavior
        const sprite = selectSpriteFromPack(
          spritePack,
          collection.collectionBehavior,
          collection.principalSpriteId
        );
        
        if (sprite) {
          results.push({ sprite, token, matchedKey: key });
          // Mark this position as triggered
          if (token.wordPosition !== undefined) {
            triggeredPositions.add(token.wordPosition);
          }
          // Continue to find more matches (don't return immediately)
        }
      }
    }
  }
  
  return results;
}

/**
 * Match individual sprite keys
 * Returns ALL matches found (not just the first)
 */
function matchSpriteKeys(
  tokens: DetectedToken[],
  collection: TriggerCollection,
  spritePack: SpritePackV2,
  triggeredPositions: Set<number>,
  context: SpriteTriggerContextV2
): Array<{ sprite: SpritePackEntryV2; spriteConfig: SpriteTriggerConfig; token: DetectedToken; matchedKey: string }> {
  const results: Array<{ sprite: SpritePackEntryV2; spriteConfig: SpriteTriggerConfig; token: DetectedToken; matchedKey: string }> = [];
  
  // Get all sprite configs for this collection
  const spriteConfigs = Object.values(collection.spriteConfigs).filter(c => c.enabled);
  
  console.log('[SpriteHandler] matchSpriteKeys checking:', {
    collectionName: collection.name,
    spriteConfigCount: spriteConfigs.length,
    spriteConfigs: spriteConfigs.map(c => ({
      key: c.key,
      keys: c.keys,
      spriteId: c.spriteId,
      enabled: c.enabled,
    })),
  });
  
  for (const token of tokens) {
    if (token.wordPosition !== undefined && triggeredPositions.has(token.wordPosition)) continue;
    
    for (const config of spriteConfigs) {
      // Find the sprite in the pack
      const sprite = spritePack.sprites.find(s => s.id === config.spriteId);
      if (!sprite) continue;
      
      // Check if token is in pipes if required
      if (config.requirePipes && token.type !== 'pipe') continue;
      
      // Get all keys for this config
      const allKeys = [config.key];
      if (config.keys && config.keys.length > 0) {
        allKeys.push(...config.keys);
      }
      
      for (const key of allKeys) {
        const normalizedKey = normalizeKeyword(key, config.caseSensitive);
        const matches = tokenMatchesKeyword(token, key, config.caseSensitive);
        
        if (matches) {
          console.log('[SpriteHandler] Sprite key matched:', {
            key,
            normalizedKey,
            token: token.token,
            tokenType: token.type,
            spriteLabel: sprite.label,
          });
          
          results.push({ sprite, spriteConfig: config, token, matchedKey: key });
          // Mark this position as triggered
          if (token.wordPosition !== undefined) {
            triggeredPositions.add(token.wordPosition);
          }
          // Continue to find more matches (don't return immediately)
        }
      }
    }
  }
  
  return results;
}

/**
 * Select sprite from pack based on behavior
 */
export function selectSpriteFromPack(
  pack: SpritePackV2,
  behavior: 'principal' | 'random' | 'list',
  principalSpriteId?: string
): SpritePackEntryV2 | null {
  if (pack.sprites.length === 0) return null;
  
  switch (behavior) {
    case 'principal':
      // Use principal sprite if specified, otherwise first sprite
      if (principalSpriteId) {
        const principal = pack.sprites.find(s => s.id === principalSpriteId);
        if (principal) return principal;
      }
      return pack.sprites[0];
    
    case 'random':
      // Random selection
      const randomIndex = Math.floor(Math.random() * pack.sprites.length);
      return pack.sprites[randomIndex];
    
    case 'list':
      // Rotate through sprites (uses first for now, rotation handled by state)
      // TODO: Implement proper list rotation with state tracking
      return pack.sprites[0];
    
    default:
      return pack.sprites[0];
  }
}

/**
 * Build trigger collection match result
 */
function buildTriggerCollectionResult(
  collection: TriggerCollection,
  spritePack: SpritePackV2,
  sprite: SpritePackEntryV2,
  spriteConfig: SpriteTriggerConfig | undefined,
  matchSource: 'collection_key' | 'sprite_key',
  token: DetectedToken,
  matchedKey: string
): TriggerCollectionMatchResult {
  // Determine which chains to use (sprite config overrides collection)
  let spriteChain: SpriteChain | undefined;
  let soundChain: SoundChain | undefined;
  
  if (spriteConfig) {
    // Use sprite config chains if defined, otherwise fall back to collection
    spriteChain = spriteConfig.spriteChain?.enabled ? spriteConfig.spriteChain : collection.spriteChain;
    soundChain = spriteConfig.soundChain?.enabled ? spriteConfig.soundChain : collection.soundChain;
  } else {
    spriteChain = collection.spriteChain;
    soundChain = collection.soundChain;
  }
  
  console.log('[SpriteHandler] buildTriggerCollectionResult chains:', {
    collectionId: collection.id,
    collectionName: collection.name,
    collectionSoundChain: collection.soundChain ? {
      enabled: collection.soundChain.enabled,
      steps: collection.soundChain.steps?.length,
    } : null,
    spriteConfigSoundChain: spriteConfig?.soundChain ? {
      enabled: spriteConfig.soundChain.enabled,
      steps: spriteConfig.soundChain.steps?.length,
    } : null,
    finalSoundChain: soundChain ? {
      enabled: soundChain.enabled,
      steps: soundChain.steps?.length,
    } : null,
  });
  
  // Determine fallback mode
  const fallbackMode = spriteConfig?.fallbackMode ?? collection.fallbackMode;
  const fallbackSpriteId = spriteConfig?.fallbackSpriteId ?? collection.fallbackSpriteId;
  const fallbackDelayMs = spriteConfig?.fallbackDelayMs ?? collection.fallbackDelayMs;
  
  return {
    matched: true,
    trigger: {
      triggerId: collection.id,
      triggerType: 'sprite',
      keyword: matchedKey,
      data: {
        spriteUrl: sprite.url,
        spriteLabel: sprite.label,
        characterId: undefined, // Set by caller
        collectionId: collection.id,
        packId: spritePack.id,
        spriteId: sprite.id,
        triggerName: collection.name,
        priority: collection.priority,
        fallbackMode,
        fallbackSpriteId,
        fallbackDelayMs,
        matchSource,
        // Chain data
        hasSpriteChain: spriteChain?.enabled ?? false,
        hasSoundChain: soundChain?.enabled ?? false,
      },
    },
    tokens: [token],
    collection,
    spritePack,
    selectedSprite: sprite,
    spriteConfig,
    matchSource,
    spriteChain: spriteChain?.enabled ? spriteChain : undefined,
    soundChain: soundChain?.enabled ? soundChain : undefined,
  };
}

/**
 * Check if collection cooldown is ready
 */
function isCollectionCooldownReady(
  collection: TriggerCollection,
  state: SpriteHandlerState
): boolean {
  if (collection.cooldownMs <= 0) return true;
  
  const now = Date.now();
  const lastTriggerKey = `collection_${collection.id}`;
  // Use a map to track last trigger times
  const lastTriggerMap = (state as any)._collectionCooldowns as Map<string, number> | undefined;
  
  if (!lastTriggerMap) return true;
  
  const lastTriggered = lastTriggerMap.get(lastTriggerKey) ?? 0;
  return now - lastTriggered >= collection.cooldownMs;
}

/**
 * Mark collection as triggered (for cooldown)
 */
export function markCollectionTriggered(
  collectionId: string,
  state: SpriteHandlerState
): void {
  const lastTriggerMap = ((state as any)._collectionCooldowns as Map<string, number>) ?? new Map<string, number>();
  lastTriggerMap.set(`collection_${collectionId}`, Date.now());
  (state as any)._collectionCooldowns = lastTriggerMap;
}

/**
 * Execute trigger collection result
 * Applies sprite, starts chains, schedules fallback
 */
export function executeTriggerCollectionResult(
  result: TriggerCollectionMatchResult,
  context: SpriteTriggerContextV2,
  storeActions: {
    applyTriggerForCharacter: (characterId: string, hit: {
      spriteUrl: string;
      spriteLabel: string | null;
      returnToIdleMs?: number;
      packId?: string;
      collectionId?: string;
    }) => void;
    scheduleReturnToIdleForCharacter: (
      characterId: string,
      triggerSpriteUrl: string,
      returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
      returnSpriteUrl: string,
      returnSpriteLabel: string | null,
      delayMs: number
    ) => void;
    addTriggerToQueue: (characterId: string, entry: Omit<TriggerQueueEntry, 'id' | 'triggeredAt'>) => void;
    startSpriteChain: (characterId: string, chain: SpriteChain) => void;
    startSoundChain: (characterId: string, chain: SoundChain) => void;
  },
  getIdleSpriteUrl: () => string | null
): void {
  const { collection, selectedSprite, spriteChain, soundChain } = result;
  const { spriteUrl, spriteLabel, fallbackMode, fallbackDelayMs, fallbackSpriteId } = result.trigger.data as {
    spriteUrl: string;
    spriteLabel: string | null;
    fallbackMode?: string;
    fallbackDelayMs?: number;
    fallbackSpriteId?: string;
  };
  
  // Get characterId from context (not from trigger.data which may be undefined)
  const characterId = context.character?.id;
  
  console.log('[SpriteHandler] executeTriggerCollectionResult:', {
    characterId,
    spriteUrl,
    hasSoundChain: !!soundChain,
    soundChainEnabled: soundChain?.enabled,
    soundChainSteps: soundChain?.steps?.length,
    hasSpriteChain: !!spriteChain,
  });
  
  if (!characterId || !spriteUrl) {
    console.log('[SpriteHandler] executeTriggerCollectionResult: Missing characterId or spriteUrl', { 
      characterId, 
      spriteUrl,
      hasContext: !!context,
      hasCharacter: !!context.character 
    });
    return;
  }
  
  // Apply the trigger sprite
  const useTimelineSounds = collection.useTimelineSounds ?? false;
  storeActions.applyTriggerForCharacter(characterId, {
    spriteUrl,
    spriteLabel,
    packId: collection.packId,
    collectionId: collection.id,
    useTimelineSounds,
  });
  
  // Mark collection as triggered for cooldown
  // This would need access to handler state - handled by caller
  
  // Start sprite chain if configured
  if (spriteChain && spriteChain.enabled && spriteChain.steps.length > 0) {
    console.log('[SpriteHandler] Starting sprite chain:', {
      characterId,
      steps: spriteChain.steps.length,
      loop: spriteChain.loop,
    });
    storeActions.startSpriteChain(characterId, spriteChain);
    // Don't schedule fallback if chain is active and not looping
    if (!spriteChain.loop) {
      return;
    }
  }

  // Note: Timeline sounds are now handled by the useTimelineSpriteSounds hook
  // which watches for changes to triggerSpriteUrl and checks useTimelineSounds
  // (useTimelineSounds is already passed to applyTriggerForCharacter above)
  
  // Schedule fallback if configured
  if (fallbackDelayMs && fallbackDelayMs > 0) {
    let returnSpriteUrl: string | null = null;
    let returnSpriteLabel: string | null = null;
    let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'idle';

    if (fallbackMode === 'custom_sprite' && fallbackSpriteId) {
      // Find fallback sprite in pack
      const fallbackSprite = result.spritePack.sprites.find(s => s.id === fallbackSpriteId);
      if (fallbackSprite) {
        returnSpriteUrl = fallbackSprite.url;
        returnSpriteLabel = fallbackSprite.label;
        returnToMode = 'idle'; // Apply the custom sprite
      }
    } else if (fallbackMode === 'idle_collection') {
      // For 'idle_collection', use 'clear' mode to let the normal state logic
      // (idle state from State Collections V2) determine what to show
      returnToMode = 'clear';
      returnSpriteUrl = ''; // Empty is fine for 'clear' mode
      returnSpriteLabel = null;
    } else if (fallbackMode === 'collection_default') {
      // Use collection's principal sprite or first sprite
      const principalSprite = selectSpriteFromPack(
        result.spritePack,
        'principal',
        result.collection.principalSpriteId
      );
      if (principalSprite) {
        returnSpriteUrl = principalSprite.url;
        returnSpriteLabel = principalSprite.label;
        returnToMode = 'idle'; // Apply the collection default sprite
      } else {
        // Fallback to 'clear' mode if no principal sprite
        returnToMode = 'clear';
        returnSpriteUrl = '';
        returnSpriteLabel = null;
      }
    }

    console.log('[SpriteHandler] Scheduling fallback:', {
      characterId,
      fallbackMode,
      fallbackDelayMs,
      returnToMode,
      returnSpriteUrl: returnSpriteUrl || '(clear mode)',
      returnSpriteLabel,
    });

    // Always schedule fallback when delay > 0
    // For 'clear' mode, returnSpriteUrl can be empty (normal state logic will apply)
    storeActions.scheduleReturnToIdleForCharacter(
      characterId,
      spriteUrl,
      returnToMode,
      returnSpriteUrl || '',
      returnSpriteLabel,
      fallbackDelayMs
    );
  }
}

/**
 * Get fallback sprite URL
 */
export function getFallbackSpriteUrl(
  mode: 'idle_collection' | 'custom_sprite' | 'collection_default',
  collection: TriggerCollection,
  spritePack: SpritePackV2,
  getIdleSpriteUrl: () => string | null
): string | null {
  switch (mode) {
    case 'custom_sprite':
      if (collection.fallbackSpriteId) {
        const sprite = spritePack.sprites.find(s => s.id === collection.fallbackSpriteId);
        return sprite?.url ?? null;
      }
      return null;
    
    case 'idle_collection':
      return getIdleSpriteUrl();
    
    case 'collection_default':
    default:
      // Use collection's principal sprite or first sprite
      const principalSprite = selectSpriteFromPack(spritePack, 'principal', collection.principalSpriteId);
      return principalSprite?.url ?? getIdleSpriteUrl();
  }
}
