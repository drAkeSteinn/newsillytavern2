// ============================================
// Chat Interrupt Route - Character reaction to interruption
// ============================================
//
// When a user interrupts the LLM generation, instead of just
// cutting off, the character generates a brief in-character
// reaction. This makes the interaction feel more natural.

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig } from '@/types';
import {
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
} from '@/lib/llm';
import {
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamGrok,
  streamTextGenerationWebUI,
} from '@/lib/llm';

// System prompt for interrupt reaction
const INTERRUPT_REACTION_SYSTEM = `Eres un personaje de rol que acaba de ser interrumpido mientras hablaba. Genera una breve reacción natural en personaje a la interrupción.

Reglas:
- La reacción debe ser CORTA (1-2 frases máximo, o una acción breve entre asteriscos)
- Debe ser coherente con la personalidad del personaje
- Puede ser: sorpresa, molestia, confusión, curiosidad, o una acción como *se detiene*, *parpadea*, *suspira*
- NO expliques qué estabas diciendo, solo reacciona al corte
- Mantente 100% en personaje
- Responde SOLO con la reacción, sin contexto adicional`;

/**
 * POST /api/chat/interrupt
 *
 * Generates a brief character reaction when the user interrupts
 * the LLM generation mid-stream.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      character,
      partialContent = '',
      llmConfig,
      userName = 'User',
      messages = [],
    } = body;

    if (!character?.name || !llmConfig?.provider) {
      return createErrorResponse('Missing required fields: character, llmConfig', 400);
    }

    // Build a minimal prompt for the reaction
    const charName = character.name;
    
    // Take last few messages for context
    const recentMessages = messages
      .filter((m: ChatMessage) => !m.isDeleted && m.content?.trim())
      .slice(-6);
    
    const chatContext = recentMessages
      .map((m: ChatMessage) => {
        const speaker = m.role === 'user' ? userName : charName;
        return `${speaker}: ${m.content.trim().slice(0, 200)}`;
      })
      .join('\n');

    // Build the interrupt context message
    const interruptMessage = partialContent
      ? `[Sistema: ${charName} estaba diciendo: "${partialContent.slice(-200)}" pero ${userName} lo interrumpió. Reacciona brevemente en personaje.]`
      : `[Sistema: ${userName} interrumpió a ${charName} mientras hablaba. Reacciona brevemente en personaje.]`;

    const systemPrompt = `${INTERRUPT_REACTION_SYSTEM}\n\nPersonaje: ${charName}\nPersonalidad: ${(character.personality || '').slice(0, 300)}`;

    // Build messages array for the LLM
    const llmMessages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      // Include recent context as a condensed message
      ...(chatContext ? [{
        role: 'user' as const,
        content: `[Contexto reciente]\n${chatContext}`,
      }] : []),
      {
        role: 'user' as const,
        content: interruptMessage,
      },
    ];

    // Configure LLM for brief reaction (low temperature, short max tokens)
    const reactionLLMConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: Math.min(llmConfig.parameters?.temperature ?? 0.7, 0.8),
        max_tokens: 80, // Very short response
      },
    };

    // Stream the reaction
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let generator: AsyncGenerator<string>;

          switch (reactionLLMConfig.provider) {
            case 'z-ai':
              generator = streamZAI(llmMessages);
              break;
            case 'anthropic':
              generator = streamAnthropic(llmMessages, reactionLLMConfig);
              break;
            case 'ollama': {
              const ollamaPrompt = llmMessages.map(m => `${m.role === 'system' ? 'System' : m.role === 'assistant' ? charName : 'User'}: ${m.content}`).join('\n\n') + `\n\n${charName}:`;
              generator = streamOllama(ollamaPrompt, reactionLLMConfig);
              break;
            }
            case 'grok':
              generator = streamGrok(llmMessages, reactionLLMConfig);
              break;
            case 'text-generation-webui':
            case 'koboldcpp': {
              const tgPrompt = llmMessages.map(m => `${m.role === 'system' ? 'System' : m.role === 'assistant' ? charName : 'User'}: ${m.content}`).join('\n\n') + `\n\n${charName}:`;
              generator = streamTextGenerationWebUI(tgPrompt, reactionLLMConfig);
              break;
            }
            default:
              // OpenAI-compatible (openai, vllm, lm-studio, custom)
              generator = streamOpenAICompatible(llmMessages, reactionLLMConfig, reactionLLMConfig.provider);
              break;
          }

          let reactionContent = '';

          for await (const chunk of generator) {
            reactionContent += chunk;
            controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));

            // Safety: limit reaction to ~150 characters
            if (reactionContent.length > 150) break;
          }

          // Clean up the reaction
          let cleaned = reactionContent.trim();
          // Remove character name prefix if present
          const namePrefix = `${charName}:`;
          if (cleaned.startsWith(namePrefix)) {
            cleaned = cleaned.slice(namePrefix.length).trim();
          }

          controller.enqueue(createSSEJSON({
            type: 'done',
            content: cleaned,
            characterId: character.id,
            characterName: charName,
          }));

          controller.close();
        } catch (error: any) {
          controller.enqueue(createSSEJSON({
            type: 'error',
            error: error?.message || 'Error generating interrupt reaction',
          }));
          controller.close();
        }
      },
    });

    return createSSEStreamResponse(stream);
  } catch (error: any) {
    console.error('[Interrupt] Error:', error?.message);
    return createErrorResponse(error?.message || 'Internal server error', 500);
  }
}
