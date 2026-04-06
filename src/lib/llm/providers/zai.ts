// ============================================
// Z.ai Provider - Streaming and generation
// ============================================
//
// This provider reads the .z-ai-config file and uses the token for authentication.
// The config file is located at:
// 1. process.cwd()/.z-ai-config
// 2. ~/.z-ai-config
// 3. /etc/.z-ai-config
//
// Supports native tool calling (OpenAI-compatible format).

import type { ChatApiMessage, GenerateResponse } from '../types';
import type { ToolDefinition } from '@/lib/tools/types';
import type { ToolCallAccumulator } from '@/lib/tools/parsers/native-parser';
import { processOpenAIDelta, finalizeToolCalls } from '@/lib/tools/parsers/native-parser';
import { toOpenAITools } from '@/lib/tools';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Config interface matching the SDK
interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;  // JWT token for X-Token header
}

// Cache for config
let cachedConfig: ZAIConfig | null = null;

/**
 * Load Z.ai configuration from file
 */
export async function loadConfig(): Promise<ZAIConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const homeDir = os.homedir();
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(homeDir, '.z-ai-config'),
    '/etc/.z-ai-config'
  ];

  for (const filePath of configPaths) {
    try {
      const configStr = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        cachedConfig = config;
        console.log('[Z.ai Provider] Config loaded from:', filePath);
        return config;
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[Z.ai Provider] Error reading config at ${filePath}:`, error);
      }
    }
  }

  throw new Error('Z.ai configuration file not found. Please create .z-ai-config in your project, home directory, or /etc.');
}

/**
 * Try a Z.ai API request with multiple token candidates.
 * Returns the first successful response, or throws the last error.
 */
async function fetchWithTokenFallback(
  url: string,
  body: string,
  tokenCandidates: string[],
  config: ZAIConfig,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < tokenCandidates.length; i++) {
    const token = tokenCandidates[i];
    const source = `candidate ${i + 1}/${tokenCandidates.length} (${token.length} chars)`;
    console.log(`[Z.ai Provider] Trying ${source}...`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Z-AI-From': 'Z',
      'X-Token': token,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(300000),
      });

      if (response.status === 401) {
        const errorBody = await response.text();
        console.warn(`[Z.ai Provider] Token ${source} failed: 401 ${errorBody}`);
        lastError = new Error(`401: ${errorBody}`);
        continue; // Try next candidate
      }

      // Any other status (including errors) — return as-is
      console.log(`[Z.ai Provider] Token ${source} succeeded: ${response.status}`);
      return response;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      console.warn(`[Z.ai Provider] Token ${source} threw: ${msg}`);
      lastError = error instanceof Error ? error : new Error(msg);
      continue;
    }
  }

  throw lastError || new Error('All token candidates failed');
}

/**
 * Build a list of token candidates to try, in priority order.
 * Returns empty array if no candidates available (will use basic auth).
 */
export function buildTokenCandidates(
  gatewayToken?: string,
  config?: ZAIConfig,
): string[] {
  const candidates: string[] = [];
  if (gatewayToken) candidates.push(gatewayToken);
  if (config?.token) candidates.push(config.token);
  return candidates;
}

/**
 * Stream from Z.ai API with proper authentication (no tools)
 * @param messages - Chat messages to send
 * @param gatewayToken - Token forwarded from Z.ai gateway (x-session-id, fc-security-token, etc.)
 */
export async function* streamZAI(
  messages: ChatApiMessage[],
  gatewayToken?: string
): AsyncGenerator<string> {
  try {
    const config = await loadConfig();
    const url = `${config.baseUrl}/chat/completions`;

    const body = JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      thinking: { type: 'disabled' },
      stream: true
    });

    // Build token candidates: gateway token first, then file config token
    const candidates = buildTokenCandidates(gatewayToken, config);

    let response: Response;
    if (candidates.length > 0) {
      // Use token fallback system
      response = await fetchWithTokenFallback(url, body, candidates, config);
    } else {
      // No tokens available — try basic auth
      console.log('[Z.ai Provider] No token candidates, using basic auth');
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Z-AI-From': 'Z',
        },
        body,
        signal: AbortSignal.timeout(300000),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401 && errorBody.includes('X-Token')) {
        throw new Error(`Z.ai requiere autenticación X-Token. El gateway no proporcionó un token válido.`);
      }
      throw new Error(`Z.ai API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body from Z.ai');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const sseMessages = buffer.split('\n\n');
        buffer = sseMessages.pop() || '';

        for (const message of sseMessages) {
          if (!message.startsWith('data: ')) continue;

          const jsonStr = message.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const choices = data.choices as Array<Record<string, unknown>> | undefined;
            const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
            const content = delta?.content as string | undefined;

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
  } catch (error) {
    console.error('[Z.ai Provider] Stream error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stream from Z.ai API WITH native tool calling support.
 *
 * Uses OpenAI-compatible tool calling format. Tool calls are accumulated
 * in the provided ToolCallAccumulator. After the generator completes,
 * check `accumulator.toolCalls` and `accumulator.finishReason`.
 *
 * @param messages - Chat messages to send
 * @param tools - Tool definitions to provide to the model
 * @param accumulator - Mutable accumulator for tool call state
 * @param gatewayToken - Token forwarded from Z.ai gateway
 */
export async function* streamZAIWithTools(
  messages: ChatApiMessage[],
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
  gatewayToken?: string
): AsyncGenerator<string> {
  try {
    const config = await loadConfig();
    const url = `${config.baseUrl}/chat/completions`;

    const openAITools = toOpenAITools(tools);

    console.log(`[Z.ai+Tools] Streaming with ${openAITools.length} tools`);

    const body = JSON.stringify({
      messages: messages,
      thinking: { type: 'disabled' },
      stream: true,
      tools: openAITools,
    });

    // Build token candidates and use fallback system
    const candidates = buildTokenCandidates(gatewayToken, config);

    let response: Response;
    if (candidates.length > 0) {
      response = await fetchWithTokenFallback(url, body, candidates, config);
    } else {
      console.log('[Z.ai+Tools] No token candidates, using basic auth');
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Z-AI-From': 'Z',
        },
        body,
        signal: AbortSignal.timeout(300000),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401 && errorBody.includes('X-Token')) {
        throw new Error(`Z.ai requiere autenticación X-Token. El gateway no proporcionó un token válido.`);
      }
      throw new Error(`Z.ai API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Z.ai');

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

            // Process delta for both text and tool calls (OpenAI format)
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

    console.log(`[Z.ai+Tools] Stream complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
  } catch (error) {
    console.error('[Z.ai+Tools] Stream error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Call Z.ai API (non-streaming)
 * @param messages - Chat messages to send
 * @param gatewayToken - Token forwarded from Z.ai gateway
 */
export async function callZAI(
  messages: ChatApiMessage[],
  gatewayToken?: string
): Promise<GenerateResponse> {
  try {
    const config = await loadConfig();
    const url = `${config.baseUrl}/chat/completions`;

    const body = JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      thinking: { type: 'disabled' },
      stream: false
    });

    const candidates = buildTokenCandidates(gatewayToken, config);

    let response: Response;
    if (candidates.length > 0) {
      response = await fetchWithTokenFallback(url, body, candidates, config);
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Z-AI-From': 'Z',
        },
        body,
        signal: AbortSignal.timeout(300000),
      });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Z.ai API error ${response.status}: ${errorBody}`);
    }

    const completion = await response.json();
    const content = completion.choices[0]?.message?.content || '';

    return {
      message: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model: completion.model || 'z-ai'
    };
  } catch (error) {
    console.error('[Z.ai Provider] Call error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
