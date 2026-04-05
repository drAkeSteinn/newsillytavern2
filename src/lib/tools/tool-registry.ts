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
      parameters: t.parameters,
    },
  }));
}

/** Build the prompt-based tools section for models without native tool calling */
export function buildPromptBasedToolsSection(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';

  const lines: string[] = [
    '[HERRAMIENTAS DISPONIBLES]',
    'Tienes acceso a las siguientes herramientas. Para usar una, responde con el siguiente formato EXACTO:',
    '```tool_call',
    '{"name": "nombre_herramienta", "parameters": {"param1": "valor1"}}',
    '```',
    '',
  ];

  for (const tool of tools) {
    const params = Object.entries(tool.parameters.properties)
      .map(([key, val]) => {
        const req = tool.parameters.required.includes(key) ? ' (requerido)' : '';
        const enumVals = val.enum ? ` [${val.enum.join('|')}]` : '';
        return `  - ${key}${enumVals}: ${val.description}${req}`;
      })
      .join('\n');

    lines.push(`${tool.name}: ${tool.description}`);
    if (params) lines.push(params);
    lines.push('');
  }

  lines.push('IMPORTANTE: Solo usa una herramienta por respuesta. No uses ```tool_call si no necesitas una herramienta.');

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

// Register built-in tools
registerTool(rollDiceTool, rollDiceExecutor);
registerTool(searchMemoryTool, searchMemoryExecutor);
registerTool(getWeatherTool, getWeatherExecutor);
registerTool(searchWebTool, searchWebExecutor);
registerTool(setReminderTool, setReminderExecutor);

console.log(`[Tools] Registered ${toolRegistry.size} built-in tools: ${Array.from(toolRegistry.keys()).join(', ')}`);
