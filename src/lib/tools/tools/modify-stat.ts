// ============================================
// Tool: Modify Stat
// ============================================
// Category: in_character
// Modifies character stats based on LLM decisions
//
// Supports all attribute types (number, keyword, text)
// Supports operators: set (default), add (+), subtract (-)
// Applies min/max clamping for numeric attributes
// Returns statActivation for client-side store update

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import type { AttributeDefinition } from '@/types';

export const modifyStatTool: ToolDefinition = {
  id: 'modify_stat',
  name: 'modify_stat',
  label: 'Modificar Stat',
  icon: 'Pencil',
  description:
    'Modifica el valor de un atributo o stat del personaje. ' +
    'Úsala cuando un evento en el roleplay deba cambiar una estadística ' +
    '(ej: ganar experiencia, perder vida, recibir daño, cambiar estado). ' +
    'Para atributos numéricos puedes usar operadores: "+10" suma, "-5" resta, "=50" establece.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      stat_name: {
        type: 'string',
        description: 'Nombre o key del stat a modificar (ej: vida, exp, nivel, estado). Puede ser la key exacta o el nombre del atributo.',
        required: true,
      },
      new_value: {
        type: 'string',
        description: 'Nuevo valor del stat. Para números: "50" establece a 50, "+10" suma 10, "-5" resta 5. Para texto/keyword: el nuevo valor directamente (ej: "envenenado", "armadura_pesada").',
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

/**
 * Clamp a numeric value to attribute min/max bounds
 */
function clampValue(value: number, attr: AttributeDefinition): number {
  let result = value;
  if (attr.min !== undefined) {
    const minVal = typeof attr.min === 'number' ? attr.min : parseFloat(String(attr.min));
    if (!isNaN(minVal)) result = Math.max(result, minVal);
  }
  if (attr.max !== undefined) {
    const maxVal = typeof attr.max === 'number' ? attr.max : parseFloat(String(attr.max));
    if (!isNaN(maxVal)) result = Math.min(result, maxVal);
  }
  return result;
}

export async function modifyStatExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const statName = String(params.stat_name || '').trim();
  const rawValue = params.new_value !== undefined ? String(params.new_value).trim() : '';
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

  if (!rawValue) {
    return {
      success: false,
      toolName: 'modify_stat',
      result: null,
      displayMessage: 'Debes especificar un valor para el stat.',
      error: 'Missing required parameter: new_value',
    };
  }

  // Check that stats system is available
  const { statsConfig, sessionStats, characterId } = context;

  if (!statsConfig?.enabled) {
    return {
      success: false,
      toolName: 'modify_stat',
      result: null,
      displayMessage: 'El sistema de stats no está habilitado para este personaje.',
      error: 'Stats system not enabled',
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
    // Build helpful error with available stats
    const availableStats = (statsConfig.attributes || []).map(a => {
      const keys = [a.key, ...(a.keys || [])].filter(Boolean);
      return `  - "${a.name}" (key: ${a.key}${keys.length > 1 ? ', alias: ' + keys.slice(1).join(', ') : ''})`;
    });

    const hint = availableStats.length > 0
      ? '\nStats disponibles:\n' + availableStats.join('\n')
      : '\nNo hay stats definidos para este personaje.';

    return {
      success: false,
      toolName: 'modify_stat',
      result: null,
      displayMessage: `Stat "${statName}" no encontrado.${hint}`,
      error: 'Stat not found',
    };
  }

  // Get current value from session stats
  const charStats = sessionStats?.characterStats?.[characterId];
  const oldValue = charStats?.attributeValues?.[matchedAttr.key] ?? matchedAttr.defaultValue;

  // Compute new value based on attribute type and operator
  let newValue: number | string;
  let operatorLabel = 'establecido a';

  if (matchedAttr.type === 'number' || typeof oldValue === 'number') {
    // Numeric attribute - parse operator
    if (rawValue.startsWith('+')) {
      // Add operation
      const delta = parseFloat(rawValue.slice(1));
      if (isNaN(delta)) {
        return {
          success: false,
          toolName: 'modify_stat',
          result: null,
          displayMessage: `Valor inválido para suma: "${rawValue}". Usa formato "+10" para sumar.`,
          error: 'Invalid value for add operation',
        };
      }
      const baseValue = typeof oldValue === 'number' ? oldValue : parseFloat(String(oldValue)) || 0;
      newValue = clampValue(baseValue + delta, matchedAttr);
      operatorLabel = `+${delta}`;
    } else if (rawValue.startsWith('-')) {
      // Subtract operation
      const delta = parseFloat(rawValue.slice(1));
      if (isNaN(delta)) {
        return {
          success: false,
          toolName: 'modify_stat',
          result: null,
          displayMessage: `Valor inválido para resta: "${rawValue}". Usa formato "-5" para restar.`,
          error: 'Invalid value for subtract operation',
        };
      }
      const baseValue = typeof oldValue === 'number' ? oldValue : parseFloat(String(oldValue)) || 0;
      newValue = clampValue(baseValue - delta, matchedAttr);
      operatorLabel = `-${delta}`;
    } else if (rawValue.startsWith('=')) {
      // Explicit set operation
      const parsed = parseFloat(rawValue.slice(1));
      if (isNaN(parsed)) {
        return {
          success: false,
          toolName: 'modify_stat',
          result: null,
          displayMessage: `Valor numérico inválido: "${rawValue.slice(1)}".`,
          error: 'Invalid numeric value',
        };
      }
      newValue = clampValue(parsed, matchedAttr);
    } else {
      // Default: set value
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed)) {
        return {
          success: false,
          toolName: 'modify_stat',
          result: null,
          displayMessage: `Valor numérico inválido: "${rawValue}". El atributo "${matchedAttr.name}" es de tipo numérico.`,
          error: 'Invalid numeric value for number attribute',
        };
      }
      newValue = clampValue(parsed, matchedAttr);
    }
  } else {
    // Keyword or text attribute - set directly
    newValue = rawValue;
  }

  // Build display message
  const lines = [
    `📊 **Stat modificado:** ${matchedAttr.name} (${matchedAttr.key})`,
  ];

  lines.push(`  Valor anterior: ${oldValue}`);
  lines.push(`  Nuevo valor: **${newValue}** ${operatorLabel !== 'establecido a' ? `(${operatorLabel})` : ''}`);

  if (reason) {
    lines.push(`  Razón: ${reason}`);
  }

  // Check if value was clamped
  const unclampedRaw = rawValue.startsWith('+') || rawValue.startsWith('-') || rawValue.startsWith('=')
    ? parseFloat(rawValue.slice(1))
    : parseFloat(rawValue);
  const wasClamped = matchedAttr.type === 'number' && !isNaN(unclampedRaw) && newValue !== unclampedRaw;

  // Note: for add/subtract, clamping is already applied above. We just need to inform.
  if (wasClamped && !rawValue.startsWith('+') && !rawValue.startsWith('-')) {
    lines.push(`  ⚠️ Valor limitado (min: ${matchedAttr.min ?? '-∞'}, max: ${matchedAttr.max ?? '∞'})`);
  }

  return {
    success: true,
    toolName: 'modify_stat',
    result: {
      stat: matchedAttr.key,
      newValue,
      previousValue: oldValue ?? null,
      reason,
      attributeType: matchedAttr.type,
    },
    displayMessage: lines.join('\n'),
    statActivation: {
      characterId,
      attributeKey: matchedAttr.key,
      attributeName: matchedAttr.name,
      attributeType: matchedAttr.type || 'number',
      oldValue,
      newValue,
      reason: reason || 'llm_tool',
    },
  };
}
