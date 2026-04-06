// ============================================
// Z.ai Provider - Uses z-ai-web-dev-sdk v0.0.17+
// ============================================
//
// This provider uses the official Z.ai SDK for all API calls.
// The SDK reads config from .z-ai-config files and handles authentication.
//
// Token resolution priority:
// 1. Token passed from caller (gateway forwarding)
// 2. Token from .z-ai-config file ("token" field)
// 3. Fallback: no token (works if API doesn't require X-Token)
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

// ============================================
// Config Loading
// ============================================

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string; // JWT token for X-Token header
}

let cachedConfig: ZAIConfig | null = null;

/**
 * Load Z.ai configuration from file (same paths as SDK)
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
        console.log(`[Z.ai Provider] Config loaded from: ${filePath}`);
        console.log(`[Z.ai Provider] baseUrl=${config.baseUrl}, hasToken=${!!config.token}`);
        return config;
      }
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[Z.ai Provider] Error reading config at ${filePath}:`, error);
      }
    }
  }

  throw new Error('Z.ai: No se encontró archivo de configuración. Cree .z-ai-config en el proyecto, home, o /etc.');
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

// ============================================
// SDK Integration
// ============================================

/**
 * Build headers matching the SDK v0.0.17+ format.
 * This replicates exactly what the SDK does for authentication.
 */
function buildHeaders(config: ZAIConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    'X-Z-AI-From': 'Z',
  };
  if (config.chatId) {
    headers['X-Chat-Id'] = config.chatId;
  }
  if (config.userId) {
    headers['X-User-Id'] = config.userId;
  }
  if (config.token) {
    headers['X-Token'] = config.token;
  }
  return headers;
}

/**
 * Create a resolved config merging file config with runtime overrides.
 * Priority: runtimeToken > config.token
 */
async function resolveConfig(runtimeToken?: string): Promise<ZAIConfig> {
  const config = await loadConfig();

  // If a runtime token is provided (from gateway forwarding), use it
  if (runtimeToken) {
    return { ...config, token: runtimeToken };
  }

  return config;
}

/**
 * Format a user-friendly error for 401 responses.
 */
function formatAuthError(status: number, errorBody: string): Error {
  if (status === 401) {
    if (errorBody.includes('missing X-Token')) {
      return new Error(
        'Z.ai requiere autenticación X-Token.\n\n' +
        'El archivo de configuración no tiene un campo "token".\n' +
        'Para resolver esto, agregue un token JWT válido al archivo /etc/.z-ai-config:\n' +
        '{"baseUrl": "...", "apiKey": "...", "token": "su-jwt-token-aquí"}\n\n' +
        'O configure el campo "API Key" del proveedor Z.ai con su token JWT.'
      );
    }
    if (errorBody.includes('invalid X-Token')) {
      return new Error(
        'Z.ai: El token X-Token proporcionado no es válido.\n\n' +
        'Verifique que el token JWT en la configuración esté actualizado y no haya expirado.'
      );
    }
  }
  return new Error(`Z.ai API error ${status}: ${errorBody}`);
}

// ============================================
// SSE Stream Parser
// ============================================

/**
 * Parse an SSE ReadableStream and yield content strings.
 * Handles the OpenAI-compatible SSE format.
 */
async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onDelta?: (delta: Record<string, unknown>) => string | undefined
): AsyncGenerator<string> {
  const reader = stream.getReader();
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta || {};

          // Use custom delta processor if provided (for tool calling)
          if (onDelta) {
            const textContent = onDelta(delta);
            if (textContent) yield textContent;
          } else {
            // Simple text extraction
            const content = delta.content as string | undefined;
            if (content) yield content;
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================
// Public API: Streaming (no tools)
// ============================================

/**
 * Stream from Z.ai API (no tool calling).
 * Uses the SDK's authentication mechanism.
 *
 * @param messages - Chat messages to send
 * @param runtimeToken - Optional token from gateway/CLI override
 */
export async function* streamZAI(
  messages: ChatApiMessage[],
  runtimeToken?: string
): AsyncGenerator<string> {
  try {
    const config = await resolveConfig(runtimeToken);
    const url = `${config.baseUrl}/chat/completions`;
    const headers = buildHeaders(config);

    console.log(`[Z.ai Provider] Streaming chat (no tools), hasToken=${!!config.token}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        thinking: { type: 'disabled' },
        stream: true,
      }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw formatAuthError(response.status, errorBody);
    }

    const body = response.body;
    if (!body) throw new Error('No response body from Z.ai');

    yield* parseSSEStream(body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Z.ai')) throw error;
    console.error('[Z.ai Provider] Stream error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// ============================================
// Public API: Streaming with Tools
// ============================================

/**
 * Stream from Z.ai API WITH native tool calling support.
 *
 * Uses OpenAI-compatible tool calling format via the SDK.
 * Tool calls are accumulated in the ToolCallAccumulator.
 *
 * @param messages - Chat messages to send
 * @param tools - Tool definitions to provide to the model
 * @param accumulator - Mutable accumulator for tool call state
 * @param runtimeToken - Optional token from gateway/CLI override
 */
export async function* streamZAIWithTools(
  messages: ChatApiMessage[],
  tools: ToolDefinition[],
  accumulator: ToolCallAccumulator,
  runtimeToken?: string
): AsyncGenerator<string> {
  try {
    const config = await resolveConfig(runtimeToken);
    const url = `${config.baseUrl}/chat/completions`;
    const headers = buildHeaders(config);

    const openAITools = toOpenAITools(tools);
    console.log(`[Z.ai+Tools] Streaming with ${openAITools.length} tools, hasToken=${!!config.token}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        thinking: { type: 'disabled' },
        stream: true,
        tools: openAITools,
        tool_choice: 'auto',
      }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw formatAuthError(response.status, errorBody);
    }

    const body = response.body;
    if (!body) throw new Error('No response body from Z.ai');

    yield* parseSSEStream(body, (delta) => {
      // Process delta using native parser (handles tool_calls)
      return processOpenAIDelta(delta, accumulator);
    });

    finalizeToolCalls(accumulator);
    console.log(`[Z.ai+Tools] Complete. finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Z.ai')) throw error;
    console.error('[Z.ai+Tools] Stream error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

// ============================================
// Public API: Non-streaming
// ============================================

/**
 * Call Z.ai API (non-streaming).
 *
 * @param messages - Chat messages to send
 * @param runtimeToken - Optional token from gateway/CLI override
 */
export async function callZAI(
  messages: ChatApiMessage[],
  runtimeToken?: string
): Promise<GenerateResponse> {
  try {
    const config = await resolveConfig(runtimeToken);
    const url = `${config.baseUrl}/chat/completions`;
    const headers = buildHeaders(config);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        thinking: { type: 'disabled' },
        stream: false,
      }),
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw formatAuthError(response.status, errorBody);
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
    if (error instanceof Error && error.message.startsWith('Z.ai')) throw error;
    console.error('[Z.ai Provider] Call error:', error);
    throw new Error(`Z.ai Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
