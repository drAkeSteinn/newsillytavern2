// ============================================
// OpenAI Provider - Streaming and generation
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition, ToolCall, ToolChatMessage } from '@/lib/tools/types';
import { OpenAIToolCallAccumulator } from '@/lib/tools/parsers/native-parser';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Stream from OpenAI-compatible API (NO tool calling - legacy)
 */
export async function* streamOpenAICompatible(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string = 'openai'
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Use configurable timeout or default (5 minutes)
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true
  };

  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
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
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            yield content;
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

// ============================================
// Tool Calling Support - OpenAI Compatible
// ============================================

/**
 * Result from a tool-capable stream.
 * Contains either text content or tool calls (or both).
 */
export interface ToolStreamResult {
  content: string;
  toolCalls: ToolCall[];
  // The assistant message in OpenAI format (for appending to conversation)
  assistantMessage: ToolChatMessage;
}

/**
 * Stream from OpenAI-compatible API WITH tool calling support.
 * Sends the `tools` array and processes `delta.tool_calls` from the response.
 * Returns the complete accumulated result (content + tool calls).
 */
export async function streamOpenAIWithTools(
  messages: ToolChatMessage[],
  config: LLMConfig,
  tools: ToolDefinition[],
  provider: string = 'openai'
): Promise<ToolStreamResult> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true,
    tools: tools,
  };

  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  console.log(`[OpenAI WithTools] Sending request with ${tools.length} tool(s) to ${provider}`);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  const accumulator = new OpenAIToolCallAccumulator();

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
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta) {
            accumulator.processDelta(delta);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const content = accumulator.getContent();
  const toolCalls = accumulator.getToolCalls();

  // Build the assistant message for the follow-up conversation
  const assistantMessage: ToolChatMessage = {
    role: 'assistant',
    content: content || null,
  };

  if (toolCalls.length > 0) {
    assistantMessage.tool_calls = toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      },
    }));
    console.log(`[OpenAI WithTools] Received ${toolCalls.length} tool call(s):`, 
      toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 60)}...)`));
  } else {
    console.log(`[OpenAI WithTools] Received text response (${content.length} chars)`);
  }

  return { content, toolCalls, assistantMessage };
}

/**
 * Call OpenAI-compatible API (non-streaming)
 */
export async function callOpenAICompatible(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string = 'openai'
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  
  // Use default timeout (5 minutes)
  const timeoutMs = DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: false
  };

  if (provider === 'openai') {
    requestBody.frequency_penalty = config.parameters.frequencyPenalty;
    requestBody.presence_penalty = config.parameters.presencePenalty;
    if (config.parameters.stopStrings?.length) {
      requestBody.stop = config.parameters.stopStrings;
    }
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // Keep original error text
    }
    throw new Error(`${provider} Error (${response.status}): ${errorMessage}`);
  }

  const data = await response.json();

  return {
    message: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    },
    model: data.model || config.model
  };
}
