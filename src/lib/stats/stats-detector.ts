// ============================================
// Stats Detector - Post-LLM detection of stat changes
// ============================================
//
// This module detects stat changes in LLM responses using
// detection keys defined in CharacterStatsConfig.attributes
//
// Uses the same system as HUD fields:
// - key: Primary detection key (always checked first)
// - keys: Alternative detection keys (optional)
// - caseSensitive: Whether to distinguish case
//
// For example, if an attribute has:
//   key: "vida"
//   keys: ["HP:", "hp:", "❤️"]
//   caseSensitive: false
//
// And the LLM response contains any of:
//   "...Vida: 35..." or "...HP: 35..." or "...hp: 35..."
//
// It will detect the change from current value to 35

import type {
  CharacterStatsConfig,
  AttributeDefinition,
  SessionStats,
  StatsTriggerHit,
  CharacterCard,
} from '@/types';
import {
  processSolicitudes,
  createSolicitudDetectionState,
  type SolicitudProcessingResult,
  type SolicitudStoreActions,
} from './solicitud-executor';

// ============================================
// Types
// ============================================

export interface AttributeDetection {
  attributeId: string;
  attributeKey: string;
  attributeName: string;
  oldValue: number | string | null;
  newValue: number | string;
  matchedText: string;
  matchedPattern: string;
  position: number;
}

export interface StatsDetectionResult {
  characterId: string;
  detections: AttributeDetection[];
  hasChanges: boolean;
}

// ============================================
// Key Extraction (Similar to HUD Handler)
// ============================================

/**
 * Get all detection keys for an attribute
 * 
 * Priority:
 * 1. Use attribute.key as primary key
 * 2. Add attribute.keys[] as alternative keys
 * 3. Fallback: parse detectionTags (legacy format)
 */
export function getDetectionKeys(attribute: AttributeDefinition): string[] {
  const allKeys: string[] = [];
  
  // Primary key is always included
  if (attribute.key) {
    allKeys.push(attribute.key);
  }
  
  // Add alternative keys from keys[] array
  if (attribute.keys && attribute.keys.length > 0) {
    for (const key of attribute.keys) {
      if (key && !allKeys.includes(key)) {
        allKeys.push(key);
      }
    }
  }
  
  // Fallback: parse legacy detectionTags
  if (allKeys.length === 0 && attribute.detectionTags) {
    const tags = attribute.detectionTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    for (const tag of tags) {
      if (!allKeys.includes(tag)) {
        allKeys.push(tag);
      }
    }
  }
  
  return allKeys;
}

/**
 * Normalize a key for case-insensitive matching
 */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Check if a detected key matches an attribute's keys
 */
export function keyMatchesAttribute(
  detectedKey: string,
  attribute: AttributeDefinition
): boolean {
  const allKeys = getDetectionKeys(attribute);
  
  for (const key of allKeys) {
    if (attribute.caseSensitive) {
      // Case-sensitive: exact match
      if (key === detectedKey) {
        return true;
      }
    } else {
      // Case-insensitive: normalize both
      if (normalizeKey(key) === normalizeKey(detectedKey)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================
// Detection Functions
// ============================================

/**
 * Parse a value based on attribute type
 */
export function parseStatValue(
  rawValue: string,
  attributeType: 'number' | 'keyword' | 'text'
): number | string {
  if (attributeType === 'number') {
    const num = parseFloat(rawValue);
    return isNaN(num) ? rawValue : num;
  }
  return rawValue.trim();
}

/**
 * Build regex pattern from detection keys
 * Similar to HUD token detection
 */
export function buildPatternFromKeys(
  keys: string[],
  caseSensitive: boolean = false
): RegExp | null {
  if (keys.length === 0) return null;
  
  // Escape special regex characters in each key
  const escapedKeys = keys.map(key => {
    return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  
  // Build pattern: (key1|key2|key3)\s*[:=]?\s*(value)
  // This matches any key followed by optional colon/equals and then captures the value
  const patternStr = `(${escapedKeys.join('|')})\\s*[:=]?\\s*(-?\\d+(?:\\.\\d+)?|[^\\s,;.!?\\n\\[\\]]{1,50})`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect attribute updates in text using detection keys
 * 
 * This function detects patterns like:
 * - [Vida=35] - bracketed format
 * - Vida: 35 - colon format  
 * - HP: 35 - alternative key
 * - vida 35 - space separated
 */
export function detectAttributeUpdates(
  text: string,
  attributes: AttributeDefinition[],
  currentValues: Record<string, number | string> | undefined
): AttributeDetection[] {
  const detections: AttributeDetection[] = [];
  
  for (const attribute of attributes) {
    // Get all detection keys for this attribute
    const keys = getDetectionKeys(attribute);
    
    if (keys.length === 0) continue;
    
    // Build regex pattern
    const regex = buildPatternFromKeys(keys, attribute.caseSensitive);
    if (!regex) continue;
    
    try {
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // match[1] is the matched key, match[2] is the value
        const matchedKey = match[1];
        const rawValue = match[2];
        
        if (!rawValue) continue;
        
        // Verify this key actually matches this attribute (for case sensitivity)
        if (!keyMatchesAttribute(matchedKey, attribute)) continue;
        
        const newValue = parseStatValue(rawValue, attribute.type);
        const oldValue = currentValues?.[attribute.key] ?? null;
        
        // Only add if value changed
        if (oldValue !== newValue) {
          detections.push({
            attributeId: attribute.id,
            attributeKey: attribute.key,
            attributeName: attribute.name,
            oldValue,
            newValue,
            matchedText: match[0],
            matchedPattern: matchedKey,
            position: match.index,
          });
        }
      }
    } catch (error) {
      console.error(`[StatsDetector] Error processing attribute ${attribute.key}:`, error);
    }
  }
  
  return detections;
}

/**
 * Detect all stat updates for a character in text
 */
export function detectStatsUpdates(
  text: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined
): StatsDetectionResult {
  const emptyResult: StatsDetectionResult = {
    characterId,
    detections: [],
    hasChanges: false,
  };
  
  if (!statsConfig?.enabled || !statsConfig.attributes.length) {
    return emptyResult;
  }
  
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;
  
  const detections = detectAttributeUpdates(
    text,
    statsConfig.attributes,
    currentValues
  );
  
  return {
    characterId,
    detections,
    hasChanges: detections.length > 0,
  };
}

/**
 * Convert detections to trigger hits for the trigger system
 */
export function detectionsToTriggerHits(
  detections: AttributeDetection[],
  characterId: string
): StatsTriggerHit[] {
  return detections.map(d => ({
    characterId,
    attributeId: d.attributeId,
    attributeKey: d.attributeKey,
    attributeName: d.attributeName,
    oldValue: d.oldValue,
    newValue: d.newValue,
    matchedPattern: d.matchedPattern,
    matchedText: d.matchedText,
  }));
}

// ============================================
// Streaming Support
// ============================================

/**
 * Stats detection state for streaming
 * 
 * Keeps track of the LAST value detected for each attribute.
 * Multiple updates to the same attribute in one message will use the last value.
 * 
 * IMPORTANT: Uses position-based tracking to avoid re-detecting the same pattern
 * when streaming causes text windows to overlap.
 */
export class StatsDetectionState {
  private processedLength: number = 0;
  private lastDetectedValue: Map<string, AttributeDetection> = new Map(); // attributeKey -> last detection
  private processedPositions: Set<number> = new Set(); // Track which positions have been processed
  
  /**
   * Process new text incrementally
   * 
   * Returns detections that have changed from the current stored value.
   * If an attribute is detected multiple times, only the last value is kept.
   */
  processNewText(
    newText: string,
    fullText: string,
    attributes: AttributeDefinition[],
    currentValues: Record<string, number | string> | undefined
  ): AttributeDetection[] {
    // Only process NEW text (from processedLength onwards)
    const newContent = fullText.slice(this.processedLength);
    
    if (!newContent.trim()) {
      this.processedLength = fullText.length;
      return [];
    }
    
    const newDetections = detectAttributeUpdates(
      newContent,
      attributes,
      currentValues
    );
    
    // Adjust positions to be relative to full text
    for (const detection of newDetections) {
      detection.position += this.processedLength;
    }
    
    // Process all detections, keeping track of the last value for each attribute
    const changedDetections: AttributeDetection[] = [];
    
    for (const detection of newDetections) {
      // Skip if we've already processed this exact position
      if (this.processedPositions.has(detection.position)) {
        continue;
      }
      this.processedPositions.add(detection.position);
      
      const key = detection.attributeKey;
      const existingDetection = this.lastDetectedValue.get(key);
      
      // Always update to the latest detection (later in text = more recent)
      this.lastDetectedValue.set(key, detection);
      
      // Only return as changed if value is different from what we had
      if (!existingDetection || existingDetection.newValue !== detection.newValue) {
        changedDetections.push(detection);
      }
    }
    
    this.processedLength = fullText.length;
    
    return changedDetections;
  }
  
  /**
   * Reset state for new message
   */
  reset(): void {
    this.processedLength = 0;
    this.lastDetectedValue.clear();
    this.processedPositions.clear();
  }
  
  /**
   * Get the last detected value for each attribute
   */
  getLastDetections(): AttributeDetection[] {
    return Array.from(this.lastDetectedValue.values());
  }
}

/**
 * Create a new detection state
 */
export function createStatsDetectionState(): StatsDetectionState {
  return new StatsDetectionState();
}

// ============================================
// Trigger System Integration
// ============================================

/**
 * Stats trigger context for the trigger handler
 */
export interface StatsTriggerContext {
  characterId: string;
  characterName: string;
  fullText: string;
  isStreaming: boolean;
  messageKey: string;
  timestamp: number;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  // For solicitud processing
  sessionId: string;
  allCharacters: CharacterCard[];
}

/**
 * Stats handler result for trigger system
 */
export interface StatsHandlerResult {
  matched: boolean;
  hits: StatsTriggerHit[];
  detections: AttributeDetection[];
  // Solicitud processing results
  solicitudResult?: SolicitudProcessingResult;
}

/**
 * Create stats handler state
 */
export function createStatsHandlerState() {
  return {
    detectionStates: new Map<string, StatsDetectionState>(),
    solicitudStates: new Map<string, ReturnType<typeof createSolicitudDetectionState>>(),
  };
}

/**
 * Check stats triggers during streaming
 */
export function checkStatsTriggers(
  context: StatsTriggerContext,
  handlerState: { 
    detectionStates: Map<string, StatsDetectionState>;
    solicitudStates: Map<string, ReturnType<typeof createSolicitudDetectionState>>;
  },
  storeActions?: SolicitudStoreActions
): StatsHandlerResult {
  const { characterId, characterName, fullText, statsConfig, sessionStats } = context;
  
  if (!statsConfig?.enabled) {
    return { matched: false, hits: [], detections: [] };
  }
  
  // Get or create detection state for this character
  let state = handlerState.detectionStates.get(characterId);
  if (!state) {
    state = createStatsDetectionState();
    handlerState.detectionStates.set(characterId, state);
  }
  
  const charStats = sessionStats?.characterStats?.[characterId];
  const currentValues = charStats?.attributeValues;
  
  // Process new text for attribute changes
  const newDetections = state.processNewText(
    fullText,
    fullText,
    statsConfig.attributes,
    currentValues
  );
  
  // Process solicitudes (peticiones activations and solicitud completions)
  let solicitudResult: SolicitudProcessingResult | undefined;
  
  if (storeActions && context.sessionId) {
    // Get or create solicitud state for this character
    let solState = handlerState.solicitudStates.get(characterId);
    if (!solState) {
      solState = createSolicitudDetectionState();
      handlerState.solicitudStates.set(characterId, solState);
    }
    
    solicitudResult = solState.processNewText(
      fullText,
      {
        sessionId: context.sessionId,
        characterId,
        characterName,
        statsConfig,
        sessionStats,
        allCharacters: context.allCharacters,
      },
      storeActions
    );
  }
  
  const hasDetections = newDetections.length > 0;
  const hasSolicitudChanges = solicitudResult?.hasChanges || false;
  
  if (!hasDetections && !hasSolicitudChanges) {
    return { matched: false, hits: [], detections: [], solicitudResult };
  }
  
  // Convert to trigger hits
  const hits = detectionsToTriggerHits(newDetections, characterId);
  
  return {
    matched: hasDetections || hasSolicitudChanges,
    hits,
    detections: newDetections,
    solicitudResult,
  };
}

/**
 * Reset stats handler state for new message
 */
export function resetStatsHandlerState(
  handlerState: { 
    detectionStates: Map<string, StatsDetectionState>;
    solicitudStates: Map<string, ReturnType<typeof createSolicitudDetectionState>>;
  },
  characterId: string
): void {
  const state = handlerState.detectionStates.get(characterId);
  if (state) {
    state.reset();
  }
  
  const solState = handlerState.solicitudStates.get(characterId);
  if (solState) {
    solState.reset();
  }
}
