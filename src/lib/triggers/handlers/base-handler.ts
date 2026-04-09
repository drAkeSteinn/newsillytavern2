// ============================================
// Base Handler - Base Class for Trigger Handlers
// ============================================
//
// This provides a unified interface for all trigger handlers.
// Each handler can detect and execute triggers using DetectedKey.
//
// Key Features:
// - Consistent interface across all handlers
// - Position-based tracking (no duplicates)
// - Immediate execution on match
// - Support for multiple keys triggering same handler

import type { DetectedKey } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type { TriggerMatch, TriggerMatchResult } from '../types';

// ============================================
// Handler Types
// ============================================

export interface HandlerConfig {
  id: string;
  type: 'sound' | 'sprite' | 'background' | 'effect' | 'quest' | 'stats' | 'hud' | 'solicitud';
  priority: number;
  enabled: boolean;
}

export interface HandlerState {
  // Positions already triggered (to avoid duplicates)
  triggeredPositions: Set<number>;
  // Keys already processed in this message
  processedKeys: Set<string>;
}

// ============================================
// Base Handler Class
// ============================================

export abstract class BaseTriggerHandler {
  protected config: HandlerConfig;
  protected state: Map<string, HandlerState> = new Map();
  
  constructor(config: HandlerConfig) {
    this.config = config;
  }
  
  // ============================================
  // Abstract Methods (must be implemented by subclasses)
  // ============================================
  
  /**
   * Get all registered keys for this handler
   * Used for word-based detection
   */
  abstract getRegisteredKeys(context: TriggerContext): string[];
  
  /**
   * Check if a detected key should trigger this handler
   * Returns match result if should trigger, null otherwise
   */
  abstract checkKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null;
  
  /**
   * Execute the trigger action immediately
   */
  abstract executeMatch(match: TriggerMatch, context: TriggerContext): void;
  
  // ============================================
  // Common Methods (provided by base class)
  // ============================================
  
  /**
   * Get handler ID
   */
  get id(): string {
    return this.config.id;
  }
  
  /**
   * Get handler type
   */
  get type(): string {
    return this.config.type;
  }
  
  /**
   * Get handler priority
   */
  get priority(): number {
    return this.config.priority;
  }
  
  /**
   * Check if handler is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Process a detected key
   * Returns true if the key was processed (matched and executed)
   */
  processKey(key: DetectedKey, context: TriggerContext): boolean {
    // Get or create state for this message
    const state = this.getState(context.messageKey);
    
    // Check if already processed this position
    if (state.triggeredPositions.has(key.position)) {
      return false;
    }
    
    // Check if this key should trigger
    const result = this.checkKey(key, context);
    if (!result || !result.matched) {
      return false;
    }
    
    // Mark as triggered
    state.triggeredPositions.add(key.position);
    state.processedKeys.add(key.key);
    
    // Execute immediately
    this.executeMatch(result.trigger, context);
    
    return true;
  }
  
  /**
   * Process multiple keys in batch
   * Returns array of matched triggers
   */
  processKeys(keys: DetectedKey[], context: TriggerContext): TriggerMatch[] {
    const matches: TriggerMatch[] = [];
    
    for (const key of keys) {
      const state = this.getState(context.messageKey);
      
      // Skip if already processed
      if (state.triggeredPositions.has(key.position)) {
        continue;
      }
      
      // Check if should trigger
      const result = this.checkKey(key, context);
      if (result && result.matched) {
        // Mark as triggered
        state.triggeredPositions.add(key.position);
        state.processedKeys.add(key.key);
        
        // Execute immediately
        this.executeMatch(result.trigger, context);
        
        matches.push(result.trigger);
      }
    }
    
    return matches;
  }
  
  /**
   * Get or create state for a message
   */
  protected getState(messageKey: string): HandlerState {
    let state = this.state.get(messageKey);
    if (!state) {
      state = {
        triggeredPositions: new Set(),
        processedKeys: new Set(),
      };
      this.state.set(messageKey, state);
    }
    return state;
  }
  
  /**
   * Reset state for a new message
   */
  reset(messageKey: string): void {
    this.state.delete(messageKey);
  }
  
  /**
   * Clear all state
   */
  clearAll(): void {
    this.state.clear();
  }
  
  /**
   * Check if a position has already been triggered
   */
  protected isPositionTriggered(messageKey: string, position: number): boolean {
    const state = this.state.get(messageKey);
    return state?.triggeredPositions.has(position) ?? false;
  }
  
  /**
   * Check if a key has already been processed
   */
  protected isKeyProcessed(messageKey: string, key: string): boolean {
    const state = this.state.get(messageKey);
    return state?.processedKeys.has(key) ?? false;
  }
  
  /**
   * Mark a position as triggered
   */
  protected markPositionTriggered(messageKey: string, position: number): void {
    const state = this.getState(messageKey);
    state.triggeredPositions.add(position);
  }
  
  /**
   * Mark a key as processed
   */
  protected markKeyProcessed(messageKey: string, key: string): void {
    const state = this.getState(messageKey);
    state.processedKeys.add(key);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize a key for comparison
 * (delegates to key-detector's normalizeKey)
 */
export function normalizeHandlerKey(key: string): string {
  // Simple normalization for handler use
  if (!key) return '';
  
  let result = key.trim().toLowerCase();
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  result = result.replace(/[^a-z0-9_-]/g, '');
  
  return result;
}

/**
 * Check if a detected key matches a registered trigger key
 */
export function detectedKeyMatchesTrigger(
  detectedKey: DetectedKey,
  triggerKey: string,
  options: { caseSensitive?: boolean; exactMatch?: boolean } = {}
): boolean {
  const { caseSensitive = false, exactMatch = true } = options;
  
  const normalizedDetected = caseSensitive 
    ? detectedKey.key 
    : detectedKey.key.toLowerCase();
  
  const normalizedTrigger = caseSensitive 
    ? triggerKey 
    : normalizeHandlerKey(triggerKey);
  
  if (exactMatch) {
    return normalizedDetected === normalizedTrigger;
  }
  
  // Partial match (detected contains trigger or vice versa)
  return normalizedDetected.includes(normalizedTrigger) || 
         normalizedTrigger.includes(normalizedDetected);
}

/**
 * Get all variations of a key (main key + alternatives)
 */
export function getKeyVariations(
  mainKey?: string,
  alternativeKeys?: string[],
  legacyKeywords?: string[]
): string[] {
  const variations: string[] = [];
  
  // Main key
  if (mainKey) {
    variations.push(mainKey);
  }
  
  // Alternative keys
  if (alternativeKeys && alternativeKeys.length > 0) {
    for (const key of alternativeKeys) {
      if (key && !variations.includes(key)) {
        variations.push(key);
      }
    }
  }
  
  // Legacy keywords (only if no new keys)
  if (variations.length === 0 && legacyKeywords && legacyKeywords.length > 0) {
    for (const kw of legacyKeywords) {
      if (kw && !variations.includes(kw)) {
        variations.push(kw);
      }
    }
  }
  
  return variations;
}
