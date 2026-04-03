// ============================================
// Handler Registry - Unified Handler Orchestration
// ============================================
//
// This module provides a unified registry for all key handlers.
// Each handler implements the KeyHandler interface and processes
// DetectedKey[] from the unified KeyDetector.
//
// Flow:
// 1. KeyDetector detects keys in text
// 2. HandlerRegistry processes keys through all registered handlers
// 3. Each handler decides if the key belongs to it via canHandle()
// 4. Handlers execute triggers immediately

import type { DetectedKey, KeyCategory } from '../key-detector';
import type { KeyHandler, TriggerMatch, HandlerProcessResult } from '../types';
import type { TriggerContext } from '../trigger-bus';

// ============================================
// Registry Types
// ============================================

export interface HandlerRegistryConfig {
  debug?: boolean;
  /** Maximum time to spend processing handlers per chunk (ms) */
  maxProcessingTime?: number;
}

export interface HandlerRegistryResult {
  totalKeys: number;
  processedKeys: number;
  handlerResults: Map<string, HandlerProcessResult>;
  allMatches: TriggerMatch[];
}

// ============================================
// Handler Registry Class
// ============================================

class HandlerRegistryImpl {
  private handlers: Map<string, KeyHandler> = new Map();
  private handlerOrder: string[] = [];
  private debug: boolean = false;
  
  /**
   * Register a handler
   * Handlers are sorted by priority (higher = processed first)
   */
  register(handler: KeyHandler): () => void {
    this.handlers.set(handler.id, handler);
    
    // Re-sort handlers by priority
    this.handlerOrder = Array.from(this.handlers.values())
      .sort((a, b) => b.priority - a.priority)
      .map(h => h.id);
    
    if (this.debug) {
      console.log(`[HandlerRegistry] Registered: ${handler.id} (priority: ${handler.priority})`);
    }
    
    return () => {
      this.handlers.delete(handler.id);
      this.handlerOrder = this.handlerOrder.filter(id => id !== handler.id);
      handler.cleanup?.();
      
      if (this.debug) {
        console.log(`[HandlerRegistry] Unregistered: ${handler.id}`);
      }
    };
  }
  
  /**
   * Process keys through all registered handlers
   * Each handler gets a chance to process keys that belong to it
   */
  processKeys(
    keys: DetectedKey[],
    context: TriggerContext
  ): HandlerRegistryResult {
    const result: HandlerRegistryResult = {
      totalKeys: keys.length,
      processedKeys: 0,
      handlerResults: new Map(),
      allMatches: [],
    };
    
    if (keys.length === 0) {
      return result;
    }
    
    // Track which keys have been consumed
    const consumedKeys = new Set<string>();
    
    // Process each handler in priority order
    for (const handlerId of this.handlerOrder) {
      const handler = this.handlers.get(handlerId);
      if (!handler) continue;
      
      const handlerResult: HandlerProcessResult = {
        handlerId,
        matched: false,
        matches: [],
      };
      
      // Process each key
      for (const key of keys) {
        // Create unique key identifier
        const keyId = `${key.position}:${key.key}`;
        
        // Skip if already consumed by higher-priority handler
        // (unless handler wants to see all keys)
        if (consumedKeys.has(keyId) && handler.type !== 'stats') {
          continue;
        }
        
        // Check if this handler should process this key
        if (!handler.canHandle(key, context)) {
          continue;
        }
        
        // Process the key
        const matchResult = handler.handleKey(key, context);
        if (matchResult?.matched) {
          handlerResult.matched = true;
          handlerResult.matches.push(matchResult.trigger);
          result.allMatches.push(matchResult.trigger);
          
          // Execute immediately
          handler.execute(matchResult.trigger, context);
          
          // Mark as consumed (most handlers consume keys)
          // Stats handler is special - it doesn't consume keys
          if (handler.type !== 'stats') {
            consumedKeys.add(keyId);
          }
          
          result.processedKeys++;
        }
      }
      
      result.handlerResults.set(handlerId, handlerResult);
    }
    
    return result;
  }
  
  /**
   * Get all registered keys from all handlers
   * Used for word-based detection optimization
   */
  getAllRegisteredKeys(context: TriggerContext): string[] {
    const allKeys: string[] = [];
    
    for (const handler of this.handlers.values()) {
      if (handler.getRegisteredKeys) {
        allKeys.push(...handler.getRegisteredKeys(context));
      }
    }
    
    return [...new Set(allKeys)]; // Deduplicate
  }
  
  /**
   * Reset all handlers for a new message
   */
  resetAll(messageKey: string): void {
    for (const handler of this.handlers.values()) {
      handler.reset?.(messageKey);
    }
    
    if (this.debug) {
      console.log(`[HandlerRegistry] Reset all handlers for message: ${messageKey}`);
    }
  }
  
  /**
   * Clear all handlers
   */
  clearAll(): void {
    for (const handler of this.handlers.values()) {
      handler.cleanup?.();
    }
    this.handlers.clear();
    this.handlerOrder = [];
  }
  
  /**
   * Enable debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }
  
  /**
   * Get handler by ID
   */
  getHandler(id: string): KeyHandler | undefined {
    return this.handlers.get(id);
  }
  
  /**
   * Get all handlers
   */
  getHandlers(): KeyHandler[] {
    return Array.from(this.handlers.values());
  }
}

// ============================================
// Singleton Instance
// ============================================

let registryInstance: HandlerRegistryImpl | null = null;

export function getHandlerRegistry(): HandlerRegistryImpl {
  if (!registryInstance) {
    registryInstance = new HandlerRegistryImpl();
  }
  return registryInstance;
}

export function resetHandlerRegistry(): void {
  registryInstance?.clearAll();
  registryInstance = null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Categorize detected keys by likely handler type
 * This is a hint - handlers should do their own classification
 */
export function categorizeKeys(keys: DetectedKey[]): Map<KeyCategory, DetectedKey[]> {
  const categorized = new Map<KeyCategory, DetectedKey[]>();
  
  for (const key of keys) {
    // Import classifyKey from key-detector
    // For now, default to 'unknown'
    const category: KeyCategory = 'unknown';
    
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(key);
  }
  
  return categorized;
}

/**
 * Log detected keys for debugging
 */
export function logDetectedKeys(keys: DetectedKey[], context: TriggerContext): void {
  if (keys.length === 0) return;
  
  console.log(`[HandlerRegistry] Detected ${keys.length} keys:`, {
    messageKey: context.messageKey,
    keys: keys.map(k => ({
      key: k.key,
      format: k.format,
      position: k.position,
      value: k.value,
      prefix: k.prefix,
    })),
  });
}
