// ============================================
// Chat Regenerate Route - Generate swipe alternative
// ============================================

import { NextRequest } from 'next/server';
import type { CharacterCard, PromptSection, Lorebook, SessionStats, HUDContextConfig, EmbeddingsChatSettings } from '@/types';
import {
  DEFAULT_CHARACTER,
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  cleanResponseContent,
  buildSystemPrompt,
  buildChatHistorySections,
  buildPostHistorySection,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  processCharacter,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI,
  streamGrok,
  buildLorebookSectionForPrompt,
  buildHUDContextSection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections
} from '@/lib/llm';
import {
  sanitizeInput
} from '@/lib/validations';
import {
  retrieveEmbeddingsContext,
  formatEmbeddingsForSSE
} from '@/lib/embeddings/chat-context';

import {
  selectContextMessages,
  type ContextConfig
} from '@/lib/context-manager';

// Validate regenerate request manually
function validateRegenerateRequest(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return { success: false, error: 'Request body must be an object' } as const;
  }
  const obj = data as Record<string, unknown>;
  
  // sessionId is required
  if (typeof obj.sessionId !== 'string' || !obj.sessionId) {
    return { success: false, error: 'sessionId is required' } as const;
  }
  
  // messageId is required
  if (typeof obj.messageId !== 'string' || !obj.messageId) {
    return { success: false, error: 'messageId is required' } as const;
  }
  
  // llmConfig is required
  if (typeof obj.llmConfig !== 'object' || obj.llmConfig === null) {
    return { success: false, error: 'llmConfig is required' } as const;
  }
  
  return {
    success: true,
    data: {
      sessionId: obj.sessionId,
      messageId: obj.messageId,
      character: obj.character as Record<string, unknown> | undefined,
      characterId: typeof obj.characterId === 'string' ? obj.characterId : undefined,
      messages: Array.isArray(obj.messages) ? obj.messages : [],
      llmConfig: obj.llmConfig as Record<string, unknown>,
      userName: typeof obj.userName === 'string' ? obj.userName : 'User',
      persona: obj.persona as Record<string, unknown> | undefined,
      contextConfig: obj.contextConfig as Record<string, unknown> | undefined,
      lorebooks: Array.isArray(obj.lorebooks) ? obj.lorebooks : [],
      sessionStats: obj.sessionStats,
      hudContext: obj.hudContext as HUDContextConfig | undefined,
      allCharacters: Array.isArray(obj.allCharacters) ? obj.allCharacters : [],
      embeddingsChat: obj.embeddingsChat as Partial<EmbeddingsChatSettings> | undefined,
      summary: obj.summary as Record<string, unknown> | undefined
    }
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request manually (no Zod)
    const validation = validateRegenerateRequest(body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }
    
    const {
      sessionId,
      messageId,
      character,
      characterId,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      contextConfig,
      lorebooks = [],
      sessionStats,
      hudContext,
      allCharacters = [],
      embeddingsChat,
      summary
    } = validation.data;

    // Extract lorebooks for processing
    const typedLorebooks: Lorebook[] = lorebooks;
    
    // Cast sessionStats to proper type
    const typedSessionStats = sessionStats as SessionStats | undefined;

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Find the message to regenerate
    const messageToRegenerate = messages.find((m: { id: string }) => m.id === messageId);
    if (!messageToRegenerate) {
      return createErrorResponse('Message not found', 404);
    }

    // Only regenerate assistant messages
    if (messageToRegenerate.role !== 'assistant') {
      return createErrorResponse('Can only regenerate assistant messages', 400);
    }

    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || DEFAULT_CHARACTER;

    // Get effective user name from persona or use provided userName
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Process character template variables ({{user}}, {{char}}, etc.)
    const processedCharacter = processCharacter(effectiveCharacter, effectiveUserName, persona, typedSessionStats, allCharacters);

    // Get messages before the one to regenerate
    const messageIndex = messages.findIndex((m: { id: string }) => m.id === messageId);
    const messagesBeforeRegenerate = messages.slice(0, messageIndex);

    // Build context configuration from request or use defaults
    const ctxConfig: Partial<ContextConfig> = contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messagesBeforeRegenerate, llmConfig, ctxConfig);

    // Process lorebooks and get matched entries
    const { section: lorebookSection } = buildLorebookSectionForPrompt(
      messagesBeforeRegenerate,
      typedLorebooks,
      {
        scanDepth: ctxConfig.scanDepth,
        tokenBudget: 2048
      }
    );

    // ========================================
    // Embeddings Context Retrieval
    // ========================================
    // Retrieve relevant embeddings based on the last user message before the assistant message to regenerate
    const lastUserMessage = [...messagesBeforeRegenerate].reverse().find((m: { role: string }) => m.role === 'user');
    const queryMessage = lastUserMessage ? sanitizeInput((lastUserMessage as { content: string }).content || '') : '';

    const embeddingsResult = await retrieveEmbeddingsContext(
      queryMessage,
      characterId || effectiveCharacter.id,
      sessionId,
      embeddingsChat
    );

    if (embeddingsResult.found) {
      console.log(`[Regenerate Route] Retrieved ${embeddingsResult.count} embeddings from namespaces: ${embeddingsResult.searchedNamespaces.join(', ')}`);
    }

    // Build system prompt with persona and lorebook (using processed character)
    const { prompt: systemPrompt, sections: systemSections } = buildSystemPrompt(
      processedCharacter,
      effectiveUserName,
      persona,
      lorebookSection,
      typedSessionStats,  // Pass session stats for attribute values
      allCharacters       // Pass all characters for peticiones/solicitudes resolution
    );

    // Build HUD context section if enabled
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext) : null;

    // Build all prompt sections for storage
    const chatHistorySections = buildChatHistorySections(contextWindow.messages, processedCharacter.name, effectiveUserName);
    const postHistorySection = buildPostHistorySection(processedCharacter.postHistoryInstructions);

    // Combine all sections in order
    // Order: System -> [CONTEXTO] non-memory -> [MEMORIA] memory -> Chat History -> Post-History
    const personaIndex = systemSections.findIndex(s => s.type === 'persona');
    const prePersonaSections = personaIndex >= 0 ? systemSections.slice(0, personaIndex + 1) : systemSections;
    const postPersonaSections = personaIndex >= 0 ? systemSections.slice(personaIndex + 1) : [];

    let allPromptSections: PromptSection[] = [
      ...prePersonaSections,
      ...postPersonaSections,
      ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []),  // Non-memory: before chat
      ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []),  // Memory: before chat
      ...chatHistorySections,
      ...(postHistorySection ? [postHistorySection] : [])
    ];

    // Inject HUD context into sections if enabled
    if (hudContextSection && hudContext) {
      allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, hudContext.position);
    }

    // Build combined embeddings context: [CONTEXTO RELEVANTE] then [MEMORIA RELEVANTE]
    // Both injected before chat history (not in system prompt)
    const contextParts: string[] = [];
    if (embeddingsResult.nonMemoryContextString?.trim()) {
      contextParts.push(embeddingsResult.nonMemoryContextString);
    }
    if (embeddingsResult.memoryContextString?.trim()) {
      contextParts.push(embeddingsResult.memoryContextString);
    }
    const embeddingsContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

    // Build the final system prompt (no embeddings appended)
    const finalSystemPrompt = systemPrompt;

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send prompt data at the start
          controller.enqueue(createSSEJSON({
            type: 'prompt_data',
            promptSections: allPromptSections
          }));

          // Send embeddings context metadata to the client for UI display
          if (embeddingsResult.found) {
            controller.enqueue(createSSEJSON({
              type: 'embeddings_context',
              data: formatEmbeddingsForSSE(embeddingsResult)
            }));
          }

          let generator: AsyncGenerator<string>;

          // Route to appropriate provider
          switch (llmConfig.provider) {
            case 'z-ai': {
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                undefined,  // authorNote
                false,      // useSystemRole
                embeddingsContext  // Combined embeddings context before chat history
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamZAI(chatMessages);
              break;
            }

            case 'openai':
            case 'vllm':
            case 'lm-studio':
            case 'custom': {
              if (!llmConfig.endpoint) {
                throw new Error(`${llmConfig.provider} requires an endpoint URL`);
              }
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                undefined,  // authorNote
                true,       // useSystemRole
                embeddingsContext  // Combined embeddings context before chat history
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
              break;
            }

            case 'anthropic': {
              if (!llmConfig.apiKey) {
                throw new Error('Anthropic requires an API key');
              }
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                undefined,  // authorNote
                true,       // useSystemRole
                embeddingsContext  // Combined embeddings context before chat history
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamAnthropic(chatMessages, llmConfig);
              break;
            }

            case 'ollama': {
              const prompt = buildCompletionPrompt({
                systemPrompt: finalSystemPrompt,
                messages: contextWindow.messages,
                character: processedCharacter,
                userName: effectiveUserName,
                postHistoryInstructions: processedCharacter.postHistoryInstructions,
                embeddingsContext: embeddingsContext  // Memory embeddings before chat history
              });
              generator = streamOllama(prompt, llmConfig);
              break;
            }

            case 'grok': {
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                contextWindow.messages,
                processedCharacter,
                effectiveUserName,
                processedCharacter.postHistoryInstructions,
                undefined,
                true,
                embeddingsContext
              );
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              generator = streamGrok(chatMessages, llmConfig);
              break;
            }

            case 'text-generation-webui':
            case 'koboldcpp':
            default: {
              const prompt = buildCompletionPrompt({
                systemPrompt: finalSystemPrompt,
                messages: contextWindow.messages,
                character: processedCharacter,
                userName: effectiveUserName,
                postHistoryInstructions: processedCharacter.postHistoryInstructions,
                embeddingsContext: embeddingsContext  // Memory embeddings before chat history
              });
              generator = streamTextGenerationWebUI(prompt, llmConfig);
              break;
            }
          }

          let fullContent = '';
          
          // Stream the response
          for await (const chunk of generator) {
            fullContent += chunk;
            controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
          }

          // Clean response
          const cleanedContent = cleanResponseContent(fullContent, processedCharacter.name);

          // Send done signal with the full content
          controller.enqueue(createSSEJSON({ 
            type: 'done', 
            content: cleanedContent,
            messageId,
            sessionId
          }));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(createSSEJSON({ type: 'error', error: errorMessage }));
          controller.close();
        }
      }
    });

    return createSSEStreamResponse(stream);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to regenerate response',
      500
    );
  }
}
