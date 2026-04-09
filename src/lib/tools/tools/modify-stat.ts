// ============================================
// Tool: Modify Stat
// ============================================
// Category: in_character
// Modifies character stats based on LLM decisions

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const modifyStatTool: ToolDefinition = {
  id: 'modify_stat',
  name: 'modify_stat',
  label: 'Modificar Stat',
  icon: 'Pencil',
  description:
    'Modifica el valor de un atributo o stat del personaje. ' +
    'Úsala cuando un evento en el roleplay deba cambiar una estadística ' +
    '(ej: ganar experiencia, perder vida, recibir daño).',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      stat_name: {
        type: 'string',
        description: 'Nombre del stat a modificar (ej: vida, exp, nivel)',
        required: true,
      },
      new_value: {
        type: 'number',
        description: 'Nuevo valor del stat',
        required: true,
      },
      reason: {
        type: 'string',
        description: 'Razón narrativa del cambio (ej: "El jugador derrotó al dragón")',
        required: false,
      },
    },
    required: ['stat_name', 'new_value'],
  },
  permissionMode: 'auto',
};

export async function modifyStatExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const statName = String(params.stat_name || '').trim();
  const newValue = params.new_value !== undefined ? Number(params.new_value) : NaN;
  const reason = params.reason ? String(params.reason).trim() : '';

  if (!statName) {
    return {
      success: false,
      toolName: 'modify_stat',
      result: null,
      displayMessage: 'Debes especificar el nombre del stat.',
      error: 'Missing required parameter: stat_name',
    };
  }

  if (isNaN(newValue)) {
    return {
      success: false,
      toolName: 'modify_stat',
      result: null,
      displayMessage: 'Debes especificar un valor numérico válido.',
      error: 'Missing or invalid required parameter: new_value',
    };
  }

  try {
    const { setCharacterStat } = await import('@/lib/stats/stats-resolver');

    if (context.characterId && typeof setCharacterStat === 'function') {
      const previousValue = await setCharacterStat(context.characterId, statName, newValue);

      const lines = [
        `📊 **Stat modificado:** ${statName}`,
      ];

      if (previousValue !== undefined && previousValue !== null) {
        lines.splice(1, 0, `  Valor anterior: ${previousValue}`);
      }

      lines.push(`  Nuevo valor: **${newValue}**`);

      if (reason) {
        lines.push(`  Razón: ${reason}`);
      }

      return {
        success: true,
        toolName: 'modify_stat',
        result: {
          stat: statName,
          newValue,
          previousValue: previousValue ?? null,
          reason,
        },
        displayMessage: lines.join('\n'),
      };
    }
  } catch {
    // Stats system not available
  }

  return {
    success: true,
    toolName: 'modify_stat',
    result: {
      stat: statName,
      newValue,
      reason,
      simulated: true,
    },
    displayMessage: `📊 **Stat modificado (simulado):** ${statName} = **${newValue}**${reason ? `\nRazón: ${reason}` : ''}\n⚠️ El sistema de stats no está configurado.`,
  };
}
