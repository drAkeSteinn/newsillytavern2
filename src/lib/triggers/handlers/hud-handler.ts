// ============================================
// HUD Handler - Handles HUD Field Updates
// ============================================
//
// This handler processes HUD tokens [key=value] and updates
// the corresponding HUD field values in the store.
//
// The HUD system uses the existing TokenDetector which already
// extracts HUD tokens with their key/value pairs.
//
// Supports multiple detection keys per field with optional case sensitivity.

import type { TriggerMatch } from '../types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { HUDTemplate, HUDField } from '@/types';

// ============================================
// HUD Handler State
// ============================================

export interface HUDHandlerState {
  updatedFields: Map<string, Map<string, { value: string | number | boolean; token: DetectedToken }>>; // messageKey -> fieldId -> last update
}

export function createHUDHandlerState(): HUDHandlerState {
  return {
    updatedFields: new Map(),
  };
}

// ============================================
// HUD Trigger Context
// ============================================

export interface HUDTriggerContext extends TriggerContext {
  activeHUDTemplate: HUDTemplate | null;
  currentValues: Record<string, string | number | boolean>;
}

export interface HUDHandlerResult {
  matched: boolean;
  trigger: TriggerMatch;
  tokens: DetectedToken[];
}

// ============================================
// HUD Handler Functions
// ============================================

/**
 * Check HUD triggers - match HUD tokens to template fields
 * 
 * This function processes HUD tokens [key=value] and matches them
 * against the active HUD template fields.
 * 
 * Logic:
 * 1. Only process tokens of type 'hud'
 * 2. Match token.metadata.hudKey to field.key or field.keys[]
 * 3. Apply case sensitivity if field.caseSensitive is true
 * 4. Validate value based on field type
 * 5. Collect ALL valid matches (process all, return the last one per field)
 * 
 * Note: Multiple updates to the same field in one message will use the LAST value
 */
export function checkHUDTriggers(
  tokens: DetectedToken[],
  context: HUDTriggerContext,
  state: HUDHandlerState
): HUDHandlerResult | null {
  const { activeHUDTemplate, currentValues } = context;
  
  // No active HUD template
  if (!activeHUDTemplate) {
    return null;
  }
  
  // Get updates map for this message
  if (!state.updatedFields.has(context.messageKey)) {
    state.updatedFields.set(context.messageKey, new Map());
  }
  const updatesForMessage = state.updatedFields.get(context.messageKey)!;
  
  // Filter to only HUD tokens with value
  const hudTokens = tokens.filter(t => t.type === 'hud' && t.metadata?.hudKey && t.metadata?.hudValue !== undefined);
  
  // Process ALL HUD tokens, keeping the last value for each field
  let lastMatch: { field: HUDField; token: DetectedToken; value: string | number | boolean } | null = null;
  
  for (const token of hudTokens) {
    const { hudKey, hudValue } = token.metadata || {};
    
    if (!hudKey || hudValue === undefined) continue;
    
    // Find matching field using all available keys
    const field = findMatchingField(activeHUDTemplate.fields, hudKey);
    
    if (!field) continue;
    
    // Validate and convert value based on field type
    const validatedValue = validateHUDValue(hudValue, field);
    
    if (validatedValue === null) continue;
    
    // Store this update (will overwrite previous updates to same field)
    updatesForMessage.set(field.id, { value: validatedValue, token });
    lastMatch = { field, token, value: validatedValue };
  }
  
  // If we have any updates, return the last one as the trigger
  // (The actual updates will be processed by executeHUDTrigger for ALL fields)
  if (lastMatch) {
    const currentValue = currentValues[lastMatch.field.id];
    
    return {
      matched: true,
      trigger: {
        triggerId: `hud_${lastMatch.field.id}`,
        triggerType: 'hud',
        keyword: lastMatch.token.metadata?.hudKey || '',
        data: {
          fieldId: lastMatch.field.id,
          fieldName: lastMatch.field.name,
          newValue: lastMatch.value,
          oldValue: currentValue,
          allUpdates: Array.from(updatesForMessage.entries()).map(([fieldId, data]) => ({
            fieldId,
            value: data.value,
          })),
        },
      },
      tokens: [lastMatch.token],
    };
  }
  
  return null;
}

/**
 * Find a field that matches the given HUD key
 * 
 * Checks both field.key and field.keys[] array
 * Respects field.caseSensitive setting
 */
function findMatchingField(
  fields: HUDField[],
  hudKey: string
): HUDField | undefined {
  for (const field of fields) {
    // Get all keys to check (primary key + alternative keys)
    const allKeys = [field.key, ...(field.keys || [])];
    
    for (const key of allKeys) {
      if (field.caseSensitive) {
        // Case-sensitive: exact match
        if (key === hudKey) {
          return field;
        }
      } else {
        // Case-insensitive: normalize both
        if (normalizeKey(key) === normalizeKey(hudKey)) {
          return field;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Execute HUD trigger - update the field value in store
 * 
 * If allUpdates is present in match.data, updates ALL fields
 */
export function executeHUDTrigger(
  match: TriggerMatch,
  context: TriggerContext,
  storeActions: {
    updateHUDFieldValue: (fieldId: string, value: string | number | boolean) => void;
  }
): void {
  const data = match.data as {
    fieldId: string;
    newValue: string | number | boolean;
    allUpdates?: Array<{ fieldId: string; value: string | number | boolean }>;
  };
  
  // If we have allUpdates, process them all
  if (data.allUpdates && data.allUpdates.length > 0) {
    for (const update of data.allUpdates) {
      storeActions.updateHUDFieldValue(update.fieldId, update.value);
    }
  } else {
    // Fallback: single update
    storeActions.updateHUDFieldValue(data.fieldId, data.newValue);
  }
}

/**
 * Reset state for new message
 */
export function resetHUDHandlerState(state: HUDHandlerState, messageKey: string): void {
  state.updatedFields.delete(messageKey);
}

/**
 * Clear all HUD handler state
 */
export function clearHUDHandlerState(state: HUDHandlerState): void {
  state.updatedFields.clear();
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize a key for matching (case-insensitive, trim)
 */
function normalizeKey(key: string): string {
  return (key ?? '').toString().trim().toLowerCase();
}

/**
 * Validate and convert a HUD value based on field type
 * Returns null if invalid
 */
function validateHUDValue(
  value: string,
  field: HUDField
): string | number | boolean | null {
  switch (field.type) {
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return null;
      
      // Clamp to min/max if defined
      const min = field.min ?? -Infinity;
      const max = field.max ?? Infinity;
      return Math.max(min, Math.min(max, num));
    }
    
    case 'enum': {
      // Case-insensitive match against options
      const normalized = value.toLowerCase().trim();
      const option = field.options?.find(o => o.toLowerCase() === normalized);
      return option || null;
    }
    
    case 'boolean': {
      const normalized = value.toLowerCase().trim();
      if (['true', '1', 'yes', 'on', 'sí', 'si'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      return null;
    }
    
    case 'string':
    default: {
      // Just return the trimmed string
      return value.trim();
    }
  }
}
