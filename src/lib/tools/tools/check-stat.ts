// ============================================
// Tool: Check Stat
// ============================================
// Category: in_character
// Checks character stats for the LLM

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const checkStatTool: ToolDefinition = {
  id: 'check_stat',
  name: 'check_stat',
  label: 'Consultar Stat',
  icon: 'BarChart3',
  description:
    'Consulta el valor de un atributo o stat del personaje. ' +
    'Úsala cuando necesites verificar las estadísticas del personaje ' +
    'durante el roleplay (ej: verificar nivel, vida restante, oro).',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      stat_name: {
        type: 'string',
        description: 'Nombre del stat a consultar (ej: vida, nivel, exp, oro)',
        required: true,
      },
    },
    required: ['stat_name'],
  },
  permissionMode: 'auto',
};

export async function checkStatExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const statName = String(params.stat_name || '').trim();

  if (!statName) {
    return {
      success: false,
      toolName: 'check_stat',
      result: null,
      displayMessage: 'Debes especificar el nombre del stat a consultar.',
      error: 'Missing required parameter: stat_name',
    };
  }

  try {
    const { getCharacterStats } = await import('@/lib/stats/stats-resolver');

    if (context.characterId) {
      const stats = await getCharacterStats(context.characterId);
      if (stats) {
        const normalizedStatName = statName.toLowerCase();
        const matchedStat = Object.entries(stats).find(
          ([key]) => key.toLowerCase() === normalizedStatName
        );

        if (matchedStat) {
          const [key, value] = matchedStat;
          return {
            success: true,
            toolName: 'check_stat',
            result: { stat: key, value },
            displayMessage: `📊 **${key}:** ${value}`,
          };
        }

        const availableStats = Object.keys(stats).join(', ');
        return {
          success: true,
          toolName: 'check_stat',
          result: { stat: statName, value: null, availableStats },
          displayMessage: `📊 Stat "${statName}" no encontrado.\nStats disponibles: ${availableStats}`,
        };
      }
    }
  } catch {
    // Stats system not available
  }

  return {
    success: true,
    toolName: 'check_stat',
    result: {
      stat: statName,
      value: null,
      note: 'Stats no disponibles en este contexto',
    },
    displayMessage: `📊 **${statName}:** Stat no disponible en este contexto.`,
  };
}
