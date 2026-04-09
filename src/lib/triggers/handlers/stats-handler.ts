// ============================================
// Stats Handler - Handles Stats Updates Post-LLM
// ============================================
//
// @deprecated Use StatsKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new StatsKeyHandler provides:
// - Unified KeyHandler interface
// - Operator support (+N, -N, =N)
// - Per-character detection state for group chat
// - Min/max value constraints
//
// Migration: Use createStatsKeyHandler() from './stats-key-handler'
//
// This handler detects stat changes in LLM responses
// using detection keys defined in CharacterStatsConfig.attributes
//
// Uses the same system as HUD fields:
// - key: Primary detection key (always checked first)
// - keys: Alternative detection keys (optional)
// - caseSensitive: Whether to distinguish case

import type { TriggerMatch } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type {
  CharacterStatsConfig,
  SessionStats,
  StatsTriggerHit,
  CharacterCard,
} from '@/types';
import {
  detectStatsUpdates,
  createStatsDetectionState,
  type StatsDetectionState,
  type AttributeDetection,
  type StatsDetectionResult,
} from '@/lib/stats/stats-detector';

// ============================================
// Stats Handler State
// ============================================

export interface StatsHandlerState {
  detectionStates: Map<string, StatsDetectionState>;
  processedMessages: Set<string>;
}

export function createStatsHandlerState(): StatsHandlerState {
  return {
    detectionStates: new Map(),
    processedMessages: new Set(),
  };
}

// ============================================
// Stats Trigger Context
// ============================================

export interface StatsTriggerContext extends TriggerContext {
  characterId: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
}

export interface StatsHandlerResult {
  matched: boolean;
  trigger: TriggerMatch | null;
  detections: AttributeDetection[];
}

// ============================================
// Stats Handler Functions
// ============================================

/**
 * Check stats triggers during streaming or at message end
 *
 * This function processes the text to find stat update patterns
 * and returns trigger matches for the trigger system.
 */
export function checkStatsTriggersInText(
  text: string,
  context: StatsTriggerContext,
  state: StatsHandlerState
): StatsHandlerResult {
  const { characterId, statsConfig, sessionStats, messageKey } = context;

  const result: StatsHandlerResult = {
    matched: false,
    trigger: null,
    detections: [],
  };

  // Check if stats system is enabled
  if (!statsConfig?.enabled) {
    return result;
  }

  // Get or create detection state for this character
  let detectionState = state.detectionStates.get(characterId);
  if (!detectionState) {
    detectionState = createStatsDetectionState();
    state.detectionStates.set(characterId, detectionState);
  }

  // Get current values for this character
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;

  // Process text for new detections
  const newDetections = detectionState.processNewText(
    text,
    text,
    statsConfig.attributes,
    currentValues
  );

  if (newDetections.length === 0) {
    return result;
  }

  // Return first detection as trigger (like HUD handler)
  const firstDetection = newDetections[0];

  result.trigger = {
    triggerId: `stats_${firstDetection.attributeId}`,
    triggerType: 'stats',
    keyword: firstDetection.attributeKey,
    data: {
      characterId,
      attributeId: firstDetection.attributeId,
      attributeKey: firstDetection.attributeKey,
      attributeName: firstDetection.attributeName,
      oldValue: firstDetection.oldValue,
      newValue: firstDetection.newValue,
      matchedPattern: firstDetection.matchedPattern,
      matchedText: firstDetection.matchedText,
      allDetections: newDetections, // Include all detections for batch processing
    },
  };
  result.detections = newDetections;
  result.matched = true;

  return result;
}

/**
 * Execute stats trigger - Update the stat value in store
 *
 * This should be called by the trigger system when a stats match is found.
 * The actual store update should be done via the statsSlice actions.
 */
export function executeStatsTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
    activeSessionId: string | null;
  }
): StatsTriggerHit[] {
  const data = match.data as {
    characterId: string;
    attributeId: string;
    attributeKey: string;
    attributeName: string;
    oldValue: number | string | null;
    newValue: number | string;
    matchedPattern: string;
    matchedText: string;
    allDetections?: AttributeDetection[];
  };

  const hits: StatsTriggerHit[] = [];
  const sessionId = storeActions?.activeSessionId;

  if (!sessionId || !storeActions) {
    return hits;
  }

  // Process all detections (batch update)
  const detections = data.allDetections || [data];

  for (const detection of detections) {
    storeActions.updateCharacterStat(
      sessionId,
      detection.characterId || data.characterId,
      detection.attributeKey,
      detection.newValue,
      'llm_detection'
    );

    hits.push({
      characterId: detection.characterId || data.characterId,
      attributeId: detection.attributeId,
      attributeKey: detection.attributeKey,
      attributeName: detection.attributeName,
      oldValue: detection.oldValue,
      newValue: detection.newValue,
      matchedPattern: detection.matchedPattern,
      matchedText: detection.matchedText,
    });
  }

  return hits;
}

/**
 * Reset state for new message
 * 
 * If characterId is empty, resets ALL detection states (for safety).
 * This ensures that stale state doesn't affect new messages.
 */
export function resetStatsHandlerState(
  state: StatsHandlerState,
  characterId: string,
  messageKey: string
): void {
  if (!characterId) {
    // No specific character - reset ALL states to be safe
    for (const detectionState of state.detectionStates.values()) {
      detectionState.reset();
    }
  } else {
    // Reset specific character's state
    const detectionState = state.detectionStates.get(characterId);
    if (detectionState) {
      detectionState.reset();
    }
  }
  state.processedMessages.delete(messageKey);
}

/**
 * Clear all detection states (e.g., when changing sessions)
 */
export function clearStatsHandlerState(state: StatsHandlerState): void {
  state.detectionStates.clear();
  state.processedMessages.clear();
}

// ============================================
// Full Text Detection (Non-Streaming)
// ============================================

/**
 * Detect stats updates in complete text (non-streaming mode)
 *
 * Use this when processing a complete message after streaming ends.
 */
export function detectStatsInFullText(
  text: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined
): StatsDetectionResult {
  return detectStatsUpdates(text, characterId, statsConfig, sessionStats);
}

// ============================================
// Batch Processing for Group Chats
// ============================================

/**
 * Process stats for multiple characters (group chat)
 *
 * In a group chat, each character may have different stats.
 * This function processes all characters' stats in one pass.
 */
export function processGroupStats(
  text: string,
  characters: Array<{
    id: string;
    statsConfig?: CharacterStatsConfig;
  }>,
  sessionStats: SessionStats | undefined,
  state: StatsHandlerState
): Map<string, StatsHandlerResult> {
  const results = new Map<string, StatsHandlerResult>();

  for (const char of characters) {
    if (!char.statsConfig?.enabled) continue;

    const context: StatsTriggerContext = {
      characterId: char.id,
      character: null,
      fullText: text,
      isStreaming: false,
      messageKey: `group_${Date.now()}`,
      timestamp: Date.now(),
      statsConfig: char.statsConfig,
      sessionStats,
    };

    const result = checkStatsTriggersInText(text, context, state);
    if (result.matched) {
      results.set(char.id, result);
    }
  }

  return results;
}

/**
 * Execute all stats triggers from a result
 */
export function executeAllStatsTriggers(
  result: StatsHandlerResult,
  context: TriggerContext,
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
    activeSessionId: string | null;
  }
): StatsTriggerHit[] {
  if (!result.matched || !result.trigger) return [];

  return executeStatsTrigger(result.trigger, context, storeActions);
}
