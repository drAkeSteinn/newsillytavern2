// ============================================
// Trigger Types - Common Types for All Triggers
// ============================================

import type { DetectedKey, KeyFormat, KeyCategory, ValueOperator, KeyValueInfo } from './key-detector';
import type { TriggerContext } from './trigger-bus';

// Re-export key detector types
export type { DetectedKey, KeyFormat, KeyCategory, ValueOperator, KeyValueInfo } from './key-detector';

// ============================================
// Trigger Match Types
// ============================================

export type TriggerType = 'sound' | 'sprite' | 'background' | 'effect' | 'quest' | 'stats' | 'hud' | 'solicitud' | 'skill' | 'item' | 'atmosphere';

export interface TriggerMatch {
  triggerId: string;
  triggerType: TriggerType;
  keyword: string;
  data: Record<string, unknown>;
  
  // Execution metadata
  executed?: boolean;
  timestamp?: number;
}

export type TriggerMatchResult = 
  | { matched: true; trigger: TriggerMatch; key: DetectedKey }
  | { matched: false };

// ============================================
// Registered Key Interface
// ============================================

/**
 * Information about a registered trigger key
 * Used by handlers to declare what keys they can process
 */
export interface RegisteredKey {
  /** The key string (will be normalized for matching) */
  key: string;
  
  /** Original key before normalization */
  original?: string;
  
  /** Whether matching should be case sensitive */
  caseSensitive?: boolean;
  
  /** Whether this key requires a value */
  requireValue?: boolean;
  
  /** Allowed value types */
  valueTypes?: ('string' | 'number' | 'boolean')[];
  
  /** Category hint for this key */
  category?: KeyCategory;
  
  /** Additional configuration for this key */
  config?: Record<string, unknown>;
}

// ============================================
// Key Handler Interface (Unified)
// ============================================

/**
 * Unified interface for all key handlers
 * 
 * Each handler:
 * 1. Receives DetectedKey[] from the unified KeyDetector
 * 2. Decides if the key belongs to it via canHandle()
 * 3. Processes the key via handleKey()
 * 4. Returns results for execution
 * 
 * Lifecycle:
 * 1. Handler is created with createXxxKeyHandler()
 * 2. Handler is registered with HandlerRegistry
 * 3. Keys are detected by KeyDetector
 * 4. For each key: canHandle() → handleKey() → execute()
 * 5. On message end: reset()
 * 6. On handler removal: cleanup()
 */
export interface KeyHandler {
  /** Unique handler identifier */
  id: string;
  
  /** Handler type for categorization */
  type: TriggerType;
  
  /** Priority for handler ordering (higher = processed first) */
  priority: number;
  
  /**
   * Check if this handler should process a detected key
   * Returns true if the key matches this handler's domain
   * 
   * This should be a fast check - don't do heavy processing here
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean;
  
  /**
   * Process a key and return match result
   * Called only if canHandle() returned true
   * 
   * This is where the handler determines if the key actually matches
   * a registered trigger and returns the trigger data
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null;
  
  /**
   * Execute the trigger action immediately
   * Called after handleKey() returns a match
   * 
   * This is where side effects happen (play sound, change sprite, etc.)
   */
  execute(match: TriggerMatch, context: TriggerContext): void;
  
  /**
   * Batch process multiple keys (optional, for efficiency)
   * Default implementation calls handleKey() for each
   * 
   * Override this if you need to process multiple keys together
   * (e.g., for combo triggers or optimized execution)
   */
  handleKeys?(keys: DetectedKey[], context: TriggerContext): TriggerMatch[];
  
  /**
   * Get all registered keys for this handler
   * Used for word-based detection optimization
   * 
   * Returns the list of keys this handler can process,
   * which will be used for fast word matching
   */
  getRegisteredKeys?(context: TriggerContext): RegisteredKey[];
  
  /**
   * Check if a key should be consumed after processing
   * If true, other handlers won't see this key
   * Default: true for most handlers
   */
  consumesKey?(key: DetectedKey): boolean;
  
  /**
   * Get cooldown status for a key
   * Returns remaining cooldown time in ms, or 0 if ready
   */
  getCooldown?(key: DetectedKey): number;
  
  /**
   * Reset state for new message
   * Called at the start of each new message
   */
  reset?(messageKey: string): void;
  
  /**
   * Cleanup when handler is removed
   * Called when the handler is unregistered
   */
  cleanup?(): void;
}

// ============================================
// Handler Base Class (Optional Helper)
// ============================================

/**
 * Base class for KeyHandler implementations
 * Provides common functionality and default implementations
 */
export abstract class BaseKeyHandler implements KeyHandler {
  abstract id: string;
  abstract type: TriggerType;
  abstract priority: number;
  
  abstract canHandle(key: DetectedKey, context: TriggerContext): boolean;
  abstract handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null;
  abstract execute(match: TriggerMatch, context: TriggerContext): void;
  
  /**
   * Default batch implementation - processes keys one by one
   */
  handleKeys(keys: DetectedKey[], context: TriggerContext): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    
    for (const key of keys) {
      if (this.canHandle(key, context)) {
        const result = this.handleKey(key, context);
        if (result?.matched) {
          matches.push(result.trigger);
          this.execute(result.trigger, context);
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Default: handler consumes all keys it processes
   */
  consumesKey(_key: DetectedKey): boolean {
    return true;
  }
  
  /**
   * Default: no cooldown
   */
  getCooldown(_key: DetectedKey): number {
    return 0;
  }
  
  /**
   * Default: no registered keys (handler relies on canHandle logic)
   */
  getRegisteredKeys(_context: TriggerContext): RegisteredKey[] {
    return [];
  }
  
  /**
   * Default: no state to reset
   */
  reset(_messageKey: string): void {
    // Override in subclass if needed
  }
  
  /**
   * Default: no cleanup needed
   */
  cleanup(): void {
    // Override in subclass if needed
  }
}

// ============================================
// Handler Result Types
// ============================================

export interface HandlerProcessResult {
  handlerId: string;
  handlerType: TriggerType;
  matched: boolean;
  matches: TriggerMatch[];
  keysProcessed: number;
  keysConsumed: number;
}

export interface BatchProcessResult {
  totalKeys: number;
  processedKeys: number;
  handlerResults: Map<string, HandlerProcessResult>;
  allMatches: TriggerMatch[];
  executionTime: number;
}

// ============================================
// Cooldown Types
// ============================================

export interface CooldownConfig {
  global: number;
  perTrigger: number;
}

export interface CooldownState {
  lastGlobalTrigger: number;
  lastTriggerTimes: Map<string, number>;
}

// ============================================
// Handler Context Types
// ============================================

/**
 * Base context for all trigger handlers
 * Extended by specific handler contexts
 */
export interface HandlerContext extends TriggerContext {
  /** Session ID if available */
  sessionId?: string;
  
  /** Character ID that generated the content */
  characterId?: string;
  
  /** Character name for logging/messages */
  characterName?: string;
  
  /** All characters in the current context (for group chats) */
  allCharacters?: Array<{ id: string; name: string }>;
  
  /** Active persona if available */
  activePersona?: { id: string; name: string } | null;
}

/**
 * Sound handler specific context
 */
export interface SoundHandlerContext extends HandlerContext {
  soundTriggers: Array<{
    id: string;
    name: string;
    keywords: string[];
    collection: string;
    active: boolean;
    volume?: number;
    playMode?: 'random' | 'cycle' | 'sequence';
    cooldown?: number;
  }>;
  soundCollections: Array<{
    name: string;
    path: string;
    files: string[];
  }>;
  soundSettings: {
    enabled: boolean;
    globalVolume: number;
    globalCooldown?: number;
  };
}

/**
 * Sprite handler specific context
 */
export interface SpriteHandlerContext extends HandlerContext {
  triggerCollections: Array<{
    id: string;
    name: string;
    packId: string;
    collectionKey?: string;
    activationKeys?: string[];
    active: boolean;
    priority: number;
    principalSpriteId?: string;
    sprites: Array<{ id: string; url: string; label?: string }>;
  }>;
  spritePacksV2: Array<{
    id: string;
    name: string;
    sprites: Array<{ id: string; url: string; label?: string }>;
  }>;
  spriteConfig?: {
    sprites?: Record<string, string>;
    stateCollections?: Record<string, { entries: Array<{ spriteUrl: string; spriteLabel?: string }> }>;
  };
  isSpriteLocked?: boolean;
}

/**
 * Background handler specific context
 */
export interface BackgroundHandlerContext extends HandlerContext {
  backgroundPacks: Array<{
    id: string;
    name: string;
    active: boolean;
    priority?: number;
    items: Array<{
      id: string;
      backgroundName: string;
      backgroundUrl: string;
      triggerKeys: string[];
      enabled: boolean;
      overlays?: Array<{ url: string; opacity?: number }>;
    }>;
  }>;
  backgroundSettings: {
    enabled: boolean;
    transitionDuration: number;
    defaultTransitionType: 'fade' | 'slide' | 'zoom' | 'none';
    globalCooldown?: number;
  };
}

/**
 * Quest handler specific context
 */
export interface QuestHandlerContext extends HandlerContext {
  questTemplates: Array<{
    id: string;
    name: string;
    description?: string;
    activation: {
      method: 'keyword' | 'auto' | 'manual';
      key?: string;
      keys?: string[];
    };
    objectives: Array<{
      id: string;
      description: string;
      completion: {
        key: string;
        keys?: string[];
      };
    }>;
    completion: {
      key?: string;
      keys?: string[];
    };
  }>;
  sessionQuests: Array<{
    templateId: string;
    status: 'available' | 'active' | 'completed' | 'failed';
    objectives: Array<{
      templateId: string;
      isCompleted: boolean;
      currentCount?: number;
    }>;
  }>;
  questSettings: {
    enabled: boolean;
    autoDetect: boolean;
  };
}

/**
 * Stats handler specific context
 */
export interface StatsHandlerContext extends HandlerContext {
  statsConfig?: {
    enabled: boolean;
    attributes: Array<{
      id: string;
      name: string;
      key: string;
      detectionKeys?: string[];
      minValue?: number;
      maxValue?: number;
      defaultValue?: number;
    }>;
  };
  sessionStats?: {
    characterStats?: Record<string, Record<string, number | string>>;
  };
}

/**
 * Skill handler specific context
 */
export interface SkillHandlerContext extends HandlerContext {
  skills?: Array<{
    id: string;
    name: string;
    activationKey?: string;
    activationKeys?: string[];
    enabled: boolean;
  }>;
  skillsConfig?: {
    enabled: boolean;
  };
}

/**
 * Solicitud handler specific context
 */
export interface SolicitudHandlerContext extends HandlerContext {
  invitations?: Array<{
    peticionKey: string;
    objetivo: string;
    description?: string;
    requirements?: Array<{ attributeKey: string; operator: string; value: number | string }>;
  }>;
  solicitudes?: Record<string, Array<{
    id: string;
    status: 'pending' | 'completed';
    solicitudKey: string;
    fromCharacterId: string;
    fromCharacterName: string;
  }>>;
}

// ============================================
// Legacy Types (for backward compatibility during migration)
// ============================================

import type { DetectedToken } from './token-detector';

/**
 * @deprecated Use TriggerMatchResult instead
 */
export type LegacyTriggerMatchResult = 
  | { matched: true; trigger: TriggerMatch; tokens: DetectedToken[] }
  | { matched: false };

/**
 * @deprecated Use KeyHandler instead
 */
export interface LegacyTriggerHandler {
  id: string;
  type: string;
  priority: number;
  checkTrigger(
    tokens: DetectedToken[],
    context: TriggerContext,
    alreadyTriggered: Set<string>
  ): LegacyTriggerMatchResult | null;
  executeTrigger(match: TriggerMatch, context: TriggerContext): void;
  reset?(messageKey: string): void;
  cleanup?(): void;
}
