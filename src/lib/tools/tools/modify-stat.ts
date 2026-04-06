/**
 * Modify Stat Tool
 *
 * In-character tool to modify character stats (RPG system).
 * Changes a character's stat value with a reason.
 */

import type { ToolDefinition, ToolExecutor, ToolContext, ToolExecutionResult } from '../types';
import { registerTool } from '../tool-registry';

const modifyStatTool: ToolDefinition = {
  name: 'modify_stat',
  label: 'Modificar Stat',
  icon: 'Pencil',
  description:
    'Modifica el valor de un atributo o stat del personaje. Úsala cuando un evento en el roleplay deba cambiar una estadística.',
  category: 'in_character',
  parameters: [
    {
      name: 'stat_name',
      type: 'string',
      required: true,
      description: 'Nombre del stat',
    },
    {
      name: 'new_value',
      type: 'number',
      required: true,
      description: 'Nuevo valor',
    },
    {
      name: 'reason',
      type: 'string',
      required: false,
      description: 'Razón del cambio',
    },
  ],
  permissionMode: 'auto',
};

const modifyStatExecutor: ToolExecutor = {
  execute: async (
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> => {
    try {
      const statName = String(params.stat_name || '').trim();
      const newValue = params.new_value !== undefined ? Number(params.new_value) : NaN;
      const reason = params.reason ? String(params.reason).trim() : '';

      if (!statName) {
        return {
          success: false,
          result: null,
          displayMessage: 'Debes especificar el nombre del stat.',
          error: 'Missing required parameter: stat_name',
        };
      }

      if (isNaN(newValue)) {
        return {
          success: false,
          result: null,
          displayMessage: 'Debes especificar un valor numérico válido.',
          error: 'Missing or invalid required parameter: new_value',
        };
      }

      // Try to modify stat through the stats system
      try {
        // Dynamic import to avoid loading stats module at startup
        const { setCharacterStat } = await import('@/lib/stats/stats-resolver');

        if (context.characterId && typeof setCharacterStat === 'function') {
          const previousValue = await setCharacterStat(context.characterId, statName, newValue);

          const lines = [
            `✏️ **Stat modificado:** ${statName}`,
            `• **Nuevo valor:** ${newValue}`,
          ];

          if (previousValue !== undefined && previousValue !== null) {
            lines.splice(1, 0, `• **Valor anterior:** ${previousValue}`);
          }

          if (reason) {
            lines.push(`• **Razón:** ${reason}`);
          }

          return {
            success: true,
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
        // Stats system not available, fall through to placeholder
      }

      // Placeholder when stats system is not available
      const lines = [
        `✏️ **Stat modificado (simulado):** ${statName}`,
        `• **Nuevo valor:** ${newValue}`,
      ];

      if (reason) {
        lines.push(`• **Razón:** ${reason}`);
      }

      lines.push('⚠️ Nota: El sistema de stats no está configurado. Este cambio es simulado y no se guardará.');

      return {
        success: true,
        result: {
          stat: statName,
          newValue,
          reason,
          simulated: true,
        },
        displayMessage: lines.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        displayMessage: 'Error al modificar el stat.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

registerTool(modifyStatTool, modifyStatExecutor);
