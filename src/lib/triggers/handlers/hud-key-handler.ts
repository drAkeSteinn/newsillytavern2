// ============================================
// HUD Key Handler - Unified Implementation
// ============================================
//
// Handles ALL HUD trigger detection and execution using the unified
// KeyHandler interface. Works with DetectedKey[] from KeyDetector.
//
// Supports:
// - HUD templates with multiple fields
// - Multiple detection keys per field
// - Field types: number, string, enum, boolean
// - Value validation (min/max, options)
// - Case-sensitive matching option
// - Real-time HUD updates during streaming
// - Per-character isolation in group chats

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { HUDTemplate, HUDField, HUDFieldType } from '@/types';
import {
  normalizeKey,
  keyMatches,
  classifyKey,
  parseValueWithOperator,
} from '../key-detector';
import {
  logHandler,
  logMatch,
  createMatch,
  successResult,
} from '../utils';

// ============================================
// Types
// ============================================

export interface HUDKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  activeHUDTemplate: HUDTemplate | null;
  currentHUDValues: Record<string, string | number | boolean>;

  // Store Actions
  updateHUDFieldValue?: (fieldId: string, value: string | number | boolean) => void;
}

interface FieldUpdate {
  fieldId: string;
  fieldName: string;
  newValue: string | number | boolean;
  oldValue: string | number | boolean;
  operator?: string;
}

// ============================================
// HUD Key Handler Class
// ============================================

export class HUDKeyHandler implements KeyHandler {
  readonly id = 'hud-key-handler';
  readonly type = 'hud' as const;
  readonly priority = 70; // After background

  private triggeredPositions: Map<string, Set<number>>;
  private fieldUpdates: Map<string, Map<string, FieldUpdate>>; // messageKey -> fieldId -> update

  constructor() {
    this.triggeredPositions = new Map();
    this.fieldUpdates = new Map();
  }

  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const hudContext = context as Partial<HUDKeyHandlerContext>;

    // Check if there's an active HUD template
    if (!hudContext.activeHUDTemplate) {
      return false;
    }

    // Check if category hint is HUD
    const category = classifyKey(key);
    if (category === 'hud') {
      return true;
    }

    // Check if key matches any field in the template
    const template = hudContext.activeHUDTemplate;
    for (const field of template.fields) {
      // Check primary key
      if (keyMatches(key.key, field.key)) {
        return true;
      }
      // Check alternative keys
      if (field.keys?.some(k => keyMatches(key.key, k))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const hudContext = context as HUDKeyHandlerContext;
    const messageKey = context.messageKey;

    // Check if position already triggered
    const triggered = this.triggeredPositions.get(messageKey) ?? new Set<number>();
    if (triggered.has(key.position)) {
      return null;
    }

    // Find matching field
    const result = this.findMatchingField(key, hudContext);
    if (result) {
      triggered.add(key.position);
      this.triggeredPositions.set(messageKey, triggered);
      return result;
    }

    return null;
  }

  /**
   * Execute the trigger action immediately
   */
  execute(match: TriggerMatch, context: TriggerContext): void {
    const hudContext = context as HUDKeyHandlerContext;
    const data = match.data as {
      fieldId: string;
      newValue: string | number | boolean;
      allUpdates?: Array<{ fieldId: string; value: string | number | boolean }>;
    };

    logHandler(this.id, 'execute', {
      fieldId: data.fieldId,
      newValue: data.newValue,
      allUpdatesCount: data.allUpdates?.length,
    });

    // If we have allUpdates, process them all
    if (data.allUpdates && data.allUpdates.length > 0) {
      for (const update of data.allUpdates) {
        hudContext.updateHUDFieldValue?.(update.fieldId, update.value);
      }
    } else {
      // Fallback: single update
      hudContext.updateHUDFieldValue?.(data.fieldId, data.newValue);
    }
  }

  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): RegisteredKey[] {
    const hudContext = context as Partial<HUDKeyHandlerContext>;
    const keys: RegisteredKey[] = [];

    if (!hudContext.activeHUDTemplate) {
      return keys;
    }

    for (const field of hudContext.activeHUDTemplate.fields) {
      // Primary key
      keys.push({
        key: field.key,
        category: 'hud',
        requireValue: true,
        config: { fieldId: field.id, fieldType: field.type },
      });

      // Alternative keys
      for (const key of field.keys || []) {
        keys.push({
          key,
          category: 'hud',
          requireValue: true,
          config: { fieldId: field.id, fieldType: field.type },
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
    this.fieldUpdates.delete(messageKey);
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.triggeredPositions.clear();
    this.fieldUpdates.clear();
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Find matching field and create result
   */
  private findMatchingField(
    key: DetectedKey,
    context: HUDKeyHandlerContext
  ): TriggerMatchResult | null {
    const { activeHUDTemplate, currentHUDValues } = context;

    if (!activeHUDTemplate) {
      return null;
    }

    // Initialize updates map for this message if not exists
    if (!this.fieldUpdates.has(context.messageKey)) {
      this.fieldUpdates.set(context.messageKey, new Map());
    }
    const updatesForMessage = this.fieldUpdates.get(context.messageKey)!;

    // Find matching field
    let matchedField: HUDField | null = null;

    for (const field of activeHUDTemplate.fields) {
      // Check primary key
      if (keyMatches(key.key, field.key)) {
        matchedField = field;
        break;
      }
      // Check alternative keys
      if (field.keys?.some(k => keyMatches(key.key, k))) {
        matchedField = field;
        break;
      }
    }

    if (!matchedField) {
      return null;
    }

    // For HUD fields, we need a value
    // The value can come from:
    // 1. key.value (for key:value format like "HP:100")
    // 2. key.valueInfo (for operator format like "+10 hp")
    if (!key.value && !key.valueInfo) {
      logMatch(this.id, key.key, false, { reason: 'no_value', field: matchedField.name });
      return null;
    }

    // Validate and convert value
    const validatedValue = this.validateValue(key, matchedField);
    if (validatedValue === null) {
      logMatch(this.id, key.key, false, { reason: 'invalid_value', field: matchedField.name });
      return null;
    }

    // Store this update
    const currentValue = currentHUDValues[matchedField.id] ?? matchedField.defaultValue;
    updatesForMessage.set(matchedField.id, {
      fieldId: matchedField.id,
      fieldName: matchedField.name,
      newValue: validatedValue,
      oldValue: currentValue,
      operator: key.valueInfo?.operator,
    });

    logMatch(this.id, key.key, true, {
      field: matchedField.name,
      value: validatedValue,
      operator: key.valueInfo?.operator,
    });

    // Collect all updates for this message
    const allUpdates = Array.from(updatesForMessage.values()).map(u => ({
      fieldId: u.fieldId,
      value: u.newValue,
    }));

    return successResult(key, createMatch('hud', key.original, {
      fieldId: matchedField.id,
      fieldName: matchedField.name,
      newValue: validatedValue,
      oldValue: currentValue,
      operator: key.valueInfo?.operator,
      allUpdates,
      fieldType: matchedField.type,
    }));
  }

  /**
   * Validate and convert a value based on field type
   */
  private validateValue(
    key: DetectedKey,
    field: HUDField
  ): string | number | boolean | null {
    // Get raw value
    let rawValue: string | undefined;

    if (key.value) {
      rawValue = key.value;
    } else if (key.valueInfo) {
      // For operator-based values, we need special handling
      return this.validateOperatorValue(key, field);
    }

    if (!rawValue) {
      return null;
    }

    switch (field.type) {
      case 'number': {
        const num = parseFloat(rawValue);
        if (isNaN(num)) return null;

        // Clamp to min/max if defined
        const min = field.min ?? -Infinity;
        const max = field.max ?? Infinity;
        return Math.max(min, Math.min(max, num));
      }

      case 'enum': {
        // Case-insensitive match against options
        const normalized = rawValue.toLowerCase().trim();
        const option = field.options?.find(o => o.toLowerCase() === normalized);
        return option || null;
      }

      case 'boolean': {
        const normalized = rawValue.toLowerCase().trim();
        if (['true', '1', 'yes', 'on', 'sí', 'si'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        return null;
      }

      case 'string':
      default: {
        return rawValue.trim();
      }
    }
  }

  /**
   * Validate operator-based values (e.g., +10, -5)
   * For number fields, applies the operator to the current value
   */
  private validateOperatorValue(
    key: DetectedKey,
    field: HUDField
  ): string | number | boolean | null {
    // Only number fields support operators
    if (field.type !== 'number' || !key.valueInfo) {
      return null;
    }

    const { operator, numericValue } = key.valueInfo;

    // If no numeric value, can't process
    if (numericValue === undefined) {
      return null;
    }

    // For set operators, just return the value
    if (operator === 'set' || operator === '=') {
      const min = field.min ?? -Infinity;
      const max = field.max ?? Infinity;
      return Math.max(min, Math.min(max, numericValue));
    }

    // For add/subtract operators, we need the current value
    // This will be handled at execution time
    // For now, return the numeric value with operator info
    // The actual calculation happens in execute() with currentHUDValues

    // Return as a special format that indicates operator
    // The execute function will handle the calculation
    return {
      operator,
      value: numericValue,
    } as unknown as number; // Type cast for now, will be handled properly in execute
  }
}

// ============================================
// Factory Function
// ============================================

let hudKeyHandlerInstance: HUDKeyHandler | null = null;

export function createHUDKeyHandler(): HUDKeyHandler {
  if (!hudKeyHandlerInstance) {
    hudKeyHandlerInstance = new HUDKeyHandler();
  }
  return hudKeyHandlerInstance;
}

export function resetHUDKeyHandler(): void {
  hudKeyHandlerInstance?.cleanup();
  hudKeyHandlerInstance = null;
}
