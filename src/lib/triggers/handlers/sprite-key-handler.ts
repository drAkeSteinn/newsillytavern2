// ============================================
// Sprite Key Handler - Unified Implementation
// ============================================
//
// Handles ALL sprite trigger detection and execution using the unified
// KeyHandler interface. Works with DetectedKey[] from KeyDetector.
//
// Supports:
// - V2 Trigger Collections (primary system)
// - V2 State Collections (idle, talk, thinking)
// - Legacy Sprite Packs
// - Fallback modes (idle_collection, custom_sprite, collection_default)
// - Timeline sounds
// - Sprite chains

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { 
  CharacterCard,
  TriggerCollection,
  SpritePackV2,
  SpritePackEntryV2,
  SpriteTriggerConfig,
  SpriteChain,
  SoundChain,
  StateCollectionV2,
} from '@/types';
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
  isDirectUrl,
} from '../utils';

// ============================================
// Types
// ============================================

export interface SpriteKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  character: CharacterCard | null;
  allCharacters?: CharacterCard[];
  
  // V2 System
  triggerCollections: TriggerCollection[];
  spritePacksV2: SpritePackV2[];
  stateCollectionsV2?: StateCollectionV2[];
  
  // Legacy System
  spritePacks?: Array<{
    id: string;
    name: string;
    active: boolean;
    keywords: string[];
    items: Array<{
      spriteUrl: string;
      spriteLabel?: string;
      enabled: boolean;
      keys?: string[];
    }>;
  }>;
  spriteTriggers?: Array<{
    id: string;
    name: string;
    active: boolean;
    keywords: string[];
    spriteUrl: string;
    spriteState?: string;
    returnToIdleMs?: number;
    priority?: number;
  }>;
  
  // Store Actions
  applyTriggerForCharacter?: (characterId: string, hit: {
    spriteUrl: string;
    spriteLabel?: string | null;
    returnToIdleMs?: number;
    packId?: string;
    collectionId?: string;
    useTimelineSounds?: boolean;
  }) => void;
  scheduleReturnToIdleForCharacter?: (
    characterId: string,
    triggerSpriteUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    delayMs: number
  ) => void;
  addTriggerToQueue?: (characterId: string, entry: {
    triggerCollectionId: string;
    spriteId: string;
    spriteUrl: string;
    spriteLabel?: string;
    source: string;
    fallbackMode?: string;
    fallbackDelayMs?: number;
    fallbackSpriteId?: string;
    fallbackSpriteUrl?: string;
  }) => void;
  startSpriteChain?: (characterId: string, chain: SpriteChain) => void;
  startSoundChain?: (characterId: string, chain: SoundChain) => void;
  
  // State
  isSpriteLocked?: boolean;
}

// ============================================
// Sprite Key Handler Class
// ============================================

export class SpriteKeyHandler implements KeyHandler {
  readonly id = 'sprite-key-handler';
  readonly type = 'sprite' as const;
  readonly priority = 90; // After sound, before background
  
  private cooldownTracker: CooldownTracker;
  private triggeredPositions: Map<string, Set<number>>;
  private collectionCooldowns: Map<string, number>;
  
  constructor() {
    this.cooldownTracker = new CooldownTracker();
    this.triggeredPositions = new Map();
    this.collectionCooldowns = new Map();
  }
  
  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const spriteContext = context as Partial<SpriteKeyHandlerContext>;
    
    console.log(`[SpriteKeyHandler] canHandle called`, {
      key: key.key,
      value: key.value,
      format: key.format,
      original: key.original,
      category: key.category,
      isSpriteLocked: spriteContext.isSpriteLocked,
      hasTriggerCollections: (spriteContext.triggerCollections?.length || 0),
      hasSpritePacksV2: (spriteContext.spritePacksV2?.length || 0),
      hasSpriteTriggers: (spriteContext.spriteTriggers?.length || 0),
      hasSpritePacks: (spriteContext.spritePacks?.length || 0),
    });
    
    // Check if sprite is locked
    if (spriteContext.isSpriteLocked) {
      console.log(`[SpriteKeyHandler] Cannot handle - sprite is locked`);
      return false;
    }
    
    // Check if category hint is sprite
    const category = classifyKey(key);
    console.log(`[SpriteKeyHandler] Classified as: ${category}`);
    if (category === 'sprite') {
      console.log(`[SpriteKeyHandler] Can handle - category is sprite`);
      return true;
    }
    
    // Check V2 trigger collections
    const collections = spriteContext.triggerCollections || [];
    for (const collection of collections) {
      if (!collection.active) continue;
      
      // Check collection key
      if (collection.collectionKey && keyMatches(key.key, collection.collectionKey)) {
        return true;
      }
      if (collection.collectionKeys?.some(k => keyMatches(key.key, k))) {
        return true;
      }
      
      // Check sprite config keys
      for (const config of Object.values(collection.spriteConfigs)) {
        if (!config.enabled) continue;
        if (config.key && keyMatches(key.key, config.key)) {
          return true;
        }
        if (config.keys?.some(k => keyMatches(key.key, k))) {
          return true;
        }
      }
    }
    
    // Check legacy triggers
    const triggers = spriteContext.spriteTriggers || [];
    for (const trigger of triggers) {
      if (!trigger.active) continue;
      if (trigger.keywords?.some(kw => keyMatches(key.key, kw))) {
        return true;
      }
    }
    
    // Check legacy packs
    const packs = spriteContext.spritePacks || [];
    for (const pack of packs) {
      if (!pack.active) continue;
      if (pack.keywords?.some(kw => keyMatches(key.key, kw))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const spriteContext = context as SpriteKeyHandlerContext;
    const messageKey = context.messageKey;
    
    console.log(`[SpriteKeyHandler] handleKey called`, {
      key: key.key,
      value: key.value,
      format: key.format,
      original: key.original,
      position: key.position,
      messageKey,
      hasCharacter: !!spriteContext.character,
      characterId: spriteContext.character?.id,
    });
    
    // Check if position already triggered
    const triggered = this.triggeredPositions.get(messageKey) ?? new Set<number>();
    if (triggered.has(key.position)) {
      console.log(`[SpriteKeyHandler] Position already triggered, skipping`);
      return null;
    }
    
    // For type-indicator keys like "sprite:value", use the value for matching
    // e.g., sprite:alegre -> key="sprite", value="alegre" -> match with "alegre"
    const effectiveKey = this.getEffectiveKey(key);
    console.log(`[SpriteKeyHandler] Effective key:`, {
      originalKey: key.key,
      effectiveKey: effectiveKey.key,
      effectiveValue: effectiveKey.value,
    });
    
    // Try V2 trigger collections first (highest priority)
    const v2Result = this.findV2Match(effectiveKey, spriteContext);
    console.log(`[SpriteKeyHandler] V2 match result:`, v2Result ? { matched: v2Result.matched, key: v2Result.key?.key } : null);
    if (v2Result) {
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      return v2Result;
    }
    
    // Try legacy sprite triggers
    const legacyResult = this.findLegacyMatch(effectiveKey, spriteContext);
    console.log(`[SpriteKeyHandler] Legacy match result:`, legacyResult ? { matched: legacyResult.matched, key: legacyResult.key?.key } : null);
    if (legacyResult) {
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      return legacyResult;
    }
    
    console.log(`[SpriteKeyHandler] No match found for key: ${effectiveKey.key}`);
    return null;
  }
  
  /**
   * Get effective key for matching
   * For type-indicator keys like "sprite:value", returns the value
   * Otherwise returns the original key
   */
  private getEffectiveKey(key: DetectedKey): DetectedKey {
    // Type indicators that signal the value should be used for matching
    const typeIndicators = ['sprite', 'expresion', 'expression'];
    
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
    const spriteContext = context as SpriteKeyHandlerContext;
    const characterId = spriteContext.character?.id;
    
    if (!characterId) {
      logHandler(this.id, 'execute', { error: 'No character ID' });
      return;
    }
    
    const {
      spriteUrl,
      spriteLabel,
      fallbackMode,
      fallbackDelayMs,
      fallbackSpriteId,
      fallbackSpriteUrl,
      collectionId,
      packId,
      triggerName,
      hasSpriteChain,
      spriteChain,
      hasSoundChain,
      soundChain,
      useTimelineSounds,
    } = match.data as {
      spriteUrl: string;
      spriteLabel?: string;
      fallbackMode?: string;
      fallbackDelayMs?: number;
      fallbackSpriteId?: string;
      fallbackSpriteUrl?: string;
      collectionId?: string;
      packId?: string;
      triggerName?: string;
      hasSpriteChain?: boolean;
      spriteChain?: SpriteChain;
      hasSoundChain?: boolean;
      soundChain?: SoundChain;
      useTimelineSounds?: boolean;
    };
    
    if (!spriteUrl) {
      logHandler(this.id, 'execute', { error: 'No sprite URL' });
      return;
    }
    
    logHandler(this.id, 'execute', {
      characterId,
      spriteUrl,
      spriteLabel,
      fallbackMode,
      fallbackDelayMs,
    });
    
    // Apply trigger sprite
    spriteContext.applyTriggerForCharacter?.(characterId, {
      spriteUrl,
      spriteLabel: spriteLabel || null,
      packId,
      collectionId,
      useTimelineSounds,
    });
    
    // Mark collection for cooldown
    if (collectionId) {
      this.collectionCooldowns.set(collectionId, Date.now());
    }
    
    // Start sprite chain if configured
    if (hasSpriteChain && spriteChain && spriteContext.startSpriteChain) {
      logHandler(this.id, 'Starting sprite chain', { steps: spriteChain.steps.length });
      spriteContext.startSpriteChain(characterId, spriteChain);
      // Don't schedule fallback if chain is active and not looping
      if (!spriteChain.loop) {
        return;
      }
    }
    
    // Start sound chain if configured
    if (hasSoundChain && soundChain && spriteContext.startSoundChain) {
      logHandler(this.id, 'Starting sound chain', { steps: soundChain.steps.length });
      spriteContext.startSoundChain(characterId, soundChain);
    }
    
    // Schedule fallback if configured
    if (fallbackDelayMs && fallbackDelayMs > 0 && spriteContext.scheduleReturnToIdleForCharacter) {
      this.scheduleFallback(
        characterId,
        spriteUrl,
        spriteLabel || null,
        fallbackMode,
        fallbackDelayMs,
        fallbackSpriteUrl,
        spriteContext
      );
    }
  }
  
  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): RegisteredKey[] {
    const spriteContext = context as Partial<SpriteKeyHandlerContext>;
    const keys: RegisteredKey[] = [];
    
    // V2 trigger collections
    const collections = spriteContext.triggerCollections || [];
    for (const collection of collections) {
      if (!collection.active) continue;
      
      if (collection.collectionKey) {
        keys.push({
          key: collection.collectionKey,
          category: 'sprite',
          config: { collectionId: collection.id },
        });
      }
      for (const key of collection.collectionKeys || []) {
        keys.push({
          key,
          category: 'sprite',
          config: { collectionId: collection.id },
        });
      }
      
      for (const [spriteId, config] of Object.entries(collection.spriteConfigs)) {
        if (!config.enabled) continue;
        if (config.key) {
          keys.push({
            key: config.key,
            category: 'sprite',
            config: { collectionId: collection.id, spriteId },
          });
        }
        for (const key of config.keys || []) {
          keys.push({
            key,
            category: 'sprite',
            config: { collectionId: collection.id, spriteId },
          });
        }
      }
    }
    
    // Legacy triggers
    const triggers = spriteContext.spriteTriggers || [];
    for (const trigger of triggers) {
      if (!trigger.active) continue;
      for (const keyword of trigger.keywords) {
        keys.push({
          key: keyword,
          category: 'sprite',
          config: { triggerId: trigger.id },
        });
      }
    }
    
    return keys;
  }
  
  /**
   * Check if key should be consumed
   */
  consumesKey(_key: DetectedKey): boolean {
    return true;
  }
  
  /**
   * Reset state for new message
   */
  reset(messageKey: string): void {
    this.triggeredPositions.delete(messageKey);
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.triggeredPositions.clear();
    this.collectionCooldowns.clear();
    this.cooldownTracker.reset();
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  /**
   * Find match in V2 trigger collections
   */
  private findV2Match(
    key: DetectedKey,
    context: SpriteKeyHandlerContext
  ): TriggerMatchResult | null {
    const { triggerCollections, spritePacksV2, character } = context;
    
    console.log(`[SpriteKeyHandler] findV2Match called`, {
      key: key.key,
      hasCharacter: !!character,
      triggerCollectionsCount: triggerCollections?.length || 0,
      spritePacksV2Count: spritePacksV2?.length || 0,
    });
    
    if (!character) {
      console.log(`[SpriteKeyHandler] findV2Match: No character, returning null`);
      return null;
    }
    
    // Filter active collections and sort by priority
    const activeCollections = triggerCollections
      .filter(c => c.active)
      .sort((a, b) => b.priority - a.priority);
    
    console.log(`[SpriteKeyHandler] findV2Match: Active collections`, {
      count: activeCollections.length,
      names: activeCollections.map(c => c.name),
    });
    
    for (const collection of activeCollections) {
      console.log(`[SpriteKeyHandler] Checking collection: ${collection.name}`, {
        collectionKey: collection.collectionKey,
        collectionKeys: collection.collectionKeys,
        packId: collection.packId,
        spriteConfigsCount: Object.keys(collection.spriteConfigs || {}).length,
      });
      
      // Check cooldown
      if (!this.isCollectionCooldownReady(collection)) {
        console.log(`[SpriteKeyHandler] Collection on cooldown: ${collection.name}`);
        continue;
      }
      
      const pack = spritePacksV2.find(p => p.id === collection.packId);
      if (!pack || pack.sprites.length === 0) {
        console.log(`[SpriteKeyHandler] No pack found or empty sprites for collection: ${collection.name}`, {
          packFound: !!pack,
          spritesCount: pack?.sprites?.length || 0,
        });
        continue;
      }
      
      // Try collection key match
      const collectionKeyMatch = this.matchCollectionKey(key, collection, pack);
      console.log(`[SpriteKeyHandler] Collection key match result:`, collectionKeyMatch ? 'matched' : 'no match');
      if (collectionKeyMatch) {
        logMatch(this.id, key.key, true, { 
          source: 'collection_key',
          collection: collection.name,
          sprite: collectionKeyMatch.spriteLabel 
        });
        
        return this.buildV2Result(
          key,
          collection,
          pack,
          collectionKeyMatch,
          'collection_key'
        );
      }
      
      // Try individual sprite keys
      const spriteKeyMatch = this.matchSpriteKey(key, collection, pack);
      console.log(`[SpriteKeyHandler] Sprite key match result:`, spriteKeyMatch ? 'matched' : 'no match');
      if (spriteKeyMatch) {
        logMatch(this.id, key.key, true, { 
          source: 'sprite_key',
          collection: collection.name,
          sprite: spriteKeyMatch.sprite.label 
        });
        
        return this.buildV2Result(
          key,
          collection,
          pack,
          spriteKeyMatch.sprite,
          'sprite_key',
          spriteKeyMatch.config
        );
      }
    }
    
    console.log(`[SpriteKeyHandler] findV2Match: No match found`);
    return null;
  }
  
  /**
   * Match collection-level key
   */
  private matchCollectionKey(
    key: DetectedKey,
    collection: TriggerCollection,
    pack: SpritePackV2
  ): SpritePackEntryV2 | null {
    const allKeys = [
      collection.collectionKey,
      ...(collection.collectionKeys || [])
    ].filter(Boolean);
    
    console.log(`[SpriteKeyHandler] matchCollectionKey`, {
      detectedKey: key.key,
      collectionKeys: allKeys,
    });
    
    // Normalize collection keys the same way we normalize detected keys
    // This handles keys like "sprite:test01" -> "test01"
    const normalizedCollectionKeys = allKeys.map(k => this.normalizeTriggerKey(k));
    
    console.log(`[SpriteKeyHandler] matchCollectionKey normalized`, {
      normalizedCollectionKeys,
      detectedKey: key.key,
    });
    
    const matched = normalizedCollectionKeys.some(k => keyMatches(key.key, k));
    if (!matched) return null;
    
    return this.selectSprite(pack, collection.collectionBehavior, collection.principalSpriteId);
  }
  
  /**
   * Normalize a trigger key from configuration
   * Handles keys like "sprite:test01" -> "test01"
   */
  private normalizeTriggerKey(triggerKey: string): string {
    if (!triggerKey) return '';
    
    // Check for type:value format (e.g., "sprite:test01", "expression:happy")
    const typeValueMatch = triggerKey.match(/^(sprite|expresion|expression|sound|bg|background)[:=](.+)$/i);
    if (typeValueMatch) {
      return normalizeKey(typeValueMatch[2]);
    }
    
    // Otherwise just normalize the key
    return normalizeKey(triggerKey);
  }
  
  /**
   * Match individual sprite keys
   */
  private matchSpriteKey(
    key: DetectedKey,
    collection: TriggerCollection,
    pack: SpritePackV2
  ): { sprite: SpritePackEntryV2; config: SpriteTriggerConfig } | null {
    for (const [spriteId, config] of Object.entries(collection.spriteConfigs)) {
      if (!config.enabled) continue;
      
      const allKeys = [config.key, ...(config.keys || [])].filter(Boolean);
      
      // Normalize sprite keys the same way we normalize detected keys
      const normalizedSpriteKeys = allKeys.map(k => this.normalizeTriggerKey(k));
      
      const matched = normalizedSpriteKeys.some(k => keyMatches(key.key, k));
      
      if (matched) {
        const sprite = pack.sprites.find(s => s.id === spriteId);
        if (sprite) {
          return { sprite, config };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Build V2 trigger result
   */
  private buildV2Result(
    key: DetectedKey,
    collection: TriggerCollection,
    pack: SpritePackV2,
    sprite: SpritePackEntryV2,
    matchSource: 'collection_key' | 'sprite_key',
    spriteConfig?: SpriteTriggerConfig
  ): TriggerMatchResult {
    const fallbackMode = spriteConfig?.fallbackMode ?? collection.fallbackMode;
    const fallbackDelayMs = spriteConfig?.fallbackDelayMs ?? collection.fallbackDelayMs;
    const fallbackSpriteId = spriteConfig?.fallbackSpriteId ?? collection.fallbackSpriteId;
    
    // DEBUG: Log fallback configuration
    console.log('[SpriteKeyHandler] buildV2Result fallback config:', {
      collectionName: collection.name,
      fallbackMode,
      fallbackDelayMs,
      fallbackSpriteId,
      spriteConfigFallbackMode: spriteConfig?.fallbackMode,
      collectionFallbackMode: collection.fallbackMode,
      spriteConfigFallbackDelay: spriteConfig?.fallbackDelayMs,
      collectionFallbackDelay: collection.fallbackDelayMs,
    });
    
    // Get fallback sprite URL if needed
    let fallbackSpriteUrl: string | undefined;
    if (fallbackMode === 'custom_sprite' && fallbackSpriteId) {
      const fallbackSprite = pack.sprites.find(s => s.id === fallbackSpriteId);
      if (fallbackSprite) {
        fallbackSpriteUrl = fallbackSprite.url;
      }
    }
    
    // Determine chains
    const spriteChain = spriteConfig?.spriteChain ?? collection.spriteChain;
    const soundChain = spriteConfig?.soundChain ?? collection.soundChain;
    
    return successResult(key, createMatch('sprite', key.original, {
      spriteUrl: sprite.url,
      spriteLabel: sprite.label,
      collectionId: collection.id,
      packId: pack.id,
      triggerName: collection.name,
      priority: collection.priority,
      fallbackMode,
      fallbackDelayMs,
      fallbackSpriteId,
      fallbackSpriteUrl,
      matchSource,
      useTimelineSounds: collection.useTimelineSounds,
      hasSpriteChain: spriteChain?.enabled ?? false,
      spriteChain: spriteChain?.enabled ? spriteChain : undefined,
      hasSoundChain: soundChain?.enabled ?? false,
      soundChain: soundChain?.enabled ? soundChain : undefined,
    }));
  }
  
  /**
   * Find match in legacy system
   */
  private findLegacyMatch(
    key: DetectedKey,
    context: SpriteKeyHandlerContext
  ): TriggerMatchResult | null {
    const { spriteTriggers, spritePacks, character } = context;
    
    console.log(`[SpriteKeyHandler] findLegacyMatch called`, {
      key: key.key,
      hasCharacter: !!character,
      spriteTriggersCount: spriteTriggers?.length || 0,
      spritePacksCount: spritePacks?.length || 0,
    });
    
    if (!character) {
      console.log(`[SpriteKeyHandler] findLegacyMatch: No character, returning null`);
      return null;
    }
    
    // Try simple triggers first (sorted by priority)
    if (spriteTriggers && spriteTriggers.length > 0) {
      const activeTriggers = spriteTriggers
        .filter(t => t.active)
        .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1));
      
      console.log(`[SpriteKeyHandler] findLegacyMatch: Active triggers`, {
        count: activeTriggers.length,
        names: activeTriggers.map(t => t.name),
        keywords: activeTriggers.map(t => ({ name: t.name, keywords: t.keywords })),
      });
      
      for (const trigger of activeTriggers) {
        const matched = trigger.keywords?.some(kw => keyMatches(key.key, kw));
        console.log(`[SpriteKeyHandler] Checking trigger: ${trigger.name}`, {
          keywords: trigger.keywords,
          keyToMatch: key.key,
          matched,
        });
        if (matched && trigger.spriteUrl) {
          logMatch(this.id, key.key, true, { 
            source: 'legacy_trigger',
            trigger: trigger.name 
          });
          
          return successResult(key, createMatch('sprite', key.original, {
            spriteUrl: trigger.spriteUrl,
            spriteLabel: trigger.spriteState,
            returnToIdleMs: trigger.returnToIdleMs,
            triggerName: trigger.name,
            triggerId: trigger.id,
          }));
        }
      }
    }
    
    // Try sprite packs
    if (spritePacks && spritePacks.length > 0) {
      const activePacks = spritePacks.filter(p => p.active);
      
      console.log(`[SpriteKeyHandler] findLegacyMatch: Active packs`, {
        count: activePacks.length,
        names: activePacks.map(p => p.name),
      });
      
      for (const pack of activePacks) {
        const matched = pack.keywords?.some(kw => keyMatches(key.key, kw));
        console.log(`[SpriteKeyHandler] Checking pack: ${pack.name}`, {
          keywords: pack.keywords,
          keyToMatch: key.key,
          matched,
        });
        if (!matched) continue;
        
        // Find first enabled item
        const item = pack.items.find(i => i.enabled && i.spriteUrl);
        if (item) {
          logMatch(this.id, key.key, true, { 
            source: 'legacy_pack',
            pack: pack.name 
          });
          
          return successResult(key, createMatch('sprite', key.original, {
            spriteUrl: item.spriteUrl,
            spriteLabel: item.spriteLabel,
            triggerName: pack.name,
            packId: pack.id,
          }));
        }
      }
    }
    
    return null;
  }
  
  /**
   * Select sprite from pack based on behavior
   */
  private selectSprite(
    pack: SpritePackV2,
    behavior: 'principal' | 'random' | 'list',
    principalSpriteId?: string
  ): SpritePackEntryV2 | null {
    if (pack.sprites.length === 0) return null;
    
    switch (behavior) {
      case 'principal':
        if (principalSpriteId) {
          const principal = pack.sprites.find(s => s.id === principalSpriteId);
          if (principal) return principal;
        }
        return pack.sprites[0];
        
      case 'random':
        return pack.sprites[Math.floor(Math.random() * pack.sprites.length)];
        
      case 'list':
        // TODO: Track list position per collection
        return pack.sprites[0];
        
      default:
        return pack.sprites[0];
    }
  }
  
  /**
   * Check if collection cooldown is ready
   */
  private isCollectionCooldownReady(collection: TriggerCollection): boolean {
    if (!collection.cooldownMs || collection.cooldownMs <= 0) return true;
    
    const lastTriggered = this.collectionCooldowns.get(collection.id) ?? 0;
    return Date.now() - lastTriggered >= collection.cooldownMs;
  }
  
  /**
   * Schedule fallback for sprite
   */
  private scheduleFallback(
    characterId: string,
    triggerSpriteUrl: string,
    triggerSpriteLabel: string | null,
    fallbackMode: string | undefined,
    fallbackDelayMs: number,
    fallbackSpriteUrl: string | undefined,
    context: SpriteKeyHandlerContext
  ): void {
    let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'clear';
    let returnSpriteUrl = '';
    let returnSpriteLabel: string | null = null;
    
    if (fallbackMode === 'custom_sprite' && fallbackSpriteUrl) {
      returnToMode = 'idle';
      returnSpriteUrl = fallbackSpriteUrl;
      returnSpriteLabel = triggerSpriteLabel;
    } else if (fallbackMode === 'idle_collection') {
      returnToMode = 'clear';
      returnSpriteUrl = '';
      returnSpriteLabel = null;
    } else if (fallbackMode === 'collection_default') {
      returnToMode = 'idle';
      returnSpriteUrl = fallbackSpriteUrl || '';
      returnSpriteLabel = triggerSpriteLabel;
    }
    
    logHandler(this.id, 'Scheduling fallback', {
      characterId,
      fallbackMode,
      fallbackDelayMs,
      returnToMode,
    });
    
    context.scheduleReturnToIdleForCharacter?.(
      characterId,
      triggerSpriteUrl,
      returnToMode,
      returnSpriteUrl,
      returnSpriteLabel,
      fallbackDelayMs
    );
  }
}

// ============================================
// Factory Function
// ============================================

let spriteKeyHandlerInstance: SpriteKeyHandler | null = null;

export function createSpriteKeyHandler(): SpriteKeyHandler {
  if (!spriteKeyHandlerInstance) {
    spriteKeyHandlerInstance = new SpriteKeyHandler();
  }
  return spriteKeyHandlerInstance;
}

export function resetSpriteKeyHandler(): void {
  spriteKeyHandlerInstance?.cleanup();
  spriteKeyHandlerInstance = null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get idle sprite URL for a character
 */
export function getIdleSpriteUrl(character: CharacterCard | null): string | null {
  if (!character) return null;
  
  // Try V2 state collections first
  const idleCollectionV2 = character.stateCollectionsV2?.find(c => c.state === 'idle');
  if (idleCollectionV2) {
    const pack = character.spritePacksV2?.find(p => p.id === idleCollectionV2.packId);
    if (pack) {
      if (idleCollectionV2.principalSpriteId) {
        const sprite = pack.sprites.find(s => s.id === idleCollectionV2.principalSpriteId);
        if (sprite) return sprite.url;
      }
      if (pack.sprites.length > 0) {
        return pack.sprites[0].url;
      }
    }
  }
  
  // Fall back to legacy
  const idleCollection = character.spriteConfig?.stateCollections?.['idle'];
  if (idleCollection?.entries.length) {
    const entry = idleCollection.entries.find(e => e.role === 'principal') || idleCollection.entries[0];
    if (entry?.spriteUrl) return entry.spriteUrl;
  }
  
  if (character.spriteConfig?.sprites?.['idle']) {
    return character.spriteConfig.sprites['idle'];
  }
  
  if (character.avatar) {
    return character.avatar;
  }
  
  return null;
}
