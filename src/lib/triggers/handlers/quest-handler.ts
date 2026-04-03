// ============================================
// Quest Handler - Handles Quest Triggers
// ============================================
//
// @deprecated Use QuestKeyHandler instead. This legacy handler is kept for
// backward compatibility but will be removed in a future version.
// The new QuestKeyHandler provides:
// - Unified KeyHandler interface
// - Per-character position tracking for group chat
// - Better streaming support
// - Keyword-based activation detection
//
// Migration: Use createQuestKeyHandler() from './quest-key-handler'
//
// Updated to work with the new Quest Template/Instance system
// Uses quest-detector.ts for key-based detection

import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type {
  QuestTemplate,
  SessionQuestInstance,
  QuestSettings,
  QuestTriggerHit,
  QuestObjectiveTemplate,
  QuestReward,
} from '@/types';
import {
  checkQuestTriggersInText,
  createQuestDetectionState,
  resetQuestDetectorState,
  getExampleKey,
  type QuestDetectionResult,
  type QuestDetectionState,
} from '@/lib/quest/quest-detector';
import { getCooldownManager } from '../cooldown-manager';

// ============================================
// Quest Handler State
// ============================================

export interface QuestHandlerState {
  processedQuests: Map<string, Set<string>>; // messageKey -> questIds processed
  questProgressTracked: Map<string, Set<string>>; // questId -> objectiveIds tracked
  triggeredPositions: Map<string, Set<number>>; // messageKey -> wordPositions already triggered
  detectionStates: Map<string, QuestDetectionState>; // sessionId -> detection state
}

export function createQuestHandlerState(): QuestHandlerState {
  return {
    processedQuests: new Map(),
    questProgressTracked: new Map(),
    triggeredPositions: new Map(),
    detectionStates: new Map(),
  };
}

// ============================================
// Quest Trigger Context
// ============================================

export interface QuestTriggerContext extends TriggerContext {
  templates: QuestTemplate[];
  sessionQuests: SessionQuestInstance[];
  questSettings: QuestSettings;
  sessionId: string;
  turnCount: number;
}

export interface QuestHandlerResult {
  matched: boolean;
  hits: QuestTriggerHit[];
  detections: QuestDetectionResult | null;
}

// ============================================
// Quest Tag Parser (Legacy Support)
// ============================================

interface ParsedQuestTag {
  action: 'activate' | 'progress' | 'complete' | 'fail';
  questId?: string;
  questTitle?: string;
  objectiveId?: string;
  progress?: number;
  description?: string;
}

const QUEST_TAG_PATTERN = /<quest(?::(activate|progress|complete|fail))?(?:\s+([^>]*))?\/?>/gi;
const QUEST_ATTR_PATTERN = /(\w+)="([^"]*)"/g;

/**
 * Parse quest tags from message content (legacy format)
 * Format: <quest:activate title="Mission Name" description="..."/>
 *         <quest:progress id="quest-123" objective="obj-1" amount="1"/>
 *         <quest:complete id="quest-123"/>
 */
export function parseQuestTags(content: string): ParsedQuestTag[] {
  const tags: ParsedQuestTag[] = [];
  
  let match;
  while ((match = QUEST_TAG_PATTERN.exec(content)) !== null) {
    const action = (match[1] as ParsedQuestTag['action']) || 'activate';
    const attrs = match[2] || '';
    
    const tag: ParsedQuestTag = { action };
    
    // Parse attributes
    let attrMatch;
    while ((attrMatch = QUEST_ATTR_PATTERN.exec(attrs)) !== null) {
      const [, key, value] = attrMatch;
      
      switch (key) {
        case 'id':
          tag.questId = value;
          break;
        case 'title':
          tag.questTitle = value;
          break;
        case 'objective':
          tag.objectiveId = value;
          break;
        case 'amount':
        case 'progress':
          tag.progress = parseInt(value) || 1;
          break;
        case 'description':
          tag.description = value;
          break;
      }
    }
    
    tags.push(tag);
  }
  
  return tags;
}

// ============================================
// Quest Handler Functions
// ============================================

/**
 * Check quest triggers - Main entry point
 * 
 * Uses both:
 * 1. Key-based detection (new system via quest-detector)
 * 2. Tag parsing (legacy support)
 */
export function checkQuestTriggers(
  tokens: DetectedToken[],
  content: string,
  context: QuestTriggerContext,
  state: QuestHandlerState
): QuestHandlerResult {
  const { templates, sessionQuests, questSettings, sessionId, turnCount } = context;
  
  if (!questSettings.enabled) {
    return {
      matched: false,
      hits: [],
      detections: null,
    };
  }
  
  const hits: QuestTriggerHit[] = [];
  let detections: QuestDetectionResult | null = null;
  
  // 1. Parse explicit quest tags from content (legacy format)
  const parsedTags = parseQuestTags(content);
  
  for (const tag of parsedTags) {
    const hit = processParsedTag(tag, templates, sessionQuests);
    if (hit) {
      hits.push(hit);
    }
  }
  
  // 2. Use key-based detection (new system)
  // Debug logging
  console.log('[QuestHandler] Checking quest triggers:', {
    autoDetect: questSettings.autoDetect,
    templatesCount: templates.length,
    sessionQuestsCount: sessionQuests.length,
    sessionId,
    contentPreview: content.substring(0, 100) + '...',
  });
  
  if (questSettings.autoDetect && templates.length > 0 && sessionQuests.length > 0) {
    // Log available quests
    const availableQuests = sessionQuests.filter(q => q.status === 'available');
    console.log('[QuestHandler] Available quests (status=available):', availableQuests.map(q => ({
      templateId: q.templateId,
      status: q.status,
    })));
    
    // Log templates with keyword activation
    const keywordTemplates = templates.filter(t => t.activation.method === 'keyword');
    console.log('[QuestHandler] Templates with keyword activation:', keywordTemplates.map(t => ({
      id: t.id,
      name: t.name,
      activationKey: t.activation.key,
      activationKeys: t.activation.keys,
      caseSensitive: t.activation.caseSensitive,
    })));
    
    // Get or create detection state for this session
    let detectionState = state.detectionStates.get(sessionId);
    if (!detectionState) {
      detectionState = createQuestDetectionState();
      state.detectionStates.set(sessionId, detectionState);
    }
    
    // Create handler state for detection
    const detectorHandlerState = { detectionStates: state.detectionStates };
    
    // Run detection
    const detectContext = {
      sessionId,
      fullText: content,
      isStreaming: context.isStreaming,
      messageKey: context.messageKey,
      timestamp: context.timestamp,
      templates,
      sessionQuests,
      turnCount,
    };
    
    const detectResult = checkQuestTriggersInText(detectContext, detectorHandlerState);
    
    console.log('[QuestHandler] Detection result:', {
      matched: detectResult.matched,
      hitsCount: detectResult.hits.length,
      activations: detectResult.detections?.activations?.length || 0,
    });
    
    if (detectResult.matched) {
      detections = detectResult.detections;
      hits.push(...detectResult.hits);
    }
  } else {
    // Log why we're not checking
    if (!questSettings.autoDetect) {
      console.log('[QuestHandler] Auto-detect disabled in quest settings');
    }
    if (templates.length === 0) {
      console.log('[QuestHandler] No templates loaded in store');
    }
    if (sessionQuests.length === 0) {
      console.log('[QuestHandler] No session quests in active session');
    }
  }
  
  // Update state
  const processedForMessage = state.processedQuests.get(context.messageKey) ?? new Set<string>();
  for (const hit of hits) {
    processedForMessage.add(hit.questId);
  }
  state.processedQuests.set(context.messageKey, processedForMessage);
  
  return {
    matched: hits.length > 0,
    hits,
    detections,
  };
}

/**
 * Process a parsed quest tag (legacy format)
 */
function processParsedTag(
  tag: ParsedQuestTag,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): QuestTriggerHit | null {
  switch (tag.action) {
    case 'activate':
      // For activation, try to find template by ID or create from title
      let template = templates.find(t => t.id === tag.questId);
      
      if (!template && tag.questTitle) {
        // Try to find by name
        template = templates.find(t => t.name.toLowerCase() === tag.questTitle?.toLowerCase());
      }
      
      return {
        questId: tag.questId || `quest-${Date.now()}`,
        template,
        action: 'activate',
        message: `Quest activated: ${tag.questTitle || tag.description || 'New Quest'}`,
      };
      
    case 'progress':
      const progressTemplate = templates.find(t => t.id === tag.questId);
      if (!progressTemplate) return null;
      
      const objective = progressTemplate.objectives.find(o => o.id === tag.objectiveId);
      if (!objective) return null;
      
      // Find session quest to check if this progress completes the objective
      const sessionQuest = sessionQuests.find(q => q.templateId === progressTemplate.id);
      const sessionObj = sessionQuest?.objectives.find(o => o.templateId === objective.id);
      const currentCount = sessionObj?.currentCount || 0;
      const targetCount = objective.targetCount || 1;
      const progressAmount = tag.progress || 1;
      const newCount = Math.min(currentCount + progressAmount, targetCount);
      const willComplete = !sessionObj?.isCompleted && newCount >= targetCount;
      
      return {
        questId: progressTemplate.id,
        template: progressTemplate,
        objectiveId: objective.id,
        objective,
        action: 'progress',
        progress: progressAmount,
        message: `Objective "${objective.description}" progressed`,
        // Include objective rewards if this progress will complete the objective
        objectiveRewards: willComplete && objective.rewards ? objective.rewards : undefined,
        completesObjective: willComplete,
      };
      
    case 'complete':
      const completeTemplate = templates.find(t => t.id === tag.questId);
      return {
        questId: tag.questId || '',
        template: completeTemplate,
        action: 'complete',
        message: `Quest completed: ${completeTemplate?.name || tag.questId}`,
        rewards: completeTemplate?.rewards,
      };
      
    case 'fail':
      const failTemplate = templates.find(t => t.id === tag.questId);
      return {
        questId: tag.questId || '',
        template: failTemplate,
        action: 'fail',
        message: `Quest failed: ${failTemplate?.name || tag.questId}`,
      };
      
    default:
      return null;
  }
}

// ============================================
// Quest Prompt Builder
// ============================================

/**
 * Check if an objective should be visible to a specific character
 * based on the characterFilter configuration
 */
export function isObjectiveVisibleForCharacter(
  objective: QuestObjectiveTemplate,
  characterId: string
): boolean {
  // If no filter is configured, objective is visible to all
  if (!objective.characterFilter?.enabled) {
    console.log(`[QuestHandler] Objective "${objective.description}" - no filter, visible to all`);
    return true;
  }
  
  const { mode, characterIds } = objective.characterFilter;
  
  // If no character IDs specified, treat as visible to all
  if (!characterIds || characterIds.length === 0) {
    console.log(`[QuestHandler] Objective "${objective.description}" - no characterIds in filter, visible to all`);
    return true;
  }
  
  const isInList = characterIds.includes(characterId);
  
  // include mode: only characters in the list can see it
  // exclude mode: all characters EXCEPT those in the list can see it
  const isVisible = mode === 'include' ? isInList : !isInList;
  
  console.log(`[QuestHandler] Objective "${objective.description}" - filter: ${JSON.stringify(objective.characterFilter)}, characterId: ${characterId}, isInList: ${isInList}, mode: ${mode}, isVisible: ${isVisible}`);
  
  return isVisible;
}

/**
 * Filter objectives for a specific character
 * Returns only objectives that the character can see
 */
export function filterObjectivesForCharacter(
  objectives: QuestObjectiveTemplate[],
  characterId: string | undefined
): QuestObjectiveTemplate[] {
  // If no character ID specified, return all objectives (no filtering)
  if (!characterId) {
    return objectives;
  }
  
  return objectives.filter(obj => isObjectiveVisibleForCharacter(obj, characterId));
}

/**
 * Build quest section for NARRATOR
 *
 * Narrator sees both active and available quests in a simplified format:
 *
 * [MISIONES ACTIVAS]
 *   1) Nombre de la misión
 *      - descripción: descripción
 *
 * [MISIONES DISPONIBLES]
 *   1) Nombre de la misión
 *      - descripción: descripción
 *      - key de activación: activation_key
 */
function buildNarratorQuestSection(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  templateStr: string,
  questSettings?: QuestSettings
): string {
  // Get active and available quests
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  const availableQuests = sessionQuests.filter(q => q.status === 'available');

  const sections: string[] = [];

  // Build ACTIVE quests section
  if (activeQuests.length > 0) {
    const activeLines: string[] = [];
    activeQuests.forEach((q, index) => {
      const questTemplate = templates.find(t => t.id === q.templateId);
      if (!questTemplate) return;

      activeLines.push(`  ${index + 1}) ${questTemplate.name}`);
      activeLines.push(`     - descripción: ${questTemplate.description}`);
    });

    if (activeLines.length > 0) {
      sections.push(`[MISIONES ACTIVAS]\n${activeLines.join('\n')}`);
    }
  }

  // Build AVAILABLE quests section
  if (availableQuests.length > 0) {
    const availableLines: string[] = [];
    availableQuests.forEach((q, index) => {
      const questTemplate = templates.find(t => t.id === q.templateId);
      if (!questTemplate) return;

      availableLines.push(`  ${index + 1}) ${questTemplate.name}`);
      availableLines.push(`     - descripción: ${questTemplate.description}`);

      // Add activation key for available quests with prefix
      const activation = questTemplate.activation || {};
      const baseKey = activation.key || (activation.keys && activation.keys[0]);
      if (baseKey) {
        const activationKey = getExampleKey(questSettings?.questActivationPrefix, baseKey);
        availableLines.push(`     - key de activación: ${activationKey}`);
      }
    });

    if (availableLines.length > 0) {
      sections.push(`[MISIONES DISPONIBLES]\n${availableLines.join('\n')}`);
    }
  }

  // If no quests at all, return empty
  if (sections.length === 0) {
    return '';
  }

  // Join sections with double newline
  const fullQuestSection = sections.join('\n\n');

  // Replace placeholder in template
  return templateStr.replace('{{activeQuests}}', fullQuestSection);
}

/**
 * Build quest section for prompt
 *
 * NEW YAML-LIKE FORMAT:
 * [MISIONES ACTIVAS]
 * - key: madera_de_calidad
 *   descripcion: Se requiere conseguir madera de abedul para reconstruir la aldea.
 *   objetivos_principales_pendientes:
 *     - key: troncos_abedul
 *       descripcion: Conseguir, cortar o entregar troncos de abedul utilizables.
 *       se_completa_cuando: Leny confirma claramente que ya obtuvo, cortó o entregó troncos de abedul.
 *
 * NARRATOR FORMAT:
 * [MISIONES ACTIVAS]
 *   1) Nombre de la misión
 *      - descripción: descripción de la misión
 *
 * [MISIONES DISPONIBLES]
 *   1) Nombre de la misión
 *      - descripción: descripción de la misión
 *      - key de activación: activation_key
 *
 * - Only shows incomplete objectives
 * - Objectives are numbered dynamically
 * - Optional objectives section only appears if there are pending optional objectives
 * - Filters objectives by character if characterId is provided
 * - For narrator: shows both active and available quests
 */
export function buildQuestPromptSection(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  templateStr: string,
  characterId?: string,
  isForNarrator: boolean = false,
  questSettings?: QuestSettings
): string {
  console.log(`[QuestHandler] buildQuestPromptSection called with characterId: ${characterId}, isForNarrator: ${isForNarrator}, hasPrefix: ${!!questSettings?.objectiveCompletionPrefix}`);

  // For narrator, show different format with both active and available quests
  if (isForNarrator) {
    return buildNarratorQuestSection(templates, sessionQuests, templateStr, questSettings);
  }

  // Regular character format - only active quests
  const activeQuests = sessionQuests.filter(q => q.status === 'active');

  if (activeQuests.length === 0) {
    return '';
  }

  const questList = activeQuests.map(q => {
    const questTemplate = templates.find(t => t.id === q.templateId);
    if (!questTemplate) return '';

    const objectives = questTemplate.objectives || [];
    console.log(`[QuestHandler] Processing quest "${questTemplate.name}" with ${objectives.length} objectives`);

    // Filter objectives for this character first
    const visibleObjectives = filterObjectivesForCharacter(
      objectives,
      characterId
    );

    console.log(`[QuestHandler] Quest "${questTemplate.name}" - visible objectives: ${visibleObjectives.length} of ${objectives.length}`);

    // If no objectives are visible for this character, don't show the quest
    if (visibleObjectives.length === 0) return '';

    // Separate objectives: pending (not completed) vs optional
    // Store as objects with all needed info
    const pendingObjectives: {
      key: string;
      description: string;
      completionDescription?: string;
      progress?: string;
    }[] = [];
    const optionalObjectives: {
      key: string;
      description: string;
      completionDescription?: string;
      progress?: string;
    }[] = [];

    for (const obj of visibleObjectives) {
      const sessionObj = q.objectives?.find(o => o.templateId === obj.id);
      const isCompleted = sessionObj?.isCompleted || false;

      // Skip completed objectives - they should not appear
      if (isCompleted) continue;

      const currentCount = sessionObj?.currentCount || 0;
      const progress = obj.targetCount > 1
        ? ` (${currentCount}/${obj.targetCount})`
        : undefined;

      // Get the completion key for this objective
      // Apply prefix if configured
      const baseKey = obj.completion?.key || '';
      const objectiveKey = getExampleKey(questSettings?.objectiveCompletionPrefix, baseKey);

      const objectiveData = {
        key: objectiveKey,
        description: obj.description,
        completionDescription: obj.completionDescription,
        progress,
      };

      if (obj.isOptional) {
        optionalObjectives.push(objectiveData);
      } else {
        pendingObjectives.push(objectiveData);
      }
    }

    // If all visible objectives are completed, don't show the quest for this character
    if (pendingObjectives.length === 0 && optionalObjectives.length === 0) return '';

    // Build the quest block in new YAML-like format
    // Show mission name instead of key for better readability
    let questBlock = `- Misión: ${questTemplate.name}
  descripcion: ${questTemplate.description}`;

    // Add pending objectives section
    // Format: YAML-like list with key, descripcion, se_completa_cuando
    if (pendingObjectives.length > 0) {
      const objectiveLines = pendingObjectives.map(obj => {
        let line = `    - key: ${obj.key}
      descripcion: ${obj.description}${obj.progress || ''}`;
        if (obj.completionDescription) {
          line += `
      se_completa_cuando: ${obj.completionDescription}`;
        }
        return line;
      }).join('\n');
      questBlock += `
  objetivos_principales_pendientes:
${objectiveLines}`;
    }

    // Add optional objectives section
    if (optionalObjectives.length > 0) {
      const objectiveLines = optionalObjectives.map(obj => {
        let line = `    - key: ${obj.key}
      descripcion: ${obj.description}${obj.progress || ''}`;
        if (obj.completionDescription) {
          line += `
      se_completa_cuando: ${obj.completionDescription}`;
        }
        return line;
      }).join('\n');
      questBlock += `
  objetivos_opcionales_pendientes:
${objectiveLines}`;
    }

    return questBlock;
  }).filter(q => q).join('\n\n');

  if (!questList) return '';

  // Add header and replace placeholder
  const fullQuestSection = `[MISIONES ACTIVAS]
${questList}`;

  return templateStr.replace('{{activeQuests}}', fullQuestSection);
}

/**
 * Build quest progress block for AI to use
 * This tells the AI what keys it can use to progress quests
 */
export function buildQuestKeysPrompt(
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): string {
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  
  if (activeQuests.length === 0) {
    return '';
  }
  
  const lines: string[] = ['You can progress quests by including these keys in your response:'];
  
  for (const q of activeQuests) {
    const template = templates.find(t => t.id === q.templateId);
    if (!template) continue;
    
    // Incomplete objectives
    for (const obj of template.objectives) {
      const sessionObj = q.objectives.find(o => o.templateId === obj.id);
      if (sessionObj?.isCompleted) continue;
      
      const keys = [obj.completion.key, ...(obj.completion.keys || [])];
      if (keys.length > 0) {
        lines.push(`- ${keys[0]}: ${obj.description} (${template.name})`);
      }
    }
    
    // Quest completion key
    const completionKeys = [template.completion.key, ...(template.completion.keys || [])];
    if (completionKeys.length > 0) {
      lines.push(`- ${completionKeys[0]}: Complete quest "${template.name}"`);
    }
  }
  
  return lines.join('\n');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Reset state for new message
 * IMPORTANT: Must also reset the QuestDetectionState for the session so that
 * each message can detect quest keys independently
 */
export function resetQuestHandlerState(state: QuestHandlerState, messageKey: string, sessionId?: string): void {
  state.processedQuests.delete(messageKey);
  state.triggeredPositions.delete(messageKey);
  
  // Reset the QuestDetectionState for the session so processedLength = 0
  // This allows each new message to be processed from the beginning
  if (sessionId) {
    const detectionState = state.detectionStates.get(sessionId);
    if (detectionState) {
      detectionState.reset();
      console.log(`[QuestHandler] Reset detection state for session ${sessionId}`);
    }
  }
}

/**
 * Reset detection state for a session
 */
export function resetQuestDetectionForSession(
  state: QuestHandlerState,
  sessionId: string
): void {
  const detectionState = state.detectionStates.get(sessionId);
  if (detectionState) {
    detectionState.reset();
  }
}

/**
 * Clear all quest state
 */
export function clearQuestHandlerState(state: QuestHandlerState): void {
  state.processedQuests.clear();
  state.questProgressTracked.clear();
  state.triggeredPositions.clear();
  state.detectionStates.clear();
}

// ============================================
// Export Index
// ============================================

export type { QuestHandlerState, QuestTriggerContext, QuestHandlerResult };
