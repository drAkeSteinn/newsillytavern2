// ============================================
// Native Tool Call Parser
// ============================================
// Parses tool calls from streaming responses for different providers.
// 
// OpenAI/Ollama: tool_calls come via delta.tool_calls[].function.arguments (streamed)
// Anthropic: tool_use blocks via content_block_delta with delta.type === 'input_json_delta'

import type { ToolCall, ToolCallResult, ToolStreamEvent } from '../types';

/**
 * Accumulator for parsing streaming tool calls from OpenAI-compatible providers.
 * Handles the incremental assembly of tool call arguments from delta chunks.
 */
export class OpenAIToolCallAccumulator {
  private toolCalls: Map<number, {
    id: string;
    name: string;
    arguments: string;
  }> = new Map();

  private contentBuffer = '';

  /**
   * Process a single SSE delta chunk from an OpenAI-compatible streaming response.
   * Returns an array of events: content tokens and tool call deltas.
   */
  processDelta(delta: Record<string, unknown>): ToolStreamEvent[] {
    const events: ToolStreamEvent[] = [];

    // Process content delta
    const content = delta.content as string | undefined;
    if (content) {
      this.contentBuffer += content;
      events.push({ type: 'content', content });
    }

    // Process tool_calls delta
    const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const index = tc.index as number;
        const tcDelta = tc as Record<string, unknown>;
        const func = tcDelta.function as Record<string, unknown> | undefined;
        const id = (tcDelta.id as string) || undefined;
        const name = func?.name as string | undefined;
        const args = func?.arguments as string | undefined;

        if (!this.toolCalls.has(index)) {
          this.toolCalls.set(index, {
            id: id || `call_${Date.now()}_${index}`,
            name: name || '',
            arguments: '',
          });
          events.push({
            type: 'tool_call_start',
            toolCallId: this.toolCalls.get(index)!.id,
            toolCallName: name || '',
            toolCallIndex: index,
          });
        }

        const existing = this.toolCalls.get(index)!;
        if (id && !existing.id.includes('Date.now')) {
          existing.id = id;
        }
        if (name) {
          existing.name = name;
        }
        if (args) {
          existing.arguments += args;
          events.push({
            type: 'tool_call_delta',
            toolCallId: existing.id,
            toolCallArguments: args,
            toolCallIndex: index,
          });
        }
      }
    }

    return events;
  }

  /**
   * Check if any tool calls were accumulated.
   */
  hasToolCalls(): boolean {
    return this.toolCalls.size > 0;
  }

  /**
   * Get accumulated content text.
   */
  getContent(): string {
    return this.contentBuffer;
  }

  /**
   * Get all accumulated tool calls as parsed ToolCall objects.
   */
  getToolCalls(): ToolCall[] {
    const result: ToolCall[] = [];
    
    // Sort by index to maintain order
    const sortedIndices = [...this.toolCalls.keys()].sort((a, b) => a - b);
    
    for (const index of sortedIndices) {
      const tc = this.toolCalls.get(index)!;
      
      // Parse arguments JSON
      let parsedArgs: Record<string, unknown> = {};
      try {
        const argsStr = tc.arguments.trim();
        if (argsStr) {
          parsedArgs = JSON.parse(argsStr);
        }
      } catch (e) {
        console.error(`[NativeParser] Failed to parse tool call arguments for ${tc.name}:`, e);
        console.error(`[NativeParser] Raw arguments:`, tc.arguments);
        // Try to recover partial JSON
        parsedArgs = { _raw: tc.arguments };
      }

      result.push({
        id: tc.id,
        name: tc.name,
        arguments: parsedArgs,
      });
    }

    return result;
  }
}

/**
 * Accumulator for parsing streaming tool calls from Anthropic responses.
 * Anthropic uses content_block_start (with type: 'tool_use') and 
 * content_block_delta (with delta.type: 'input_json_delta') events.
 */
export class AnthropicToolCallAccumulator {
  private toolCalls: Map<string, {
    id: string;
    name: string;
    arguments: string;
    contentIndex: number;
  }> = new Map();

  private contentBuffer = '';
  private currentContentBlockIndex = -1;
  private currentBlockType: string | null = null;

  /**
   * Process a single SSE event from an Anthropic streaming response.
   * Pass the full parsed JSON object from the event stream.
   */
  processEvent(event: Record<string, unknown>): ToolStreamEvent[] {
    const events: ToolStreamEvent[] = [];
    const eventType = event.type as string;

    if (eventType === 'content_block_start') {
      const block = event.content_block as Record<string, unknown> | undefined;
      const index = event.index as number;
      this.currentContentBlockIndex = index;

      if (block?.type === 'tool_use') {
        const id = block.id as string;
        const name = block.name as string;
        this.currentBlockType = 'tool_use';
        
        this.toolCalls.set(id, {
          id,
          name,
          arguments: '',
          contentIndex: index,
        });

        events.push({
          type: 'tool_call_start',
          toolCallId: id,
          toolCallName: name,
          toolCallIndex: index,
        });
      } else if (block?.type === 'text') {
        this.currentBlockType = 'text';
      }
    } else if (eventType === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined;
      const deltaType = delta?.type as string;

      if (deltaType === 'text_delta' && delta?.text) {
        this.contentBuffer += delta.text as string;
        events.push({ type: 'content', content: delta.text as string });
      } else if (deltaType === 'input_json_delta' && delta?.partial_json) {
        // Find the current tool call by content block index
        for (const [id, tc] of this.toolCalls.entries()) {
          if (tc.contentIndex === this.currentContentBlockIndex) {
            tc.arguments += delta.partial_json as string;
            events.push({
              type: 'tool_call_delta',
              toolCallId: id,
              toolCallArguments: delta.partial_json as string,
              toolCallIndex: this.currentContentBlockIndex,
            });
            break;
          }
        }
      }
    } else if (eventType === 'content_block_stop') {
      this.currentBlockType = null;
    }

    return events;
  }

  hasToolCalls(): boolean {
    return this.toolCalls.size > 0;
  }

  getContent(): string {
    return this.contentBuffer;
  }

  getToolCalls(): ToolCall[] {
    const result: ToolCall[] = [];

    for (const tc of this.toolCalls.values()) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        const argsStr = tc.arguments.trim();
        if (argsStr) {
          parsedArgs = JSON.parse(argsStr);
        }
      } catch (e) {
        console.error(`[AnthropicParser] Failed to parse arguments for ${tc.name}:`, e);
        parsedArgs = { _raw: tc.arguments };
      }

      result.push({
        id: tc.id,
        name: tc.name,
        arguments: parsedArgs,
      });
    }

    return result;
  }
}

/**
 * Format tool call results into messages for the follow-up LLM call.
 * Each tool result becomes a 'tool' role message.
 */
export function formatToolResultsForMessages(
  toolCallResults: ToolCallResult[],
  originalToolCalls: ToolCall[]
): Array<{ role: 'tool'; content: string; tool_call_id: string }> {
  return toolCallResults.map(result => ({
    role: 'tool' as const,
    content: result.success 
      ? result.result 
      : `Error ejecutando ${result.toolName}: ${result.error}`,
    tool_call_id: result.toolCallId,
  }));
}
