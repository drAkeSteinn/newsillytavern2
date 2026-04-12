// ============================================
// Quest Reward Executor - Unified Reward Execution
// ============================================
//
// Este módulo ejecuta recompensas de quests usando el sistema unificado:
// - attribute: Modifica stats del personaje (HP, MP, gold, etc.)
// - trigger: Activa triggers existentes (sprite, sound, background)
//
// Las recompensas se ejecutan SILENTLY - actualizan estado sin mensajes en chat.
//
// Para triggers, delega a unified-trigger-executor.ts que reutiliza
// toda la infraestructura de TokenDetector/TriggerBus.

import type {
  QuestReward,
  QuestRewardCondition,
  QuestTemplate,
  SessionStats,
  CharacterCard,
  AttributeAction,
} from '@/types';
import {
  normalizeReward,
  validateReward,
} from './quest-reward-utils';
import {
  executeTriggerReward,
  type TriggerExecutionContext,
  type TriggerExecutionResult,
  type TriggerStoreActions,
  type TriggerCategory,
  type TriggerTargetMode,
  type SpriteTriggerHit,
} from '@/lib/triggers/unified-trigger-executor';

// ============================================
// Types
// ============================================

export interface RewardExecutionContext {
  sessionId: string;
  characterId: string;
  character?: CharacterCard | null;
  sessionStats?: SessionStats;
  allCharacters?: CharacterCard[];  // Para group chats
  targetCharacterId?: string;       // ID del personaje objetivo cuando targetMode es 'target'
  timestamp: number;
  
  // Resources for trigger lookup
  soundCollections?: Array<{ name: string; path: string; files: string[] }>;
  soundTriggers?: Array<{ id: string; name: string; keywords: string[]; collection: string; active: boolean; playMode?: string }>;
  soundSequenceTriggers?: Array<{ id: string; name: string; active: boolean; activationKey?: string; sequence: string[]; volume?: number }>;
  backgroundPacks?: Array<{ id: string; name: string; active: boolean; priority: number; items: Array<{ backgroundUrl: string; backgroundName: string; triggerKeys: string[]; enabled: boolean; overlays?: unknown[] }>; defaultOverlays?: unknown[]; defaultBackground?: string }>;
  
  // Settings
  soundSettings?: { enabled: boolean; globalVolume: number };
  backgroundSettings?: { transitionDuration: number; defaultTransitionType: string };
}

export interface RewardExecutionResult {
  rewardId: string;
  type: 'attribute' | 'trigger' | 'objective' | 'solicitud';
  success: boolean;
  key: string;
  value?: string | number;
  message?: string;
  error?: string;
  // Para triggers, información adicional
  triggerResults?: TriggerExecutionResult[];
  // Para objectives, información del objetivo completado
  objectiveKey?: string;
  questId?: string;
}

export interface RewardBatchResult {
  results: RewardExecutionResult[];
  successCount: number;
  failureCount: number;
  attributeUpdates: Map<string, number | string>; // key -> new value
  triggerResults: TriggerExecutionResult[];
}

// ============================================
// Store Action Interface
// ============================================

/**
 * Interface for store actions needed to execute rewards
 * Combines attribute actions and trigger actions
 */
export interface RewardStoreActions {
  // Attribute updates
  updateCharacterStat: (
    sessionId: string,
    characterId: string,
    attributeKey: string,
    value: number | string,
    reason?: 'llm_detection' | 'manual' | 'trigger' | 'initialization'
  ) => void;

  // Progress quest objective — same path quest-detector uses for key-based completion
  progressQuestObjective?: (
    sessionId: string,
    questTemplateId: string,
    objectiveId: string,
    amount?: number,
    characterId?: string
  ) => void;

  // Get session quest data for validation (checks session.sessionQuests)
  getSessionQuests?: (sessionId: string) => Array<{
    templateId: string;
    status: string;
    objectives: Array<{
      templateId: string;
      isCompleted: boolean;
    }>;
  }>;

  // Quest objective completion by key search (fallback for objective rewards)
  completeQuestObjective?: (
    sessionId: string,
    questId: string,
    objectiveKey: string,
    characterId?: string
  ) => boolean;

  // Solicitud completion (for solicitud rewards)
  completeSolicitud?: (
    sessionId: string,
    characterId: string,
    solicitudKey: string
  ) => { key: string; status: string } | null;

  // Trigger actions (delegated to unified-trigger-executor)
  applyTriggerForCharacter: (
    characterId: string,
    hit: SpriteTriggerHit
  ) => void;
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerSpriteUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    returnToIdleMs: number
  ) => void;
  isSpriteLocked?: () => boolean;
  
  // Sound
  playSound?: (collection: string, filename: string, volume?: number) => void;
  
  // Background
  setBackground?: (url: string) => void;
  setActiveOverlays?: (overlays: Array<{ url: string; position: string; opacity: number }>) => void;
}

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate a reward condition
 * Returns true if the condition is met, false otherwise
 */
export function evaluateRewardCondition(
  condition: QuestRewardCondition | undefined,
  sessionStats: SessionStats | undefined,
  characterId: string
): boolean {
  // No condition = always execute
  if (!condition) return true;
  
  // Currently only support attribute conditions
  if (condition.type !== 'attribute') return true;
  
  if (!sessionStats?.characterStats?.[characterId]) {
    return false;
  }
  
  const currentValue = sessionStats.characterStats[characterId].attributeValues?.[condition.key];
  
  if (currentValue === undefined) {
    return false;
  }
  
  const numValue = typeof currentValue === 'number' ? currentValue : parseFloat(currentValue);
  const conditionValue = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value);
  
  if (isNaN(numValue) || isNaN(conditionValue)) {
    // String comparison for non-numeric values
    const strValue = String(currentValue);
    const strCondition = String(condition.value);
    
    switch (condition.operator) {
      case '==': return strValue === strCondition;
      case '!=': return strValue !== strCondition;
      default: return true;
    }
  }
  
  // Numeric comparison
  switch (condition.operator) {
    case '<': return numValue < conditionValue;
    case '>': return numValue > conditionValue;
    case '<=': return numValue <= conditionValue;
    case '>=': return numValue >= conditionValue;
    case '==': return numValue === conditionValue;
    case '!=': return numValue !== conditionValue;
    default: return true;
  }
}

// ============================================
// Attribute Reward Execution
// ============================================

/**
 * Calculate new attribute value based on action
 */
export function calculateNewAttributeValue(
  currentValue: number | string | undefined,
  rewardValue: number | string,
  action: AttributeAction = 'set'
): number | string {
  if (action === 'set') {
    return rewardValue;
  }
  
  const currentNum = typeof currentValue === 'number' 
    ? currentValue 
    : parseFloat(String(currentValue)) || 0;
  const rewardNum = typeof rewardValue === 'number' 
    ? rewardValue 
    : parseFloat(String(rewardValue)) || 0;
  
  switch (action) {
    case 'add':
      return currentNum + rewardNum;
    case 'subtract':
      return currentNum - rewardNum;
    case 'multiply':
      return currentNum * rewardNum;
    case 'divide':
      return rewardNum !== 0 ? currentNum / rewardNum : currentNum;
    case 'percent':
      // Add/subtract percentage of current value
      return currentNum + (currentNum * rewardNum / 100);
    default:
      return rewardValue;
  }
}

/**
 * Execute an attribute reward
 * Supports both new format (reward.attribute) and legacy format (reward.key/value/action)
 */
export function executeAttributeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { sessionId, characterId, sessionStats } = context;
  
  try {
    // Normalize to get attribute config (handles both new and legacy format)
    const normalized = normalizeReward(reward);
    const attr = normalized.attribute;
    
    if (!attr) {
      return {
        rewardId: reward.id,
        type: 'attribute',
        key: reward.key || 'unknown',
        success: false,
        error: 'Invalid attribute reward structure',
      };
    }
    
    // Get current value
    const currentValue = sessionStats?.characterStats?.[characterId]?.attributeValues?.[attr.key];
    
    // Calculate new value
    const newValue = calculateNewAttributeValue(currentValue, attr.value, attr.action);
    
    // Execute update with 'trigger' reason since this is from a quest reward
    storeActions.updateCharacterStat(
      sessionId,
      characterId,
      attr.key,
      newValue,
      'trigger'
    );
    
    return {
      rewardId: reward.id,
      type: 'attribute',
      key: attr.key,
      value: newValue,
      success: true,
      message: `${attr.key}: ${currentValue ?? 0} → ${newValue}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'attribute',
      key: reward.key || 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Target Attribute Reward Execution
// ============================================

/**
 * Execute a target_attribute reward — modifies an attribute of ANOTHER character or the persona.
 * Uses the same updateCharacterStat store action but with the target's characterId.
 */
export function executeTargetAttributeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { sessionId, sessionStats } = context;

  try {
    const normalized = normalizeReward(reward);
    const ta = normalized.target_attribute;

    if (!ta) {
      return {
        rewardId: reward.id,
        type: 'target_attribute',
        key: 'unknown',
        success: false,
        error: 'Invalid target_attribute reward structure',
      };
    }

    const targetId = ta.targetCharacterId;
    const targetLabel = targetId === '__user__' ? 'Persona' : targetId;

    // Get current value of the target's attribute
    const currentValue = sessionStats?.characterStats?.[targetId]?.attributeValues?.[ta.key];

    // Calculate new value
    const newValue = calculateNewAttributeValue(currentValue, ta.value, ta.action);

    // Execute update on the TARGET character/persona
    storeActions.updateCharacterStat(
      sessionId,
      targetId,
      ta.key,
      newValue,
      'trigger'
    );

    return {
      rewardId: reward.id,
      type: 'target_attribute',
      key: ta.key,
      value: newValue,
      success: true,
      message: `[${targetLabel}] ${ta.key}: ${currentValue ?? 0} → ${newValue}`,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'target_attribute',
      key: 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Trigger Reward Execution
// ============================================

/**
 * Execute a trigger reward by delegating to unified-trigger-executor
 * 
 * This creates a synthetic token detection and executes the trigger
 * using the existing infrastructure (SpriteHandler, SoundHandler, BackgroundHandler)
 */
export function executeTriggerRewardFromQuest(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { characterId, character, allCharacters, sessionId } = context;
  
  try {
    // Normalize to get trigger config
    const normalized = normalizeReward(reward);
    const trig = normalized.trigger;
    
    if (!trig) {
      return {
        rewardId: reward.id,
        type: 'trigger',
        key: reward.key || 'unknown',
        success: false,
        error: 'Invalid trigger reward structure',
      };
    }
    
    if (!character) {
      return {
        rewardId: reward.id,
        type: 'trigger',
        key: trig.key,
        success: false,
        error: 'Character not available for trigger execution',
      };
    }
    
    // Build trigger context
    const triggerContext: TriggerExecutionContext = {
      sessionId,
      characterId,
      character,
      allCharacters,
      targetCharacterId: trig.targetCharacterId, // Pass target character ID for 'target' mode
      source: 'quest_completion',
      timestamp: Date.now(),
      storeActions: {
        applyTriggerForCharacter: storeActions.applyTriggerForCharacter,
        scheduleReturnToIdleForCharacter: storeActions.scheduleReturnToIdleForCharacter,
        isSpriteLocked: storeActions.isSpriteLocked,
        playSound: storeActions.playSound,
        setBackground: storeActions.setBackground,
        setActiveOverlays: storeActions.setActiveOverlays,
      },
      // Pass resources for lookup
      soundCollections: context.soundCollections as any,
      soundTriggers: context.soundTriggers as any,
      soundSequenceTriggers: context.soundSequenceTriggers as any,
      backgroundPacks: context.backgroundPacks as any,
      // Pass settings
      soundSettings: context.soundSettings as any,
      backgroundSettings: context.backgroundSettings as any,
    };
    
    // Execute trigger via unified executor
    const results = executeTriggerReward(
      trig.category as TriggerCategory,
      trig.key,
      triggerContext,
      trig.targetMode as TriggerTargetMode,
      {
        returnToIdleMs: trig.returnToIdleMs,
        volume: trig.volume,
        transitionDuration: trig.transitionDuration,
      }
    );
    
    // Check if all trigger executions succeeded
    const allSucceeded = results.every(r => r.success);
    const anySucceeded = results.some(r => r.success);
    
    // Build summary message
    const successMessages = results
      .filter(r => r.success)
      .map(r => r.message)
      .filter(Boolean);
    const errorMessages = results
      .filter(r => !r.success)
      .map(r => r.error)
      .filter(Boolean);
    
    return {
      rewardId: reward.id,
      type: 'trigger',
      key: trig.key,
      success: allSucceeded,
      message: allSucceeded 
        ? successMessages.join('; ')
        : anySucceeded 
          ? `Partial success: ${successMessages.length}/${results.length}`
          : undefined,
      error: errorMessages.length > 0 ? errorMessages.join('; ') : undefined,
      triggerResults: results,
    };
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'trigger',
      key: reward.key || 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Objective Reward Execution (Action → Quest Objective)
// ============================================

/**
 * Execute an objective reward from an Action
 *
 * This completes a quest objective when an action is activated.
 * Strategy:
 * 1. If objectiveId + questId are available → call progressQuestObjective
 *    (SAME function the quest-detector uses when an objective key is detected in text)
 * 2. Fallback → search by objectiveKey via completeQuestObjective
 */
export function executeObjectiveRewardFromAction(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { sessionId, characterId } = context;

  try {
    const normalized = normalizeReward(reward);
    const obj = normalized.objective;

    console.log(`[executeObjectiveRewardFromAction] Attempting to complete objective:`, {
      rewardId: reward.id,
      objectiveKey: obj?.objectiveKey,
      objectiveId: obj?.objectiveId,
      questId: obj?.questId,
      sessionId,
      characterId,
    });

    if (!obj || !obj.objectiveKey) {
      return {
        rewardId: reward.id,
        type: 'objective',
        key: reward.key || 'unknown',
        success: false,
        error: 'Invalid objective reward structure - missing objectiveKey',
      };
    }

    // ========================================
    // Validate: quest must be active and objective must be incomplete
    // ========================================
    if (storeActions.getSessionQuests && (obj.questId || obj.objectiveId)) {
      const sessionQuests = storeActions.getSessionQuests(sessionId);
      const quest = sessionQuests.find(q => q.templateId === obj.questId);

      if (!quest) {
        console.log(`[executeObjectiveRewardFromAction] Quest "${obj.questId}" not found in session ${sessionId}. Skipping.`);
        return {
          rewardId: reward.id,
          type: 'objective',
          key: obj.objectiveKey,
          success: false,
          message: `Misión "${obj.questId}" no encontrada en la sesión actual`,
        };
      }

      if (quest.status !== 'active') {
        console.log(`[executeObjectiveRewardFromAction] Quest "${obj.questId}" is "${quest.status}", not active. Skipping.`);
        return {
          rewardId: reward.id,
          type: 'objective',
          key: obj.objectiveKey,
          success: false,
          message: `Misión "${obj.questId}" no está activa (estado: ${quest.status})`,
        };
      }

      const objective = quest.objectives.find(o => o.templateId === obj.objectiveId);
      if (objective?.isCompleted) {
        console.log(`[executeObjectiveRewardFromAction] Objective "${obj.objectiveId}" is already completed. Skipping.`);
        return {
          rewardId: reward.id,
          type: 'objective',
          key: obj.objectiveKey,
          success: false,
          message: `Objetivo "${obj.objectiveKey}" ya estaba completado`,
        };
      }
    }

    if (!storeActions.completeQuestObjective && !storeActions.progressQuestObjective) {
      return {
        rewardId: reward.id,
        type: 'objective',
        key: obj.objectiveKey,
        success: false,
        error: 'Quest objective completion not available in this context',
      };
    }

    // Strategy 1: Use progressQuestObjective (same path as quest-detector when key is detected in text)
    // This is the same path the quest-detector uses for key-based objective completion
    if (obj.objectiveId && obj.questId && storeActions.progressQuestObjective) {
      console.log(`[executeObjectiveRewardFromAction] Using progressQuestObjective: store.progressQuestObjective(${sessionId}, ${obj.questId}, ${obj.objectiveId}, 999, ${characterId})`);
      try {
        // Use a large amount (999) to ensure the objective is completed in one go
        storeActions.progressQuestObjective(sessionId, obj.questId, obj.objectiveId, 999, characterId);
        console.log(`[executeObjectiveRewardFromAction] progressQuestObjective executed successfully`);
        return {
          rewardId: reward.id,
          type: 'objective',
          key: obj.objectiveKey,
          success: true,
          message: `Objetivo completado: ${obj.objectiveKey}`,
          objectiveKey: obj.objectiveKey,
          questId: obj.questId,
        };
      } catch (directErr) {
        console.warn(`[executeObjectiveRewardFromAction] progressQuestObjective failed, falling back to key search:`, directErr);
      }
    }

    // Strategy 2: Fallback — search by objectiveKey via completeQuestObjective
    console.log(`[executeObjectiveRewardFromAction] Using KEY SEARCH path with objectiveKey: "${obj.objectiveKey}"`);
    const completed = storeActions.completeQuestObjective(
      sessionId,
      obj.questId || '',  // May be empty - will search all active quests
      obj.objectiveKey,
      characterId
    );
    console.log(`[executeObjectiveRewardFromAction] completeQuestObjective result: ${completed}`);

    if (completed) {
      return {
        rewardId: reward.id,
        type: 'objective',
        key: obj.objectiveKey,
        success: true,
        message: `Objetivo completado: ${obj.objectiveKey}`,
        objectiveKey: obj.objectiveKey,
        questId: obj.questId,
      };
    } else {
      return {
        rewardId: reward.id,
        type: 'objective',
        key: obj.objectiveKey,
        success: false,
        message: `No se encontró un objetivo activo con la key: ${obj.objectiveKey}`,
      };
    }
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'objective',
      key: reward.key || 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Solicitud Reward Execution (Action → Character Solicitud)
// ============================================

/**
 * Execute a solicitud reward from an Action
 *
 * This completes a character solicitud when an action is activated.
 * The solicitudKey should match the key of a pending solicitud.
 */
export function executeSolicitudRewardFromAction(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  const { sessionId, characterId } = context;

  try {
    const normalized = normalizeReward(reward);
    const sol = normalized.solicitud;

    if (!sol || !sol.solicitudKey) {
      return {
        rewardId: reward.id,
        type: 'solicitud',
        key: reward.key || 'unknown',
        success: false,
        error: 'Invalid solicitud reward structure - missing solicitudKey',
      };
    }

    if (!storeActions.completeSolicitud) {
      return {
        rewardId: reward.id,
        type: 'solicitud',
        key: sol.solicitudKey,
        success: false,
        error: 'Solicitud completion not available in this context',
      };
    }

    const completed = storeActions.completeSolicitud(
      sessionId,
      characterId,
      sol.solicitudKey
    );

    if (completed) {
      return {
        rewardId: reward.id,
        type: 'solicitud',
        key: sol.solicitudKey,
        success: true,
        message: `Solicitud completada: ${sol.solicitudName || sol.solicitudKey}`,
      };
    } else {
      return {
        rewardId: reward.id,
        type: 'solicitud',
        key: sol.solicitudKey,
        success: false,
        message: `No se encontró una solicitud pendiente con la key: ${sol.solicitudKey}`,
      };
    }
  } catch (error) {
    return {
      rewardId: reward.id,
      type: 'solicitud',
      key: reward.key || 'unknown',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Main Execution Functions
// ============================================

/**
 * Execute a single reward
 * 
 * Handles both new unified types (attribute, trigger) and legacy types
 * (sprite, sound, background) which are normalized to trigger type.
 */
export function executeReward(
  reward: QuestReward,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardExecutionResult {
  // Check condition first
  if (reward.condition) {
    const conditionMet = evaluateRewardCondition(reward.condition, context.sessionStats, context.characterId);
    if (!conditionMet) {
      console.log(`[executeReward] Reward "${reward.id}" (type: ${reward.type}) condition NOT met:`, reward.condition);
      return {
        rewardId: reward.id,
        type: reward.type,
        key: reward.key || '',
        success: false,
        message: 'Condition not met',
      };
    }
  }
  
  // Normalize reward to handle legacy formats
  const normalized = normalizeReward(reward);
  
  // Validate
  const validation = validateReward(normalized);
  if (!validation.valid) {
    console.warn(`[executeReward] Reward "${reward.id}" (type: ${normalized.type}) validation FAILED:`, validation.errors);
    return {
      rewardId: reward.id,
      type: normalized.type,
      key: normalized.key || '',
      success: false,
      error: `Invalid reward: ${validation.errors.join(', ')}`,
    };
  }
  
  // Execute based on unified type
  switch (normalized.type) {
    case 'attribute':
      return executeAttributeReward(normalized, context, storeActions);

    case 'trigger':
      return executeTriggerRewardFromQuest(normalized, context, storeActions);

    case 'objective':
      return executeObjectiveRewardFromAction(normalized, context, storeActions);

    case 'solicitud':
      return executeSolicitudRewardFromAction(normalized, context, storeActions);

    case 'target_attribute':
      return executeTargetAttributeReward(normalized, context, storeActions);

    default:
      return {
        rewardId: reward.id,
        type: normalized.type,
        key: normalized.key || '',
        success: false,
        error: `Unknown reward type: ${normalized.type}`,
      };
  }
}

/**
 * Execute all rewards for a quest
 * 
 * This is the main entry point for executing quest rewards.
 * Rewards are executed in order, and all are attempted
 * regardless of individual failures.
 */
export function executeAllRewards(
  rewards: QuestReward[],
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  const results: RewardExecutionResult[] = [];
  const attributeUpdates = new Map<string, number | string>();
  const triggerResults: TriggerExecutionResult[] = [];
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const reward of rewards) {
    const result = executeReward(reward, context, storeActions);
    results.push(result);
    
    if (result.success) {
      successCount++;
      
      // Track attribute updates
      if (result.type === 'attribute' && result.value !== undefined) {
        attributeUpdates.set(result.key, result.value as number | string);
      }
      
      // Collect trigger results
      if (result.triggerResults) {
        triggerResults.push(...result.triggerResults);
      }
    } else {
      failureCount++;
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
    attributeUpdates,
    triggerResults,
  };
}

/**
 * Execute quest completion rewards
 * This is called when a quest is completed
 */
export function executeQuestCompletionRewards(
  template: QuestTemplate,
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  if (!template.rewards || template.rewards.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      attributeUpdates: new Map(),
      triggerResults: [],
    };
  }
  
  console.log(`[QuestReward] Executing ${template.rewards.length} quest completion rewards for character ${context.characterId}`);
  
  return executeAllRewards(template.rewards, context, storeActions);
}

/**
 * Execute objective completion rewards
 * This is called when an objective is completed (not just progressed)
 * 
 * @param objectiveRewards - Rewards defined in the objective template
 * @param context - Execution context with character/session info
 * @param storeActions - Store actions to execute rewards
 */
export function executeObjectiveRewards(
  objectiveRewards: QuestReward[],
  context: RewardExecutionContext,
  storeActions: RewardStoreActions
): RewardBatchResult {
  if (!objectiveRewards || objectiveRewards.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      attributeUpdates: new Map(),
      triggerResults: [],
    };
  }
  
  console.log(`[QuestReward] Executing ${objectiveRewards.length} objective rewards for character ${context.characterId}`);
  
  return executeAllRewards(objectiveRewards, context, storeActions);
}

// ============================================
// Reward Preview (For UI)
// ============================================

/**
 * Generate a human-readable description of a reward
 */
export function describeReward(reward: QuestReward): string {
  const normalized = normalizeReward(reward);
  
  if (normalized.type === 'attribute' && normalized.attribute) {
    const attr = normalized.attribute;
    const actionSymbols: Record<AttributeAction, string> = {
      'set': '=',
      'add': '+',
      'subtract': '-',
      'multiply': '×',
      'divide': '÷',
      'percent': '%+',
    };
    const symbol = actionSymbols[attr.action as AttributeAction] || '=';
    return `${attr.key} ${symbol} ${attr.value}`;
  }
  
  if (normalized.type === 'trigger' && normalized.trigger) {
    const trig = normalized.trigger;
    const categoryIcons: Record<string, string> = {
      sprite: '🖼️',
      sound: '🔊',
      background: '🌄',
      soundSequence: '🎵',
    };
    const icon = categoryIcons[trig.category] || '⚡';
    const targetLabels: Record<string, string> = {
      self: '',
      all: ' (todos)',
      target: ' (objetivo)',
    };
    const targetLabel = targetLabels[trig.targetMode] || '';
    return `${icon} ${trig.key}${targetLabel}`;
  }

  if (normalized.type === 'solicitud' && normalized.solicitud) {
    return `📋 ${normalized.solicitud.solicitudName || normalized.solicitud.solicitudKey}`;
  }
  
  // Fallback for unknown format
  return `${normalized.type}: ${normalized.key || '?'}`;
}

/**
 * Generate a summary of all rewards
 */
export function describeRewards(rewards: QuestReward[]): string {
  return rewards.map(describeReward).join(', ');
}

// ============================================
// Export Index
// ============================================

export type {
  RewardExecutionContext,
  RewardExecutionResult,
  RewardBatchResult,
  RewardStoreActions,
};

// ============================================
// Direct Objective Activation (for Tools)
// ============================================

export interface DirectObjectiveActivationResult {
  success: boolean;
  objectiveCompleted: boolean;
  objectiveKey: string;
  questId?: string;
  questCompleted: boolean;
  objectiveRewardsExecuted: boolean;
  questRewardsExecuted: boolean;
  messages: string[];
  errors: string[];
}

/**
 * Interface for accessing quest data from store
 */
export interface QuestStoreAccessor {
  getSessionQuests: (sessionId: string) => Array<{
    templateId: string;
    status: string;
    objectives: Array<{
      templateId: string;
      currentCount: number;
      isCompleted: boolean;
    }>;
  }>;
  getTemplates: () => QuestTemplate[];
  // Use progressQuestObjective (same path quest-detector uses for key-based completion)
  progressQuestObjective: (
    sessionId: string,
    questTemplateId: string,
    objectiveId: string,
    amount?: number,
    characterId?: string
  ) => void;
  addQuestNotification?: (notification: {
    questId: string;
    questTitle: string;
    type: string;
    message: string;
  }) => void;
}

/**
 * Activate an objective directly from a tool call.
 * This executes the complete quest system flow:
 * 1. Finds the objective by its completion key
 * 2. Marks it as completed
 * 3. Executes objective rewards (if any)
 * 4. If all objectives complete, marks quest complete
 * 5. Executes quest rewards (if any)
 * 
 * @param objectiveKey - The completion key of the objective (e.g., "psycompletado")
 * @param storeAccessor - Access to store functions
 * @param context - Execution context
 * @param storeActions - Store actions for executing rewards
 * @param rewardActions - Actions for executing rewards
 * @returns Result of the activation
 */
export function activateObjectiveDirectly(
  objectiveKey: string,
  storeAccessor: QuestStoreAccessor,
  context: {
    sessionId: string;
    characterId: string;
    character?: CharacterCard | null;
    allCharacters?: CharacterCard[];
    sessionStats?: SessionStats;
    timestamp: number;
    soundCollections?: Array<{ name: string; path: string; files: string[] }>;
    soundTriggers?: Array<{ id: string; name: string; keywords: string[]; collection: string; active: boolean; playMode?: string }>;
    soundSequenceTriggers?: Array<{ id: string; name: string; active: boolean; activationKey?: string; sequence: string[]; volume?: number }>;
    backgroundPacks?: Array<{ id: string; name: string; active: boolean; priority: number; items: Array<{ backgroundUrl: string; backgroundName: string; triggerKeys: string[]; enabled: boolean; overlays?: unknown[] }>; defaultOverlays?: unknown[]; defaultBackground?: string }>;
    soundSettings?: { enabled: boolean; globalVolume: number };
    backgroundSettings?: { transitionDuration: number; defaultTransitionType: string };
  },
  storeActions: RewardStoreActions,
  rewardActions: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger' | 'initialization'
    ) => void;
    applyTriggerForCharacter: (characterId: string, hit: SpriteTriggerHit) => void;
    scheduleReturnToIdleForCharacter?: (
      characterId: string,
      triggerSpriteUrl: string,
      returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
      returnSpriteUrl: string,
      returnSpriteLabel: string | null,
      returnToIdleMs: number
    ) => void;
    playSound?: (collection: string, filename: string, volume?: number) => void;
    setBackground?: (url: string) => void;
    setActiveOverlays?: (overlays: Array<{ url: string; position: string; opacity: number }>) => void;
  }
): DirectObjectiveActivationResult {
  const messages: string[] = [];
  const errors: string[] = [];
  
  try {
    const { sessionId, characterId, character, allCharacters, sessionStats, timestamp } = context;
    
    // 1. Get active quests
    const sessionQuests = storeAccessor.getSessionQuests(sessionId);
    const activeQuests = sessionQuests.filter(q => 
      q.status === 'active' || q.status === 'available'
    );
    
    if (activeQuests.length === 0) {
      errors.push('No hay misiones activas');
      return {
        success: false,
        objectiveCompleted: false,
        objectiveKey,
        questCompleted: false,
        objectiveRewardsExecuted: false,
        questRewardsExecuted: false,
        messages,
        errors,
      };
    }
    
    // 2. Get templates
    const templates = storeAccessor.getTemplates();
    
    // 3. Find the objective by its completion key
    let foundObjective: {
      quest: typeof activeQuests[0];
      objective: QuestTemplate['objectives'][0];
      template: QuestTemplate;
    } | null = null;
    
    const normalizedKey = objectiveKey.toLowerCase().trim();
    
    for (const quest of activeQuests) {
      const template = templates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      for (const objective of template.objectives || []) {
        // Check completion keys
        const completionKeys = [
          objective.completion?.key,
          ...(objective.completion?.keys || [])
        ].filter(Boolean);
        
        for (const key of completionKeys) {
          if (
            key?.toLowerCase().trim() === normalizedKey ||
            key === `obj-${normalizedKey}` ||
            key?.toLowerCase().includes(normalizedKey)
          ) {
            foundObjective = { quest, objective, template };
            break;
          }
        }
        
        if (foundObjective) break;
      }
      if (foundObjective) break;
    }
    
    if (!foundObjective) {
      errors.push(`No se encontró objetivo con key: ${objectiveKey}`);
      return {
        success: false,
        objectiveCompleted: false,
        objectiveKey,
        questCompleted: false,
        objectiveRewardsExecuted: false,
        questRewardsExecuted: false,
        messages,
        errors,
      };
    }
    
    const { quest, objective, template } = foundObjective;
    
    // 4. Check if already completed
    const sessionObj = quest.objectives.find(o => o.templateId === objective.id);
    if (sessionObj?.isCompleted) {
      messages.push(`Objetivo "${objective.description}" ya estaba completado`);
      return {
        success: true,
        objectiveCompleted: true,
        objectiveKey,
        questId: template.id,
        questCompleted: quest.status === 'completed',
        objectiveRewardsExecuted: false,
        questRewardsExecuted: false,
        messages,
        errors,
      };
    }
    
    // 5. Complete the objective using progressQuestObjective (same path quest-detector uses)
    console.log(`[activateObjectiveDirectly] Completing objective "${objective.description}" (${objective.id}) in quest "${template.name}"`);
    storeAccessor.progressQuestObjective(sessionId, template.id, objective.id, 999, characterId);
    messages.push(`✅ Objetivo completado: "${objective.description}"`);
    
    // 6. Check if quest was auto-completed
    const updatedQuests = storeAccessor.getSessionQuests(sessionId);
    const updatedQuest = updatedQuests.find(q => q.templateId === template.id);
    const questCompleted = updatedQuest?.status === 'completed' ?? false;
    
    if (questCompleted) {
      messages.push(`🏆 ¡Misión "${template.name}" completada!`);
      // Quest rewards, chain activation, and notifications are all handled by the store
    }
    
    console.log(`[activateObjectiveDirectly] Success! objective=${objective.description}, questCompleted=${questCompleted}`);
    
    return {
      success: true,
      objectiveCompleted: true,
      objectiveKey,
      questId: template.id,
      questCompleted,
      objectiveRewardsExecuted: true, // Store handles rewards
      questRewardsExecuted: questCompleted, // Store handles rewards if completed
      messages,
      errors,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[activateObjectiveDirectly] Error:`, error);
    errors.push(`Error: ${errorMsg}`);
    
    return {
      success: false,
      objectiveCompleted: false,
      objectiveKey,
      questCompleted: false,
      objectiveRewardsExecuted: false,
      questRewardsExecuted: false,
      messages,
      errors,
    };
  }
}
