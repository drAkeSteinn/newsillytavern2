// ============================================
// Tool Executor - Central execution engine
// ============================================

import { getTool } from './tool-registry';
import type { ToolContext, ToolExecutionResult } from './types';

// In-memory usage tracking (simple, resets on server restart)
const usageRecords: Map<string, number> = new Map();

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {

  const entry = getTool(toolName);

  if (!entry) {
    return {
      success: false,
      toolName,
      result: null,
      displayMessage: `Herramienta "${toolName}" no encontrada`,
      error: 'TOOL_NOT_FOUND',
    };
  }

  const { definition, executor } = entry;

  // Check if disabled
  if (definition.enabled === false || definition.permissionMode === 'disabled') {
    return {
      success: false,
      toolName,
      result: null,
      displayMessage: `Herramienta "${toolName}" está deshabilitada`,
      error: 'TOOL_DISABLED',
    };
  }

  // Check daily usage limit
  if (definition.maxUsesPerDay) {
    const key = `${toolName}:${context.sessionId}`;
    const uses = usageRecords.get(key) || 0;
    if (uses >= definition.maxUsesPerDay) {
      return {
        success: false,
        toolName,
        result: null,
        displayMessage: `Límite diario alcanzado para "${definition.label}"`,
        error: 'TOOL_DAILY_LIMIT',
      };
    }
  }

  // Execute
  const startTime = Date.now();
  try {
    const result = await executor.execute(args, context);

    // Record usage
    const key = `${toolName}:${context.sessionId}`;
    usageRecords.set(key, (usageRecords.get(key) || 0) + 1);

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
      displayMessage: `Error ejecutando "${definition.label}"`,
      error: error instanceof Error ? error.message : 'Unknown',
      duration: Date.now() - startTime,
    };
  }
}

export { getTool, getAllTools, getToolDefinitions, toOpenAITools, buildToolsPromptText } from './tool-registry';
