// ============================================
// Attribute-Based Lorebook Evaluator
// ============================================
// Evaluates attribute-based lorebook entries by checking
// character/persona attribute values against requirements.

import type {
  Lorebook,
  LorebookEntry,
  AttributeRequirement,
  AttributeOperator,
  AttributeEntryConfig,
  AttributeEntryResult,
  DynamicContentConfig,
  DynamicContentRule,
  AttributeRequirementLogic,
} from '@/types';
import type { SessionStats, CharacterCard, Persona, AttributeDefinition } from '@/types';

/**
 * Context needed to evaluate attribute-based entries
 */
export interface AttributeEvaluationContext {
  /** Current character */
  character: CharacterCard;
  /** Current persona (if any) */
  persona?: Persona;
  /** All characters in the group (for cross-character requirements) */
  allCharacters?: CharacterCard[];
  /** Session stats containing current attribute values */
  sessionStats?: SessionStats;
  /** User name (for persona targeting) */
  userName?: string;
}

/**
 * Get attribute definitions and current values for a target
 */
function getAttributeData(
  targetId: string,
  targetType: 'character' | 'persona',
  context: AttributeEvaluationContext
): { definitions: AttributeDefinition[]; values: Record<string, number | string> } {
  let statsConfig: CharacterCard['statsConfig'] | Persona['statsConfig'] | undefined;
  let attributeValues: Record<string, number | string> = {};

  if (targetType === 'character') {
    // Find the character
    let targetChar: CharacterCard | undefined;
    if (context.character.id === targetId) {
      targetChar = context.character;
    } else if (context.allCharacters) {
      targetChar = context.allCharacters.find(c => c.id === targetId);
    }

    if (targetChar?.statsConfig) {
      statsConfig = targetChar.statsConfig;
    }

    // Get session values for this character
    if (context.sessionStats?.characterStats?.[targetId]) {
      attributeValues = context.sessionStats.characterStats[targetId].attributeValues || {};
    }
  } else {
    // Persona
    if (context.persona?.statsConfig) {
      statsConfig = context.persona.statsConfig;
    }

    // Persona stats are stored under '__user__'
    if (context.sessionStats?.characterStats?.['__user__']) {
      attributeValues = context.sessionStats.characterStats['__user__'].attributeValues || {};
    }
  }

  return {
    definitions: statsConfig?.attributes || [],
    values: attributeValues,
  };
}

/**
 * Get the current value of an attribute
 */
function getAttributeValue(
  attributeKey: string,
  definitions: AttributeDefinition[],
  values: Record<string, number | string>
): { value: number | string | undefined; type: string } {
  const definition = definitions.find(d => d.key === attributeKey);
  const currentValue = values[attributeKey];

  return {
    value: currentValue,
    type: definition?.type || 'text',
  };
}

/**
 * Evaluate a single comparison operator
 */
export function evaluateOperator(
  operator: AttributeOperator,
  attributeValue: number | string | undefined,
  compareValue: string,
  compareValueSecondary?: string
): boolean {
  const val = attributeValue;

  // Existence checks (don't need a value)
  if (operator === 'has_attribute') {
    return val !== undefined && val !== null && val !== '';
  }
  if (operator === 'missing_attribute') {
    return val === undefined || val === null || val === '';
  }

  // Empty checks
  if (operator === 'is_empty') {
    return val === undefined || val === null || val === '' ||
      (typeof val === 'string' && val.trim() === '');
  }
  if (operator === 'is_not_empty') {
    return val !== undefined && val !== null && val !== '' &&
      !(typeof val === 'string' && val.trim() === '');
  }

  // If attribute has no value, most comparisons fail
  if (val === undefined || val === null) return false;

  const valStr = String(val).toLowerCase();
  const valNum = typeof val === 'number' ? val : parseFloat(String(val));
  const compStr = compareValue.toLowerCase();
  const compNum = parseFloat(compareValue);
  const compNumSec = compareValueSecondary ? parseFloat(compareValueSecondary) : 0;

  // Boolean checks
  if (operator === 'is_true') {
    return val === true || valStr === 'true' || val === 1 || valStr === '1';
  }
  if (operator === 'is_false') {
    return val === false || valStr === 'false' || val === 0 || valStr === '0';
  }

  // Text comparison operators
  if (operator === 'equals') {
    return valStr === compStr;
  }
  if (operator === 'not_equals') {
    return valStr !== compStr;
  }
  if (operator === 'contains') {
    return valStr.includes(compStr);
  }
  if (operator === 'not_contains') {
    return !valStr.includes(compStr);
  }
  if (operator === 'starts_with') {
    return valStr.startsWith(compStr);
  }
  if (operator === 'ends_with') {
    return valStr.endsWith(compStr);
  }

  // Number comparison operators
  if (operator === 'eq') {
    if (isNaN(valNum) || isNaN(compNum)) return valStr === compStr;
    return valNum === compNum;
  }
  if (operator === 'neq') {
    if (isNaN(valNum) || isNaN(compNum)) return valStr !== compStr;
    return valNum !== compNum;
  }
  if (operator === 'gt') {
    if (isNaN(valNum) || isNaN(compNum)) return false;
    return valNum > compNum;
  }
  if (operator === 'gte') {
    if (isNaN(valNum) || isNaN(compNum)) return false;
    return valNum >= compNum;
  }
  if (operator === 'lt') {
    if (isNaN(valNum) || isNaN(compNum)) return false;
    return valNum < compNum;
  }
  if (operator === 'lte') {
    if (isNaN(valNum) || isNaN(compNum)) return false;
    return valNum <= compNum;
  }
  if (operator === 'between') {
    if (isNaN(valNum) || isNaN(compNum) || isNaN(compNumSec)) return false;
    return valNum >= compNum && valNum <= compNumSec;
  }

  // List operators
  if (operator === 'includes') {
    return valStr.split(',').map(v => v.trim().toLowerCase()).includes(compStr);
  }
  if (operator === 'not_includes') {
    return !valStr.split(',').map(v => v.trim().toLowerCase()).includes(compStr);
  }
  if (operator === 'one_of') {
    const options = compareValueSecondary
      ? compareValueSecondary.split(',').map(v => v.trim().toLowerCase())
      : compareValue.split(',').map(v => v.trim().toLowerCase());
    return options.includes(valStr);
  }
  if (operator === 'none_of') {
    const options = compareValueSecondary
      ? compareValueSecondary.split(',').map(v => v.trim().toLowerCase())
      : compareValue.split(',').map(v => v.trim().toLowerCase());
    return !options.includes(valStr);
  }

  // Length operators (treat value as string/number)
  const strLen = String(val).length;
  const lenNum = parseFloat(compareValue);
  if (operator === 'length_gt') {
    return !isNaN(lenNum) && strLen > lenNum;
  }
  if (operator === 'length_gte') {
    return !isNaN(lenNum) && strLen >= lenNum;
  }
  if (operator === 'length_lt') {
    return !isNaN(lenNum) && strLen < lenNum;
  }
  if (operator === 'length_lte') {
    return !isNaN(lenNum) && strLen <= lenNum;
  }
  if (operator === 'length_equals') {
    return !isNaN(lenNum) && strLen === lenNum;
  }

  console.warn(`[AttributeEvaluator] Unknown operator: ${operator}`);
  return false;
}

/**
 * Evaluate a single attribute requirement
 */
function evaluateRequirement(
  requirement: AttributeRequirement,
  context: AttributeEvaluationContext
): boolean {
  const { definitions, values } = getAttributeData(
    requirement.targetId,
    requirement.targetType,
    context
  );

  // Existence checks don't need value data
  if (requirement.operator === 'has_attribute' || requirement.operator === 'missing_attribute') {
    const hasAttr = definitions.some(d => d.key === requirement.attributeKey) ||
                    requirement.attributeKey in values;
    if (requirement.operator === 'has_attribute') return hasAttr;
    return !hasAttr;
  }

  const { value } = getAttributeValue(
    requirement.attributeKey,
    definitions,
    values
  );

  return evaluateOperator(
    requirement.operator,
    value,
    requirement.value,
    requirement.valueSecondary
  );
}

/**
 * Evaluate all requirements for a config with logic combinator
 */
function evaluateRequirements(
  requirements: AttributeRequirement[],
  logic: AttributeRequirementLogic,
  context: AttributeEvaluationContext
): boolean {
  if (requirements.length === 0) return true;

  if (logic === 'AND') {
    return requirements.every(req => evaluateRequirement(req, context));
  } else {
    // OR
    return requirements.some(req => evaluateRequirement(req, context));
  }
}

/**
 * Evaluate dynamic content rules against current attribute values
 */
function evaluateDynamicContent(
  contentConfig: DynamicContentConfig,
  context: AttributeEvaluationContext,
  config: AttributeEntryConfig
): string {
  for (const rule of contentConfig.rules) {
    const ruleMet = rule.conditions.every(condition => {
      // Get the attribute value from the requirement at the referenced index
      if (condition.requirementIndex >= config.requirements.length) return true;

      const req = config.requirements[condition.requirementIndex];
      const { definitions, values } = getAttributeData(
        req.targetId,
        req.targetType,
        context
      );
      const { value } = getAttributeValue(
        req.attributeKey,
        definitions,
        values
      );

      return evaluateOperator(
        condition.operator,
        value,
        condition.value,
        condition.valueSecondary
      );
    });

    if (ruleMet && rule.content.trim()) {
      return rule.content;
    }
  }

  // Return default content if no rule matched
  return contentConfig.defaultContent || '';
}

/**
 * Evaluate a single dynamic content rule for preview purposes
 */
export function evaluateDynamicRuleForPreview(
  rule: DynamicContentRule,
  requirements: AttributeRequirement[],
  context: AttributeEvaluationContext
): boolean {
  return rule.conditions.every(condition => {
    if (condition.requirementIndex >= requirements.length) return true;

    const req = requirements[condition.requirementIndex];
    const { definitions, values } = getAttributeData(
      req.targetId,
      req.targetType,
      context
    );
    const { value } = getAttributeValue(
      req.attributeKey,
      definitions,
      values
    );

    return evaluateOperator(
      condition.operator,
      value,
      condition.value,
      condition.valueSecondary
    );
  });
}

/**
 * Extract attribute entry config from LorebookEntry
 */
export function getAttributeConfig(entry: LorebookEntry): AttributeEntryConfig | null {
  if (entry.entryType !== 'attribute') return null;
  const config = entry.extensions?.attributeConfig as AttributeEntryConfig | undefined;
  if (!config) return null;
  return config;
}

/**
 * Evaluate all attribute-based entries across active lorebooks
 * Returns a map of templateKey → resolved content
 *
 * When multiple entries produce the same templateKey, the one with
 * the highest priority wins. Fallback entries are used only if
 * no non-fallback entry produced content for that key.
 */
export function evaluateAttributeEntries(
  lorebooks: Lorebook[],
  context: AttributeEvaluationContext
): Map<string, AttributeEntryResult> {
  const results = new Map<string, AttributeEntryResult[]>();
  const fallbacks = new Map<string, AttributeEntryResult[]>();

  for (const lorebook of lorebooks) {
    if (!lorebook.active) continue;

    for (const entry of lorebook.entries) {
      if (entry.disable) continue;
      if (entry.entryType !== 'attribute') continue;

      const config = getAttributeConfig(entry);
      if (!config) continue;

      const templateKey = config.templateKey;
      if (!templateKey.trim()) continue;

      // Check if this is a fallback entry (no requirements)
      if (config.isFallback || config.requirements.length === 0) {
        // Resolve content
        const content = resolveAttributeContent(config, context);
        if (content.trim()) {
          if (!fallbacks.has(templateKey)) fallbacks.set(templateKey, []);
          fallbacks.get(templateKey)!.push({
            templateKey,
            content,
            entryUid: entry.uid,
            lorebookId: lorebook.id,
            lorebookName: lorebook.name,
            priority: config.priority ?? 0,
            isFallback: true,
            requirementsMet: true,
          });
        }
        continue;
      }

      // Evaluate requirements
      const requirementsMet = evaluateRequirements(
        config.requirements,
        config.requirementLogic || 'AND',
        context
      );

      if (requirementsMet) {
        const content = resolveAttributeContent(config, context);
        if (content.trim()) {
          if (!results.has(templateKey)) results.set(templateKey, []);
          results.get(templateKey)!.push({
            templateKey,
            content,
            entryUid: entry.uid,
            lorebookId: lorebook.id,
            lorebookName: lorebook.name,
            priority: config.priority ?? 0,
            isFallback: false,
            requirementsMet: true,
          });
        }
      }
    }
  }

  // Merge: for each key, pick highest priority non-fallback, or fallback if no non-fallback
  const finalMap = new Map<string, AttributeEntryResult>();

  for (const [key, entries] of results) {
    // Sort by priority descending, take first
    entries.sort((a, b) => b.priority - a.priority);
    finalMap.set(key, entries[0]);
  }

  // Add fallbacks for keys that have no non-fallback result
  for (const [key, entries] of fallbacks) {
    if (!finalMap.has(key)) {
      entries.sort((a, b) => b.priority - a.priority);
      finalMap.set(key, entries[0]);
    }
  }

  return finalMap;
}

/**
 * Resolve content from an attribute entry config (static or dynamic)
 */
function resolveAttributeContent(
  config: AttributeEntryConfig,
  context: AttributeEvaluationContext
): string {
  if (config.content.type === 'static') {
    return config.content.content;
  }

  // Dynamic content
  return evaluateDynamicContent(config.content, context, config);
}

/**
 * Build the template key replacement map from attribute entry results
 * Returns: Map of "{{key}}" → resolved content
 */
export function buildAttributeTemplateMap(
  results: Map<string, AttributeEntryResult>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, result] of results) {
    map.set(`{{${key}}}`, result.content);
    // Also add case-insensitive variant
    map.set(`{{${key}}}`.toLowerCase(), result.content);
  }
  return map;
}

/**
 * Resolve attribute template keys in text
 * Replaces {{key}} with the evaluated content
 */
export function resolveAttributeKeys(
  text: string,
  templateMap: Map<string, string>
): string {
  if (!text || templateMap.size === 0) return text;

  let result = text;
  for (const [key, value] of templateMap) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/**
 * Get all unique attribute targets (character IDs and persona) referenced
 * across all attribute entries in the given lorebooks
 */
export function getReferencedTargets(
  lorebooks: Lorebook[]
): { characterIds: Set<string>; hasPersona: boolean } {
  const characterIds = new Set<string>();
  let hasPersona = false;

  for (const lorebook of lorebooks) {
    if (!lorebook.active) continue;

    for (const entry of lorebook.entries) {
      if (entry.entryType !== 'attribute') continue;
      const config = getAttributeConfig(entry);
      if (!config) continue;

      for (const req of config.requirements) {
        if (req.targetType === 'character') {
          characterIds.add(req.targetId);
        } else {
          hasPersona = true;
        }
      }
    }
  }

  return { characterIds, hasPersona };
}

/**
 * Preview a single attribute requirement (for UI preview panel)
 */
export function previewRequirement(
  requirement: AttributeRequirement,
  context: AttributeEvaluationContext
): { met: boolean; currentValue: number | string | undefined } {
  const { definitions, values } = getAttributeData(
    requirement.targetId,
    requirement.targetType,
    context
  );
  const { value } = getAttributeValue(
    requirement.attributeKey,
    definitions,
    values
  );

  const met = evaluateOperator(
    requirement.operator,
    value,
    requirement.value,
    requirement.valueSecondary
  );

  return { met, currentValue: value };
}
