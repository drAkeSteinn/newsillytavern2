// ============================================
// Tool Call Parsers
// ============================================
// Two parsing strategies:
// 1. Native: Parse tool_calls from OpenAI/Ollama compatible responses
// 2. Prompt-based: Detect TOOL_CALL pattern in text output

import type { ParsedToolCall } from './types';

/** Generate a unique tool call ID */
function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse tool calls from native LLM response (OpenAI format).
 * Some providers return tool_calls in the response metadata.
 */
export function parseNativeToolCalls(response: {
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}): ParsedToolCall[] {
  if (!response.tool_calls?.length) return [];

  return response.tool_calls.map(tc => ({
    id: tc.id || generateToolCallId(),
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
    raw: tc.function.arguments,
  }));
}

/**
 * Parse tool calls from prompt-based LLM response.
 * Detects patterns like:
 *
 * TOOL_CALL: roll_dice
 * ```json
 * {"dice": "1d20"}
 * ```
 */
export function parsePromptToolCalls(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];

  // Pattern: TOOL_CALL: tool_name\n```json\n{...}\n```
  const pattern = /TOOL_CALL:\s*(\w+)\s*\n```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const toolName = match[1].trim();
    const argsStr = match[2].trim();

    try {
      const args = JSON.parse(argsStr);
      results.push({
        id: generateToolCallId(),
        name: toolName,
        arguments: args,
        raw: argsStr,
      });
    } catch {
      console.warn(`[Tools] Failed to parse tool call arguments for "${toolName}":`, argsStr);
    }
  }

  // Fallback: TOOL_CALL: tool_name | {...json...}
  if (results.length === 0) {
    const pipePattern = /TOOL_CALL:\s*(\w+)\s*\|\s*([\s\S]*?)(?:\n|$)/gi;
    while ((match = pipePattern.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argsStr = match[2].trim();

      try {
        const args = JSON.parse(argsStr);
        results.push({
          id: generateToolCallId(),
          name: toolName,
          arguments: args,
          raw: argsStr,
        });
      } catch {
        console.warn(`[Tools] Failed to parse pipe tool call for "${toolName}":`, argsStr);
      }
    }
  }

  return results;
}

/** Strip tool call text from LLM response for clean display */
export function stripToolCallText(text: string): string {
  let cleaned = text;

  // Remove TOOL_CALL blocks
  cleaned = cleaned.replace(/TOOL_CALL:\s*\w+\s*\n```(?:json)?\s*\n?[\s\S]*?\n?```/gi, '');
  cleaned = cleaned.replace(/TOOL_CALL:\s*\w+\s*\|[\s\S]*?(?:\n|$)/gi, '');

  // Also remove bare JSON tool call format: {"name": "...", "parameters": {...}}
  cleaned = cleaned.replace(/\{"name"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[^}]*\}\s*\}/g, '');

  return cleaned.trim();
}
