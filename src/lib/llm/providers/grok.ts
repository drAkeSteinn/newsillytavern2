// ============================================
// Grok Provider (xAI) - Streaming and generation
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { ToolCallAccumulator } from '@/lib/tools/parsers/native-parser';
import { toOpenAITools } from '@/lib/tools/tool-registry';
import { processOpenAIDelta, finalizeToolCalls } from '@/lib/tools/parsers/native-parser';

const DEFAULT_TIMEOUT = 300000;

const GROK_DEFAULT_ENDPOINT = 'https://api.x.ai/v1';

export async function* streamGrok(
  messages: ChatApiMessage[],
  config: LLMConfig,
): AsyncGenerator<string> {
  const endpoint = (config.endpoint || GROK_DEFAULT_ENDPOINT).replace(/\/$/, '');
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || 'grok-3',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true
  };

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
    throw new Error(`Grok Error (${response.status}): ${errorMessage}`);
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

export async function* streamGrokWithTools(
  messages: ChatApiMessage[],
  config: LLMConfig,
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
): AsyncGenerator<string> {
  const endpoint = (config.endpoint || GROK_DEFAULT_ENDPOINT).replace(/\/$/, '');
  const timeoutMs = config.parameters.timeout || DEFAULT_TIMEOUT;

  const openAITools = toOpenAITools(tools);
  
  console.log(`[Grok+Tools] Streaming with ${openAITools.length} tools`);

  const requestBody: Record<string, unknown> = {
    model: config.model || 'grok-3',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: true,
    tools: openAITools,
  };

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
    throw new Error(`Grok Error (${response.status}): ${errorMessage}`);
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

          if (choice?.finish_reason) {
            accumulator.finishReason = choice.finish_reason;
          }

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
    finalizeToolCalls(accumulator);
  }

  console.log(`[Grok+Tools] Stream complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
}

export async function callGrok(
  messages: ChatApiMessage[],
  config: LLMConfig,
): Promise<GenerateResponse> {
  const endpoint = (config.endpoint || GROK_DEFAULT_ENDPOINT).replace(/\/$/, '');
  const timeoutMs = DEFAULT_TIMEOUT;

  const requestBody: Record<string, unknown> = {
    model: config.model || 'grok-3',
    messages: messages,
    max_tokens: config.parameters.maxTokens,
    temperature: config.parameters.temperature,
    top_p: config.parameters.topP,
    stream: false,
  };

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
    throw new Error(`Grok Error (${response.status}): ${errorMessage}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    content,
    finishReason: data.choices?.[0]?.finish_reason || 'stop',
  };
}
