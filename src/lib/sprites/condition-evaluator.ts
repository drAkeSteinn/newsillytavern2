// ============================================
// Sprite Condition Evaluator
// ============================================
//
// Evaluates StatRequirement conditions against session stats for the sprite system.
// Reuses the evaluation logic pattern from lorebook/attribute-resolver.ts but
// adapted for the sprite context (ConditionalStateVariant, ConditionalSpriteEntry).
//
// Supports:
// - Same-character attributes (attributeKey only)
// - Cross-character attributes (attributeKey + targetCharacterId)
// - Persona attributes (targetCharacterId = '__user__')
// - Operators: <, <=, >, >=, ==, !=, between, contains, not_contains

import type {
  StatRequirement,
  SessionStats,
  ConditionalStateVariant,
  ConditionalSpriteEntry,
  SpritePackEntryV2,
  ThresholdEffect,
} from '@/types';

// ============================================
// Core Evaluation Functions
// ============================================

/**
 * Evaluate all conditions in a StatRequirement array.
 * Supports AND and OR logic (controlled by operator parameter).
 * Default is AND logic (all conditions must match).
 *
 * For each condition:
 * - If targetCharacterId is set, look up that character's attribute
 * - If targetCharacterId is '__user__', look up persona attributes
 * - Otherwise, look up the current character's attribute
 */
export function evaluateStatConditions(
  conditions: StatRequirement[],
  sessionStats: SessionStats | null | undefined,
  characterId: string,
  operator?: 'AND' | 'OR'
): boolean {
  if (!conditions || conditions.length === 0) return true;
  if (!sessionStats) return false;

  const logicFn = operator === 'OR' ? conditions.some.bind(conditions) : conditions.every.bind(conditions);

  return logicFn((condition) => {
    // Determine which character's attribute to check
    const targetCharId = condition.targetCharacterId || characterId;
    const attrValue = getAttributeValueFromStats(
      targetCharId,
      condition.attributeKey,
      sessionStats
    );

    // If attribute not found, condition fails
    if (attrValue === null) return false;

    return evaluateSingleCondition(
      attrValue,
      condition.operator,
      condition.value,
      condition.valueMax
    );
  });
}

/**
 * Get attribute value from session stats for a given character.
 *
 * @param characterId - The character ID (or '__user__' for persona)
 * @param attributeKey - The attribute key to look up
 * @param sessionStats - Current session stats
 * @returns The attribute value, or null if not found
 */
export function getAttributeValueFromStats(
  characterId: string,
  attributeKey: string,
  sessionStats: SessionStats | null | undefined
): number | string | null {
  if (!sessionStats) return null;

  const charStats = sessionStats.characterStats?.[characterId];
  if (!charStats) return null;

  const value = charStats.attributeValues?.[attributeKey];
  if (value !== undefined && value !== null) return value;

  // FASE 5: Check emotional state for {{emocion}} key
  if (attributeKey === 'emocion' && charStats.emotionalState) {
    return charStats.emotionalState;
  }

  return null;
}

/**
 * Evaluate a single condition against an attribute value.
 *
 * Logic follows the same pattern as attribute-resolver.ts evaluateCondition:
 *
 * For string attributes:
 * - == and != are case-insensitive
 * - contains/not_contains are case-insensitive
 * - <, <=, >, >= return false (not applicable to text)
 *
 * For numeric attributes (or numeric strings):
 * - All comparison operators work with numeric comparison
 * - == and != are exact numeric comparison
 *
 * The 'between' operator checks: value <= attrValue <= valueMax
 */
export function evaluateSingleCondition(
  attrValue: number | string,
  operator: string,
  compareValue: number | string,
  valueMax?: number // For 'between' operator
): boolean {
  // ============================================
  // String-only operators (case-insensitive)
  // ============================================
  if (operator === 'contains') {
    return String(attrValue).toLowerCase().includes(String(compareValue).toLowerCase());
  }

  if (operator === 'not_contains') {
    return !String(attrValue).toLowerCase().includes(String(compareValue).toLowerCase());
  }

  // ============================================
  // Between operator (numeric only)
  // ============================================
  if (operator === 'between') {
    const numAttr = typeof attrValue === 'number' ? attrValue : parseFloat(String(attrValue));
    const numMin = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));
    const numMax = typeof valueMax === 'number' ? valueMax : (valueMax !== undefined ? parseFloat(String(valueMax)) : NaN);

    if (isNaN(numAttr) || isNaN(numMin) || isNaN(numMax)) return false;

    return numMin <= numAttr && numAttr <= numMax;
  }

  // ============================================
  // Numeric comparison operators
  // ============================================
  // Try numeric comparison first
  const numAttr = typeof attrValue === 'number' ? attrValue : parseFloat(String(attrValue));
  const numComp = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));
  const bothNumeric = !isNaN(numAttr) && !isNaN(numComp);

  if (bothNumeric) {
    switch (operator) {
      case '<': return numAttr < numComp;
      case '<=': return numAttr <= numComp;
      case '>': return numAttr > numComp;
      case '>=': return numAttr >= numComp;
      case '==': return numAttr === numComp;
      case '!=': return numAttr !== numComp;
      default: return false;
    }
  }

  // ============================================
  // Text comparison (one or both values are non-numeric)
  // ============================================
  const strAttr = String(attrValue).toLowerCase();
  const strComp = String(compareValue).toLowerCase();

  switch (operator) {
    case '==': return strAttr === strComp;
    case '!=': return strAttr !== strComp;
    // Numeric operators don't apply to text
    case '<': case '<=': case '>': case '>=':
      return false;
    default:
      return false;
  }
}

// ============================================
// Conditional Variant/Entry Evaluation
// ============================================

/**
 * Evaluate conditional state variants for a state collection.
 * Returns the winning variant (highest priority that matches) or null.
 *
 * Evaluation order:
 * 1. Filter to enabled variants only
 * 2. Sort by priority DESC (highest priority first)
 * 3. Return the first variant whose conditions all match
 * 4. If no variant matches, return null (use default pack/behavior)
 *
 * @param variants - Array of ConditionalStateVariant
 * @param sessionStats - Current session stats
 * @param characterId - The character ID whose sprite we're evaluating
 * @returns The winning variant or null if no variant matches
 */
export function evaluateConditionalVariants(
  variants: ConditionalStateVariant[] | undefined,
  sessionStats: SessionStats | null | undefined,
  characterId: string
): ConditionalStateVariant | null {
  if (!variants || variants.length === 0) return null;

  // Filter to enabled variants only
  const enabledVariants = variants.filter((v) => v.enabled);
  if (enabledVariants.length === 0) return null;

  // Sort by priority DESC (highest priority first)
  const sorted = [...enabledVariants].sort((a, b) => b.priority - a.priority);

  // Return the first variant whose conditions match (respecting operator)
  for (const variant of sorted) {
    if (evaluateStatConditions(variant.conditions, sessionStats, characterId, variant.conditionOperator)) {
      return variant;
    }
  }

  // No variant matched
  return null;
}

/**
 * Evaluate conditional sprite entries for a trigger collection.
 * Returns the winning entry (highest priority that matches) or null.
 *
 * Evaluation order:
 * 1. Filter to enabled entries only
 * 2. Sort by priority DESC (highest priority first)
 * 3. Return the first entry whose conditions all match
 * 4. If no entry matches, return null (use default sprite)
 *
 * @param entries - Array of ConditionalSpriteEntry
 * @param sessionStats - Current session stats
 * @param characterId - The character ID
 * @returns The winning entry or null if no entry matches
 */
export function evaluateConditionalEntries(
  entries: ConditionalSpriteEntry[] | undefined,
  sessionStats: SessionStats | null | undefined,
  characterId: string
): ConditionalSpriteEntry | null {
  if (!entries || entries.length === 0) return null;

  // Filter to enabled entries only
  const enabledEntries = entries.filter((e) => e.enabled);
  if (enabledEntries.length === 0) return null;

  // Sort by priority DESC (highest priority first)
  const sorted = [...enabledEntries].sort((a, b) => b.priority - a.priority);

  // Return the first entry whose conditions match (respecting operator)
  for (const entry of sorted) {
    if (evaluateStatConditions(entry.conditions, sessionStats, characterId, entry.conditionOperator)) {
      return entry;
    }
  }

  // No entry matched
  return null;
}

// ============================================
// Pack-Level Conditional Evaluation
// ============================================

/**
 * Evaluate conditional sprites within a SpritePackV2.
 * Returns the winning sprite entry (highest priority with matching conditions) or null.
 *
 * This replaces the old ConditionalStateVariant approach. Now conditions are
 * defined directly on each SpritePackEntryV2 within a pack.
 *
 * Evaluation order:
 * 1. Filter to sprites with conditionalEnabled = true
 * 2. Sort by priority DESC (highest priority first)
 * 3. Return the first sprite whose conditions all match
 * 4. If no sprite matches, return null (caller should use defaultSpriteId or behavior)
 *
 * @param sprites - Array of SpritePackEntryV2 from a pack
 * @param sessionStats - Current session stats
 * @param characterId - The character ID whose sprite we're evaluating
 * @returns The winning sprite entry or null if no conditional sprite matches
 */
export function evaluatePackConditionalSprites(
  sprites: SpritePackEntryV2[] | undefined,
  sessionStats: SessionStats | null | undefined,
  characterId: string
): SpritePackEntryV2 | null {
  if (!sprites || sprites.length === 0) return null;

  // Filter to sprites with conditional enabled
  const conditionalSprites = sprites.filter(s => s.conditionalEnabled && s.conditions && s.conditions.length > 0);
  if (conditionalSprites.length === 0) return null;

  // Sort by priority DESC (highest priority first)
  const sorted = [...conditionalSprites].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Return the first sprite whose conditions match (respecting operator)
  for (const sprite of sorted) {
    if (evaluateStatConditions(sprite.conditions!, sessionStats, characterId, sprite.conditionOperator)) {
      return sprite;
    }
  }

  // No conditional sprite matched
  return null;
}

// ============================================
// Threshold Effect Evaluation
// ============================================

/**
 * Evaluate threshold effects for an attribute.
 * Returns all matching effects sorted by priority DESC (highest first).
 *
 * This replaces the old binary onMinReached/onMaxReached system with
 * flexible conditions using StatRequirement operators (>=, >, <=, <, ==, !=, between).
 *
 * Evaluation order:
 * 1. Filter to enabled effects with conditions and rewards
 * 2. For each effect, evaluate all conditions against session stats
 * 3. Collect matching effects
 * 4. Sort by priority DESC (highest priority first)
 * 5. Return matching effects in priority order
 *
 * @param effects - Array of ThresholdEffect from an AttributeDefinition
 * @param sessionStats - Current session stats
 * @param characterId - The character ID whose attribute changed
 * @returns Array of matching ThresholdEffects sorted by priority DESC
 */
export function evaluateThresholdEffects(
  effects: ThresholdEffect[] | undefined,
  sessionStats: SessionStats | null | undefined,
  characterId: string
): ThresholdEffect[] {
  if (!effects || effects.length === 0) return [];

  // Filter to enabled effects that have conditions and rewards
  const activeEffects = effects.filter(
    (e) => e.enabled && e.conditions && e.conditions.length > 0 && e.rewards && e.rewards.length > 0
  );
  if (activeEffects.length === 0) return [];

  // Evaluate each effect's conditions (respecting operator)
  const matchingEffects: ThresholdEffect[] = [];
  for (const effect of activeEffects) {
    if (evaluateStatConditions(effect.conditions, sessionStats, characterId, effect.conditionOperator)) {
      matchingEffects.push(effect);
    }
  }

  // Sort by priority DESC (highest priority first)
  matchingEffects.sort((a, b) => b.priority - a.priority);

  return matchingEffects;
}
