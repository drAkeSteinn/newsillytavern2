// ============================================
// LLM Generation - Non-streaming generation functions
// ============================================

import type { LLMConfig, ChatApiMessage, GenerateResponse } from './types';
import {
  callZAI,
  callOpenAICompatible,
  callAnthropic,
  callOllama,
  callTextGenerationWebUI
} from './providers';
import { buildCompletionPrompt } from './prompt-builder';

/**
 * Get the appropriate generation function based on provider
 */
export async function generateResponse(
  provider: string,
  chatMessages: ChatApiMessage[],
  config: LLMConfig,
  characterName: string
): Promise<GenerateResponse> {
  switch (provider) {
    case 'test-mock': {
      // Test mode: Return a mock response for testing without a real LLM
      // This is useful for testing summary generation and other non-streaming operations
      console.log('[generateResponse] Using TEST-MOCK provider');
      const mockSummaryResponse = `The conversation covered various topics between ${characterName} and the user. Key points were discussed and decisions were made about future plans.`;
      return {
        content: mockSummaryResponse,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        model: 'test-mock',
      };
    }

    case 'z-ai': {
      return callZAI(chatMessages, config.apiKey);
    }

    case 'openai':
    case 'vllm':
    case 'custom': {
      if (!config.endpoint) {
        throw new Error(`${provider} requires an endpoint URL`);
      }
      // Convert assistant role to system for first message (OpenAI format)
      const openaiMessages = chatMessages.map((m, i) => ({
        role: m.role === 'assistant' && i === 0 ? 'system' : m.role,
        content: m.content
      })) as ChatApiMessage[];
      return callOpenAICompatible(openaiMessages, config, provider);
    }

    case 'anthropic': {
      if (!config.apiKey) {
        throw new Error('Anthropic requires an API key');
      }
      // Convert assistant role to system for first message
      const anthropicMessages = chatMessages.map((m, i) => ({
        role: m.role === 'assistant' && i === 0 ? 'system' : m.role,
        content: m.content
      })) as ChatApiMessage[];
      return callAnthropic(anthropicMessages, config);
    }

    case 'ollama': {
      // Ollama uses completion-style prompts
      const prompt = buildCompletionPromptFromMessages(chatMessages, characterName);
      return callOllama(prompt, config);
    }

    case 'text-generation-webui':
    case 'koboldcpp':
    default: {
      // Text Generation WebUI uses completion-style prompts
      const prompt = buildCompletionPromptFromMessages(chatMessages, characterName);
      return callTextGenerationWebUI(prompt, config);
    }
  }
}

/**
 * Build prompt from chat messages for completion-style APIs
 */
function buildCompletionPromptFromMessages(messages: ChatApiMessage[], characterName: string): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      parts.push(msg.content);
      parts.push('\n---\n');
    } else if (msg.role === 'assistant') {
      // First assistant message is system prompt in our format
      if (messages.indexOf(msg) === 0) {
        parts.push(msg.content);
        parts.push('\n---\n');
      } else {
        parts.push(`${characterName}: ${msg.content}`);
      }
    } else {
      parts.push(`User: ${msg.content}`);
    }
  }

  parts.push(`\n${characterName}:`);

  return parts.join('\n');
}

// Re-export provider functions
export {
  callZAI,
  callOpenAICompatible,
  callAnthropic,
  callOllama,
  callTextGenerationWebUI
};
