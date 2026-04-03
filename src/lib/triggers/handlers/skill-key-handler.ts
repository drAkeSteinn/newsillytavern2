// ============================================
// Skill Key Handler - Unified KeyHandler Implementation
// ============================================
//
// Implements the KeyHandler interface for skill activations.
// Works with DetectedKey[] from the unified KeyDetector.

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { CharacterStatsConfig, SessionStats, SkillDefinition } from '@/types';
import type { UpdateCharacterStatResult, ThresholdReachedInfo } from '@/store/slices/statsSlice';
import { normalizeKey, keyMatches } from '../key-detector';
import {
  createSkillActivationHandlerState,
  checkSkillActivationTriggersInText,
  executeAllSkillActivations,
  type SkillActivationHandlerState,
  type SkillActivationTriggerContext,
} from './skill-activation-handler';

// ============================================
// Types
// ============================================

export interface SkillKeyHandlerContext extends TriggerContext {
  characterId: string;
  characterName?: string;  // For ultima_accion_realizada format
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  sessionId: string;
  storeActions?: {
    updateCharacterStat: (
      sessionId: string,
      characterId: string,
      attributeKey: string,
      value: number | string,
      reason?: 'llm_detection' | 'manual' | 'trigger'
    ) => UpdateCharacterStatResult;
    updateSessionEvent?: (
      sessionId: string,
      eventType: 'ultimo_objetivo_completado' | 'ultima_solicitud_completada' | 'ultima_solicitud_realizada' | 'ultima_accion_realizada',
      description: string
    ) => void;
  };
}

// Track activated skill positions to prevent duplicates
interface SkillActivationPosition {
  skillId: string;
  position: number;
  length: number;
}

// Check if two position ranges overlap
function positionsOverlap(pos1: { position: number; length: number }, pos2: { position: number; length: number }): boolean {
  const end1 = pos1.position + pos1.length;
  const end2 = pos2.position + pos2.length;
  return pos1.position < end2 && pos2.position < end1;
}

// ============================================
// Skill Key Handler Class
// ============================================

export class SkillKeyHandler implements KeyHandler {
  readonly id = 'skill';
  readonly type = 'skill' as const;
  readonly priority = 90; // High priority - skills affect stats
  
  private state: SkillActivationHandlerState;
  
  // Track activation positions per message to prevent duplicate activations
  // when the same skill is detected via different formats (word vs key:value)
  private activationPositions: Map<string, SkillActivationPosition[]> = new Map();
  
  constructor() {
    this.state = createSkillActivationHandlerState();
  }
  
  /**
   * Check if a skill has already been activated at an overlapping position
   */
  private isAlreadyActivatedAtPosition(messageKey: string, skillId: string, position: number, length: number): boolean {
    const positions = this.activationPositions.get(messageKey) || [];
    for (const pos of positions) {
      if (pos.skillId === skillId && positionsOverlap(pos, { position, length })) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Record a skill activation position
   */
  private recordActivation(messageKey: string, skillId: string, position: number, length: number): void {
    const positions = this.activationPositions.get(messageKey) || [];
    positions.push({ skillId, position, length });
    this.activationPositions.set(messageKey, positions);
  }
  
  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const skillContext = context as SkillKeyHandlerContext;
    
    // Check if stats system is enabled
    if (!skillContext.statsConfig?.enabled) {
      return false;
    }
    
    // Get skills with activation keys
    const skillsWithKeys = skillContext.statsConfig.skills.filter(
      s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0)
    );
    
    if (skillsWithKeys.length === 0) {
      return false;
    }
    
    // Check if key matches any skill activation key
    for (const skill of skillsWithKeys) {
      // Check primary activation key - match against key.key OR key.value (for key=value format)
      if (skill.activationKey) {
        const normalizedActivationKey = normalizeKey(skill.activationKey);
        // Match against key (e.g., "golpe" matches "golpe")
        if (keyMatches(key.key, normalizedActivationKey)) {
          return true;
        }
        // For key=value format, also match against value (e.g., "Accion=hab1" matches activationKey "hab1")
        if (key.value && keyMatches(key.value, normalizedActivationKey)) {
          return true;
        }
      }
      
      // Check alternative activation keys
      for (const altKey of (skill.activationKeys || [])) {
        const normalizedAltKey = normalizeKey(altKey);
        if (keyMatches(key.key, normalizedAltKey) || (key.value && keyMatches(key.value, normalizedAltKey))) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const skillContext = context as SkillKeyHandlerContext;
    
    if (!skillContext.statsConfig?.enabled) return null;
    
    // Get skills with activation keys
    const skillsWithKeys = skillContext.statsConfig.skills.filter(
      s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0)
    );
    
    // Find matching skill
    for (const skill of skillsWithKeys) {
      const allKeys = [
        skill.activationKey,
        ...(skill.activationKeys || [])
      ].filter(Boolean);
      
      for (const activationKey of allKeys) {
        const normalizedActivationKey = normalizeKey(activationKey!);
        
        // Check both key.key and key.value (for key=value format like "Accion=hab1")
        const keyMatchesActivation = keyMatches(key.key, normalizedActivationKey) || 
          (key.value && keyMatches(normalizeKey(key.value), normalizedActivationKey));
        
        if (keyMatchesActivation) {
          // Check if this skill was already activated at this position (prevent duplicates)
          const messageKey = context.messageKey || 'default';
          if (this.isAlreadyActivatedAtPosition(messageKey, skill.id, key.position, key.length)) {
            console.log(`[SkillKeyHandler] Skill ${skill.name} already activated at position ${key.position}, skipping duplicate`);
            return null;
          }
          
          // Record this activation position
          this.recordActivation(messageKey, skill.id, key.position, key.length);
          
          return {
            matched: true,
            trigger: {
              triggerId: `skill_${skill.id}_${Date.now()}`, // Unique ID for each activation
              triggerType: 'skill',
              keyword: activationKey!,
              data: {
                skillId: skill.id,
                skillName: skill.name,
                skillDescription: skill.description, // Include skill description for ultima_accion_realizada
                skillKey: skill.key,
                matchedKey: key.key,
                activationCosts: skill.activationCosts || [],
                activationRewards: skill.activationRewards || [],
                // Track position for deduplication
                position: key.position,
                length: key.length,
              },
            },
            key,
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Execute the trigger action
   * Returns thresholds reached so the caller can execute the effects
   */
  execute(match: TriggerMatch, context: TriggerContext): { thresholdsReached: ThresholdReachedInfo[] } {
    const skillContext = context as SkillKeyHandlerContext;
    const { skillId, skillName, skillDescription, activationCosts, activationRewards } = match.data as {
      skillId: string;
      skillName: string;
      skillDescription?: string;
      activationCosts: any[];
      activationRewards: any[];
    };
    
    console.log(`[SkillKeyHandler] Executing skill: ${skillName}`);
    
    // Collect all thresholds reached
    const allThresholdsReached: ThresholdReachedInfo[] = [];
    
    // Save ultima_accion_realizada for {{eventos}} key
    if (skillContext.storeActions?.updateSessionEvent) {
      const characterName = skillContext.characterName || skillContext.characterId;
      const actionDescription = `${characterName} - ${skillName}${skillDescription ? `: ${skillDescription}` : ''}`;
      skillContext.storeActions.updateSessionEvent(
        skillContext.sessionId,
        'ultima_accion_realizada',
        actionDescription
      );
      console.log(`[SkillKeyHandler] Saved ultima_accion_realizada: ${actionDescription}`);
    }
    
    // Execute costs if store actions provided
    if (skillContext.storeActions && activationCosts.length > 0) {
      const charStats = skillContext.sessionStats?.characterStats?.[skillContext.characterId];
      const currentValues = charStats?.attributeValues || {};

      for (const cost of activationCosts) {
        if (!cost.attributeKey) continue;

        const attribute = skillContext.statsConfig?.attributes.find(a => a.key === cost.attributeKey);
        if (!attribute) {
          console.warn(`[SkillKeyHandler] Attribute not found for cost: ${cost.attributeKey}`);
          continue;
        }

        const oldValue = currentValues[cost.attributeKey] ?? attribute.defaultValue ?? 0;
        let newValue = this.applyCost(oldValue, cost);

        // Apply min/max constraints
        if (typeof newValue === 'number') {
          if (attribute.min !== undefined) newValue = Math.max(newValue, attribute.min);
          if (attribute.max !== undefined) newValue = Math.min(newValue, attribute.max);
        }

        // Call updateCharacterStat and handle threshold effects
        const result = skillContext.storeActions.updateCharacterStat(
          skillContext.sessionId,
          skillContext.characterId,
          cost.attributeKey,
          newValue,
          'trigger'
        );

        console.log(`[SkillKeyHandler] Applied cost: ${cost.attributeKey} ${oldValue} -> ${result.newValue}`);

        // Collect thresholds reached
        if (result.thresholdsReached.length > 0) {
          allThresholdsReached.push(...result.thresholdsReached);
          for (const threshold of result.thresholdsReached) {
            console.log(`[SkillKeyHandler] Threshold reached: ${threshold.attributeName} ${threshold.thresholdType} (${threshold.thresholdValue}), ${threshold.rewards.length} effects to execute`);
          }
        }
      }
    }
    
    // Note: activationRewards should be processed by the unified reward executor
    // This is handled by the caller (useTriggerSystem)
    
    return { thresholdsReached: allThresholdsReached };
  }
  
  /**
   * Apply an activation cost to a value
   */
  private applyCost(currentValue: number | string, cost: { operator: string; value: number }): number | string {
    if (typeof currentValue !== 'number') return currentValue;
    
    const costValue = cost.value;
    switch (cost.operator) {
      case '-': return currentValue - costValue;
      case '+': return currentValue + costValue;
      case '*': return currentValue * costValue;
      case '/': return costValue !== 0 ? currentValue / costValue : currentValue;
      case '=': return costValue;
      case 'set_min': return Math.max(currentValue, costValue);
      case 'set_max': return Math.min(currentValue, costValue);
      default: return currentValue;
    }
  }
  
  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): string[] {
    const skillContext = context as SkillKeyHandlerContext;
    const keys: string[] = [];
    
    if (!skillContext.statsConfig?.enabled) return keys;
    
    const skillsWithKeys = skillContext.statsConfig.skills.filter(
      s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0)
    );
    
    for (const skill of skillsWithKeys) {
      if (skill.activationKey) keys.push(skill.activationKey);
      if (skill.activationKeys) keys.push(...skill.activationKeys);
    }
    
    return keys;
  }
  
  /**
   * Reset state for new message
   */
  reset(messageKey: string): void {
    this.state.processedMessages.delete(messageKey);
    this.state.activatedSkillsPerMessage.delete(messageKey);
    // Clear activation positions for this message
    this.activationPositions.delete(messageKey);
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.state.processedMessages.clear();
    this.state.activationHistory.clear();
    this.state.activatedSkillsPerMessage.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createSkillKeyHandler(): SkillKeyHandler {
  return new SkillKeyHandler();
}
