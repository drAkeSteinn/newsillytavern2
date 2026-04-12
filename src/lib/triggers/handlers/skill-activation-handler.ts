// ============================================
// Skill Activation Handler - Handles Skill Triggers Post-LLM
// ============================================
//
// This handler detects skill activation keys in LLM responses
// and applies the associated activation costs to character stats.
//
// Detection patterns:
// - key:value  (habilidad:uso, golpe:activo)
// - key=value  (habilidad=1, golpe=si)
// - key_suffix (habilidad_1, golpe_x)
// - |key|      (pipe delimiters)
//
// Requirements check:
// Before activating a skill, the handler verifies that all requirements are met.

import type { DetectedToken } from '../token-detector';
import type { TriggerMatch, TriggerContext } from '../types';
import type { TriggerBus } from '../trigger-bus';
import type {
  CharacterStatsConfig,
  SessionStats,
  SkillDefinition,
  ActivationCost,
  CharacterCard,
  CostOperator,
  StatRequirement,
  RequirementOperator,
  AttributeDefinition,
  QuestReward,
} from '@/types';
import { getTokenDetector, normalizeToken } from '../token-detector';

// ============================================
// Types
// ============================================

export interface RequirementCheckResult {
  met: boolean;
  failedRequirements: Array<{
    attributeKey: string;
    attributeName: string;
    currentValue: number | string;
    requiredValue: number | string;
    operator: RequirementOperator;
    valueMax?: number;
  }>;
}

export interface SkillActivationMatch {
  skillId: string;
  skillName: string;
  skillKey: string;
  matchedKey: string;          // The key that was matched
  matchedToken: string;         // The full token that matched
  activationCosts: ActivationCost[];
  activationRewards: QuestReward[];  // Trigger rewards to execute on activation
  characterId: string;
  requirementsMet: boolean;     // Whether all requirements are met
  requirementCheck?: RequirementCheckResult; // Details of requirement check
}

export interface SkillActivationResult {
  matched: boolean;
  matches: SkillActivationMatch[];
  triggers: TriggerMatch[];
}

export interface SkillActivationHandlerState {
  processedMessages: Set<string>;
  activationHistory: Map<string, number>; // skillId -> last activation timestamp
  activatedSkillsPerMessage: Map<string, Set<string>>; // messageKey -> Set of activated skillIds
}

// ============================================
// State Management
// ============================================

export function createSkillActivationHandlerState(): SkillActivationHandlerState {
  return {
    processedMessages: new Set(),
    activationHistory: new Map(),
    activatedSkillsPerMessage: new Map(),
  };
}

export function resetSkillActivationState(
  state: SkillActivationHandlerState,
  messageKey: string
): void {
  state.processedMessages.delete(messageKey);
  state.activatedSkillsPerMessage.delete(messageKey);
}

export function clearSkillActivationHandlerState(
  state: SkillActivationHandlerState
): void {
  state.processedMessages.clear();
  state.activationHistory.clear();
  state.activatedSkillsPerMessage.clear();
}

// ============================================
// Requirements Check Functions
// ============================================

/**
 * Check a single requirement against current attribute values
 */
function checkRequirement(
  requirement: StatRequirement,
  currentValue: number | string | undefined,
  attributeName: string
): { met: boolean; failedRequirement?: RequirementCheckResult['failedRequirements'][0] } {
  // If no current value, requirement is not met
  if (currentValue === undefined) {
    return {
      met: false,
      failedRequirement: {
        attributeKey: requirement.attributeKey,
        attributeName,
        currentValue: 'undefined',
        requiredValue: requirement.value,
        operator: requirement.operator,
        valueMax: requirement.valueMax,
      },
    };
  }

  const isTextOperator = requirement.operator === 'contains' || requirement.operator === 'not_contains';

  // Text comparison for text operators or non-numeric values
  if (isTextOperator || (typeof currentValue === 'string' && isNaN(parseFloat(currentValue)))) {
    const currentStr = String(currentValue).toLowerCase();
    const requiredStr = String(requirement.value).toLowerCase();

    let met = false;
    switch (requirement.operator) {
      case '==':
        met = currentStr === requiredStr;
        break;
      case '!=':
        met = currentStr !== requiredStr;
        break;
      case 'contains':
        met = currentStr.includes(requiredStr);
        break;
      case 'not_contains':
        met = !currentStr.includes(requiredStr);
        break;
      default:
        met = false;
    }

    if (!met) {
      return {
        met: false,
        failedRequirement: {
          attributeKey: requirement.attributeKey,
          attributeName,
          currentValue,
          requiredValue: requirement.value,
          operator: requirement.operator,
          valueMax: requirement.valueMax,
        },
      };
    }
    return { met: true };
  }

  const current = typeof currentValue === 'string' ? parseFloat(currentValue) || 0 : currentValue;
  const required = typeof requirement.value === 'string' ? parseFloat(requirement.value) || 0 : requirement.value;
  const requiredMax = requirement.valueMax !== undefined
    ? (typeof requirement.valueMax === 'string' ? parseFloat(requirement.valueMax) || 0 : requirement.valueMax)
    : undefined;

  let met = false;

  switch (requirement.operator) {
    case '>=':
      met = current >= required;
      break;
    case '>':
      met = current > required;
      break;
    case '<=':
      met = current <= required;
      break;
    case '<':
      met = current < required;
      break;
    case '==':
      met = current === required;
      break;
    case '!=':
      met = current !== required;
      break;
    case 'between':
      if (requiredMax !== undefined) {
        met = current >= required && current <= requiredMax;
      } else {
        met = false; // Invalid between without max
      }
      break;
    default:
      met = false;
  }

  if (met) {
    return { met: true };
  }

  return {
    met: false,
    failedRequirement: {
      attributeKey: requirement.attributeKey,
      attributeName,
      currentValue: current,
      requiredValue: requirement.value,
      operator: requirement.operator,
      valueMax: requirement.valueMax,
    },
  };
}

/**
 * Check all requirements for a skill against current attribute values
 * Supports target requirements (checking attributes of other characters or persona)
 */
export function checkAllRequirements(
  requirements: StatRequirement[],
  statsConfig: CharacterStatsConfig,
  currentValues: Record<string, number | string>,
  sessionStats?: SessionStats
): RequirementCheckResult {
  const result: RequirementCheckResult = {
    met: true,
    failedRequirements: [],
  };

  for (const requirement of requirements) {
    if (!requirement.attributeKey) continue;

    // Determine where to get the attribute value from
    let currentValue: number | string | undefined;
    let attributeName: string;

    if (requirement.targetCharacterId) {
      // Target mode - get value from another character or persona
      const targetCharStats = sessionStats?.characterStats?.[requirement.targetCharacterId];
      currentValue = targetCharStats?.attributeValues?.[requirement.attributeKey];
      attributeName = requirement.targetAttributeName
        ? `${requirement.targetAttributeName} (${requirement.attributeKey})`
        : requirement.attributeKey;
    } else {
      // Self mode - get value from own attributes
      const attribute = statsConfig.attributes.find(a => a.key === requirement.attributeKey);
      currentValue = currentValues[requirement.attributeKey];
      attributeName = attribute?.name || requirement.attributeKey;
    }

    const check = checkRequirement(requirement, currentValue, attributeName);

    if (!check.met) {
      result.met = false;
      if (check.failedRequirement) {
        result.failedRequirements.push(check.failedRequirement);
      }
    }
  }

  return result;
}

/**
 * Get current attribute values for a character from session stats
 */
function getCurrentAttributeValues(
  characterId: string,
  sessionStats: SessionStats | undefined,
  statsConfig: CharacterStatsConfig
): Record<string, number | string> {
  const charStats = sessionStats?.characterStats?.[characterId];
  const values: Record<string, number | string> = {};

  // Initialize with default values
  for (const attr of statsConfig.attributes) {
    values[attr.key] = charStats?.attributeValues?.[attr.key] ?? attr.defaultValue ?? 0;
  }

  // Override with current session values
  if (charStats?.attributeValues) {
    Object.assign(values, charStats.attributeValues);
  }

  return values;
}

// ============================================
// Key Matching Functions
// ============================================

/**
 * Check if a token matches a skill's activation key
 * Supports multiple formats:
 * - Exact match: "golpe" matches "golpe"
 * - Key:value format: "golpe:uso" matches activationKey "golpe"
 * - Key=value format: "golpe=1" matches activationKey "golpe"
 * - Key_suffix format: "golpe_1" matches activationKey "golpe"
 * - Pipe format: "|golpe|" matches activationKey "golpe"
 */
function tokenMatchesActivationKey(
  token: DetectedToken,
  activationKey: string,
  caseSensitive: boolean = false
): { matches: boolean; matchedKey: string } {
  const normalizedToken = normalizeToken(token.token, { caseSensitive });
  const normalizedKey = normalizeToken(activationKey, { caseSensitive });
  
  if (!normalizedKey || !normalizedToken) {
    return { matches: false, matchedKey: '' };
  }
  
  // 1. Exact match
  if (normalizedToken === normalizedKey) {
    return { matches: true, matchedKey: activationKey };
  }
  
  // For key:value and key=value patterns, use the ORIGINAL token text
  // because normalizeToken strips special characters like : and =
  const originalLower = token.original.toLowerCase();
  
  // 2. Key:value format (key:value or key: value)
  if (originalLower.includes(':')) {
    const [keyPart] = originalLower.split(':');
    const normalizedKeyPart = normalizeToken(keyPart, { caseSensitive });
    if (normalizedKeyPart === normalizedKey) {
      return { matches: true, matchedKey: activationKey };
    }
  }
  
  // 3. Key=value format
  if (originalLower.includes('=')) {
    const [keyPart] = originalLower.split('=');
    const normalizedKeyPart = normalizeToken(keyPart, { caseSensitive });
    if (normalizedKeyPart === normalizedKey) {
      return { matches: true, matchedKey: activationKey };
    }
  }
  
  // 4. Key_suffix format (key_1, key_x, etc.)
  if (normalizedToken.startsWith(normalizedKey + '_')) {
    return { matches: true, matchedKey: activationKey };
  }
  
  // 5. Token starts with key (partial match for compound words)
  if (normalizedToken.startsWith(normalizedKey) && normalizedToken.length > normalizedKey.length) {
    // Only match if followed by separator or number
    const afterKey = normalizedToken.slice(normalizedKey.length);
    if (/^[_:=-]/.test(afterKey) || /^\d/.test(afterKey)) {
      return { matches: true, matchedKey: activationKey };
    }
  }
  
  return { matches: false, matchedKey: '' };
}

/**
 * Find all skills that match a token
 */
function findMatchingSkills(
  token: DetectedToken,
  skills: SkillDefinition[]
): Array<{ skill: SkillDefinition; matchedKey: string }> {
  const matches: Array<{ skill: SkillDefinition; matchedKey: string }> = [];
  
  for (const skill of skills) {
    if (!skill.activationKey && (!skill.activationKeys || skill.activationKeys.length === 0)) {
      continue; // No activation keys defined
    }
    
    const caseSensitive = skill.activationKeyCaseSensitive ?? false;
    
    // Check primary activation key
    if (skill.activationKey) {
      const result = tokenMatchesActivationKey(token, skill.activationKey, caseSensitive);
      if (result.matches) {
        matches.push({ skill, matchedKey: result.matchedKey });
        continue;
      }
    }
    
    // Check alternative keys
    if (skill.activationKeys) {
      for (const altKey of skill.activationKeys) {
        const result = tokenMatchesActivationKey(token, altKey, caseSensitive);
        if (result.matches) {
          matches.push({ skill, matchedKey: result.matchedKey });
          break;
        }
      }
    }
  }
  
  return matches;
}

// ============================================
// Main Detection Functions
// ============================================

/**
 * Detect skill activations in text
 */
export function detectSkillActivations(
  text: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined,
  state: SkillActivationHandlerState,
  messageKey: string
): SkillActivationResult {
  const result: SkillActivationResult = {
    matched: false,
    matches: [],
    triggers: [],
  };
  
  // Check if stats system is enabled
  if (!statsConfig?.enabled) {
    return result;
  }
  
  // Get skills with activation keys
  const skillsWithKeys = statsConfig.skills.filter(
    s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0)
  );
  
  if (skillsWithKeys.length === 0) {
    return result;
  }
  
  // Get already activated skills for this message (prevent duplicates across streaming)
  const activatedSkills = state.activatedSkillsPerMessage.get(messageKey) ?? new Set<string>();
  
  // Get current attribute values for requirement checking
  const currentValues = getCurrentAttributeValues(characterId, sessionStats, statsConfig);
  
  // Get token detector and process text
  const detector = getTokenDetector();
  const tokens = detector.processFull(text, messageKey);
  
  // Check each token against skill activation keys
  for (const token of tokens) {
    const skillMatches = findMatchingSkills(token, skillsWithKeys);
    
    for (const { skill, matchedKey } of skillMatches) {
      // Allow multiple activations of the same skill
      // Each occurrence triggers the skill independently
      
      // Mark as activated for tracking (but don't skip)
      activatedSkills.add(skill.id);
      
      // Check requirements
      const requirementCheck = checkAllRequirements(
        skill.requirements || [],
        statsConfig,
        currentValues,
        sessionStats
      );
      
      const match: SkillActivationMatch = {
        skillId: skill.id,
        skillName: skill.name,
        skillKey: skill.key,
        matchedKey,
        matchedToken: token.original,
        activationCosts: skill.activationCosts || [],
        activationRewards: skill.activationRewards || [],
        characterId,
        requirementsMet: requirementCheck.met,
        requirementCheck: requirementCheck.failedRequirements.length > 0 ? requirementCheck : undefined,
      };
      
      result.matches.push(match);
      
      // Create trigger match
      result.triggers.push({
        triggerId: `skill_${skill.id}`,
        triggerType: 'skill_activation',
        keyword: matchedKey,
        data: match,
      });
      
      // Update activation history
      state.activationHistory.set(skill.id, Date.now());
    }
  }
  
  // Save activated skills back to state
  state.activatedSkillsPerMessage.set(messageKey, activatedSkills);
  
  result.matched = result.matches.length > 0;
  
  return result;
}

/**
 * Detect skill activations incrementally (for streaming)
 */
export function detectSkillActivationsIncremental(
  newText: string,
  fullText: string,
  characterId: string,
  statsConfig: CharacterStatsConfig | undefined,
  sessionStats: SessionStats | undefined,
  state: SkillActivationHandlerState,
  messageKey: string
): SkillActivationResult {
  const result: SkillActivationResult = {
    matched: false,
    matches: [],
    triggers: [],
  };
  
  // Check if stats system is enabled
  if (!statsConfig?.enabled) {
    return result;
  }
  
  // Get skills with activation keys
  const skillsWithKeys = statsConfig.skills.filter(
    s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0)
  );
  
  if (skillsWithKeys.length === 0) {
    return result;
  }
  
  // Get already activated skills for this message (prevent duplicates across streaming)
  const activatedSkills = state.activatedSkillsPerMessage.get(messageKey) ?? new Set<string>();
  
  // Get current attribute values for requirement checking
  const currentValues = getCurrentAttributeValues(characterId, sessionStats, statsConfig);
  
  // Get token detector and process incrementally
  const detector = getTokenDetector();
  const newTokens = detector.processIncremental(fullText, messageKey);
  
  // Check each new token against skill activation keys
  for (const token of newTokens) {
    const skillMatches = findMatchingSkills(token, skillsWithKeys);
    
    for (const { skill, matchedKey } of skillMatches) {
      // Allow multiple activations of the same skill
      // Each occurrence triggers the skill independently
      
      // Mark as activated for tracking (but don't skip)
      activatedSkills.add(skill.id);
      
      // Check requirements
      const requirementCheck = checkAllRequirements(
        skill.requirements || [],
        statsConfig,
        currentValues,
        sessionStats
      );
      
      const match: SkillActivationMatch = {
        skillId: skill.id,
        skillName: skill.name,
        skillKey: skill.key,
        matchedKey,
        matchedToken: token.original,
        activationCosts: skill.activationCosts || [],
        activationRewards: skill.activationRewards || [],
        characterId,
        requirementsMet: requirementCheck.met,
        requirementCheck: requirementCheck.failedRequirements.length > 0 ? requirementCheck : undefined,
      };
      
      result.matches.push(match);
      
      // Create trigger match
      result.triggers.push({
        triggerId: `skill_${skill.id}_${Date.now()}`, // Unique ID for each activation
        triggerType: 'skill_activation',
        keyword: matchedKey,
        data: match,
      });
      
      // Update activation history
      state.activationHistory.set(skill.id, Date.now());
    }
  }
  
  // Save activated skills back to state
  state.activatedSkillsPerMessage.set(messageKey, activatedSkills);
  
  result.matched = result.matches.length > 0;
  
  return result;
}

// ============================================
// Cost Application Functions
// ============================================

/**
 * Apply an activation cost to stats
 */
export function applyActivationCost(
  currentValue: number | string,
  cost: ActivationCost
): number | string {
  // Only apply to numeric values
  if (typeof currentValue !== 'number') {
    return currentValue;
  }
  
  const costValue = cost.value;
  
  switch (cost.operator) {
    case '-':
      return currentValue - costValue;
    case '+':
      return currentValue + costValue;
    case '*':
      return currentValue * costValue;
    case '/':
      return costValue !== 0 ? currentValue / costValue : currentValue;
    case '=':
      return costValue;
    case 'set_min':
      return Math.max(currentValue, costValue);
    case 'set_max':
      return Math.min(currentValue, costValue);
    default:
      return currentValue;
  }
}

/**
 * Execute skill activation - apply costs to stats
 * Only applies costs if requirements are met
 * Returns changes and rewards to execute
 */
export function executeSkillActivation(
  match: SkillActivationMatch,
  context: {
    sessionId: string;
    characterId: string;
    sessionStats: SessionStats | undefined;
    statsConfig: CharacterStatsConfig | undefined;
  },
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
  }
): { 
  changes: Array<{ attributeKey: string; oldValue: number | string; newValue: number | string }>;
  rewards: QuestReward[];
} {
  const result: { 
    changes: Array<{ attributeKey: string; oldValue: number | string; newValue: number | string }>;
    rewards: QuestReward[];
  } = { changes: [], rewards: [] };
  
  // Check if requirements are met
  if (!match.requirementsMet) {
    console.log(
      `[SkillActivation] Skill "${match.skillName}" not activated - requirements not met:`,
      match.requirementCheck?.failedRequirements.map(r => 
        `${r.attributeName} ${r.operator} ${r.requiredValue} (current: ${r.currentValue})`
      ).join(', ')
    );
    return result;
  }
  
  // Apply activation costs if store actions provided
  if (storeActions && context.statsConfig && match.activationCosts.length > 0) {
    const charStats = context.sessionStats?.characterStats?.[context.characterId];
    const currentValues = charStats?.attributeValues || {};
    
    for (const cost of match.activationCosts) {
      if (!cost.attributeKey) continue;
      
      const attribute = context.statsConfig.attributes.find(a => a.key === cost.attributeKey);
      if (!attribute) continue;
      
      const oldValue = currentValues[cost.attributeKey] ?? attribute.defaultValue ?? 0;
      const newValue = applyActivationCost(oldValue, cost);
      
      // Apply min/max constraints if defined
      let finalValue = newValue;
      if (typeof newValue === 'number') {
        if (attribute.min !== undefined) {
          finalValue = Math.max(finalValue, attribute.min);
        }
        if (attribute.max !== undefined) {
          finalValue = Math.min(finalValue, attribute.max);
        }
      }
      
      storeActions.updateCharacterStat(
        context.sessionId,
        context.characterId,
        cost.attributeKey,
        finalValue,
        'trigger' // Mark as trigger-initiated
      );
      
      result.changes.push({
        attributeKey: cost.attributeKey,
        oldValue,
        newValue: finalValue,
      });
    }
  }
  
  // Return rewards to execute (will be processed by trigger executor)
  result.rewards = match.activationRewards || [];
  
  return result;
}

/**
 * Execute all skill activations from a result
 */
export function executeAllSkillActivations(
  result: SkillActivationResult,
  context: {
    sessionId: string;
    characterId: string;
    sessionStats: SessionStats | undefined;
    statsConfig: CharacterStatsConfig | undefined;
  },
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => void;
  }
): { 
  skillResults: Array<{ skillId: string; skillName: string; changes: Array<{ attributeKey: string; oldValue: number | string; newValue: number | string }> }>;
  allRewards: QuestReward[];
} {
  const skillResults: Array<{ skillId: string; skillName: string; changes: Array<{ attributeKey: string; oldValue: number | string; newValue: number | string }> }> = [];
  const allRewards: QuestReward[] = [];
  
  for (const match of result.matches) {
    const executionResult = executeSkillActivation(match, context, storeActions);
    if (executionResult.changes.length > 0 || executionResult.rewards.length > 0) {
      skillResults.push({
        skillId: match.skillId,
        skillName: match.skillName,
        changes: executionResult.changes,
      });
      allRewards.push(...executionResult.rewards);
    }
  }
  
  return { skillResults, allRewards };
}

// ============================================
// Trigger Handler Interface
// ============================================

export interface SkillActivationTriggerContext extends TriggerContext {
  characterId: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
}

/**
 * Check skill activation triggers during streaming or at message end
 */
export function checkSkillActivationTriggersInText(
  text: string,
  context: SkillActivationTriggerContext,
  state: SkillActivationHandlerState
): SkillActivationResult {
  const { characterId, statsConfig, sessionStats, messageKey } = context;
  
  return detectSkillActivations(text, characterId, statsConfig, sessionStats, state, messageKey);
}

/**
 * Check skill activation triggers incrementally (for streaming)
 */
export function checkSkillActivationTriggersIncremental(
  newText: string,
  fullText: string,
  context: SkillActivationTriggerContext,
  state: SkillActivationHandlerState
): SkillActivationResult {
  const { characterId, statsConfig, sessionStats, messageKey } = context;
  
  return detectSkillActivationsIncremental(newText, fullText, characterId, statsConfig, sessionStats, state, messageKey);
}
