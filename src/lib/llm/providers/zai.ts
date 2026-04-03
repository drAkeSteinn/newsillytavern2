// ============================================
// Z.ai Provider - Streaming and generation
// ============================================
//
// This provider reads the .z-ai-config file and uses the token for authentication.
// The config file is located at:
// 1. process.cwd()/.z-ai-config
// 2. ~/.z-ai-config
// 3. /etc/.z-ai-config

import type { ChatApiMessage, GenerateResponse } from '../types';
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
async function loadConfig(): Promise<ZAIConfig> {
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
 * Stream from Z.ai API with proper authentication
 * @param messages - Chat messages to send
 * @param overrideToken - Optional token from LLM config to override file config
 */
export async function* streamZAI(
  messages: ChatApiMessage[],
  overrideToken?: string
): AsyncGenerator<string> {
  try {
    const config = await loadConfig();
    // Use override token from LLM config if provided, otherwise use file config token
    const effectiveToken = overrideToken || config.token;
    const { baseUrl, apiKey, chatId, userId } = config;

    const url = `${baseUrl}/chat/completions`;

    // Build headers with X-Token if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Z-AI-From': 'Z',
    };

    // Add X-Token header (JWT token - either from LLM config or file config)
    if (effectiveToken) {
      headers['X-Token'] = effectiveToken;
      console.log('[Z.ai Provider] Using X-Token header (JWT token)');
    }

    if (chatId) {
      headers['X-Chat-Id'] = chatId;
    }

    if (userId) {
      headers['X-User-Id'] = userId;
    }

    console.log('[Z.ai Provider] Streaming request to:', url);
    console.log('[Z.ai Provider] Headers:', Object.keys(headers).join(', '));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        thinking: { type: 'disabled' },
        stream: true
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Z.ai API error ${response.status}: ${errorBody}`);
    }

    // The API returns a ReadableStream for streaming responses
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

        // Split by double newline (SSE message separator)
        const sseMessages = buffer.split('\n\n');
        buffer = sseMessages.pop() || '';

        for (const message of sseMessages) {
          // Each message is in format "data: {...}"
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
 * Call Z.ai API (non-streaming)
 * @param messages - Chat messages to send
 * @param overrideToken - Optional token from LLM config to override file config
 */
export async function callZAI(
  messages: ChatApiMessage[],
  overrideToken?: string
): Promise<GenerateResponse> {
  try {
    const config = await loadConfig();
    // Use override token from LLM config if provided, otherwise use file config token
    const effectiveToken = overrideToken || config.token;
    const { baseUrl, apiKey, chatId, userId } = config;

    const url = `${baseUrl}/chat/completions`;

    // Build headers with X-Token if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Z-AI-From': 'Z',
    };

    // Add X-Token header (JWT token - either from LLM config or file config)
    if (effectiveToken) {
      headers['X-Token'] = effectiveToken;
    }

    if (chatId) {
      headers['X-Chat-Id'] = chatId;
    }

    if (userId) {
      headers['X-User-Id'] = userId;
    }

    console.log('[Z.ai Provider] Non-streaming request to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        thinking: { type: 'disabled' },
        stream: false
      })
    });

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
