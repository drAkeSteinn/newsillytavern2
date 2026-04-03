// ============================================
// Chat Generate Route - Refactored with shared modules
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import type { CharacterCard, Lorebook, SessionStats, HUDContextConfig } from '@/types';
import {
  DEFAULT_CHARACTER,
  buildSystemPrompt,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  processCharacter,
  createUserMessage,
  callZAI,
  callOpenAICompatible,
  callAnthropic,
  callOllama,
  callTextGenerationWebUI,
  GenerateResponse,
  buildLorebookSectionForPrompt,
  buildHUDContextSection,
  injectHUDContextIntoMessages
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  type ContextConfig
} from '@/lib/context-manager';
import { retrieveEmbeddingsContext } from '@/lib/embeddings/chat-context';
import type { EmbeddingsChatSettings } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request (automatically detects request type)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const {
      message,
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      sessionStats
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    // Extract all characters for peticiones/solicitudes resolution
    const allCharacters: CharacterCard[] = body.allCharacters || [];

    // Extract HUD context from body
    const hudContext: HUDContextConfig | undefined = body.hudContext;

    // Extract embeddings chat settings
    const embeddingsChat: Partial<EmbeddingsChatSettings> = body.embeddingsChat || {};
    const sessionId: string | undefined = body.sessionId;
    const characterId: string | undefined = body.characterId;

    // Cast sessionStats to proper type
    const typedSessionStats = sessionStats as SessionStats | undefined;

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'No LLM configuration provided. Please configure an LLM connection in settings.' },
        { status: 400 }
      );
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message);

    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || DEFAULT_CHARACTER;

    // Get effective user name from persona or use provided userName
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Process character template variables ({{user}}, {{char}}, etc.)
    const processedCharacter = processCharacter(effectiveCharacter, effectiveUserName, persona, typedSessionStats, allCharacters);

    // Build context configuration from request or use defaults
    const contextConfig: Partial<ContextConfig> = body.contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messages, llmConfig, contextConfig);

    // Process lorebooks and get matched entries
    const { section: lorebookSection } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: contextConfig.scanDepth,
        tokenBudget: 2048
      }
    );

    // Build system prompt with persona and lorebook (using processed character)
    const { prompt: systemPrompt } = buildSystemPrompt(
      processedCharacter,
      effectiveUserName,
      persona,
      lorebookSection,
      typedSessionStats,  // Pass session stats for attribute values
      allCharacters       // Pass all characters for peticiones/solicitudes resolution
    );

    // Retrieve embeddings context
    const embeddingsResult = await retrieveEmbeddingsContext(
      sanitizedMessage,
      characterId || effectiveCharacter.id,
      sessionId,
      embeddingsChat
    );

    // Memory embeddings: inject before chat history
    const memoryContextString = embeddingsResult.memoryContextString?.trim()
      ? `[${embeddingsResult.memorySection?.label || 'MEMORIA DEL PERSONAJE'}]\n${embeddingsResult.memoryContextString}`
      : undefined;

    // Build final system prompt: non-memory embeddings go in system prompt, memory goes separately
    let finalSystemPrompt = systemPrompt;
    if (embeddingsResult.nonMemoryContextString?.trim()) {
      finalSystemPrompt += `\n\n[${embeddingsResult.nonMemorySection?.label || 'CONTEXTO'}]\n${embeddingsResult.nonMemoryContextString}`;
    }

    // Build HUD context section if enabled
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext) : null;

    // Prepare messages with new user message (use context-windowed messages)
    const allMessages = [...contextWindow.messages, createUserMessage(sanitizedMessage)];

    let response: GenerateResponse;

    // Route to appropriate provider
    switch (llmConfig.provider) {
      case 'z-ai': {
        // Z.ai uses its own SDK
        let chatMessages = buildChatMessages(
          finalSystemPrompt,
          allMessages,
          processedCharacter,
          effectiveUserName,
          processedCharacter.postHistoryInstructions,
          undefined,  // authorNote
          false,     // useSystemRole
          memoryContextString  // Memory embeddings before chat history
        );
        // Inject HUD context into chat messages if enabled
        if (hudContextSection && hudContext) {
          chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
        }
        response = await callZAI(chatMessages, llmConfig.apiKey);
        break;
      }

      case 'openai':
      case 'vllm':
      case 'custom': {
        // These need a valid endpoint
        if (!llmConfig.endpoint) {
          throw new Error(`${llmConfig.provider} requires an endpoint URL. Please configure it in settings.`);
        }
        let chatMessages = buildChatMessages(
          finalSystemPrompt,
          allMessages,
          processedCharacter,
          effectiveUserName,
          processedCharacter.postHistoryInstructions,
          undefined,  // authorNote
          true,      // useSystemRole
          memoryContextString  // Memory embeddings before chat history
        );
        // Inject HUD context into chat messages if enabled
        if (hudContextSection && hudContext) {
          chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
        }
        response = await callOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
        break;
      }

      case 'anthropic': {
        if (!llmConfig.apiKey) {
          throw new Error('Anthropic requires an API key. Please configure it in settings.');
        }
        let chatMessages = buildChatMessages(
          finalSystemPrompt,
          allMessages,
          processedCharacter,
          effectiveUserName,
          processedCharacter.postHistoryInstructions,
          undefined,  // authorNote
          true,      // useSystemRole
          memoryContextString  // Memory embeddings before chat history
        );
        // Inject HUD context into chat messages if enabled
        if (hudContextSection && hudContext) {
          chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
        }
        response = await callAnthropic(chatMessages, llmConfig);
        break;
      }

      case 'ollama': {
        const prompt = buildCompletionPrompt({
          systemPrompt: finalSystemPrompt,
          messages: allMessages,
          character: processedCharacter,
          userName: effectiveUserName,
          postHistoryInstructions: processedCharacter.postHistoryInstructions,
          embeddingsContext: memoryContextString  // Memory embeddings before chat history
        });
        response = await callOllama(prompt, llmConfig);
        break;
      }

      case 'text-generation-webui':
      case 'koboldcpp':
      default: {
        const prompt = buildCompletionPrompt({
          systemPrompt: finalSystemPrompt,
          messages: allMessages,
          character: processedCharacter,
          userName: effectiveUserName,
          postHistoryInstructions: processedCharacter.postHistoryInstructions,
          embeddingsContext: memoryContextString  // Memory embeddings before chat history
        });
        response = await callTextGenerationWebUI(prompt, llmConfig);
        break;
      }
    }

    // Clean up response
    let cleanedMessage = response.message.trim();

    // Remove character name prefix if present
    const namePrefix = `${processedCharacter.name}:`;
    if (cleanedMessage.startsWith(namePrefix)) {
      cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
    }

    return NextResponse.json({
      message: cleanedMessage,
      usage: response.usage,
      model: response.model
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate response';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
