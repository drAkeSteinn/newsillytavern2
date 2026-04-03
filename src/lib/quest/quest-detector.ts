// ============================================
// Quest Detector - Post-LLM detection of quest triggers
// ============================================
//
// This module detects quest activation, objective progress, and completion
// in LLM responses using detection keys similar to the stats system.
//
// Uses the same system as HUD fields and Stats:
// - key: Primary detection key (always checked first)
// - keys: Alternative detection keys (optional)
// - caseSensitive: Whether to distinguish case
//
// Detection Flow:
// 1. Check for quest ACTIVATION keys (in 'available' quests)
// 2. Check for OBJECTIVE progress keys (in 'active' quests)
// 3. Check for QUEST COMPLETION keys (in 'active' quests)
// 4. Check for TURN-BASED activation (if method is 'turn')

import type {
  QuestTemplate,
  SessionQuestInstance,
  QuestObjectiveTemplate,
  QuestTriggerHit,
  QuestReward,
  QuestActivationConfig,
  QuestCompletionConfig,
  QuestValueCondition,
  QuestNumberOperator,
  QuestTextOperator,
  QuestSettings,
} from '@/types';

// ============================================
// Types
// ============================================

export type QuestDetectionAction = 'activate' | 'progress' | 'complete' | 'fail';

export interface QuestActivationDetection {
  templateId: string;
  template: QuestTemplate;
  matchedKey: string;
  matchedText: string;
  position: number;
}

export interface QuestObjectiveDetection {
  templateId: string;
  objectiveId: string;
  template: QuestTemplate;
  objective: QuestObjectiveTemplate;
  matchedKey: string;
  matchedText: string;
  position: number;
  countProgress: number; // How much to increment
}

export interface QuestCompletionDetection {
  templateId: string;
  template: QuestTemplate;
  matchedKey: string;
  matchedText: string;
  position: number;
}

export interface QuestDetectionResult {
  activations: QuestActivationDetection[];
  objectiveProgress: QuestObjectiveDetection[];
  completions: QuestCompletionDetection[];
  hasDetections: boolean;
}

// ============================================
// Key Extraction (Similar to Stats Detector)
// ============================================

/**
 * Get all detection keys from an activation config
 * 
 * Priority:
 * 1. Use activation.key as primary key
 * 2. Add activation.keys[] as alternative keys
 */
export function getActivationKeys(activation: QuestActivationConfig): string[] {
  const allKeys: string[] = [];
  
  // Primary key is always included
  if (activation.key) {
    allKeys.push(activation.key);
  }
  
  // Add alternative keys
  if (activation.keys && activation.keys.length > 0) {
    for (const key of activation.keys) {
      if (key && !allKeys.includes(key)) {
        allKeys.push(key);
      }
    }
  }
  
  return allKeys;
}

/**
 * Get all detection keys from a completion config
 */
export function getCompletionKeys(completion: QuestCompletionConfig): string[] {
  const allKeys: string[] = [];
  
  if (completion.key) {
    allKeys.push(completion.key);
  }
  
  if (completion.keys && completion.keys.length > 0) {
    for (const key of completion.keys) {
      if (key && !allKeys.includes(key)) {
        allKeys.push(key);
      }
    }
  }
  
  return allKeys;
}

/**
 * Get all detection keys from an objective's completion config
 */
export function getObjectiveKeys(objective: QuestObjectiveTemplate): string[] {
  const allKeys: string[] = [];
  
  if (objective.completion?.key) {
    allKeys.push(objective.completion.key);
  }
  
  if (objective.completion?.keys && objective.completion.keys.length > 0) {
    for (const key of objective.completion.keys) {
      if (key && !allKeys.includes(key)) {
        allKeys.push(key);
      }
    }
  }
  
  return allKeys;
}

// ============================================
// Prefix + Key Variant Generation
// ============================================

/**
 * Genera todas las variantes de combinación prefijo + key
 * 
 * El sistema detecta múltiples formatos automáticamente:
 * - "Prefijo:key" (dos puntos sin espacio)
 * - "Prefijo: key" (dos puntos con espacio)
 * - "Prefijo=key" (igual sin espacio)
 * - "Prefijo = key" (igual con espacio)
 * - "Prefijo key" (solo espacio)
 * - "Prefijo_key" (guión bajo)
 * 
 * Ejemplo:
 * prefix: "Objetivo", key: "conseguir_madera"
 * Genera: ["Objetivo:conseguir_madera", "Objetivo: conseguir_madera", 
 *          "Objetivo=conseguir_madera", "Objetivo = conseguir_madera",
 *          "Objetivo conseguir_madera", "Objetivo_conseguir_madera"]
 */
export function generatePrefixKeyVariants(prefix: string, key: string): string[] {
  if (!prefix || prefix.trim() === '') {
    // Sin prefijo, retornar solo la key
    return [key];
  }
  
  const normalizedPrefix = prefix.trim();
  const normalizedKey = key.trim();
  
  const variants: string[] = [];
  
  // Separadores a probar (con y sin espacios)
  const separators = [
    ':',      // Dos puntos
    ': ',     // Dos puntos + espacio
    '=',      // Igual
    ' = ',    // Igual con espacios
    ' ',      // Solo espacio
    '_',      // Guión bajo
  ];
  
  for (const sep of separators) {
    variants.push(`${normalizedPrefix}${sep}${normalizedKey}`);
  }
  
  // También agregar variantes con key con espacios (guiones bajos -> espacios)
  if (normalizedKey.includes('_')) {
    const keyWithSpaces = normalizedKey.replace(/_/g, ' ');
    for (const sep of separators) {
      if (sep !== ' ' && sep !== '_') { // Evitar duplicados
        variants.push(`${normalizedPrefix}${sep}${keyWithSpaces}`);
      }
    }
    // Variante solo con espacio
    variants.push(`${normalizedPrefix} ${keyWithSpaces}`);
  }
  
  return variants;
}

/**
 * Aplica prefijo a todas las keys de una lista
 * Retorna una lista expandida con todas las variantes
 */
export function applyPrefixToKeys(
  keys: string[],
  prefix?: string
): string[] {
  if (!prefix || prefix.trim() === '') {
    return keys;
  }
  
  const expandedKeys: string[] = [];
  
  for (const key of keys) {
    const variants = generatePrefixKeyVariants(prefix, key);
    expandedKeys.push(...variants);
  }
  
  return expandedKeys;
}

/**
 * Obtiene las keys de activación con prefijo aplicado
 */
export function getActivationKeysWithPrefix(
  activation: QuestActivationConfig,
  questSettings?: QuestSettings
): string[] {
  // Obtener keys base
  const baseKeys = getActivationKeys(activation);
  
  // Aplicar prefijo si está configurado
  const prefix = questSettings?.questActivationPrefix;
  if (prefix && prefix.trim() !== '') {
    return applyPrefixToKeys(baseKeys, prefix);
  }
  
  return baseKeys;
}

/**
 * Obtiene las keys de completado de quest con prefijo aplicado
 */
export function getCompletionKeysWithPrefix(
  completion: QuestCompletionConfig,
  questSettings?: QuestSettings
): string[] {
  const baseKeys = getCompletionKeys(completion);
  
  const prefix = questSettings?.questCompletionPrefix;
  if (prefix && prefix.trim() !== '') {
    return applyPrefixToKeys(baseKeys, prefix);
  }
  
  return baseKeys;
}

/**
 * Obtiene las keys de completado de objetivo con prefijo aplicado
 */
export function getObjectiveKeysWithPrefix(
  objective: QuestObjectiveTemplate,
  questSettings?: QuestSettings
): string[] {
  const baseKeys = getObjectiveKeys(objective);
  
  const prefix = questSettings?.objectiveCompletionPrefix;
  if (prefix && prefix.trim() !== '') {
    return applyPrefixToKeys(baseKeys, prefix);
  }
  
  return baseKeys;
}

/**
 * Genera una key de ejemplo para mostrar en UI
 * Retorna la primera variante (la más común: prefix:key)
 */
export function getExampleKey(prefix?: string, key?: string): string {
  if (!key) return '';
  if (!prefix || prefix.trim() === '') return key;
  return `${prefix.trim()}:${key.trim()}`;
}

// ============================================
// Key Matching
// ============================================

/**
 * Normalize a key for case-insensitive matching
 */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Check if text contains any of the detection keys
 * 
 * Uses word boundaries for single-word keys to prevent false positives:
 * - "risa" won't match "marisa" (word boundary required)
 * - Multi-word keys use phrase matching
 */
function findKeyMatch(
  text: string,
  keys: string[],
  caseSensitive: boolean
): { matchedKey: string; matchedText: string; position: number } | null {
  for (const key of keys) {
    // Create pattern to find the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // For single-word keys, use word boundaries to prevent partial matches
    // For multi-word keys, use phrase matching
    const keyWords = key.trim().split(/\s+/);
    const patternStr = keyWords.length === 1 
      ? `(^|[^\\w])${escapedKey}([^\\w]|$)`  // Word boundary for single words
      : escapedKey;  // Phrase matching for multi-word keys
    
    const pattern = new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // For word boundary matches, return the actual key, not the boundary chars
      const matchedText = match[0].replace(/^[^\w]+|[^\w]+$/g, '') || match[0];
      return {
        matchedKey: key,
        matchedText,
        position: match.index,
      };
    }
  }
  
  return null;
}

// ============================================
// Value Extraction and Comparison
// ============================================

/**
 * Extract the value after a key in text
 * 
 * Supports formats:
 * - "key: valor" (colon separator)
 * - "key=valor" (equals separator)
 * - "key valor" (space separator)
 * 
 * Returns the extracted value or null if not found
 */
export function extractValueAfterKey(
  text: string,
  key: string,
  caseSensitive: boolean
): { value: string; position: number } | null {
  // Create pattern to find key followed by separator and value
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Pattern: key followed by (:|=|space) then capture the value
  // The value can be a number or text until end of line or next punctuation
  const pattern = new RegExp(
    `${escapedKey}\\s*[:=]?\\s*([\\w\\s.-]+?)(?=[,.!?;\\n]|$)`,
    caseSensitive ? 'g' : 'gi'
  );
  
  const match = pattern.exec(text);
  if (match && match[1]) {
    const value = match[1].trim();
    if (value) {
      return {
        value,
        position: match.index,
      };
    }
  }
  
  return null;
}

/**
 * Compare a numeric value against a target using an operator
 */
export function compareNumberValue(
  actualValue: number,
  targetValue: number,
  operator: QuestNumberOperator
): boolean {
  switch (operator) {
    case '>': return actualValue > targetValue;
    case '<': return actualValue < targetValue;
    case '>=': return actualValue >= targetValue;
    case '<=': return actualValue <= targetValue;
    case '==': return actualValue === targetValue;
    case '!=': return actualValue !== targetValue;
    default: return false;
  }
}

/**
 * Compare a text value against a target using an operator
 */
export function compareTextValue(
  actualValue: string,
  targetValue: string,
  operator: QuestTextOperator,
  caseSensitive: boolean
): boolean {
  const actual = caseSensitive ? actualValue : actualValue.toLowerCase();
  const target = caseSensitive ? targetValue : targetValue.toLowerCase();
  
  switch (operator) {
    case 'equals': return actual === target;
    case 'contains': return actual.includes(target);
    case 'startsWith': return actual.startsWith(target);
    case 'endsWith': return actual.endsWith(target);
    case 'notEquals': return actual !== target;
    default: return false;
  }
}

/**
 * Check if a value condition is met in text
 * 
 * @param text - The text to search in
 * @param keys - All keys to try (primary + alternatives)
 * @param caseSensitive - Whether to be case sensitive
 * @param condition - The value condition to check
 * @returns result with matched key info if condition is met
 */
export function checkValueCondition(
  text: string,
  keys: string[],
  caseSensitive: boolean,
  condition: QuestValueCondition | undefined
): { matched: boolean; matchedKey?: string; extractedValue?: string | number; message?: string } {
  // If no condition or presence type, just check if any key exists
  if (!condition || condition.valueType === 'presence') {
    const keyMatch = findKeyMatch(text, keys, caseSensitive);
    return {
      matched: keyMatch !== null,
      matchedKey: keyMatch?.matchedKey,
      message: keyMatch ? 'Key found (presence detection)' : 'Key not found',
    };
  }
  
  // Try each key until one works
  for (const key of keys) {
    // Extract the value after the key
    const extracted = extractValueAfterKey(text, key, caseSensitive);
    
    if (!extracted) {
      continue; // Try next key
    }
    
    const { value: extractedStr } = extracted;
    
    // Handle number comparison
    if (condition.valueType === 'number') {
      const numValue = parseFloat(extractedStr);
      
      if (isNaN(numValue)) {
        continue; // Try next key - extracted value is not a number
      }
      
      const targetValue = typeof condition.targetValue === 'number' 
        ? condition.targetValue 
        : parseFloat(String(condition.targetValue));
      
      if (isNaN(targetValue)) {
        return {
          matched: false,
          extractedValue: numValue,
          message: `Target value "${condition.targetValue}" is not a valid number`,
        };
      }
      
      const operator = condition.operator as QuestNumberOperator || '==';
      const matched = compareNumberValue(numValue, targetValue, operator);
      
      if (matched) {
        return {
          matched: true,
          matchedKey: key,
          extractedValue: numValue,
          message: `${numValue} ${operator} ${targetValue} = ${matched}`,
        };
      }
    }
    
    // Handle text comparison
    if (condition.valueType === 'text') {
      const targetValue = String(condition.targetValue || '');
      const operator = condition.operator as QuestTextOperator || 'equals';
      const matched = compareTextValue(extractedStr, targetValue, operator, caseSensitive);
      
      if (matched) {
        return {
          matched: true,
          matchedKey: key,
          extractedValue: extractedStr,
          message: `"${extractedStr}" ${operator} "${targetValue}" = ${matched}`,
        };
      }
    }
  }
  
  // No key matched with the condition
  return {
    matched: false,
    message: 'No key matched the value condition',
  };
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect quest activations in text
 * 
 * Checks if any 'available' quest's activation keys are present
 * Supports prefix-based key detection
 */
export function detectQuestActivations(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  questSettings?: QuestSettings
): QuestActivationDetection[] {
  const detections: QuestActivationDetection[] = [];
  
  // Get templates for quests that are 'available' (not yet activated)
  const availableQuestTemplateIds = sessionQuests
    .filter(q => q.status === 'available')
    .map(q => q.templateId);
  
  console.log('[QuestDetector] detectQuestActivations:', {
    textPreview: text.substring(0, 100) + '...',
    availableQuestTemplateIds,
    templatesCount: templates.length,
    hasPrefix: !!questSettings?.questActivationPrefix,
  });
  
  for (const template of templates) {
    // Skip if not available in this session
    if (!availableQuestTemplateIds.includes(template.id)) {
      console.log(`[QuestDetector] Template "${template.name}" (${template.id}) not in available quests, skipping`);
      continue;
    }
    
    // Skip if activation method is not 'keyword'
    if (template.activation.method !== 'keyword') {
      console.log(`[QuestDetector] Template "${template.name}" activation method is "${template.activation.method}", skipping`);
      continue;
    }
    
    // Usar función con soporte de prefijo
    const keys = getActivationKeysWithPrefix(template.activation, questSettings);
    if (keys.length === 0) {
      console.log(`[QuestDetector] Template "${template.name}" has no activation keys, skipping`);
      continue;
    }
    
    console.log(`[QuestDetector] Checking template "${template.name}" with keys:`, keys);
    
    const match = findKeyMatch(
      text,
      keys,
      template.activation.caseSensitive
    );
    
    if (match) {
      console.log(`[QuestDetector] MATCH FOUND! Template "${template.name}" matched key "${match.matchedKey}" at position ${match.position}`);
      detections.push({
        templateId: template.id,
        template,
        matchedKey: match.matchedKey,
        matchedText: match.matchedText,
        position: match.position,
      });
    } else {
      console.log(`[QuestDetector] No match for template "${template.name}" in text`);
    }
  }
  
  console.log(`[QuestDetector] Total detections: ${detections.length}`);
  return detections;
}

/**
 * Detect objective progress in text
 * 
 * Checks if any 'active' quest's objective keys are present
 * Now supports value condition checking (number/text comparison)
 * Supports prefix-based key detection
 */
export function detectObjectiveProgress(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  questSettings?: QuestSettings
): QuestObjectiveDetection[] {
  const detections: QuestObjectiveDetection[] = [];
  
  // Get active quests
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  
  console.log('[QuestDetector] detectObjectiveProgress:', {
    textPreview: text.substring(0, 100) + '...',
    activeQuestsCount: activeQuests.length,
    hasPrefix: !!questSettings?.objectiveCompletionPrefix,
  });
  
  for (const sessionQuest of activeQuests) {
    const template = templates.find(t => t.id === sessionQuest.templateId);
    if (!template) continue;
    
    // Check each objective
    for (const objective of template.objectives) {
      // Find session objective
      const sessionObj = sessionQuest.objectives.find(o => o.templateId === objective.id);
      
      // Skip if already completed
      if (sessionObj?.isCompleted) continue;
      
      // Usar función con soporte de prefijo
      const keys = getObjectiveKeysWithPrefix(objective, questSettings);
      if (keys.length === 0) continue;
      
      // Check value condition if specified
      const valueCondition = objective.completion.valueCondition;
      
      // Always use checkValueCondition (handles both presence and value comparison)
      // It now properly checks all keys (primary + alternatives)
      const result = checkValueCondition(
        text,
        keys,
        objective.completion.caseSensitive,
        valueCondition
      );
      
      console.log(`[QuestDetector] Objective "${objective.description}" check:`, {
        keys,
        valueCondition: valueCondition ? valueCondition.valueType : 'none',
        result
      });
      
      if (result.matched) {
        console.log(`[QuestDetector] Objective "${objective.description}" matched!`);
        detections.push({
          templateId: template.id,
          objectiveId: objective.id,
          template,
          objective,
          matchedKey: result.matchedKey || keys[0],
          matchedText: String(result.extractedValue || ''),
          position: 0,
          countProgress: 1,
        });
      }
    }
  }
  
  console.log(`[QuestDetector] Total objective detections: ${detections.length}`);
  return detections;
}

/**
 * Detect quest completions in text
 * 
 * Checks if any 'active' quest's completion keys are present
 * Now supports value condition checking (number/text comparison)
 * Supports prefix-based key detection
 */
export function detectQuestCompletions(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  questSettings?: QuestSettings
): QuestCompletionDetection[] {
  const detections: QuestCompletionDetection[] = [];
  
  // Get active quests
  const activeQuests = sessionQuests.filter(q => q.status === 'active');
  
  console.log('[QuestDetector] detectQuestCompletions:', {
    textPreview: text.substring(0, 100) + '...',
    activeQuestsCount: activeQuests.length,
    hasPrefix: !!questSettings?.questCompletionPrefix,
  });
  
  for (const sessionQuest of activeQuests) {
    const template = templates.find(t => t.id === sessionQuest.templateId);
    if (!template) continue;
    
    // Usar función con soporte de prefijo
    const keys = getCompletionKeysWithPrefix(template.completion, questSettings);
    if (keys.length === 0) continue;
    
    // Check if valueCondition is specified
    const valueCondition = template.completion.valueCondition;
    
    // Always use checkValueCondition (handles both presence and value comparison)
    // It now properly checks all keys (primary + alternatives)
    const result = checkValueCondition(
      text,
      keys,
      template.completion.caseSensitive,
      valueCondition
    );
    
    console.log(`[QuestDetector] Quest "${template.name}" completion check:`, {
      keys,
      valueCondition: valueCondition ? valueCondition.valueType : 'none',
      result
    });
    
    if (result.matched) {
      console.log(`[QuestDetector] Quest "${template.name}" completion matched!`);
      detections.push({
        templateId: template.id,
        template,
        matchedKey: result.matchedKey || keys[0],
        matchedText: String(result.extractedValue || ''),
        position: 0,
      });
    }
  }
  
  return detections;
}

/**
 * Main detection function - detects all quest events
 * Supports prefix-based key detection
 */
export function detectQuestEvents(
  text: string,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[],
  questSettings?: QuestSettings
): QuestDetectionResult {
  const activations = detectQuestActivations(text, templates, sessionQuests, questSettings);
  const objectiveProgress = detectObjectiveProgress(text, templates, sessionQuests, questSettings);
  const completions = detectQuestCompletions(text, templates, sessionQuests, questSettings);
  
  return {
    activations,
    objectiveProgress,
    completions,
    hasDetections: activations.length > 0 || objectiveProgress.length > 0 || completions.length > 0,
  };
}

// ============================================
// Turn-Based Activation
// ============================================

/**
 * Check if any quests should activate based on turn count
 */
export function checkTurnBasedActivation(
  currentTurn: number,
  templates: QuestTemplate[],
  sessionQuests: SessionQuestInstance[]
): QuestActivationDetection[] {
  const activations: QuestActivationDetection[] = [];
  
  // Get templates for quests that are 'available'
  const availableQuestTemplateIds = sessionQuests
    .filter(q => q.status === 'available')
    .map(q => q.templateId);
  
  for (const template of templates) {
    if (!availableQuestTemplateIds.includes(template.id)) continue;
    
    // Skip if activation method is not 'turn'
    if (template.activation.method !== 'turn') continue;
    
    const turnInterval = template.activation.turnInterval || 1;
    
    // Check if current turn matches interval
    if (currentTurn > 0 && currentTurn % turnInterval === 0) {
      activations.push({
        templateId: template.id,
        template,
        matchedKey: `turn:${currentTurn}`,
        matchedText: `Turn ${currentTurn} activation`,
        position: 0,
      });
    }
  }
  
  return activations;
}

// ============================================
// Convert to Trigger Hits
// ============================================

/**
 * Convert activation detections to trigger hits
 */
export function activationsToTriggerHits(
  detections: QuestActivationDetection[]
): QuestTriggerHit[] {
  return detections.map(d => ({
    questId: d.templateId,
    template: d.template,
    action: 'activate' as const,
    message: `Quest "${d.template.name}" activated`,
  }));
}

/**
 * Convert objective detections to trigger hits
 * 
 * Now includes objective rewards and completion flag when the objective
 * will be completed with this progress.
 */
export function objectivesToTriggerHits(
  detections: QuestObjectiveDetection[],
  sessionQuests: SessionQuestInstance[]
): QuestTriggerHit[] {
  return detections.map(d => {
    // Find the session quest to check current progress
    const sessionQuest = sessionQuests.find(q => q.templateId === d.templateId);
    const sessionObj = sessionQuest?.objectives.find(o => o.templateId === d.objectiveId);
    
    // Calculate if this progress completes the objective
    const currentCount = sessionObj?.currentCount || 0;
    const targetCount = d.objective.targetCount || 1;
    const newCount = Math.min(currentCount + d.countProgress, targetCount);
    const willComplete = !sessionObj?.isCompleted && newCount >= targetCount;
    
    return {
      questId: d.templateId,
      template: d.template,
      objectiveId: d.objectiveId,
      objective: d.objective,
      action: 'progress' as const,
      progress: d.countProgress,
      message: `Objective "${d.objective.description}" progressed`,
      // Include objective rewards if this progress will complete the objective
      objectiveRewards: willComplete && d.objective.rewards ? d.objective.rewards : undefined,
      completesObjective: willComplete,
    };
  });
}

/**
 * Convert completion detections to trigger hits
 */
export function completionsToTriggerHits(
  detections: QuestCompletionDetection[]
): QuestTriggerHit[] {
  return detections.map(d => ({
    questId: d.templateId,
    template: d.template,
    action: 'complete' as const,
    message: `Quest "${d.template.name}" completed`,
    rewards: d.template.rewards,
  }));
}

// ============================================
// Streaming Support
// ============================================

/**
 * Quest detection state for streaming
 * 
 * Tracks which detections have already been processed to avoid
 * duplicates when streaming causes text windows to overlap.
 */
export class QuestDetectionState {
  private processedLength: number = 0;
  private processedActivations: Set<string> = new Set(); // templateIds already activated
  private processedObjectives: Set<string> = new Set(); // templateId:objectiveId already progressed
  private processedCompletions: Set<string> = new Set(); // templateIds already completed
  private processedPositions: Set<number> = new Set();
  
  /**
   * Process new text incrementally
   */
  processNewText(
    newText: string,
    fullText: string,
    templates: QuestTemplate[],
    sessionQuests: SessionQuestInstance[]
  ): QuestDetectionResult {
    // Only process NEW content
    const newContent = fullText.slice(this.processedLength);
    
    if (!newContent.trim()) {
      this.processedLength = fullText.length;
      return {
        activations: [],
        objectiveProgress: [],
        completions: [],
        hasDetections: false,
      };
    }
    
    // Detect in new content
    const rawResult = detectQuestEvents(newContent, templates, sessionQuests);
    
    // Adjust positions to be relative to full text
    for (const d of rawResult.activations) {
      d.position += this.processedLength;
    }
    for (const d of rawResult.objectiveProgress) {
      d.position += this.processedLength;
    }
    for (const d of rawResult.completions) {
      d.position += this.processedLength;
    }
    
    // Filter out already processed detections
    const filteredActivations = rawResult.activations.filter(d => {
      if (this.processedActivations.has(d.templateId)) return false;
      if (this.processedPositions.has(d.position)) return false;
      this.processedActivations.add(d.templateId);
      this.processedPositions.add(d.position);
      return true;
    });
    
    const filteredObjectives = rawResult.objectiveProgress.filter(d => {
      const key = `${d.templateId}:${d.objectiveId}`;
      // Check if this objective was already processed in this stream
      if (this.processedObjectives.has(key)) return false;
      if (this.processedPositions.has(d.position)) return false;
      // Mark this objective as processed
      this.processedObjectives.add(key);
      this.processedPositions.add(d.position);
      return true;
    });
    
    const filteredCompletions = rawResult.completions.filter(d => {
      if (this.processedCompletions.has(d.templateId)) return false;
      if (this.processedPositions.has(d.position)) return false;
      this.processedCompletions.add(d.templateId);
      this.processedPositions.add(d.position);
      return true;
    });
    
    this.processedLength = fullText.length;
    
    return {
      activations: filteredActivations,
      objectiveProgress: filteredObjectives,
      completions: filteredCompletions,
      hasDetections: filteredActivations.length > 0 || filteredObjectives.length > 0 || filteredCompletions.length > 0,
    };
  }
  
  /**
   * Reset state for new message
   */
  reset(): void {
    this.processedLength = 0;
    this.processedActivations.clear();
    this.processedObjectives.clear();
    this.processedCompletions.clear();
    this.processedPositions.clear();
  }
  
  /**
   * Mark a quest as activated (external trigger)
   */
  markActivated(templateId: string): void {
    this.processedActivations.add(templateId);
  }
  
  /**
   * Mark a quest as completed (external trigger)
   */
  markCompleted(templateId: string): void {
    this.processedCompletions.add(templateId);
  }
}

/**
 * Create a new quest detection state
 */
export function createQuestDetectionState(): QuestDetectionState {
  return new QuestDetectionState();
}

// ============================================
// Trigger System Integration
// ============================================

/**
 * Quest trigger context for the trigger handler
 */
export interface QuestTriggerContext {
  sessionId: string;
  fullText: string;
  isStreaming: boolean;
  messageKey: string;
  timestamp: number;
  templates: QuestTemplate[];
  sessionQuests: SessionQuestInstance[];
  turnCount: number;
}

/**
 * Quest handler result for trigger system
 */
export interface QuestHandlerResult {
  matched: boolean;
  hits: QuestTriggerHit[];
  detections: QuestDetectionResult;
}

/**
 * Create quest handler state for trigger system
 */
export function createQuestHandlerState() {
  return {
    detectionStates: new Map<string, QuestDetectionState>(),
  };
}

/**
 * Check quest triggers during streaming
 */
export function checkQuestTriggersInText(
  context: QuestTriggerContext,
  handlerState: { detectionStates: Map<string, QuestDetectionState> }
): QuestHandlerResult {
  const { sessionId, fullText, templates, sessionQuests, turnCount } = context;
  
  if (!templates.length || !sessionQuests.length) {
    return {
      matched: false,
      hits: [],
      detections: {
        activations: [],
        objectiveProgress: [],
        completions: [],
        hasDetections: false,
      },
    };
  }
  
  // Get or create detection state for this session
  let state = handlerState.detectionStates.get(sessionId);
  if (!state) {
    state = createQuestDetectionState();
    handlerState.detectionStates.set(sessionId, state);
  }
  
  // Process new text
  const detections = state.processNewText(fullText, fullText, templates, sessionQuests);
  
  // Also check turn-based activations
  const turnActivations = checkTurnBasedActivation(turnCount, templates, sessionQuests);
  
  // Filter turn activations that haven't been processed
  const newTurnActivations = turnActivations.filter(d => {
    const key = `${d.templateId}:turn:${turnCount}`;
    // We'll add these to detections
    return true;
  });
  
  // Combine all detections
  detections.activations.push(...newTurnActivations);
  detections.hasDetections = detections.activations.length > 0 || 
                              detections.objectiveProgress.length > 0 || 
                              detections.completions.length > 0;
  
  if (!detections.hasDetections) {
    return {
      matched: false,
      hits: [],
      detections,
    };
  }
  
  // Convert to trigger hits
  const hits: QuestTriggerHit[] = [
    ...activationsToTriggerHits(detections.activations),
    ...objectivesToTriggerHits(detections.objectiveProgress, sessionQuests),
    ...completionsToTriggerHits(detections.completions),
  ];
  
  return {
    matched: true,
    hits,
    detections,
  };
}

/**
 * Reset quest handler state for new message
 */
export function resetQuestDetectorState(
  handlerState: { detectionStates: Map<string, QuestDetectionState> },
  sessionId: string
): void {
  const state = handlerState.detectionStates.get(sessionId);
  if (state) {
    state.reset();
  }
}

/**
 * Clear all quest detection state
 */
export function clearQuestDetectorState(
  handlerState: { detectionStates: Map<string, QuestDetectionState> }
): void {
  handlerState.detectionStates.clear();
}

// ============================================
// Quest Chain Helpers
// ============================================

/**
 * Get the next quest to activate after completing a quest
 */
export function getNextQuestInChain(
  completedTemplate: QuestTemplate,
  allTemplates: QuestTemplate[]
): QuestTemplate | null {
  const chain = completedTemplate.chain;
  
  if (!chain || chain.type === 'none') {
    return null;
  }
  
  if (chain.type === 'specific' && chain.nextQuestId) {
    return allTemplates.find(t => t.id === chain.nextQuestId) || null;
  }
  
  if (chain.type === 'random' && chain.randomPool && chain.randomPool.length > 0) {
    // Pick a random quest from the pool
    const randomIndex = Math.floor(Math.random() * chain.randomPool.length);
    const randomId = chain.randomPool[randomIndex];
    return allTemplates.find(t => t.id === randomId) || null;
  }
  
  return null;
}

/**
 * Check if a quest should auto-start when its chain predecessor completes
 */
export function shouldAutoStartChain(chain: QuestTemplate['chain']): boolean {
  return chain?.autoStart === true;
}

// ============================================
// Export Index
// ============================================

export type {
  QuestDetectionAction,
  QuestActivationDetection,
  QuestObjectiveDetection,
  QuestCompletionDetection,
  QuestDetectionResult,
  QuestTriggerContext,
  QuestHandlerResult,
};
