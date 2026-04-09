// ============================================
// Stats Key Handler - Unified Stats Update System
// ============================================
//
// Handles stat/attribute updates with operators
// Supports: +N (add), -N (subtract), =N (set)
//
// Key formats:
// - stat:value (e.g., "health:50" sets health to 50)
// - stat:+N (e.g., "health:+10" adds 10 to health)
// - stat:-N (e.g., "health:-5" subtracts 5 from health)
// - [stat:value], [stat+N], [stat-N]

import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { DetectedKey, ValueOperator } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type { CharacterStatsConfig, SessionStats } from '@/types';
import {
  detectStatsUpdates,
  createStatsDetectionState,
  type StatsDetectionState,
  type AttributeDetection,
} from '@/lib/stats/stats-detector';

// ============================================
// Stats Key Handler Context
// ============================================

export interface StatsKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  characterName?: string;
  statsConfig?: CharacterStatsConfig;
  sessionStats?: SessionStats;
  
  // Store actions
  updateCharacterStat?: (
    sessionId: string,
    characterId: string,
    attributeKey: string,
    value: number | string,
    reason?: 'llm_detection' | 'manual' | 'trigger'
  ) => void;
}

// ============================================
// Stats Key Handler Implementation
// ============================================

export class StatsKeyHandler implements KeyHandler {
  id = 'stats-key-handler';
  type = 'stats' as const;
  priority = 50; // After quest, before item
  
  // Detection states per character
  private detectionStates: Map<string, StatsDetectionState> = new Map();
  
  // Track processed messages
  private processedMessages: Set<string> = new Set();

  canHandle(key: DetectedKey, context: StatsKeyHandlerContext): boolean {
    // Check if stats system is enabled
    if (!context.statsConfig?.enabled) {
      return false;
    }
    
    const normalizedKey = key.key.toLowerCase();
    
    // Check if key matches any attribute detection key
    for (const attr of context.statsConfig.attributes) {
      const detectionKeys = [
        attr.key,
        ...(attr.detectionKeys || [])
      ].filter(Boolean);
      
      if (detectionKeys.some(k => k.toLowerCase() === normalizedKey)) {
        return true;
      }
    }
    
    return false;
  }

  handleKey(key: DetectedKey, context: StatsKeyHandlerContext): TriggerMatchResult | null {
    const { statsConfig, sessionStats, characterId, messageKey } = context;
    
    if (!statsConfig?.enabled || !characterId) {
      return { matched: false };
    }
    
    // Get or create detection state for this character
    let detectionState = this.detectionStates.get(characterId);
    if (!detectionState) {
      detectionState = createStatsDetectionState();
      this.detectionStates.set(characterId, detectionState);
    }
    
    // Get current values for this character
    const charStats = sessionStats?.characterStats?.[characterId];
    const currentValues = charStats?.attributeValues;
    
    // Find matching attribute
    const normalizedKey = key.key.toLowerCase();
    let matchedAttr: typeof statsConfig.attributes[0] | null = null;
    
    for (const attr of statsConfig.attributes) {
      const detectionKeys = [
        attr.key,
        ...(attr.detectionKeys || [])
      ].filter(Boolean);
      
      if (detectionKeys.some(k => k.toLowerCase() === normalizedKey)) {
        matchedAttr = attr;
        break;
      }
    }
    
    if (!matchedAttr) {
      return { matched: false };
    }
    
    // Parse value and operator
    let newValue: number | string;
    let operator: ValueOperator = 'set';
    const oldValue = currentValues?.[matchedAttr.key] ?? matchedAttr.defaultValue ?? 0;
    
    if (key.value) {
      // Check for operator prefix
      const valueStr = key.value.toString();
      
      if (valueStr.startsWith('+')) {
        operator = 'add';
        const parsed = parseFloat(valueStr.slice(1));
        newValue = typeof oldValue === 'number' ? oldValue + parsed : parsed;
      } else if (valueStr.startsWith('-')) {
        operator = 'subtract';
        const parsed = parseFloat(valueStr.slice(1));
        newValue = typeof oldValue === 'number' ? oldValue - parsed : -parsed;
      } else if (valueStr.startsWith('=')) {
        operator = 'set';
        newValue = parseFloat(valueStr.slice(1)) || valueStr.slice(1);
      } else {
        // Default: set value
        const parsed = parseFloat(valueStr);
        newValue = isNaN(parsed) ? valueStr : parsed;
      }
    } else {
      // No value provided - default to increment by 1
      newValue = typeof oldValue === 'number' ? oldValue + 1 : 1;
      operator = 'add';
    }
    
    // Apply min/max constraints for numeric values
    if (typeof newValue === 'number') {
      if (matchedAttr.min !== undefined) {
        newValue = Math.max(matchedAttr.min, newValue);
      }
      if (matchedAttr.max !== undefined) {
        newValue = Math.min(matchedAttr.max, newValue);
      }
    }
    
    return {
      matched: true,
      trigger: {
        triggerId: `stats_${matchedAttr.id}`,
        triggerType: 'stats',
        keyword: key.original || key.key,
        data: {
          characterId,
          attributeId: matchedAttr.id,
          attributeKey: matchedAttr.key,
          attributeName: matchedAttr.name,
          oldValue,
          newValue,
          operator,
          matchedPattern: `${key.key}${key.value ? ':' + key.value : ''}`,
        },
      },
      key,
    };
  }

  execute(match: TriggerMatch, context: StatsKeyHandlerContext): void {
    const { sessionId, characterId, updateCharacterStat } = context;
    const data = match.data as {
      characterId: string;
      attributeKey: string;
      newValue: number | string;
    };
    
    if (!sessionId || !updateCharacterStat) {
      console.warn('[StatsKeyHandler] No sessionId or updateCharacterStat, cannot update stat');
      return;
    }
    
    console.log(`[StatsKeyHandler] Updating stat ${data.attributeKey} to ${data.newValue} for character ${data.characterId}`);
    
    updateCharacterStat(
      sessionId,
      data.characterId,
      data.attributeKey,
      data.newValue,
      'llm_detection'
    );
  }

  getRegisteredKeys(context: StatsKeyHandlerContext): RegisteredKey[] {
    const keys: RegisteredKey[] = [];
    
    if (!context.statsConfig?.enabled) {
      return keys;
    }
    
    for (const attr of context.statsConfig.attributes) {
      const detectionKeys = [
        attr.key,
        ...(attr.detectionKeys || [])
      ].filter(Boolean);
      
      for (const key of detectionKeys) {
        keys.push({
          key,
          category: 'stats',
          requireValue: false, // Can work with or without value
          valueTypes: ['number', 'string'],
          config: {
            attributeId: attr.id,
            attributeKey: attr.key,
            min: attr.min,
            max: attr.max,
          },
        });
      }
    }
    
    return keys;
  }

  reset(messageKey: string): void {
    // Reset detection states for all characters
    for (const state of this.detectionStates.values()) {
      state.reset();
    }
    this.processedMessages.delete(messageKey);
  }

  cleanup(): void {
    this.detectionStates.clear();
    this.processedMessages.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createStatsKeyHandler(): StatsKeyHandler {
  return new StatsKeyHandler();
}
