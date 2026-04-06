// ============================================
// Tool: Roll Dice
// ============================================
// Category: in_character (roleplay)
// Permission: auto

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const rollDiceTool: ToolDefinition = {
  id: 'roll_dice',
  name: 'roll_dice',
  label: 'Tirar Dados',
  icon: 'Dices',
  description:
    'Tira dados para resolver acciones o eventos aleatorios. ' +
    'Usa notación de dados como 1d20, 2d6, 1d100. ' +
    'Úsala cuando el usuario pida tirar dados o cuando una acción tenga un resultado incierto.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      dice: {
        type: 'string',
        description: 'Notación de dados (ej: 1d20, 2d6+3, 1d100)',
        required: true,
      },
      label: {
        type: 'string',
        description: 'Descripción de lo que se está tirando (ej: "Ataque con espada")',
        required: false,
      },
    },
    required: ['dice'],
  },
  permissionMode: 'auto',
};

export async function rollDiceExecutor(
  params: Record<string, unknown>,
  _context: ToolContext,
): Promise<ToolExecutionResult> {
  const diceStr = String(params.dice || '1d20').toLowerCase().trim();
  const label = params.label ? String(params.label) : '';

  try {
    // Parse dice notation: XdY or XdY+Z or XdY-Z
    const diceRegex = /^(\d+)d(\d+)(?:([+-])(\d+))?$/;
    const match = diceStr.match(diceRegex);

    if (!match) {
      return {
        success: false,
        toolName: 'roll_dice',
        result: null,
        displayMessage: `Notación de dados inválida: "${diceStr}". Usa formato como 1d20, 2d6, 1d100.`,
        error: 'INVALID_DICE_NOTATION',
      };
    }

    const numDice = parseInt(match[1]);
    const numSides = parseInt(match[2]);
    const modifierOp = match[3];
    const modifierVal = match[4] ? parseInt(match[4]) : 0;

    // Validate ranges
    if (numDice < 1 || numDice > 100) {
      return {
        success: false,
        toolName: 'roll_dice',
        result: null,
        displayMessage: `Número de dados debe ser entre 1 y 100`,
        error: 'INVALID_DICE_COUNT',
      };
    }
    if (numSides < 2 || numSides > 1000) {
      return {
        success: false,
        toolName: 'roll_dice',
        result: null,
        displayMessage: `Caras del dado deben ser entre 2 y 1000`,
        error: 'INVALID_DICE_SIDES',
      };
    }

    // Roll dice
    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < numDice; i++) {
      const roll = Math.floor(Math.random() * numSides) + 1;
      rolls.push(roll);
      total += roll;
    }

    // Apply modifier
    const modifier = modifierOp === '-' ? -modifierVal : modifierVal;
    const finalTotal = total + modifier;

    // Build display message
    const rollsStr = numDice <= 10 ? `[${rolls.join(', ')}]` : `[${rolls.slice(0, 5).join(', ')}, ... +${rolls.length - 5} más]`;
    const modStr = modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : '';
    const labelStr = label ? ` para "${label}"` : '';

    const displayMessage = `🎲 Tirada${labelStr}: ${diceStr} = ${rollsStr}${modStr} = **${finalTotal}**`;

    return {
      success: true,
      toolName: 'roll_dice',
      result: {
        dice: diceStr,
        label,
        rolls,
        total,
        modifier,
        finalTotal,
      },
      displayMessage,
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'roll_dice',
      result: null,
      displayMessage: 'Error al tirar los dados',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
