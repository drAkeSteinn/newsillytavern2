// ============================================
// Quest Key Handler - Unified Quest Trigger System
// ============================================
//
// Handles quest activation, progress, and completion
// Supports both type-indicator format (quest:activate) and XML tags (<quest:activate/>)
//
// Key formats:
// - quest:activate <title> - Activate a quest by title
// - quest:progress <id> <objective> <amount> - Progress an objective
// - quest:complete <id> - Complete a quest
// - <quest:activate title="Mission Name"/>
// - <quest:progress id="quest-123" objective="obj-1" amount="1"/>

import type { KeyHandler, TriggerMatch, TriggerMatchResult, RegisteredKey } from '../types';
import type { DetectedKey } from '../key-detector';
import type { TriggerContext } from '../trigger-bus';
import type {
  QuestTemplate,
  SessionQuestInstance,
  QuestSettings,
  QuestTriggerHit,
} from '@/types';

// ============================================
// Quest Key Handler Context
// ============================================

export interface QuestKeyHandlerContext extends TriggerContext {
  sessionId?: string;
  characterId?: string;
  questTemplates: QuestTemplate[];
  sessionQuests: SessionQuestInstance[];
  questSettings: QuestSettings;
  turnCount?: number;
  
  // Store actions
  activateQuest?: (sessionId: string, questId: string) => void;
  progressQuestObjective?: (
    sessionId: string,
    questId: string,
    objectiveId: string,
    amount: number,
    characterId?: string
  ) => void;
  completeQuest?: (sessionId: string, questId: string) => void;
}

// ============================================
// Quest Key Handler Implementation
// ============================================

export class QuestKeyHandler implements KeyHandler {
  id = 'quest-key-handler';
  type = 'quest' as const;
  priority = 60; // After sprite/background, before item/stats
  
  // Track processed quests per message
  private processedQuests: Map<string, Set<string>> = new Map();
  
  // Track triggered positions to avoid duplicates
  private triggeredPositions: Map<string, Set<number>> = new Map();

  canHandle(key: DetectedKey, context: QuestKeyHandlerContext): boolean {
    // Check if quest system is enabled
    if (!context.questSettings?.enabled) {
      console.log(`[QuestKeyHandler] Quest system disabled`);
      return false;
    }
    
    // Type-indicator format: quest:action
    if (key.key === 'quest' && key.value) {
      const action = key.value.toLowerCase();
      const canHandleAction = ['activate', 'progress', 'complete', 'fail'].includes(action);
      console.log(`[QuestKeyHandler] Type-indicator format: quest:${action}, canHandle: ${canHandleAction}`);
      return canHandleAction;
    }
    
    // Check if key matches any quest activation or completion key
    const normalizedKey = key.key.toLowerCase();
    
    // Check activation keys from available quests
    const availableQuests = context.sessionQuests.filter(q => q.status === 'available');
    console.log(`[QuestKeyHandler] Checking key "${normalizedKey}" against ${availableQuests.length} available quests`);
    
    for (const quest of availableQuests) {
      const template = context.questTemplates.find(t => t.id === quest.templateId);
      if (template?.activation?.method === 'keyword') {
        const keys = [
          template.activation.key,
          ...(template.activation.keys || [])
        ].filter(Boolean);
        
        if (keys.some(k => k.toLowerCase() === normalizedKey)) {
          return true;
        }
      }
    }
    
    // Check objective completion keys from active quests
    const activeQuests = context.sessionQuests.filter(q => q.status === 'active');
    for (const quest of activeQuests) {
      const template = context.questTemplates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      for (const obj of template.objectives) {
        const sessionObj = quest.objectives.find(o => o.templateId === obj.id);
        if (sessionObj?.isCompleted) continue;
        
        const keys = [
          obj.completion?.key,
          ...(obj.completion?.keys || [])
        ].filter(Boolean);
        
        if (keys.some(k => k.toLowerCase() === normalizedKey)) {
          return true;
        }
      }
    }
    
    // Check quest completion keys
    for (const quest of activeQuests) {
      const template = context.questTemplates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      const keys = [
        template.completion?.key,
        ...(template.completion?.keys || [])
      ].filter(Boolean);
      
      if (keys.some(k => k.toLowerCase() === normalizedKey)) {
        return true;
      }
    }
    
    return false;
  }

  handleKey(key: DetectedKey, context: QuestKeyHandlerContext): TriggerMatchResult | null {
    const { questTemplates, sessionQuests, messageKey } = context;
    
    console.log(`[QuestKeyHandler] handleKey called with key: "${key.key}", messageKey: "${messageKey}"`);
    console.log(`[QuestKeyHandler] sessionQuests: ${sessionQuests.length}, templates: ${questTemplates.length}`);
    
    // Skip if already processed this position
    const triggeredPositions = this.triggeredPositions.get(messageKey) ?? new Set();
    if (key.position !== undefined && triggeredPositions.has(key.position)) {
      console.log(`[QuestKeyHandler] Position ${key.position} already processed, skipping`);
      return { matched: false };
    }
    
    // Handle type-indicator format: quest:action
    if (key.key === 'quest' && key.value) {
      return this.handleTypeIndicator(key, context);
    }
    
    // Handle keyword-based detection
    return this.handleKeywordDetection(key, context);
  }

  private handleTypeIndicator(key: DetectedKey, context: QuestKeyHandlerContext): TriggerMatchResult | null {
    const action = key.value!.toLowerCase();
    const { questTemplates, sessionQuests } = context;
    
    switch (action) {
      case 'activate': {
        // Find an available quest to activate
        const availableQuests = sessionQuests.filter(q => q.status === 'available');
        if (availableQuests.length === 0) {
          return { matched: false };
        }
        
        // Activate the first available quest (or could be more specific)
        const quest = availableQuests[0];
        const template = questTemplates.find(t => t.id === quest.templateId);
        
        return {
          matched: true,
          trigger: {
            triggerId: `quest_activate_${quest.templateId}`,
            triggerType: 'quest',
            keyword: key.original || key.key,
            data: {
              action: 'activate',
              questId: quest.templateId,
              template,
              message: `Quest activated: ${template?.name || quest.templateId}`,
            },
          },
          key,
        };
      }
      
      case 'complete': {
        // Find an active quest to complete
        const activeQuests = sessionQuests.filter(q => q.status === 'active');
        if (activeQuests.length === 0) {
          return { matched: false };
        }
        
        const quest = activeQuests[0];
        const template = questTemplates.find(t => t.id === quest.templateId);
        
        return {
          matched: true,
          trigger: {
            triggerId: `quest_complete_${quest.templateId}`,
            triggerType: 'quest',
            keyword: key.original || key.key,
            data: {
              action: 'complete',
              questId: quest.templateId,
              template,
              message: `Quest completed: ${template?.name || quest.templateId}`,
              rewards: template?.rewards,
            },
          },
          key,
        };
      }
      
      default:
        return { matched: false };
    }
  }

  private handleKeywordDetection(key: DetectedKey, context: QuestKeyHandlerContext): TriggerMatchResult | null {
    const { questTemplates, sessionQuests, messageKey } = context;
    const normalizedKey = key.key.toLowerCase();
    
    console.log(`[QuestKeyHandler] handleKeywordDetection: "${normalizedKey}"`);
    
    // Check activation keys
    const availableQuests = sessionQuests.filter(q => q.status === 'available');
    console.log(`[QuestKeyHandler] Available quests: ${availableQuests.length}`);
    
    for (const quest of availableQuests) {
      const template = questTemplates.find(t => t.id === quest.templateId);
      if (template?.activation?.method === 'keyword') {
        const keys = [
          template.activation.key,
          ...(template.activation.keys || [])
        ].filter(Boolean);
        
        console.log(`[QuestKeyHandler] Quest "${template.name}" activation keys:`, keys);
        
        if (keys.some(k => k.toLowerCase() === normalizedKey)) {
          console.log(`[QuestKeyHandler] MATCH! Activating quest: ${template.name}`);
          
          // Mark position as triggered
          const positions = this.triggeredPositions.get(messageKey) ?? new Set();
          if (key.position !== undefined) positions.add(key.position);
          this.triggeredPositions.set(messageKey, positions);
          
          return {
            matched: true,
            trigger: {
              triggerId: `quest_activate_${quest.templateId}`,
              triggerType: 'quest',
              keyword: key.original || key.key,
              data: {
                action: 'activate',
                questId: quest.templateId,
                template,
                message: `Quest activated: ${template.name}`,
              },
            },
            key,
          };
        }
      }
    }
    
    // Check objective completion keys
    const activeQuests = sessionQuests.filter(q => q.status === 'active');
    for (const quest of activeQuests) {
      const template = questTemplates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      for (const obj of template.objectives) {
        const sessionObj = quest.objectives.find(o => o.templateId === obj.id);
        if (sessionObj?.isCompleted) continue;
        
        const keys = [
          obj.completion?.key,
          ...(obj.completion?.keys || [])
        ].filter(Boolean);
        
        if (keys.some(k => k.toLowerCase() === normalizedKey)) {
          // Mark position as triggered
          const positions = this.triggeredPositions.get(messageKey) ?? new Set();
          if (key.position !== undefined) positions.add(key.position);
          this.triggeredPositions.set(messageKey, positions);
          
          // Check if this progress will complete the objective
          const currentCount = sessionObj?.currentCount || 0;
          const targetCount = obj.targetCount || 1;
          const willComplete = currentCount + 1 >= targetCount;
          
          return {
            matched: true,
            trigger: {
              triggerId: `quest_progress_${quest.templateId}_${obj.id}`,
              triggerType: 'quest',
              keyword: key.original || key.key,
              data: {
                action: 'progress',
                questId: quest.templateId,
                objectiveId: obj.id,
                objective: obj,
                template,
                progress: 1,
                message: `Objective progressed: ${obj.description}`,
                completesObjective: willComplete,
                objectiveRewards: willComplete && obj.rewards ? obj.rewards : undefined,
              },
            },
            key,
          };
        }
      }
      
      // Check quest completion keys
      const completionKeys = [
        template.completion?.key,
        ...(template.completion?.keys || [])
      ].filter(Boolean);
      
      if (completionKeys.some(k => k.toLowerCase() === normalizedKey)) {
        // Mark position as triggered
        const positions = this.triggeredPositions.get(messageKey) ?? new Set();
        if (key.position !== undefined) positions.add(key.position);
        this.triggeredPositions.set(messageKey, positions);
        
        return {
          matched: true,
          trigger: {
            triggerId: `quest_complete_${quest.templateId}`,
            triggerType: 'quest',
            keyword: key.original || key.key,
            data: {
              action: 'complete',
              questId: quest.templateId,
              template,
              message: `Quest completed: ${template.name}`,
              rewards: template.rewards,
            },
          },
          key,
        };
      }
    }
    
    return { matched: false };
  }

  execute(match: TriggerMatch, context: QuestKeyHandlerContext): void {
    const { sessionId, characterId, activateQuest, progressQuestObjective, completeQuest } = context;
    const data = match.data as {
      action: 'activate' | 'progress' | 'complete' | 'fail';
      questId: string;
      objectiveId?: string;
      progress?: number;
    };
    
    if (!sessionId) {
      console.warn('[QuestKeyHandler] No sessionId, cannot execute quest action');
      return;
    }
    
    console.log(`[QuestKeyHandler] Executing quest action: ${data.action} for quest ${data.questId}`);
    
    switch (data.action) {
      case 'activate':
        activateQuest?.(sessionId, data.questId);
        break;
        
      case 'progress':
        if (data.objectiveId) {
          progressQuestObjective?.(
            sessionId,
            data.questId,
            data.objectiveId,
            data.progress || 1,
            characterId
          );
        }
        break;
        
      case 'complete':
        completeQuest?.(sessionId, data.questId);
        break;
        
      case 'fail':
        // Not implemented yet
        console.log(`[QuestKeyHandler] Quest failed: ${data.questId}`);
        break;
    }
  }

  getRegisteredKeys(context: QuestKeyHandlerContext): RegisteredKey[] {
    const keys: RegisteredKey[] = [];
    const { questTemplates, sessionQuests } = context;
    
    // Add activation keys for available quests
    const availableQuests = sessionQuests.filter(q => q.status === 'available');
    for (const quest of availableQuests) {
      const template = questTemplates.find(t => t.id === quest.templateId);
      if (template?.activation?.method === 'keyword') {
        const activationKeys = [
          template.activation.key,
          ...(template.activation.keys || [])
        ].filter(Boolean);
        
        for (const key of activationKeys) {
          keys.push({
            key,
            category: 'quest',
            config: {
              action: 'activate',
              questId: quest.templateId,
            },
          });
        }
      }
    }
    
    // Add objective completion keys for active quests
    const activeQuests = sessionQuests.filter(q => q.status === 'active');
    for (const quest of activeQuests) {
      const template = questTemplates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      for (const obj of template.objectives) {
        const sessionObj = quest.objectives.find(o => o.templateId === obj.id);
        if (sessionObj?.isCompleted) continue;
        
        const completionKeys = [
          obj.completion?.key,
          ...(obj.completion?.keys || [])
        ].filter(Boolean);
        
        for (const key of completionKeys) {
          keys.push({
            key,
            category: 'quest',
            config: {
              action: 'progress',
              questId: quest.templateId,
              objectiveId: obj.id,
            },
          });
        }
      }
    }
    
    return keys;
  }

  reset(messageKey: string): void {
    this.processedQuests.delete(messageKey);
    this.triggeredPositions.delete(messageKey);
  }

  cleanup(): void {
    this.processedQuests.clear();
    this.triggeredPositions.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createQuestKeyHandler(): QuestKeyHandler {
  return new QuestKeyHandler();
}
