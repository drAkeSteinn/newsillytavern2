// ============================================
// Native Tool Call Parser
// ============================================
//
// Parses tool_calls from provider API responses.
// Supports OpenAI-compatible, Ollama, and Anthropic formats.

import type { ToolDefinition } from '../types';

// ============================================
// Types
// ============================================

/** A parsed tool call from a native API response */
export interface NativeToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments: string; // raw JSON string
}

/** Mutable accumulator for tool call state during streaming */
export interface ToolCallAccumulator {
  /** The tool definitions sent to the API */
  tools: ToolDefinition[];
  /** Accumulated tool calls from streaming deltas */
  toolCalls: NativeToolCall[];
  /** Buffer for partial tool call arguments (keyed by index) */
  privateArgsBuffer: Map<number, string>;
  /** Buffer for tool call IDs (keyed by index) */
  privateIdsBuffer: Map<number, string>;
  /** Buffer for tool call names (keyed by index) */
  privateNamesBuffer: Map<number, string>;
  /** Finish reason from the API response */
  finishReason: string | null;
}

/** Create a new tool call accumulator */
export function createToolCallAccumulator(tools: ToolDefinition[]): ToolCallAccumulator {
  return {
    tools,
    toolCalls: [],
    privateArgsBuffer: new Map(),
    privateIdsBuffer: new Map(),
    privateNamesBuffer: new Map(),
    finishReason: null,
  };
}

/** Check if any tool calls were accumulated */
export function hasToolCalls(accumulator: ToolCallAccumulator): boolean {
  return accumulator.toolCalls.length > 0;
}

// ============================================
// OpenAI-Compatible Format Parser
// ============================================
// Used by: OpenAI, vLLM, LM Studio, Z.ai, custom
//
// Streaming delta format:
// data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]}}]}
// data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"city"}}]}}]}
// data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\":\"Tokio\"}"}}]}}]}
// data: {"choices":[{"finish_reason":"tool_calls","delta":{}}]}

/**
 * Process a streaming delta from an OpenAI-compatible API.
 * Accumulates tool call chunks into the accumulator.
 * Returns any text content delta.
 */
export function processOpenAIDelta(
  delta: Record<string, unknown>,
  accumulator: ToolCallAccumulator,
): string {
  let textContent = '';

  // Extract text content
  const content = delta.content as string | null | undefined;
  if (content) {
    textContent = content;
  }

  // Extract tool call deltas
  const toolCallDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined;
  if (toolCallDeltas) {
    for (const tcDelta of toolCallDeltas) {
      const index = tcDelta.index as number;
      const id = tcDelta.id as string | undefined;
      const func = tcDelta.function as Record<string, unknown> | undefined;

      if (id) {
        accumulator.privateIdsBuffer.set(index, id);
      }
      if (func?.name) {
        accumulator.privateNamesBuffer.set(index, func.name as string);
      }
      if (func?.arguments) {
        const existing = accumulator.privateArgsBuffer.get(index) || '';
        accumulator.privateArgsBuffer.set(index, existing + (func.arguments as string));
      }
    }
  }

  return textContent;
}

/**
 * Finalize accumulated tool calls after streaming is complete.
 * Parses the argument strings into objects.
 */
export function finalizeToolCalls(accumulator: ToolCallAccumulator): void {
  const maxIndex = Math.max(
    ...accumulator.privateIdsBuffer.keys(),
    ...accumulator.privateNamesBuffer.keys(),
    ...accumulator.privateArgsBuffer.keys(),
    -1,
  );

  for (let i = 0; i <= maxIndex; i++) {
    const id = accumulator.privateIdsBuffer.get(i) || `call_${i}`;
    const name = accumulator.privateNamesBuffer.get(i);
    const argsStr = accumulator.privateArgsBuffer.get(i) || '{}';

    if (!name) continue;

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(argsStr);
    } catch {
      console.warn(`[NativeParser] Failed to parse tool call arguments for ${name}:`, argsStr);
      parsedArgs = {};
    }

    accumulator.toolCalls.push({
      id,
      name,
      arguments: parsedArgs,
      rawArguments: argsStr,
    });
  }
}

/**
 * Format tool calls as OpenAI-style assistant message and tool result messages
 * for the follow-up API call.
 */
export function buildToolMessagesForOpenAI(
  toolCalls: NativeToolCall[],
  toolResults: Array<{ success: boolean; displayMessage: string }>,
): Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string }> {
  const messages: Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string }> = [];

  // Assistant message with tool_calls
  messages.push({
    role: 'assistant',
    content: null,
    tool_calls: toolCalls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: tc.rawArguments,
      },
    })),
  });

  // Tool result messages
  for (let i = 0; i < toolCalls.length; i++) {
    const result = toolResults[i];
    messages.push({
      role: 'tool',
      tool_call_id: toolCalls[i].id,
      content: result
        ? JSON.stringify({ success: result.success, result: result.displayMessage })
        : JSON.stringify({ success: false, result: 'Error: no result' }),
    });
  }

  return messages;
}

// ============================================
// Ollama Format Parser
// ============================================
//
// Ollama /api/chat streaming with tools:
// {"model":"...","message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"get_weather","arguments":{"city":"Tokio"}}}]},"done":false}
// {"model":"...","message":{"role":"assistant","content":""},"done":true}

export interface OllamaToolCallDelta {
  function?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

/**
 * Process an Ollama streaming message for tool calls.
 * Ollama sends complete tool_calls in each delta (not incremental).
 */
export function processOllamaToolDelta(
  message: Record<string, unknown>,
  accumulator: ToolCallAccumulator,
): string {
  let textContent = '';
  const content = message.content as string | undefined;
  if (content) {
    textContent = content;
  }

  const toolCalls = message.tool_calls as Array<OllamaToolCallDelta> | undefined;
  if (toolCalls && toolCalls.length > 0) {
    // Ollama sends the full tool call in each chunk, so we take the last complete one
    accumulator.toolCalls = [];
    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      if (tc?.function?.name) {
        accumulator.toolCalls.push({
          id: `ollama_call_${i}`,
          name: tc.function.name,
          arguments: tc.function.arguments || {},
          rawArguments: JSON.stringify(tc.function.arguments || {}),
        });
      }
    }
  }

  return textContent;
}

/**
 * Format tool calls and results for Ollama's /api/chat endpoint.
 * 
 * Per Ollama docs, the follow-up must include:
 * 1. The assistant message with tool_calls
 * 2. A tool result message with role: "tool" and tool_name field
 * 
 * Example from Ollama docs:
 * { role: "assistant", content: "", tool_calls: [{ function: { name, arguments } }] }
 * { role: "tool", content: "result text", tool_name: "get_weather" }
 */
export function buildToolMessagesForOllama(
  toolCalls: NativeToolCall[],
  toolResults: Array<{ success: boolean; displayMessage: string }>,
): Array<{ role: string; content: string; tool_calls?: unknown[]; tool_name?: string }> {
  const messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_name?: string }> = [];

  // 1. The assistant message with tool_calls (what the model originally sent)
  messages.push({
    role: 'assistant',
    content: '',
    tool_calls: toolCalls.map(tc => ({
      function: {
        name: tc.name,
        arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments,
      },
    })),
  });

  // 2. The tool result messages (one per tool call)
  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const result = toolResults[i];
    const resultContent = result?.success
      ? result?.displayMessage || 'Tool executed successfully'
      : `ERROR: ${result?.displayMessage || 'Tool execution failed'}`;
    
    messages.push({
      role: 'tool',
      content: resultContent,
      tool_name: tc.name,
    });
  }

  return messages;
}

// ============================================
// Anthropic Format Parser
// ============================================
//
// Anthropic streams tool_use content blocks:
// data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_abc","name":"get_weather"}}
// data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"city\":\"Tokio\"}"}}
// data: {"type":"content_block_stop","index":1}
// data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}

/** State for tracking Anthropic tool use blocks during streaming */
export interface AnthropicToolState {
  /** Current tool use blocks being accumulated */
  blocks: Array<{
    id: string;
    name: string;
    inputJson: string;
    index: number;
  }>;
  /** Stop reason from the message */
  stopReason: string | null;
}

export function createAnthropicToolState(): AnthropicToolState {
  return { blocks: [], stopReason: null };
}

/**
 * Process an Anthropic SSE event for tool use.
 * Returns text content if applicable.
 */
export function processAnthropicEvent(
  event: Record<string, unknown>,
  toolState: AnthropicToolState,
): string {
  const eventType = event.type as string;

  if (eventType === 'content_block_start') {
    const block = event.content_block as Record<string, unknown> | undefined;
    if (block?.type === 'tool_use') {
      toolState.blocks.push({
        id: (block.id as string) || `toolu_${toolState.blocks.length}`,
        name: (block.name as string) || '',
        inputJson: '',
        index: (event.index as number) || 0,
      });
    }
    return '';
  }

  if (eventType === 'content_block_delta') {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (delta?.type === 'input_json_delta') {
      const partialJson = delta.partial_json as string;
      const lastBlock = toolState.blocks[toolState.blocks.length - 1];
      if (lastBlock) {
        lastBlock.inputJson += partialJson;
      }
    }
    if (delta?.type === 'text_delta') {
      return (delta.text as string) || '';
    }
    return '';
  }

  if (eventType === 'message_delta') {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (delta?.stop_reason) {
      toolState.stopReason = delta.stop_reason as string;
    }
  }

  return '';
}

/**
 * Convert Anthropic tool state to NativeToolCall array.
 */
export function anthropicStateToToolCalls(toolState: AnthropicToolState): NativeToolCall[] {
  return toolState.blocks.map(block => {
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = block.inputJson ? JSON.parse(block.inputJson) : {};
    } catch {
      console.warn(`[NativeParser] Failed to parse Anthropic tool arguments for ${block.name}:`, block.inputJson);
      parsedArgs = {};
    }

    return {
      id: block.id,
      name: block.name,
      arguments: parsedArgs,
      rawArguments: block.inputJson,
    };
  });
}

/**
 * Format tool calls and results for Anthropic's messages API.
 * Anthropic uses tool_result content blocks.
 */
export function buildToolMessagesForAnthropic(
  toolCalls: NativeToolCall[],
  toolResults: Array<{ success: boolean; displayMessage: string }>,
): Array<{ role: string; content: Array<Record<string, unknown>> | string }> {
  // Assistant message with tool_use blocks
  const assistantContent = toolCalls.map(tc => ({
    type: 'tool_use',
    id: tc.id,
    name: tc.name,
    input: tc.arguments,
  }));

  // User message with tool_result blocks
  const userContent = toolCalls.map((tc, i) => ({
    type: 'tool_result',
    tool_use_id: tc.id,
    content: toolResults[i]
      ? JSON.stringify({ success: toolResults[i].success, result: toolResults[i].displayMessage })
      : JSON.stringify({ success: false, result: 'Error: no result' }),
  }));

  return [
    { role: 'assistant', content: assistantContent },
    { role: 'user', content: userContent },
  ];
}
