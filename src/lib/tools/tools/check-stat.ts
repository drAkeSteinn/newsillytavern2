/**
 * Check Stat Tool
 *
 * In-character tool to check character stats (RPG system).
 * Queries the character's stat values from the stats system.
 */

import type { ToolDefinition, ToolExecutor, ToolContext, ToolExecutionResult } from '../types';
import { registerTool } from '../tool-registry';

const checkStatTool: ToolDefinition = {
  name: 'check_stat',
  label: 'Consultar Stat',
  icon: 'BarChart3',
  description:
    'Consulta el valor de un atributo o stat del personaje. Úsala cuando necesites verificar las estadísticas del personaje durante el roleplay.',
  category: 'in_character',
  parameters: [
    {
      name: 'stat_name',
      type: 'string',
      required: true,
      description: 'Nombre del stat a consultar',
    },
  ],
  permissionMode: 'auto',
};

const checkStatExecutor: ToolExecutor = {
  execute: async (
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    try {
      const statName = String(params.stat_name || '').trim();

      if (!statName) {
        return {
          success: false,
          result: null,
          displayMessage: 'Debes especificar el nombre del stat a consultar.',
          error: 'Missing required parameter: stat_name',
        };
      }

      // Try to resolve stat from the stats system
      try {
        // Dynamic import to avoid loading stats module at startup
        const { getCharacterStats } = await import('@/lib/stats/stats-resolver');

        if (context.characterId) {
          const stats = await getCharacterStats(context.characterId);
          if (stats) {
            // Look for the stat (case-insensitive)
            const normalizedStatName = statName.toLowerCase();
            const matchedStat = Object.entries(stats).find(
              ([key]) => key.toLowerCase() === normalizedStatName
            );

            if (matchedStat) {
              const [key, value] = matchedStat;
              return {
                success: true,
                result: { stat: key, value },
                displayMessage: `📊 **${key}:** ${value}`,
              };
            }

            // Stat not found in character stats
            const availableStats = Object.keys(stats).join(', ');
            return {
              success: true,
              result: { stat: statName, value: null, availableStats },
              displayMessage: `📊 Stat "${statName}" no encontrado. Stats disponibles: ${availableStats}`,
            };
          }
        }
      } catch {
        // Stats system not available, fall through to placeholder
      }

      // Placeholder when stats system is not available
      return {
        success: true,
        result: {
          stat: statName,
          value: null,
          note: 'Stat no disponible en este contexto',
        },
        displayMessage: `📊 **${statName}**: Stat no disponible en este contexto. El sistema de stats no está configurado para este personaje.`,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        displayMessage: 'Error al consultar el stat.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerTool(checkStatTool, checkStatExecutor);
