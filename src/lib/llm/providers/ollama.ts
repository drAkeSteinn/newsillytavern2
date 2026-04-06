// ============================================
// Ollama Provider - Streaming and generation
// ============================================

import type { LLMConfig, GenerateResponse } from '../types';
import type { ChatApiMessage } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { ToolCallAccumulator } from '@/lib/tools/parsers/native-parser';
import { processOllamaToolDelta } from '@/lib/tools/parsers/native-parser';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Stream from Ollama API using /api/generate (completion-style, no tools)
 */
export async function* streamOllama(
  prompt: string,
  config: LLMConfig
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');

  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt: prompt,
      stream: true,
      options: {
        temperature: config.parameters.temperature,
        top_p: config.parameters.topP,
        top_k: config.parameters.topK,
        num_predict: config.parameters.maxTokens,
        stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined
      }
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            yield parsed.response;
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
 * Stream from Ollama API using /api/chat WITH native tool calling support.
 *
 * Ollama's /api/chat endpoint supports tools natively.
 * It uses messages format (not completion-style prompt).
 *
 * Yields text chunks for real-time display. Tool calls are accumulated
 * in the provided ToolCallAccumulator.
 */
export async function* streamOllamaWithTools(
  messages: ChatApiMessage[],
  config: LLMConfig,
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
): AsyncGenerator<string> {
  const endpoint = config.endpoint.replace(/\/$/, '');

  // Convert our ChatApiMessage[] to Ollama's messages format
  // Ollama expects: [{ role: 'system'|'user'|'assistant', content: string }]
  const ollamaMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Convert tools to Ollama format (same structure as OpenAI)
  // IMPORTANT: Strip per-property 'required: boolean' — Ollama only accepts 'required: string[]' at schema level
  const ollamaTools = tools.map(t => ({
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

  console.log(`[Ollama+Tools] Streaming with ${ollamaTools.length} tools via /api/chat`);

  const requestBody: Record<string, unknown> = {
    model: config.model || 'llama2',
    messages: ollamaMessages,
    stream: true,
    options: {
      temperature: config.parameters.temperature,
      top_p: config.parameters.topP,
      top_k: config.parameters.topK,
      num_predict: config.parameters.maxTokens,
    },
  };

  // Only include tools if there are any (follow-up rounds don't need tools)
  if (ollamaTools.length > 0) {
    requestBody.tools = ollamaTools;
  }

  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama Error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const message = parsed.message || {};

          // Process for tool calls
          const textContent = processOllamaToolDelta(message, accumulator);
          if (textContent) {
            yield textContent;
          }

          // Check if done and if there were tool calls
          if (parsed.done) {
            // Ollama sends "done_reason": "tool_calls" or "stop"
            if (parsed.done_reason === 'tool_calls' || parsed.done_reason === 'tool use') {
              accumulator.finishReason = 'tool_calls';
            } else {
              accumulator.finishReason = parsed.done_reason || 'stop';
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`[Ollama+Tools] Stream complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
}

/**
 * Call Ollama API (non-streaming)
 */
export async function callOllama(
  prompt: string,
  config: LLMConfig
): Promise<GenerateResponse> {
  const endpoint = config.endpoint.replace(/\/$/, '');

  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama2',
      prompt: prompt,
      stream: false,
      options: {
        temperature: config.parameters.temperature,
        top_p: config.parameters.topP,
        top_k: config.parameters.topK,
        num_predict: config.parameters.maxTokens,
        stop: config.parameters.stopStrings?.length ? config.parameters.stopStrings : undefined
      }
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    message: data.response || '',
    usage: {
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
    },
    model: data.model || config.model
  };
}
