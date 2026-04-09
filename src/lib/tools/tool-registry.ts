// ============================================
// Tool Registry
// ============================================
//
// Central registry for all available tools.
// Each tool has a definition (schema for the LLM)
// and an executor (actual logic).

import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolContext,
  ToolCategory,
} from './types';

// Executor function signature
export type ToolExecutorFn = (
  params: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolExecutionResult>;

// Internal registered tool
interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutorFn;
}

// ============================================
// Registry
// ============================================

const toolRegistry = new Map<string, RegisteredTool>();

/** Register a tool in the registry */
export function registerTool(definition: ToolDefinition, executor: ToolExecutorFn): void {
  toolRegistry.set(definition.id, { definition, executor });
}

/** Get a registered tool by ID */
export function getToolById(id: string): RegisteredTool | undefined {
  return toolRegistry.get(id);
}

/** Get a tool by name (the name sent by the LLM) */
export function getToolByName(name: string): RegisteredTool | undefined {
  for (const [, tool] of toolRegistry) {
    if (tool.definition.name === name) return tool;
  }
  return undefined;
}

/** Get all tool definitions */
export function getAllToolDefinitions(): ToolDefinition[] {
  return Array.from(toolRegistry.values()).map(t => t.definition);
}

/** Get tool definitions by IDs */
export function getToolDefinitionsByIds(ids: string[]): ToolDefinition[] {
  return ids
    .map(id => toolRegistry.get(id)?.definition)
    .filter((d): d is ToolDefinition => !!d);
}

/** Get tools by category */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return getAllToolDefinitions().filter(t => t.category === category);
}

/** Convert tool definitions to OpenAI tools format */
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([key, val]) => {
            const { required: _required, ...cleanProps } = val;
            return [key, cleanProps];
          })
        ),
        required: t.parameters.required,
      },
    },
  }));
}

/** Build the prompt-based tools section for models without native tool calling */
export function buildPromptBasedToolsSection(
  tools: ToolDefinition[],
  characterName?: string,
): string {
  if (tools.length === 0) return '';

  const charRef = characterName ? `, como ${characterName}` : '';
  const charNameMsg = characterName
    ? `Recuerda: estás roleando como ${characterName}. Usa las herramientas cuando la situación del roleplay lo requiera, pero mantén siempre tu personalidad y estilo al responder.`
    : '';

  const lines: string[] = [
    '[HERRAMIENTAS DISPONIBLES]',
    `Eres un personaje en un roleplay${charRef}. Las herramientas te permiten realizar acciones en el mundo del roleplay:`,
    '- Buscar información en internet o en tu memoria',
    '- Tirar dados para resolver acciones',
    '- Modificar stats del personaje (vida, experiencia, etc.)',
    '- Gestionar misiones y objetivos',
    '- Crear recordatorios',
    '- Actualizar relaciones con otros personajes',
    '',
    'INSTRUCCIONES IMPORTANTES:',
    '- USA HERRAMIENTAS para cualquier acción que tenga consecuencias en el mundo del roleplay',
    '- USA HERRAMIENTAS cuando necesites información que no conoces (clima, datos, etc.)',
    '- NUNCA inventes respuestas: usa las herramientas disponibles',
    '- USA HERRAMIENTAS DE STATS cuando ganes/perdas experiencia, salud, etc.',
    '- USA HERRAMIENTAS DE QUESTS para reportar progreso en misiones',
    '- USA HERRAMIENTAS DE MEMORIA para guardar eventos importantes',
    '',
    charNameMsg,
    '',
    'FORMATO DE USO:',
    'Para usar una herramienta, incluye EXACTAMENTE este bloque en tu respuesta — sin texto antes ni después:',
    '```tool_call',
    '{"name": "nombre_herramienta", "parameters": {"param1": "valor1"}}',
    '```',
    '',
    'Ejemplos de uso:',
    '```tool_call',
    '{"name": "roll_dice", "parameters": {"dice": "1d20", "label": "Ataque"}}',
    '```',
    '```tool_call',
    '{"name": "modify_stat", "parameters": {"stat_name": "experiencia", "new_value": 150, "reason": "Derroté al dragón"}}',
    '```',
    '```tool_call',
    '{"name": "manage_quest", "parameters": {"action": "report_progress", "quest_name": "rescate", "objective_name": "encontrar_prisionero", "narrative_description": "Encontré al prisionero en la celda"}}',
    '```',
    '',
    'HERRAMIENTAS DISPONIBLES:',
  ];

  for (const tool of tools) {
    const params = Object.entries(tool.parameters.properties)
      .map(([key, val]) => {
        const req = tool.parameters.required.includes(key) ? ' (REQUERIDO)' : ' (opcional)';
        const enumVals = val.enum ? ` [valores: ${val.enum.join(', ')}]` : '';
        return `    - ${key}${enumVals}: ${val.description}${req}`;
      })
      .join('\n');

    lines.push(`- ${tool.name}: ${tool.description}`);
    if (params) lines.push(params);
    lines.push('');
  }

  lines.push('REGLAS IMPORTANTES:');
  lines.push('1. Cuando uses una herramienta, TU respuesta debe ser SOLO el bloque ```tool_call```. No agregues texto antes ni después del bloque.');
  lines.push('2. Si el usuario NO pide algo que requiera una herramienta (ej: una conversación normal de roleplay), responde normalmente SIN usar ```tool_call```.');
  lines.push('3. Después de usar una herramienta, el sistema te dará el resultado y podrás responder al usuario con esa información — SIEMPRE respondiendo en personaje.');
  lines.push('4. NUNCA inventes datos que podrías obtener con una herramienta. Siempre usa la herramienta correspondiente.');
  lines.push('5. Al recibir los resultados de una herramienta, intégralos naturalmente en tu respuesta de roleplay. No menciones que usaste una herramienta ni el proceso interno.');
  lines.push('6. USA modify_stat para cualquier cambio de stats: experiencia ganada, daño recibido, curación, etc.');
  lines.push('7. USA manage_quest para reportar cuando completes un objetivo o avances en una misión.');
  lines.push('8. USA manage_memory para guardar eventos importantes del roleplay.');

  lines.push('');
  lines.push('GUÍA DE TIPOS DE MEMORIA:');
  lines.push('- hecho: Información factual estática (nombre, posesión, característica, habilidad)');
  lines.push('- evento: Algo que sucedió o va a suceder (batalla, reunión, ceremonia)');
  lines.push('- relacion: Vínculo entre personajes (confianza, enemistad, alianza)');
  lines.push('- preferencia: Gustos, disgustos, hábitos del personaje');
  lines.push('- secreto: Información oculta o sensible que el personaje guarda');
  lines.push('- otro: No encaja en las categorías anteriores');

  return lines.join('\n');
}

/** Execute a tool by name */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const tool = getToolByName(toolName);

  if (!tool) {
    return {
      success: false,
      toolName,
      result: null,
      displayMessage: `Herramienta "${toolName}" no encontrada`,
      error: 'TOOL_NOT_FOUND',
    };
  }

  // Check permission mode - 'ask' tools are logged but not blocked here
  // (actual permission handling is done on the client side)

  const startTime = Date.now();

  try {
    const result = await tool.executor(params, context);
    return {
      ...result,
      toolName,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      toolName,
      result: null,
      displayMessage: `Error ejecutando "${toolName}"`,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Auto-register all built-in tools
// ============================================

import { rollDiceTool, rollDiceExecutor } from './tools/roll-dice';
import { searchMemoryTool, searchMemoryExecutor } from './tools/search-memory';
import { getWeatherTool, getWeatherExecutor } from './tools/get-weather';
import { searchWebTool, searchWebExecutor } from './tools/search-web';
import { setReminderTool, setReminderExecutor } from './tools/set-reminder';
import { modifyStatTool, modifyStatExecutor } from './tools/modify-stat';
import { checkStatTool, checkStatExecutor } from './tools/check-stat';
import { manageQuestTool, manageQuestExecutor } from './tools/manage-quest';
import { manageSolicitudTool, manageSolicitudExecutor } from './tools/manage-solicitud';
import { manageMemoryTool, manageMemoryExecutor } from './tools/manage-memory';

// Register built-in tools
registerTool(rollDiceTool, rollDiceExecutor);
registerTool(searchMemoryTool, searchMemoryExecutor);
registerTool(getWeatherTool, getWeatherExecutor);
registerTool(searchWebTool, searchWebExecutor);
registerTool(setReminderTool, setReminderExecutor);
registerTool(modifyStatTool, modifyStatExecutor);
registerTool(checkStatTool, checkStatExecutor);
registerTool(manageQuestTool, manageQuestExecutor);
registerTool(manageSolicitudTool, manageSolicitudExecutor);
registerTool(manageMemoryTool, manageMemoryExecutor);

console.log(`[Tools] Registered ${toolRegistry.size} built-in tools: ${Array.from(toolRegistry.keys()).join(', ')}`);
