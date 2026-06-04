// ============================================
// Lorebook Attribute Resolver
// ============================================
//
// Evaluates attribute-based lorebook entries against current session stats.
// Returns a map of injectionKey → resolvedContent for use in key resolution.
//
// This runs server-side in the API routes where session stats and character info are available.
// Attribute entries use {{injectionKey}} in prompt text (character description,
// system prompt, etc.) and get replaced with the resolved content.

import type {
  Lorebook,
  LorebookEntry,
  LorebookAttributeConfig,
  AttributeComparator,
  SessionStats,
} from '@/types';
import { processStartDialogueInText } from '@/lib/prompt-template';

// ============================================
// Types
// ============================================

/**
 * Context needed to resolve attribute-based lorebook entries.
 * Passed from API routes where session stats and character info are available.
 */
export interface LorebookAttributeContext {
  sessionStats?: SessionStats;
  /** Current character ID (for '__char__' resolution in attribute config) */
  characterId?: string;
  /** All characters for specific character ID resolution */
  characters?: Array<{ id: string; name: string; statsConfig?: { attributes?: Array<{ key: string }> } }>;
}

// ============================================
// Main API
// ============================================

/**
 * Resolve all attribute-based lorebook entries to a key→content map.
 * 
 * For each active, non-disabled attribute entry with an injectionKey:
 * - Looks up the attribute value from session stats
 * - Evaluates static/dynamic conditions
 * - If conditions match: adds {injectionKey: resolvedContent} to the map
 * - If conditions don't match: adds {injectionKey: ""} to the map (resolves to empty)
 *
 * This map is then passed to the key resolver which replaces {{injectionKey}}
 * in prompt text with the corresponding resolved content (or empty string).
 *
 * Supports:
 * - Character attributes: config.characterId = specific char id or '__char__'
 * - Persona attributes: config.characterId = '__user__'
 *
 * @param lorebooks Active lorebooks containing attribute entries
 * @param context Context with session stats and character info
 * @returns Map of injectionKey → resolved content string (empty string if condition not met)
 */
export interface LorebookAttrDebugEntry {
  injectionKey: string;
  characterId: string;
  resolvedCharId: string;
  attributeKey: string;
  attributeValue: unknown;  // null if not found
  attributeValueType: string;
  mode: string;
  dynamicResolution?: string;
  conditionResults: Array<{
    operator: string;
    compareValue: unknown;
    matched: boolean;
    content?: string;
    evaluationDetail?: string;  // e.g., "'escritorio' == 'escritorio' → true"
    priority?: number;
  }>;
  finalResult: string;  // resolved content or '(empty)'
}

export function resolveLorebookAttributeKeys(
  lorebooks: Lorebook[],
  context: LorebookAttributeContext
): { keys: Record<string, string>; debugEntries: LorebookAttrDebugEntry[] } {
  const result: Record<string, string> = {};
  const debugEntries: LorebookAttrDebugEntry[] = [];

  if (!context.sessionStats || lorebooks.length === 0) {
    return { keys: result, debugEntries };
  }

  // ============================================
  // Phase 1: Collect ALL attribute entries across all lorebooks
  // ============================================
  // We need to gather them first so we can sort by priority (entry.order)
  // and handle deduplication when multiple entries share the same injectionKey.
  interface CollectedEntry {
    entry: LorebookEntry;
    lorebookId: string;
    lorebookName: string;
  }

  const allAttributeEntries: CollectedEntry[] = [];

  for (const lorebook of lorebooks) {
    for (const entry of lorebook.entries) {
      if (entry.entryType !== 'attribute' || entry.disable) continue;
      if (!entry.attributeConfig?.injectionKey) continue;

      allAttributeEntries.push({
        entry,
        lorebookId: lorebook.id,
        lorebookName: lorebook.name,
      });
    }
  }

  // Sort by entry.order ascending — lower order = higher priority
  // This ensures that when multiple entries share an injectionKey,
  // the one with the lowest order (highest priority) is processed first.
  allAttributeEntries.sort((a, b) => a.entry.order - b.entry.order);

  // ============================================
  // Phase 2: Resolve each entry and group by injectionKey
  // ============================================
  // For each injectionKey, only ONE entry wins — the highest priority
  // (lowest entry.order) whose conditions match. If no conditions match
  // across any entry for a given key, the key resolves to empty string.

  // Track which injectionKeys have already been resolved with a match
  const resolvedKeys = new Map<string, { content: string; entryOrder: number }>();

  for (const { entry, lorebookId, lorebookName } of allAttributeEntries) {
    const config = entry.attributeConfig!;
    const injectionKey = config.injectionKey;

    // If this injectionKey already has a resolved match from a higher-priority entry, skip
    if (resolvedKeys.has(injectionKey)) {
      // Still build debug entry to show it was skipped
      const effectiveCharId = resolveCharacterId(config.characterId, context);
      const attrVal = getAttributeValue(effectiveCharId, config.attributeKey, context);

      debugEntries.push({
        injectionKey,
        characterId: config.characterId,
        resolvedCharId: effectiveCharId,
        attributeKey: config.attributeKey,
        attributeValue: attrVal,
        attributeValueType: attrVal === null ? 'null' : typeof attrVal,
        mode: config.mode || 'unknown',
        dynamicResolution: config.dynamicResolution || 'concat-all',
        conditionResults: [{
          operator: '(skipped)',
          compareValue: '-',
          matched: false,
          evaluationDetail: `Omitido: ya resuelto por entrada con orden ${resolvedKeys.get(injectionKey)!.entryOrder} (mayor prioridad)`,
        }],
        finalResult: '(omitido — mayor prioridad ya resuelto)',
      });
      continue;
    }

    const effectiveCharId = resolveCharacterId(config.characterId, context);
    const attrVal = getAttributeValue(effectiveCharId, config.attributeKey, context);

    // Evaluate conditions and collect debug info
    const conditionResults: LorebookAttrDebugEntry['conditionResults'] = [];

    if (attrVal !== null && attrVal !== undefined) {
      // Static mode
      if (config.mode === 'static' && config.staticCondition) {
        const sc = config.staticCondition;
        const matched = evaluateCondition(attrVal, sc.operator, sc.value);
        conditionResults.push({
          operator: sc.operator,
          compareValue: sc.value,
          matched,
          content: entry.content || undefined,
          evaluationDetail: formatEvalDetail(attrVal, sc.operator, sc.value, matched),
        });
      }
      // Dynamic mode
      if (config.mode === 'dynamic' && config.dynamicConditions) {
        for (const dc of config.dynamicConditions) {
          const matched = evaluateCondition(attrVal, dc.operator, dc.value);
          conditionResults.push({
            operator: dc.operator,
            compareValue: dc.value,
            matched,
            content: dc.content?.slice(0, 100),
            evaluationDetail: formatEvalDetail(attrVal, dc.operator, dc.value, matched),
            priority: dc.priority ?? 0,
          });
        }
      }
    }

    // Resolve the entry's content
    const resolved = resolveSingleAttributeEntry(entry, context);

    // Build debug entry
    const debugEntry: LorebookAttrDebugEntry = {
      injectionKey,
      characterId: config.characterId,
      resolvedCharId: effectiveCharId,
      attributeKey: config.attributeKey,
      attributeValue: attrVal,
      attributeValueType: attrVal === null ? 'null' : typeof attrVal,
      mode: config.mode || 'unknown',
      dynamicResolution: config.dynamicResolution || 'concat-all',
      conditionResults,
      finalResult: resolved || '(empty)',
    };

    debugEntries.push(debugEntry);

    // Mark this injectionKey as resolved
    // If conditions matched → store the resolved content
    // If conditions didn't match → mark as "resolved but empty" so lower-priority
    // entries for the same key are still skipped. Only ONE entry per injectionKey
    // should inject content — the highest priority match.
    if (resolved) {
      resolvedKeys.set(injectionKey, { content: resolved, entryOrder: entry.order });
    } else {
      // Even if this entry's conditions didn't match, we DON'T mark the key as
      // resolved yet — a lower-priority entry might still match.
      // The key is only "taken" when a match is found.
    }
  }

  // ============================================
  // Phase 3: Build the final result map
  // ============================================
  // For each injectionKey that appeared in ANY attribute entry:
  // - If a match was found → use the highest-priority matched content
  // - If no match across ANY entry → empty string ({{key}} resolves to nothing)

  // Collect all injectionKeys that appeared
  const allInjectionKeys = new Set<string>();
  for (const { entry } of allAttributeEntries) {
    allInjectionKeys.add(entry.attributeConfig!.injectionKey);
  }

  for (const key of allInjectionKeys) {
    if (resolvedKeys.has(key)) {
      result[key] = resolvedKeys.get(key)!.content;
    } else {
      // No entry matched for this key — resolve to empty string
      result[key] = '';
    }
  }

  return { keys: result, debugEntries };
}

// ============================================
// Internal Functions
// ============================================

/**
 * Format a human-readable evaluation detail string for debug output
 */
function formatEvalDetail(
  attrValue: number | string,
  operator: string,
  compareValue: number | string,
  matched: boolean
): string {
  const av = String(attrValue);
  const cv = String(compareValue);
  return `'${av}' ${operator} '${cv}' → ${matched}`;
}

/**
 * Resolve a single attribute-based entry.
 * @returns Resolved content string, or null if conditions not met.
 */
function resolveSingleAttributeEntry(
  entry: LorebookEntry,
  context: LorebookAttributeContext
): string | null {
  const config = entry.attributeConfig!;

  // Resolve the effective character ID
  const effectiveCharId = resolveCharacterId(config.characterId, context);

  // Get the attribute value from session stats
  const attrValue = getAttributeValue(effectiveCharId, config.attributeKey, context);

  // If attribute value not found, skip
  if (attrValue === null || attrValue === undefined) {
    return null;
  }

  // Resolve character names for <START> dialogue formatting
  const charName = resolveCharacterName(context.characterId, context);
  const userName = resolveCharacterName('__user__', context) || 'User';

  // Evaluate based on mode
  if (config.mode === 'static' && config.staticCondition) {
    const matched = evaluateCondition(attrValue, config.staticCondition.operator, config.staticCondition.value);
    if (matched) {
      return formatStartDialogue(entry.content || null, userName, charName);
    }
    return null;
  }

  if (config.mode === 'dynamic' && config.dynamicConditions && config.dynamicConditions.length > 0) {
    // Evaluate each dynamic condition
    const matched = config.dynamicConditions
      .filter(cond => evaluateCondition(attrValue, cond.operator, cond.value));

    if (matched.length > 0) {
      const resolutionMode = config.dynamicResolution || 'concat-all';

      if (resolutionMode === 'first-match') {
        // Only the highest-priority matching condition wins
        const sorted = [...matched].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return formatStartDialogue(sorted[0].content?.trim() || null, userName, charName);
      }

      // 'concat-all': concatenate all matching, ordered by priority (highest first)
      const sorted = [...matched].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      const contents = sorted.map(c => c.content).filter(c => c?.trim());
      if (contents.length > 0) {
        const joined = contents.join('\n\n');
        return formatStartDialogue(joined, userName, charName);
      }
    }

    // No condition matched — use fallback content if available
    if (config.fallbackContent?.trim()) {
      return formatStartDialogue(config.fallbackContent, userName, charName);
    }

    return null;
  }

  // Invalid config
  return null;
}

/**
 * Format <START>-style dialogue in content with [EJEMPLO] headers.
 * If the content doesn't contain <START> tags, returns it as-is.
 */
function formatStartDialogue(content: string | null, userName: string, charName: string): string | null {
  if (!content) return null;
  return processStartDialogueInText(content, userName, charName);
}

/**
 * Resolve a character ID to its name for dialogue formatting.
 */
function resolveCharacterName(
  characterId: string | undefined,
  context: LorebookAttributeContext
): string {
  if (characterId === '__user__') {
    // Try to find the persona name from session stats
    const userStats = context.sessionStats?.characterStats?.['__user__'] as Record<string, unknown> | undefined;
    return (userStats?.name as string) || 'User';
  }
  if (characterId === '__char__' || !characterId) {
    characterId = context.characterId || '';
  }
  const char = context.characters?.find(c => c.id === characterId);
  return char?.name || characterId || 'Character';
}

/**
 * Resolve '__user__' and '__char__' special IDs to actual character IDs.
 */
function resolveCharacterId(
  configCharacterId: string,
  context: LorebookAttributeContext
): string {
  if (configCharacterId === '__user__') {
    return '__user__';
  }

  if (configCharacterId === '__char__') {
    return context.characterId || '__char__';
  }

  // Specific character ID — return as-is
  return configCharacterId;
}

/**
 * Get attribute value from session stats for a given character.
 */
function getAttributeValue(
  characterId: string,
  attributeKey: string,
  context: LorebookAttributeContext
): number | string | null {
  const charStats = context.sessionStats?.characterStats?.[characterId];
  if (!charStats) return null;

  const value = charStats.attributeValues?.[attributeKey];
  if (value === undefined || value === null) return null;

  return value;
}

/**
 * Evaluate a single attribute condition.
 * 
 * For string attributes (e.g., "casa", "CASA", "en la casa"):
 * - == and != are case-insensitive (e.g., "casa" == "CASA" → true)
 * - contains/not_contains are case-insensitive
 * - <, <=, >, >= return false (not applicable to text)
 * 
 * For numeric attributes:
 * - All operators work with numeric comparison
 * - == and != are exact numeric comparison (0 != 0.0 → false, both are 0)
 * 
 * When attribute is a number stored as string (e.g., "42"):
 * - If the compareValue is also numeric, numeric comparison is used
 * - If the compareValue is non-numeric text, string comparison is used
 */
function evaluateCondition(
  attrValue: number | string,
  operator: AttributeComparator,
  compareValue: number | string
): boolean {
  // String operators (always case-insensitive)
  if (operator === 'contains') {
    return String(attrValue).toLowerCase().includes(String(compareValue).toLowerCase());
  }

  if (operator === 'not_contains') {
    return !String(attrValue).toLowerCase().includes(String(compareValue).toLowerCase());
  }

  // Try numeric comparison first
  const numAttr = typeof attrValue === 'number' ? attrValue : parseFloat(String(attrValue));
  const numComp = typeof compareValue === 'number' ? compareValue : parseFloat(String(compareValue));
  const bothNumeric = !isNaN(numAttr) && !isNaN(numComp);

  if (bothNumeric) {
    // Numeric comparison for all operators
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

  // Text comparison (one or both values are non-numeric)
  const strAttr = String(attrValue).toLowerCase();
  const strComp = String(compareValue).toLowerCase();

  switch (operator) {
    case '==': return strAttr === strComp;
    case '!=': return strAttr !== strComp;
    // Numeric operators don't apply to text
    case '<': case '<=': case '>': case '>=':
      return false;
    default: return false;
  }
}
