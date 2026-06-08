// ============================================
// Tool: Manage Action
// ============================================
// Category: in_character
// Validates skill/action activation and returns metadata
// for the CLIENT to execute the actual activation (costs, rewards, etc.)
// This tool does NOT directly modify store state — it only validates and prepares data.
//
// This is a complement for models that support tool-calling.
// Instead of requiring the activation key in the LLM response text,
// the model can use this tool to activate an action directly.

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import type { SkillDefinition } from '@/types';
import { checkAllRequirements } from '@/lib/triggers/handlers/skill-activation-handler';
import { resolveAllKeys, buildKeyResolutionContext } from '@/lib/key-resolver';
import { buildLorebookEntryKeyMap } from '@/lib/lorebook';

/** Resolve ALL template keys ({{user}}, {{char}}, {{userpersona}}, stats, events, lorebook entries, etc.) in text */
function resolveToolKeysComprehensive(text: string, context: ToolContext): string {
  if (!text) return text;

  // Build lorebook entry key map from available lorebooks for {{key}} resolution
  const lorebookEntryKeys = context.lorebooks && context.lorebooks.length > 0
    ? buildLorebookEntryKeyMap(context.lorebooks).keys
    : undefined;

  const keyContext = buildKeyResolutionContext(
    { id: context.characterId, name: context.characterName } as import('@/types').CharacterCard,
    context.userName,
    undefined, // persona
    undefined, // resolvedStats
    context.sessionStats,
    undefined, // soundTriggers
    undefined, // soundSettings
    undefined, // personaResolvedStats
    undefined, // questTemplates
    undefined, // sessionQuests
    undefined, // questSettings
    undefined, // outletSections
    undefined, // lorebookAttributeKeys
    undefined, // inventoryData
    lorebookEntryKeys
  );
  return resolveAllKeys(text, keyContext);
}

export const manageActionTool: ToolDefinition = {
  id: 'manage_action',
  name: 'manage_action',
  label: 'Usar Acción',
  icon: 'Sword',
  description:
    'Activa una acción o habilidad del personaje. DEBES usar esta herramienta SIEMPRE que el personaje ' +
    'realice una acción listada en las ACCIONES DISPONIBLES, incluso si no hay misiones u objetivos activos. ' +
    'Las acciones hacen al personaje más vivo y activo — úsalas con frecuencia en cada turno cuando el ' +
    'personaje haga algo más allá de hablar. No esperes a que haya quests o solicitudes para usar acciones. ' +
    'Si el personaje se mueve, ataca, usa una habilidad, reacciona físicamente, o hace cualquier cosa ' +
    'que coincida con una acción disponible, DEBES llamar esta herramienta.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      action_key: {
        type: 'string',
        description: 'Key o nombre exacto de la acción a ejecutar (ej: "golpe_furioso", "examen_psicologico"). '
                   + 'Debe coincidir con una acción listada en las ACCIONES DISPONIBLES.',
        required: true,
      },
      narrative: {
        type: 'string',
        description: 'Descripción narrativa breve de cómo el personaje ejecuta la acción (ej: "El personaje lanza un golpe devastador con su espada")',
        required: false,
      }
    },
    required: ['action_key'],
  },
  permissionMode: 'auto',
};

export async function manageActionExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const actionKey = params.action_key ? String(params.action_key).trim() : '';
  const narrative = params.narrative ? String(params.narrative) : '';

  if (!actionKey) {
    return {
      success: false,
      toolName: 'manage_action',
      result: null,
      displayMessage: 'Error: Debes especificar action_key para activar una acción.',
      error: 'Missing required parameter: action_key',
    };
  }

  try {
    const characterId = context.characterId;
    const statsConfig = context.statsConfig;

    if (!statsConfig?.enabled) {
      return {
        success: false,
        toolName: 'manage_action',
        result: null,
        displayMessage: 'Error: El sistema de stats no está habilitado para este personaje.',
        error: 'Stats system not enabled',
      };
    }

    // Find the matching skill by key
    const normalizedKey = actionKey.toLowerCase().trim();
    const skills: SkillDefinition[] = statsConfig.skills || [];

    let matchedSkill: SkillDefinition | null = null;

    for (const skill of skills) {
      // Check primary activation key
      const primaryMatch = skill.activationKey?.toLowerCase().trim() === normalizedKey;
      // Check alternative activation keys
      const altMatch = (skill.activationKeys || []).some(
        k => k.toLowerCase().trim() === normalizedKey
      );
      // Check skill name
      const nameMatch = skill.name.toLowerCase().trim() === normalizedKey;
      // Check skill template key
      const keyMatch = skill.key.toLowerCase().trim() === normalizedKey;

      if (primaryMatch || altMatch || nameMatch || keyMatch) {
        matchedSkill = skill;
        break;
      }
    }

    if (!matchedSkill) {
      // Build a helpful error with available actions
      const availableActions = skills
        .filter(s => s.activationKey || (s.activationKeys && s.activationKeys.length > 0))
        .map(s => {
          const keys = [s.activationKey, ...(s.activationKeys || [])].filter(Boolean);
          return `  - "${s.name}" (keys: ${keys.join(', ')})`;
        });

      const hint = availableActions.length > 0
        ? '\nAcciones disponibles:\n' + availableActions.join('\n')
        : '\nNo hay acciones con keys de activación definidas.';

      return {
        success: false,
        toolName: 'manage_action',
        result: null,
        displayMessage: `Error: No se encontró una acción con la key "${actionKey}".${hint}`,
        error: 'Action not found',
      };
    }

    // Check requirements (both self and target requirements)
    if (matchedSkill.requirements && matchedSkill.requirements.length > 0) {
      const charStats = context.sessionStats?.characterStats?.[characterId];
      const currentValues = charStats?.attributeValues || {};

      const requirementCheck = checkAllRequirements(
        matchedSkill.requirements,
        statsConfig,
        currentValues,
        context.sessionStats
      );

      if (!requirementCheck.met) {
        const failedDescs = requirementCheck.failedRequirements.map(fr =>
          `${fr.attributeName}: necesita ${fr.operator} ${fr.requiredValue} (actual: ${fr.currentValue})`
        ).join('; ');

        return {
          success: false,
          toolName: 'manage_action',
          result: null,
          displayMessage: `❌ No se puede ejecutar "${matchedSkill.name}": requisitos no cumplidos.\n${failedDescs}`,
          error: 'Requirements not met',
        };
      }
    }

    // Build display message with resolved template keys (comprehensive resolution)
    const resolvedName = resolveToolKeysComprehensive(matchedSkill.name, context);
    const resolvedDescription = resolveToolKeysComprehensive(matchedSkill.description || '', context);
    const resolvedCompletedDescription = resolveToolKeysComprehensive(matchedSkill.completedDescription || matchedSkill.description || '', context);
    const resolvedSkillName = resolvedName;
    const resolvedSkillDescription = resolvedDescription;
    const resolvedSkillCompletedDescription = resolvedCompletedDescription;

    const lines: string[] = [];
    lines.push(`⚔️ Acción ejecutada: ${resolvedName}`);

    if (resolvedDescription) {
      lines.push(`   ${resolvedDescription}`);
    }

    if (matchedSkill.activationCosts && matchedSkill.activationCosts.length > 0) {
      const costDescs = matchedSkill.activationCosts
        .map(c => resolveToolKeysComprehensive(c.description || `${c.attributeKey} ${c.operator}${c.value}`, context))
        .join(', ');
      lines.push(`   Costos: ${costDescs}`);
    }

    if (narrative) {
      lines.push('');
      lines.push(`Narrativa: ${narrative}`);
    }

    return {
      success: true,
      toolName: 'manage_action',
      result: {
        skillId: matchedSkill.id,
        skillName: resolvedSkillName,
        skillDescription: resolvedSkillDescription,
        skillCompletedDescription: resolvedSkillCompletedDescription,
        narrative,
        hasCosts: (matchedSkill.activationCosts || []).length > 0,
        hasRewards: (matchedSkill.activationRewards || []).length > 0,
      },
      displayMessage: lines.join('\n'),
      actionActivation: {
        skillId: matchedSkill.id,
        skillName: resolvedSkillName,
        skillDescription: resolvedSkillDescription,
        skillCompletedDescription: resolvedSkillCompletedDescription,
        activationCosts: matchedSkill.activationCosts || [],
        activationRewards: matchedSkill.activationRewards || [],
        characterId,
      },
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'manage_action',
      result: null,
      displayMessage: 'Error al gestionar la acción.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
