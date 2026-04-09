// ============================================
// Tool: Manage Quest
// ============================================
// Category: in_character
// Completes quest objectives when the character performs relevant actions

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import { useTavernStore } from '@/store';
import { activateObjectiveDirectly, type QuestStoreAccessor } from '@/lib/quest/quest-reward-executor';
import type { CharacterCard, QuestNotificationType, SessionQuestInstance, QuestTemplate } from '@/types';

export const manageQuestTool: ToolDefinition = {
  id: 'manage_quest',
  name: 'manage_quest',
  label: 'Completar Objetivo',
  icon: 'ScrollText',
  description:
    'Marca un objetivo de misión como completado cuando el personaje realiza ' +
    'una acción exitosa que lo cumple. Usa esta herramienta SOLO cuando la acción ' +
    'del personaje sea exitosa y deba avanzar la misión.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      objective_key: {
        type: 'string',
        description: 'Key del objetivo a completar (ej: "psycompletado", "combate_finalizado"). '
                   + 'Este valor debe coincidir con el objetivo listado en las ACCIONES DISPONIBLES.',
        required: true,
      },
      narrative: {
        type: 'string',
        description: 'Descripción narrativa breve de qué hizo el personaje para completar el objetivo (ej: "El personaje realizó un examen psicológico exhaustivo al paciente")',
        required: false,
      }
    },
    required: ['objective_key'],
  },
  permissionMode: 'auto',
};

export async function manageQuestExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const objectiveKey = params.objective_key ? String(params.objective_key).toLowerCase().trim() : '';
  const narrative = params.narrative ? String(params.narrative) : '';

  if (!objectiveKey) {
    return {
      success: false,
      toolName: 'manage_quest',
      result: null,
      displayMessage: 'Error: Debes especificar objective_key para completar un objetivo.',
      error: 'Missing required parameter: objective_key',
    };
  }

  try {
    const store = useTavernStore.getState();
    const sessionId = context.sessionId;
    const characterId = context.characterId;
    
    // Get quest data from context (passed from client)
    const sessionQuests: SessionQuestInstance[] = context.sessionQuests || [];
    const questTemplates: QuestTemplate[] = context.questTemplates || [];
    
    // Filter active quests
    const activeQuests = sessionQuests.filter(q => 
      q.status === 'active' || q.status === 'available'
    );
    
    if (activeQuests.length === 0) {
      return {
        success: false,
        toolName: 'manage_quest',
        result: null,
        displayMessage: 'Error: No hay misiones activas en esta sesión. '
          + 'Las misiones deben estar activadas para poder completar objetivos.',
        error: 'No active quests in session',
      };
    }

    // Find the objective by completion key
    let foundObjective: {
      quest: SessionQuestInstance;
      objective: QuestTemplate['objectives'][0];
      template: QuestTemplate;
    } | null = null;
    
    const normalizedKey = objectiveKey.toLowerCase().trim();
    
    for (const quest of activeQuests) {
      const template = questTemplates.find(t => t.id === quest.templateId);
      if (!template) continue;
      
      for (const objective of template.objectives || []) {
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
      return {
        success: false,
        toolName: 'manage_quest',
        result: null,
        displayMessage: `Error: No se encontró un objetivo con la key "${objectiveKey}" en las misiones activas. `
          + 'Verifica que la key coincida exactamente con la mostrada en las ACCIONES DISPONIBLES.',
        error: 'Objective not found',
      };
    }
    
    const { quest, objective, template } = foundObjective;
    
    // Check if already completed
    const sessionObj = quest.objectives.find(o => o.templateId === objective.id);
    if (sessionObj?.isCompleted) {
      return {
        success: true,
        toolName: 'manage_quest',
        result: { objectiveKey, alreadyCompleted: true },
        displayMessage: `El objetivo "${objective.description}" ya estaba completado anteriormente.`,
        questActivation: {
          type: 'complete_objective',
          key: objectiveKey,
          metadata: { alreadyCompleted: true },
        },
      };
    }

    const lines: string[] = [];
    let questActivation: ToolExecutionResult['questActivation'] | undefined;
    
    try {
      // Create store accessor that uses context data
      const storeAccessor: QuestStoreAccessor = {
        getSessionQuests: (_sid: string) => sessionQuests,
        getTemplates: () => questTemplates,
        completeObjective: (sid: string, questTemplateId: string, objectiveId: string, charId?: string) => {
          store.completeObjective?.(sid, questTemplateId, objectiveId, charId);
        },
        addQuestNotification: (notification: { questId: string; questTitle: string; type: string; message: string }) => {
          const questNotification = {
            ...notification,
            type: notification.type as QuestNotificationType,
          };
          store.addQuestNotification?.(questNotification as any);
        },
      };

      const activationResult = activateObjectiveDirectly(
        objectiveKey,
        storeAccessor,
        {
          sessionId,
          characterId,
          character: null as unknown as CharacterCard,
          sessionStats: undefined,
          timestamp: Date.now(),
          soundCollections: store.soundCollections,
          soundTriggers: store.soundTriggers,
          soundSequenceTriggers: store.soundSequenceTriggers,
          backgroundPacks: store.backgroundTriggerPacks,
          soundSettings: {
            enabled: store.settings.sound?.enabled ?? false,
            globalVolume: store.settings.sound?.globalVolume ?? 0.85,
          },
          backgroundSettings: {
            transitionDuration: store.settings.backgroundTriggers?.transitionDuration ?? 500,
            defaultTransitionType: store.settings.backgroundTriggers?.defaultTransitionType ?? 'fade',
          },
        },
        {
          updateCharacterStat: (sid, cid, key, value) => {
            store.updateCharacterStat?.(sid, cid, key, value, 'trigger');
          },
          completeQuestObjective: (_sid, _qid, _objKey, _charId): boolean => {
            // Already handled by the storeAccessor
            return true;
          },
          applyTriggerForCharacter: (cid, hit) => {
            store.applyTriggerForCharacter?.(cid, hit as any);
          },
          scheduleReturnToIdleForCharacter: (cid, triggerSpriteUrl, returnToMode, returnSpriteUrl, returnSpriteLabel, returnToIdleMs) => {
            store.scheduleReturnToIdleForCharacter?.(cid, triggerSpriteUrl, returnToMode as any, returnSpriteUrl, returnSpriteLabel, returnToIdleMs);
          },
          setBackground: (url) => {
            store.setBackground?.(url);
          },
          setActiveOverlays: (overlays) => {
            store.setActiveOverlays?.(overlays as any);
          },
        },
        {
          updateCharacterStat: (sid, cid, key, value) => {
            store.updateCharacterStat?.(sid, cid, key, value, 'trigger');
          },
          applyTriggerForCharacter: (cid, hit) => {
            store.applyTriggerForCharacter?.(cid, hit as any);
          },
          scheduleReturnToIdleForCharacter: (cid, triggerSpriteUrl, returnToMode, returnSpriteUrl, returnSpriteLabel, returnToIdleMs) => {
            store.scheduleReturnToIdleForCharacter?.(cid, triggerSpriteUrl, returnToMode as any, returnSpriteUrl, returnSpriteLabel, returnToIdleMs);
          },
          setBackground: (url) => {
            store.setBackground?.(url);
          },
          setActiveOverlays: (overlays) => {
            store.setActiveOverlays?.(overlays as any);
          },
        }
      );

      if (activationResult.success) {
        questActivation = {
          type: activationResult.questCompleted ? 'activate_quest' : 'complete_objective',
          key: objectiveKey,
          metadata: {
            questId: activationResult.questId,
            questName: template.name,
            objectiveName: objective.description,
            questCompleted: activationResult.questCompleted,
            messages: activationResult.messages,
          },
        };

        lines.push(`✓ Objetivo completado: ${objective.description}`);
        
        for (const msg of activationResult.messages) {
          if (!lines.includes(msg)) {
            lines.push(msg);
          }
        }
        
        if (narrative) {
          lines.push('');
          lines.push(`Narrativa: ${narrative}`);
        }

        if (activationResult.questCompleted) {
          lines.push('');
          lines.push(`🎉 ¡Misión "${template.name}" completada!`);
        }

        if (activationResult.errors.length > 0) {
          for (const err of activationResult.errors) {
            lines.push(`⚠️ ${err}`);
          }
        }
      } else {
        for (const err of activationResult.errors) {
          lines.push(`❌ ${err}`);
        }
      }
    } catch (error) {
      console.error('[manage_quest] Error activating objective:', error);
      lines.push(`❌ Error al completar el objetivo: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: questActivation?.metadata?.questId !== undefined,
      toolName: 'manage_quest',
      result: {
        objectiveKey,
        objectiveName: objective.description,
        questName: template.name,
        narrative,
      },
      displayMessage: lines.join('\n'),
      questActivation,
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'manage_quest',
      result: null,
      displayMessage: 'Error al gestionar la misión.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
