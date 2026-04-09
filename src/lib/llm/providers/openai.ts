// ============================================
// OpenAI Provider - Streaming and generation
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { ToolCallAccumulator } from '@/lib/tools/parsers/native-parser';
import { toOpenAITools } from '@/lib/tools/tool-registry';
import { processOpenAIDelta, finalizeToolCalls } from '@/lib/tools/parsers/native-parser';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Stream from OpenAI-compatible API (without tools - backward compatible)
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

/**
 * Stream from OpenAI-compatible API WITH native tool calling support.
 * 
 * Yields text chunks for real-time display. Tool calls are accumulated
 * in the provided ToolCallAccumulator. After the generator completes,
 * check `accumulator.toolCalls` and `accumulator.finishReason`.
 */
export async function* streamOpenAIWithTools(
  messages: ChatApiMessage[],
  config: LLMConfig,
  provider: string,
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const openAITools = toOpenAITools(tools);
  
  console.log(`[OpenAI+Tools] Streaming with ${openAITools.length} tools for ${provider}`);

  const requestBody: Record<string, unknown> = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true,
    tools: openAITools,
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
          const choice = parsed.choices?.[0];

          // Check finish reason
          if (choice?.finish_reason) {
            accumulator.finishReason = choice.finish_reason;
          }

          // Process delta for both text and tool calls
          const delta = choice?.delta || {};
          const textContent = processOpenAIDelta(delta, accumulator);
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
    // Finalize accumulated tool calls
    finalizeToolCalls(accumulator);
  }

  console.log(`[OpenAI+Tools] Stream complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
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
