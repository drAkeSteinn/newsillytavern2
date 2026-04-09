// ============================================
// Trigger Bus - Event System for Triggers
// ============================================

import type { DetectedKey } from './key-detector';
import type { DetectedToken } from './token-detector';
import type { CharacterCard } from '@/types';

// ============================================
// Context Types
// ============================================

export interface TriggerContext {
  character: CharacterCard | null;
  characters?: CharacterCard[];
  fullText: string;
  messageKey: string;
  isStreaming: boolean;
  timestamp: number;
}

// ============================================
// Event Types (NEW: Keys-based)
// ============================================

export interface KeysDetectedEvent {
  type: 'keys_detected';
  keys: DetectedKey[];
  context: TriggerContext;
}

// ============================================
// Event Types (LEGACY: Token-based)
// ============================================

export interface TokensDetectedEvent {
  type: 'tokens_detected';
  tokens: DetectedToken[];
  context: TriggerContext;
}

export interface MessageStartEvent {
  type: 'message_start';
  messageKey: string;
  character: CharacterCard | null;
}

export interface MessageEndEvent {
  type: 'message_end';
  messageKey: string;
  character: CharacterCard | null;
  fullText: string;
}

export type TriggerEvent = TokensDetectedEvent | KeysDetectedEvent | MessageStartEvent | MessageEndEvent;

// ============================================
// Event Handler Type
// ============================================

export type TriggerEventHandler = (event: TriggerEvent) => void;

// ============================================
// Trigger Bus Class
// ============================================

class TriggerBusImpl {
  private handlers: Map<string, TriggerEventHandler> = new Map();
  private enabled: boolean = true;
  private debug: boolean = false;
  
  /**
   * Register a handler
   */
  register(id: string, handler: TriggerEventHandler): () => void {
    this.handlers.set(id, handler);
    
    if (this.debug) {
      console.log(`[TriggerBus] Registered: ${id}`);
    }
    
    return () => {
      this.handlers.delete(id);
      if (this.debug) {
        console.log(`[TriggerBus] Unregistered: ${id}`);
      }
    };
  }
  
  /**
   * Emit an event to all handlers
   */
  emit(event: TriggerEvent): void {
    if (!this.enabled) return;
    
    if (this.debug && event.type === 'tokens_detected') {
      console.log(`[TriggerBus] Emitting ${event.tokens.length} tokens`);
    }
    
    for (const [id, handler] of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[TriggerBus] Handler ${id} error:`, error);
      }
    }
  }
  
  /**
   * Enable/disable the bus
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Enable debug mode
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }
  
  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

let busInstance: TriggerBusImpl | null = null;

export function getTriggerBus(): TriggerBusImpl {
  if (!busInstance) {
    busInstance = new TriggerBusImpl();
  }
  return busInstance;
}

export function resetTriggerBus(): void {
  busInstance?.clear();
  busInstance = null;
}

// ============================================
// Event Factories
// ============================================

export function createTokensEvent(
  tokens: DetectedToken[],
  context: TriggerContext
): TokensDetectedEvent {
  return {
    type: 'tokens_detected',
    tokens,
    context,
  };
}

export function createKeysEvent(
  keys: DetectedKey[],
  context: TriggerContext
): KeysDetectedEvent {
  return {
    type: 'keys_detected',
    keys,
    context,
  };
}

export function createMessageStartEvent(
  messageKey: string,
  character: CharacterCard | null
): MessageStartEvent {
  return {
    type: 'message_start',
    messageKey,
    character,
  };
}

export function createMessageEndEvent(
  messageKey: string,
  character: CharacterCard | null,
  fullText: string
): MessageEndEvent {
  return {
    type: 'message_end',
    messageKey,
    character,
    fullText,
  };
}
