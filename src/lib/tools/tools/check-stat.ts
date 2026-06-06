// ============================================
// Tool: Check Stat
// ============================================
// Category: in_character
// Checks character stats for the LLM
//
// Uses ToolContext.sessionStats and statsConfig to look up values
// Supports lookup by key, name, or detection keys

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import type { AttributeDefinition } from '@/types';

export const checkStatTool: ToolDefinition = {
  id: 'check_stat',
  name: 'check_stat',
  label: 'Consultar Stat',
  icon: 'BarChart3',
  description:
    'Consulta el valor de un atributo o stat del personaje. ' +
    'Úsala cuando necesites verificar las estadísticas del personaje ' +
    'durante el roleplay (ej: verificar nivel, vida restante, oro, estado).',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      stat_name: {
        type: 'string',
        description: 'Nombre o key del stat a consultar (ej: vida, nivel, exp, oro, estado)',
        required: true,
      },
    },
    required: ['stat_name'],
  },
  permissionMode: 'auto',
};

/**
 * Format an attribute value for display in the tool result
 */
function formatValueForDisplay(attr: AttributeDefinition, value: number | string): string {
  if (attr.outputFormat) {
    return attr.outputFormat.replace('{value}', String(value));
  }
  if (attr.keywordFormat) {
    return attr.keywordFormat.replace('{value}', String(value));
  }

  const attrType = attr.type || 'number';
  if (attrType === 'number') {
    const max = attr.max ?? '?';
    return `${value}/${max}`;
  }
  return String(value);
}

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

  // Check that stats system is available
  const { statsConfig, sessionStats, characterId } = context;

  if (!statsConfig?.enabled) {
    return {
      success: true,
      toolName: 'check_stat',
      result: { stat: statName, value: null, note: 'Stats no disponibles' },
      displayMessage: `📊 Stats no disponibles para este personaje.`,
    };
  }

  // Find the matching attribute by key, name, or detection keys
  const normalizedStatName = statName.toLowerCase();
  let matchedAttr: AttributeDefinition | null = null;

  for (const attr of statsConfig.attributes || []) {
    // Check by key (exact)
    if (attr.key.toLowerCase() === normalizedStatName) {
      matchedAttr = attr;
      break;
    }
    // Check by name (exact)
    if (attr.name.toLowerCase() === normalizedStatName) {
      matchedAttr = attr;
      break;
    }
    // Check by alternative detection keys
    if (attr.keys?.some(k => k.toLowerCase() === normalizedStatName)) {
      matchedAttr = attr;
      break;
    }
    // Check by legacy detectionTags
    if (attr.detectionTags) {
      const tags = attr.detectionTags.split(',').map(t => t.trim().toLowerCase());
      if (tags.includes(normalizedStatName)) {
        matchedAttr = attr;
        break;
      }
    }
  }

  if (!matchedAttr) {
    // Build helpful message with available stats
    const charStats = sessionStats?.characterStats?.[characterId];
    const availableStats = (statsConfig.attributes || []).map(a => {
      const currentVal = charStats?.attributeValues?.[a.key] ?? a.defaultValue;
      return `  - ${a.name} (${a.key}): ${currentVal}`;
    });

    const hint = availableStats.length > 0
      ? '\nStats disponibles:\n' + availableStats.join('\n')
      : '\nNo hay stats definidos para este personaje.';

    return {
      success: true,
      toolName: 'check_stat',
      result: { stat: statName, value: null, availableStats: (statsConfig.attributes || []).map(a => a.key) },
      displayMessage: `📊 Stat "${statName}" no encontrado.${hint}`,
    };
  }

  // Get current value
  const charStats = sessionStats?.characterStats?.[characterId];
  const value = charStats?.attributeValues?.[matchedAttr.key] ?? matchedAttr.defaultValue;
  const formattedValue = formatValueForDisplay(matchedAttr, value);

  return {
    success: true,
    toolName: 'check_stat',
    result: { stat: matchedAttr.key, value, formatted: formattedValue, type: matchedAttr.type },
    displayMessage: `📊 **${matchedAttr.name}:** ${formattedValue}${matchedAttr.type !== 'number' ? ` (tipo: ${matchedAttr.type})` : ''}`,
  };
}
