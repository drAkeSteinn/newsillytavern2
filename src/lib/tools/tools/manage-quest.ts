// ============================================
// Tool: Manage Quest
// ============================================
// Category: in_character
// Validates quest objective completion and returns metadata
// for the CLIENT to execute the actual completion (rewards, sprites, sounds, etc.)
// This tool does NOT directly modify store state — it only validates and prepares data.

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import type { SessionQuestInstance, QuestTemplate } from '@/types';

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
          metadata: {
            alreadyCompleted: true,
            questTemplateId: template.id,
            objectiveId: objective.id,
            objectiveKey,
            characterId,
            questName: template.name,
            objectiveName: objective.description,
          },
        },
      };
    }

    // Determine if completing this objective would auto-complete the quest.
    // NOTE: This is an optimistic preview for display/toast only.
    // The ACTUAL quest completion decision is made by store.completeObjective(),
    // which correctly handles optional objectives and chain activation.
    // Therefore, we ALWAYS send type='complete_objective' — the store handles everything.
    const allObjectives = template.objectives || [];
    const completedObjectiveIds = new Set(
      quest.objectives
        .filter(o => o.isCompleted && o.templateId !== objective.id)
        .map(o => o.templateId)
    );
    completedObjectiveIds.add(objective.id);

    // Build display message
    const lines: string[] = [];
    lines.push(`✓ Objetivo completado: ${objective.description}`);

    if (narrative) {
      lines.push('');
      lines.push(`Narrativa: ${narrative}`);
    }

    return {
      success: true,
      toolName: 'manage_quest',
      result: {
        objectiveKey,
        objectiveName: objective.description,
        questName: template.name,
        narrative,
      },
      displayMessage: lines.join('\n'),
      questActivation: {
        // ALWAYS 'complete_objective' — the store handles quest auto-completion,
        // rewards, chain activation, and notifications internally.
        type: 'complete_objective',
        key: objectiveKey,
        metadata: {
          questTemplateId: template.id,
          objectiveId: objective.id,
          objectiveKey,
          characterId,
          questName: template.name,
          objectiveName: objective.description,
        },
      },
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
