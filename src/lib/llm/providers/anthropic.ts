// ============================================
// Anthropic Provider - Streaming and generation
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { AnthropicToolState } from '@/lib/tools/parsers/native-parser';
import {
  createAnthropicToolState,
  processAnthropicEvent,
  anthropicStateToToolCalls,
} from '@/lib/tools/parsers/native-parser';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Stream from Anthropic API (without tools - backward compatible)
 */
export async function* streamAnthropic(
  messages: ChatApiMessage[],
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Use configurable timeout or default (5 minutes)
  const timeoutMs = DEFAULT_TIMEOUT;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch(`${endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.parameters.maxTokens,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      stream: true
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream from Anthropic API WITH native tool calling support.
 *
 * Anthropic uses "tool_use" content blocks in the response.
 * Yields text chunks for display. Tool calls are tracked via AnthropicToolState.
 *
 * After the generator completes, use `anthropicStateToToolCalls(toolState)` to
 * get the accumulated tool calls.
 */
export async function* streamAnthropicWithTools(
  messages: ChatApiMessage[],
  config: LLMConfig,
  tools: ToolDefinition[],
  toolState: AnthropicToolState,
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const timeoutMs = DEFAULT_TIMEOUT;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  // Convert tools to Anthropic format
  const anthropicTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  console.log(`[Anthropic+Tools] Streaming with ${anthropicTools.length} tools`);

  const response = await fetch(`${endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.parameters.maxTokens,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      tools: anthropicTools,
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      stream: true
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);

        try {
          const parsed = JSON.parse(data);
          const textContent = processAnthropicEvent(parsed, toolState);
          if (textContent) {
            yield textContent;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`[Anthropic+Tools] Stream complete. stopReason=${toolState.stopReason}, toolBlocks=${toolState.blocks.length}`);
}

/**
 * Call Anthropic API (non-streaming)
 */
export async function callAnthropic(
  messages: ChatApiMessage[],
  config: LLMConfig
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Use default timeout (5 minutes)
  const timeoutMs = DEFAULT_TIMEOUT;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch(`${endpoint}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.parameters.maxTokens,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    message: data.content?.[0]?.text || '',
    usage: {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    model: data.model || config.model
  };
}
