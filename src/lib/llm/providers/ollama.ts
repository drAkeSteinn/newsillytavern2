// ============================================
// Ollama Provider - Streaming and generation
// ============================================

import type { LLMConfig, GenerateResponse } from '../types';

// Default timeout: 5 minutes for long group chats
const DEFAULT_TIMEOUT = 300000;

/**
 * Stream from Ollama API
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
