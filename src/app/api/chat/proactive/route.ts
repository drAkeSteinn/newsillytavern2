import { NextRequest, NextResponse } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona } from '@/types';
import {
  buildSystemPrompt,
  buildChatMessages,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamGrok,
  streamTextGenerationWebUI,
  resolveAllKeys,
  buildKeyResolutionContext,
  resolveStats,
  buildLorebookSectionForPrompt,
} from '@/lib/llm';
import {
  selectContextMessages,
} from '@/lib/context-manager';
import type { Lorebook, SoundTrigger, AppSettings } from '@/types';
import { DEFAULT_QUEST_SETTINGS } from '@/types';

/**
 * POST /api/chat/proactive
 *
 * Generates a proactive message for a character.
 * This is a non-streaming endpoint that returns a complete message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      lorebooks = [],
      sessionStats,
      soundTriggers = [],
      soundSettings,
      proactiveConfig,
      reason = 'timer_idle',
      lastActivityAt,
    } = body;

    // Validate required fields
    if (!character?.name || !llmConfig?.provider) {
      return NextResponse.json(
        { error: 'Missing required fields: character, llmConfig' },
        { status: 400 }
      );
    }

    if (!proactiveConfig?.enabled) {
      return NextResponse.json(
        { error: 'Proactive messages are disabled for this character' },
        { status: 400 }
      );
    }

    console.log(`[Proactive] Generating proactive message for "${character.name}" (reason: ${reason})`);

    // Capture auth headers
    const incomingXToken = request.headers.get('X-Token');
    const fcSecurityToken = request.headers.get('x-fc-security-token');

    // Build lorebook plan
    let lorebookPlan = null;
    let lorebookAttributeKeys: Record<string, string> = {};
    try {
      if (lorebooks.length > 0) {
        const result = buildLorebookSectionForPrompt(
          messages,
          lorebooks,
          { scanDepth: 10 },
          { sessionStats, characterId: character.id, characters: [character] }
        );
        lorebookPlan = result.plan;
        lorebookAttributeKeys = result.lorebookAttributeKeys;
      }
    } catch (e) {
      console.warn('[Proactive] Lorebook processing failed:', e);
    }

    // Build system prompt (reuse existing infrastructure)
    const { prompt: systemPrompt, lorebookChatInjections } = buildSystemPrompt(
      character,
      userName,
      persona,
      lorebookPlan,
      sessionStats,
      [character],
      soundTriggers,
      soundSettings,
      [],
      [],
      DEFAULT_QUEST_SETTINGS,
      lorebookAttributeKeys
    );

    // Build proactive instruction and append to system prompt
    const defaultInstruction = `Estás enviando un mensaje a ${userName} sin que haya hablado primero. La conversación ha estado inactiva por un tiempo. Reacciona de forma natural a la situación. Puedes:
- Comentar algo que está ocurriendo a tu alrededor
- Expresar un pensamiento o sentimiento
- Iniciar un nuevo tema de conversación
- Preguntar algo a ${userName}
- Reaccionar al silencio o al paso del tiempo
- Realizar una acción disponible si encaja naturalmente en la escena (ej. *se acerca*, *mira alrededor*, *suspira*)

Mantén tu mensaje breve y natural (1-3 párrafos máximo). NO menciones que estás siendo proactivo o que ${userName} no ha hablado. Mantente en personaje en todo momento.`;
    const proactiveInstruction = proactiveConfig.customPrompt?.trim() || defaultInstruction;

    const finalSystemPrompt = `${systemPrompt}\n\n[Proactive Message Instruction]\n${proactiveInstruction}`;

    // Select recent messages for context
    const recentMessages = selectContextMessages(
      messages,
      llmConfig,
      { maxMessages: 20, keepFirstN: 2, keepLastN: 10 } as any
    );

    // Build chat messages
    const chatMessages = buildChatMessages(
      finalSystemPrompt,
      recentMessages,
      character,
      userName,
      character.postHistoryInstructions?.trim(),
      undefined,
      true,
      undefined,
      lorebookChatInjections
    );

    // Add a user message to prompt the character to speak
    // This acts as a "nudge" without appearing in the actual chat
    const nudgeMessage = {
      role: 'user' as const,
      content: `[La escena continúa en silencio. ${character.name} decide hablar o actuar por su cuenta.]`,
    };
    chatMessages.push(nudgeMessage);

    // Generate response (non-streaming, collect all tokens)
    let responseContent = '';

    const generator = createGenerator(llmConfig, chatMessages, incomingXToken, fcSecurityToken);

    for await (const chunk of generator) {
      responseContent += chunk;
      // Safety: limit response length
      if (responseContent.length > 2000) {
        responseContent = responseContent.slice(0, 2000);
        break;
      }
    }

    // Clean up response
    let cleanedMessage = responseContent.trim();
    const namePrefix = `${character.name}:`;
    if (cleanedMessage.startsWith(namePrefix)) {
      cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
    }

    // Remove any meta-commentary about being proactive
    cleanedMessage = cleanedMessage
      .replace(/\*proactive\*|\[proactive\]|\[mensaje proactivo\]/gi, '')
      .replace(/I (decided to|wanted to|chose to) (reach out|say something|speak)/gi, '')
      .replace(/(Decidí|Quise|Elegí) (escribir|decir algo|hablar|alcanzar)/gi, '')
      .trim();

    if (!cleanedMessage) {
      return NextResponse.json({
        success: false,
        error: 'Empty response generated',
        message: '',
      });
    }

    console.log(`[Proactive] Generated ${cleanedMessage.length} chars for "${character.name}"`);

    return NextResponse.json({
      success: true,
      message: cleanedMessage,
      characterId: character.id,
      characterName: character.name,
      reason,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Proactive] Error generating proactive message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate proactive message' },
      { status: 500 }
    );
  }
}

/**
 * Creates the appropriate async generator based on LLM provider
 */
function createGenerator(
  llmConfig: LLMConfig,
  messages: any[],
  xToken?: string | null,
  fcToken?: string | null
): AsyncGenerator<string> {
  const params = llmConfig.parameters || {};

  switch (llmConfig.provider) {
    case 'test-mock': {
      // Test mode: Simulate proactive message response
      console.log('[Proactive] Using TEST-MOCK provider');
      const mockResponse = llmConfig.mockResponse || `*Suspira pensativamente* ¿Sabes? Se me ocurre que podríamos hacer algo interesante... [peticion_test]`;
      return (async function* mockGenerator() {
        const words = mockResponse.split(/(\s+)/);
        for (const word of words) {
          yield word;
          await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
        }
      })();
    }

    case 'z-ai':
      return streamZAI(messages, {
        model: llmConfig.model,
        temperature: params.temperature ?? 0.9,
        maxTokens: Math.min(params.maxTokens ?? 300, 500),
        xToken: xToken || undefined,
        fcToken: fcToken || undefined,
      });

    case 'openai':
    case 'lm-studio':
    case 'vllm':
      return streamOpenAICompatible(
        { endpoint: llmConfig.endpoint, apiKey: llmConfig.apiKey },
        messages,
        {
          model: llmConfig.model,
          temperature: params.temperature ?? 0.9,
          maxTokens: Math.min(params.maxTokens ?? 300, 500),
        }
      );

    case 'anthropic':
      return streamAnthropic(
        { endpoint: llmConfig.endpoint, apiKey: llmConfig.apiKey },
        messages,
        {
          model: llmConfig.model,
          temperature: params.temperature ?? 0.9,
          maxTokens: Math.min(params.maxTokens ?? 300, 500),
        }
      );

    case 'ollama':
      return streamOllama(
        { endpoint: llmConfig.endpoint },
        messages,
        {
          model: llmConfig.model,
          temperature: params.temperature ?? 0.9,
        }
      );

    case 'koboldcpp':
      return streamTextGenerationWebUI(
        { endpoint: llmConfig.endpoint },
        messages,
        {
          temperature: params.temperature ?? 0.9,
          maxTokens: Math.min(params.maxTokens ?? 300, 500),
        }
      );

    case 'grok':
      return streamGrok(
        { endpoint: llmConfig.endpoint, apiKey: llmConfig.apiKey },
        messages,
        {
          model: llmConfig.model,
          temperature: params.temperature ?? 0.9,
          maxTokens: Math.min(params.maxTokens ?? 300, 500),
        }
      );

    default:
      throw new Error(`Unsupported provider for proactive messages: ${llmConfig.provider}`);
  }
}
