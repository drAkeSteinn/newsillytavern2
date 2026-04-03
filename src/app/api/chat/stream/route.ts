// ============================================
// Chat Stream Route - Simplified with unified key resolution
// ============================================
//
// Key resolution happens in buildSystemPrompt():
// - Template variables: {{user}}, {{char}}, {{userpersona}}
// - Stats keys: {{resistencia}}, {{habilidades}}, etc.
// - All sections are processed consistently

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance, SessionSummary, SoundTrigger, AppSettings } from '@/types';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import {
  DEFAULT_CHARACTER,
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  buildSystemPrompt,
  buildChatHistorySections,
  buildPostHistorySection,
  buildChatMessages,
  buildCompletionPrompt,
  getEffectiveUserName,
  createUserMessage,
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamTextGenerationWebUI,
  buildLorebookSectionForPrompt,
  buildHUDContextSection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections,
  resolveAllKeys,
  buildKeyResolutionContext,
  resolveStats,
} from '@/lib/llm';
import {
  validateRequest,
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  getContextStats,
  type ContextConfig
} from '@/lib/context-manager';
import { buildQuestPromptSection } from '@/lib/triggers/handlers/quest-handler';
import { retrieveEmbeddingsContext, formatEmbeddingsForSSE } from '@/lib/embeddings/chat-context';
import type { EmbeddingsChatSettings } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request (automatically detects request type)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }

    const {
      message,
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      sessionStats,
      allCharacters, // All characters for peticiones/solicitudes resolution
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    // Extract HUD context from body
    const hudContext: HUDContextConfig | undefined = body.hudContext;

    // Extract Quest data for pre-LLM integration (NEW FORMAT)
    const questTemplates: QuestTemplate[] = body.questTemplates || [];
    const sessionQuests: SessionQuestInstance[] = body.sessionQuests || [];
    const questSettings: QuestSettings = {
      ...DEFAULT_QUEST_SETTINGS,
      ...(body.questSettings || {})
    };

    // Extract Sound data for {{sonidos}} key resolution
    const soundTriggers: SoundTrigger[] = body.soundTriggers || [];
    const soundSettings = body.settings?.sound;

    // Extract summary for memory/context compression (single summary from session)
    const summary: SessionSummary | undefined = body.summary;
    
    // Extract embeddings chat settings for automatic context retrieval
    const embeddingsChat: Partial<EmbeddingsChatSettings> = body.embeddingsChat || {};
    const sessionId: string | undefined = body.sessionId;
    const characterId: string | undefined = body.characterId;
    
    // Debug: Log sessionStats event fields
    console.log(`[Stream Route] sessionStats event fields:`, {
      hasSessionStats: !!sessionStats,
      ultimo_objetivo_completado: sessionStats?.ultimo_objetivo_completado,
      ultima_solicitud_realizada: sessionStats?.ultima_solicitud_realizada,
      ultima_solicitud_completada: sessionStats?.ultima_solicitud_completada,
      ultima_accion_realizada: sessionStats?.ultima_accion_realizada,
    });

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message);

    // Create default character if none provided
    const effectiveCharacter: CharacterCard = character || DEFAULT_CHARACTER;

    // Get effective user name from persona or use provided userName
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Build context configuration from request or use defaults
    const contextConfig: Partial<ContextConfig> = body.contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messages, llmConfig, contextConfig);

    // Log context stats (for debugging)
    const stats = getContextStats(messages);

    // Process lorebooks and get matched entries
    const { section: lorebookSection } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: contextConfig.scanDepth,
        tokenBudget: 2048
      }
    );

    // ========================================
    // Embeddings Context Retrieval
    // ========================================
    // Retrieve relevant embeddings based on user message and settings
    const embeddingsResult = await retrieveEmbeddingsContext(
      sanitizedMessage,
      characterId || effectiveCharacter.id,
      sessionId,
      embeddingsChat
    );
    
    if (embeddingsResult.found) {
      console.log(`[Stream Route] Retrieved ${embeddingsResult.count} embeddings from namespaces: ${embeddingsResult.searchedNamespaces.join(', ')}`);
    }

    // ========================================
    // Build system prompt with unified key resolution
    // ========================================
    // This handles ALL key resolution internally:
    // - Template variables: {{user}}, {{char}}, {{userpersona}}
    // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
    // - Sound keys: {{sonidos}}
    // - All sections including post-history instructions
    const { prompt: systemPrompt, sections: systemSections } = buildSystemPrompt(
      effectiveCharacter,
      effectiveUserName,
      persona,
      lorebookSection,
      sessionStats,
      allCharacters, // Pass all characters for peticiones/solicitudes resolution
      soundTriggers, // Pass soundTriggers for {{sonidos}} resolution
      soundSettings  // Pass sound settings for {{sonidos}} template
    );

    // Build key resolution context for HUD context and quest sections
    const resolvedStats = resolveStats({
      characterId: effectiveCharacter.id,
      statsConfig: effectiveCharacter.statsConfig,
      sessionStats: sessionStats,
      allCharacters,
      userName: effectiveUserName,
      characterName: effectiveCharacter.name,
    });
    const keyContext = buildKeyResolutionContext(
      effectiveCharacter,
      effectiveUserName,
      persona,
      resolvedStats,
      sessionStats,  // Pass sessionStats for {{eventos}} key resolution
      soundTriggers,   // Pass soundTriggers for {{sonidos}} key resolution
      soundSettings  // Pass sound settings for {{sonidos}} template
    );

    // Build HUD context section if enabled (now resolves keys!)
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext, keyContext) : null;

    // Build quest section if enabled (pre-LLM integration)
    // Pass characterId to filter objectives for this character
    let questSection: PromptSection | null = null;
    if (questSettings.enabled && questSettings.promptInclude && sessionQuests.length > 0 && questTemplates.length > 0) {
      const questPromptContent = buildQuestPromptSection(
        questTemplates,
        sessionQuests,
        questSettings.promptTemplate || DEFAULT_QUEST_SETTINGS.promptTemplate,
        effectiveCharacter.id  // Filter objectives for this character
      );
      if (questPromptContent) {
        const resolvedQuestContent = resolveAllKeys(questPromptContent, keyContext);

        questSection = {
          type: 'quest',
          label: 'Active Quests',
          content: resolvedQuestContent,
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        };
      }
    }

    // Build chat history sections (for prompt viewer)
    const chatHistorySections = buildChatHistorySections(
      contextWindow.messages,
      effectiveCharacter.name,
      effectiveUserName
    );

    // Build post-history instructions section (for prompt viewer)
    // Pass keyContext to resolve all {{keys}} like {{user}}, {{char}}, {{stats}}, etc.
    const postHistorySection = buildPostHistorySection(
      effectiveCharacter.postHistoryInstructions,
      keyContext
    );

    // Build summary section if summary exists (memory/context compression)
    let summarySection: PromptSection | null = null;
    let summaryMessage: ChatMessage | null = null;
    if (summary) {
      summarySection = {
        type: 'system',
        label: 'Conversation Summary',
        content: `[Previous Conversation Summary]\n${summary.content}`,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      };
      // Create a synthetic message for chat history injection
      summaryMessage = {
        id: 'summary-' + Date.now(),
        role: 'assistant',
        content: `[Previous Conversation Summary]\n${summary.content}`,
        characterId: effectiveCharacter.id,
        isDeleted: false,
        timestamp: summary.createdAt,
        swipeId: 'summary',
        swipeIndex: 0
      };
    }

    // Combine all sections in order for prompt viewer
    // Order: System -> [CONTEXTO] non-memory -> Summary -> Quest -> [MEMORIA] memory -> Chat History -> Post-History
    // Non-memory (lore, world) stays with character definition. Memory goes before chat history for recency primacy.
    const personaIndex = systemSections.findIndex(s => s.type === 'persona');
    const prePersonaSections = personaIndex >= 0 ? systemSections.slice(0, personaIndex + 1) : systemSections;
    const postPersonaSections = personaIndex >= 0 ? systemSections.slice(personaIndex + 1) : [];

    let allPromptSections: PromptSection[] = [
      ...prePersonaSections,
      ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []),  // Non-memory: after persona
      ...postPersonaSections,
      ...(summarySection ? [summarySection] : []),
      ...(questSection ? [questSection] : []),
      ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []),  // Memory: before chat history
      ...chatHistorySections,
      ...(postHistorySection ? [postHistorySection] : [])
    ];

    // Inject HUD context into sections if enabled
    if (hudContextSection && hudContext) {
      allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, hudContext.position);
    }

    // Non-memory embeddings: append to system prompt (static knowledge with character definition)
    // Memory embeddings: inject as separate system message before chat history (recency primacy)
    const memoryContextString = embeddingsResult.memoryContextString?.trim()
      ? `[${embeddingsResult.memorySection?.label || 'MEMORIA DEL PERSONAJE'}]\n${embeddingsResult.memoryContextString}`
      : undefined;

    // Build the final system prompt (non-memory embeddings + quest section)
    let finalSystemPrompt = systemPrompt;
    if (embeddingsResult.nonMemoryContextString?.trim()) {
      finalSystemPrompt += `\n\n[${embeddingsResult.nonMemorySection?.label || 'CONTEXTO'}]\n${embeddingsResult.nonMemoryContextString}`;
    }
    if (questSection) {
      finalSystemPrompt += `\n\n[${questSection.label}]\n${questSection.content}`;
    }

    // Prepare messages with new user message (use context-windowed messages)
    // Inject summary at the START of chat history if it exists
    let allMessages = summaryMessage 
      ? [summaryMessage, ...contextWindow.messages] 
      : [...contextWindow.messages];
    allMessages = [...allMessages, createUserMessage(sanitizedMessage)];

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

          // Get post-history instructions from character and RESOLVE ALL KEYS
          // This ensures {{user}}, {{char}}, {{stats}}, etc. are replaced
          const rawPostHistoryInstructions = effectiveCharacter.postHistoryInstructions?.trim();
          const postHistoryInstructions = rawPostHistoryInstructions 
            ? resolveAllKeys(rawPostHistoryInstructions, keyContext)
            : undefined;

          // Route to appropriate provider
          switch (llmConfig.provider) {
            case 'test-mock': {
              // Test mode: Simulate LLM response with trigger keys for testing
              // This is useful for testing trigger detection without a real LLM
              console.log('[Stream Route] Using TEST-MOCK provider for trigger testing');
              
              // Use custom mock response from config, or default response
              const mockResponse = llmConfig.mockResponse || `*El personaje te mira con interés*

¡Hola! Me alegra verte por aquí. Tenía algo que pedirte...

[peticion_madera]

¿Podrías conseguirme algo de madera para construir un refugio?

También puedo ofrecerte algunos sonidos:

|glohg|

Y cambiar mi expresión:

[sprite:alegre]`;
              
              console.log('[Stream Route] Mock response:', mockResponse.slice(0, 100) + '...');
              
              generator = async function* mockGenerator() {
                // Stream word by word to simulate realistic streaming
                // This matches how the Replay system works and ensures
                // trigger detection works correctly
                const words = mockResponse.split(/(\s+)/);
                
                for (const word of words) {
                  yield word;
                  // Random delay between 30-80ms to simulate realistic typing
                  // This matches the delay used in the Replay system
                  await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
                }
              }();
              break;
            }

            case 'z-ai': {
              // Z.ai uses its own SDK
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                allMessages,
                effectiveCharacter,
                effectiveUserName,
                postHistoryInstructions,  // Injected AFTER chat history
                undefined,  // authorNote
                false,      // useSystemRole
                memoryContextString  // Memory embeddings before chat history
              );
              // Inject HUD context into chat messages if enabled
              if (hudContextSection && hudContext) {
                chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
              }
              // Pass the API key from LLM config as the JWT token (if provided)
              // This allows per-config token override
              generator = streamZAI(chatMessages, llmConfig.apiKey);
              break;
            }

            case 'openai':
            case 'vllm':
            case 'lm-studio':
            case 'custom': {
              // These need a valid endpoint
              if (!llmConfig.endpoint) {
                throw new Error(`${llmConfig.provider} requires an endpoint URL`);
              }
              let chatMessages = buildChatMessages(
                finalSystemPrompt,
                allMessages,
                effectiveCharacter,
                effectiveUserName,
                postHistoryInstructions,  // Injected AFTER chat history
                undefined,  // authorNote
                true,       // useSystemRole
                memoryContextString  // Memory embeddings before chat history
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
                allMessages,
                effectiveCharacter,
                effectiveUserName,
                postHistoryInstructions,  // Injected AFTER chat history
                undefined,  // authorNote
                true,       // useSystemRole
                memoryContextString  // Memory embeddings before chat history
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
                messages: allMessages,
                character: effectiveCharacter,
                userName: effectiveUserName,
                postHistoryInstructions,  // Injected AFTER chat history
                embeddingsContext: memoryContextString  // Memory embeddings before chat history
              });
              generator = streamOllama(prompt, llmConfig);
              break;
            }

            case 'text-generation-webui':
            case 'koboldcpp':
            default: {
              const prompt = buildCompletionPrompt({
                systemPrompt: finalSystemPrompt,
                messages: allMessages,
                character: effectiveCharacter,
                userName: effectiveUserName,
                postHistoryInstructions,  // Injected AFTER chat history
                embeddingsContext: memoryContextString  // Memory embeddings before chat history
              });
              generator = streamTextGenerationWebUI(prompt, llmConfig);
              break;
            }
          }

          // Stream the response
          let accumulatedContent = '';
          for await (const chunk of generator) {
            accumulatedContent += chunk;
            controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
          }

          // Check if memory extraction should trigger BEFORE closing stream
          const shouldExtract =
            embeddingsChat.memoryExtractionEnabled &&
            accumulatedContent.length > 50 &&
            allMessages.length > 0 &&
            allMessages.length % (embeddingsChat.memoryExtractionFrequency || 5) === 0 &&
            !!llmConfig;

          if (shouldExtract) {
            controller.enqueue(createSSEJSON({
              type: 'memory_extracting',
              characterName: effectiveCharacter.name,
            }));
          }

          // Send done signal
          controller.enqueue(createSSEJSON({ type: 'done' }));
          controller.close();

          // Async: Extract memory from response (fire-and-forget, don't block)
          if (shouldExtract) {
            setTimeout(async () => {
              try {
                const response = await fetch('/api/embeddings/extract-memory', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    lastMessage: accumulatedContent,
                    characterName: effectiveCharacter.name,
                    characterId: effectiveCharacter.id,
                    sessionId: sessionId || '',
                    llmConfig: {
                      provider: llmConfig.provider,
                      endpoint: llmConfig.endpoint,
                      apiKey: llmConfig.apiKey,
                      model: llmConfig.model,
                      parameters: llmConfig.parameters,
                    },
                    minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                    consolidationSettings: embeddingsChat.memoryConsolidationEnabled ? {
                      enabled: true,
                      threshold: embeddingsChat.memoryConsolidationThreshold || 50,
                      keepRecent: embeddingsChat.memoryConsolidationKeepRecent || 10,
                      keepHighImportance: embeddingsChat.memoryConsolidationKeepHighImportance || 4,
                    } : undefined,
                  }),
                });
                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.saved > 0) {
                    console.log(`[Memory] Auto-extracted ${result.saved} memories for ${effectiveCharacter.name}`);
                  }
                }
              } catch (err) {
                console.warn('[Memory] Async extraction failed:', err);
              }
            }, 0);
          }
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
      error instanceof Error ? error.message : 'Failed to stream response',
      500
    );
  }
}
