// ============================================
// LLM Streaming - Unified streaming functions
// ============================================

import type { LLMConfig, ChatApiMessage } from './types';
import { 
  streamZAI, 
  streamOpenAICompatible, 
  streamAnthropic, 
  streamOllama, 
  streamTextGenerationWebUI 
} from './providers';
import { buildCompletionPrompt } from './prompt-builder';

// ============================================
// Streaming Generator Factory
// ============================================

/**
 * Get the appropriate streaming generator based on provider
 */
export async function* getStreamGenerator(
  provider: string,
  chatMessages: ChatApiMessage[],
  config: LLMConfig,
  characterName: string
): AsyncGenerator<string> {
  switch (provider) {
    case 'z-ai': {
      yield* streamZAI(chatMessages);
      break;
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
      yield* streamOpenAICompatible(openaiMessages, config, provider);
      break;
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
      yield* streamAnthropic(anthropicMessages, config);
      break;
    }

    case 'ollama': {
      // Ollama uses completion-style prompts
      const prompt = buildOllamaPrompt(chatMessages, characterName);
      yield* streamOllama(prompt, config);
      break;
    }

    case 'text-generation-webui':
    case 'koboldcpp':
    default: {
      // Text Generation WebUI uses completion-style prompts
      const prompt = buildCompletionPromptFromMessages(chatMessages, characterName);
      yield* streamTextGenerationWebUI(prompt, config);
      break;
    }
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build prompt for Ollama from chat messages
 */
function buildOllamaPrompt(messages: ChatApiMessage[], characterName: string): string {
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

/**
 * Build prompt for Text Generation WebUI from chat messages
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

// ============================================
// Re-export provider functions
// ============================================

export {
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI
};
