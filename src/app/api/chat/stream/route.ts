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
import type { EmbeddingsChatSettings, ToolsSettings } from '@/types';
import {
  getAllToolDefinitions,
  getToolDefinitionsByIds,
  executeTool,
  getSessionReminders,
  createToolCallAccumulator,
  hasToolCalls,
  buildToolMessagesForOpenAI,
  buildToolMessagesForOllama,
  buildToolMessagesForAnthropic,
  createAnthropicToolState,
  anthropicStateToToolCalls,
  parseAllToolCallsFromText,
  mightContainToolCall,
  stripToolCallFromText,
  splitIntoChunks,
  cleanModelArtifacts,
} from '@/lib/tools';
import {
  streamOpenAIWithTools,
  streamOllamaWithTools,
  streamAnthropicWithTools,
} from '@/lib/llm/providers';
import type { NativeToolCall } from '@/lib/tools';
import type { CharacterCard } from '@/types';

// ============================================
// Tool Execution Helper
// ============================================

/**
 * Execute detected tool calls, send SSE events, and return results.
 * Returns { newContent: combined display messages, shouldContinue: true if tools were executed }
 */
async function executeToolCallsAndContinue(
  toolCalls: NativeToolCall[],
  availableTools: Array<{ id: string; name: string; label: string; icon: string }>,
  currentRound: number,
  maxRounds: number,
  character: CharacterCard,
  sessionId: string,
  userName: string,
  controller: { enqueue: (chunk: string) => void },
): Promise<{ newContent: string; shouldContinue: boolean }> {
  if (toolCalls.length === 0 || currentRound >= maxRounds) {
    return { newContent: '', shouldContinue: false };
  }

  const toolResults: Array<{ success: boolean; displayMessage: string }> = [];
  let allDisplayMessages = '';

  for (const tc of toolCalls) {
    const toolDef = availableTools.find(t => t.name === tc.name);

    // Send tool_call_start event
    controller.enqueue(createSSEJSON({
      type: 'tool_call_start',
      toolName: tc.name,
      toolLabel: toolDef?.label || tc.name,
      toolIcon: toolDef?.icon || 'Wrench',
      params: tc.arguments,
    }));

    console.log(`[Tools] Executing tool call: ${tc.name}`, tc.arguments);

    // Execute the tool
    const toolResult = await executeTool(
      tc.name,
      tc.arguments,
      {
        characterId: character.id,
        characterName: character.name,
        sessionId,
        userName,
      },
    );

    // Send tool_call_result event
    controller.enqueue(createSSEJSON({
      type: 'tool_call_result',
      toolName: tc.name,
      success: toolResult.success,
      displayMessage: toolResult.displayMessage,
      duration: toolResult.duration || 0,
    }));

    console.log(`[Tools] Tool ${tc.name}: success=${toolResult.success} duration=${toolResult.duration}ms`, toolResult.displayMessage);

    toolResults.push({ success: toolResult.success, displayMessage: toolResult.displayMessage });
    if (toolResult.displayMessage) {
      allDisplayMessages += (allDisplayMessages ? '\n' : '') + toolResult.displayMessage;
    }
  }

  // Return the display messages as content, and signal that a follow-up call is needed
  return {
    newContent: allDisplayMessages,
    shouldContinue: true, // Always continue to get the LLM's natural response
  };
}

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
    
    // Extract tools settings for tool/action system (native tool calling only)
    const toolsSettings: ToolsSettings = {
      enabled: body.toolsSettings?.enabled ?? true,
      maxToolCallsPerTurn: body.toolsSettings?.maxToolCallsPerTurn ?? 2,
      characterConfigs: body.toolsSettings?.characterConfigs || [],
    };
    
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
    // Enrich search query with recent context for better semantic matching
    const searchContextDepth = embeddingsChat.searchContextDepth || 0;
    let enrichedSearchQuery = sanitizedMessage;
    if (searchContextDepth > 0) {
      // Collect recent messages from history for context enrichment
      const recentHistory = messages
        .filter(m => !m.isDeleted)
        .slice(-(searchContextDepth * 2 + 1)) // user+assistant pairs
        .map(m => m.content?.trim())
        .filter(Boolean)
        .slice(0, -1); // exclude current message (already in sanitizedMessage)
      
      if (recentHistory.length > 0) {
        enrichedSearchQuery = recentHistory.join(' ') + ' ' + sanitizedMessage;
      }
    }

    // Retrieve relevant embeddings based on enriched query and settings
    const embeddingsResult = await retrieveEmbeddingsContext(
      enrichedSearchQuery,
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

    // Build the final system prompt (non-memory embeddings + quest section + tools)
    let finalSystemPrompt = systemPrompt;
    if (embeddingsResult.nonMemoryContextString?.trim()) {
      finalSystemPrompt += `\n\n[${embeddingsResult.nonMemorySection?.label || 'CONTEXTO'}]\n${embeddingsResult.nonMemoryContextString}`;
    }
    if (questSection) {
      finalSystemPrompt += `\n\n[${questSection.label}]\n${questSection.content}`;
    }

    // ===== TOOL/ACTION SYSTEM (Native Tool Calling) =====
    // Build available tools for this character
    // Tools are NOT injected into the system prompt - they are sent via the API's
    // native tools parameter. Only models that support tool calling will use them.
    const characterToolConfig = toolsSettings.characterConfigs.find(
      c => c.characterId === effectiveCharacter.id
    );
    const enabledToolIds = characterToolConfig?.enabledTools || [];
    const availableTools = enabledToolIds.length > 0
      ? getToolDefinitionsByIds(enabledToolIds)
      : getAllToolDefinitions(); // All tools enabled if no specific config
    const toolsEnabled = toolsSettings.enabled && availableTools.length > 0;

    // Determine if the current provider supports native tool calling
    const supportsNativeTools = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama'].includes(llmConfig.provider);
    const shouldUseTools = toolsEnabled && supportsNativeTools;

    if (shouldUseTools) {
      console.log(`[Tools] Native tool calling enabled for ${effectiveCharacter.name} (${llmConfig.provider}):`, availableTools.map(t => t.name));
    } else if (toolsEnabled && !supportsNativeTools) {
      console.log(`[Tools] Tools enabled but provider ${llmConfig.provider} does not support native tool calling - tools will not be used`);
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
          // If tools are enabled and provider supports native tool calling,
          // use the tool-aware streaming functions.
          let accumulatedContent = '';
          const maxToolRounds = toolsSettings.maxToolCallsPerTurn || 2;
          let toolRound = 0;
          let toolContextMessages: Array<Record<string, unknown>> = []; // for tool result messages

          // Build the initial chat messages once (shared across tool rounds for OpenAI/Anthropic)
          let baseChatMessages: import('@/lib/llm/types').ChatApiMessage[] | null = null;
          let baseSystemPrompt: string | null = null;

          while (toolRound <= maxToolRounds) {
            let generator: AsyncGenerator<string>;
            let isToolRound = toolRound > 0;

            // Get post-history instructions from character and RESOLVE ALL KEYS
            // This ensures {{user}}, {{char}}, {{stats}}, etc. are replaced
            if (toolRound === 0) {
              const rawPostHistoryInstructions = effectiveCharacter.postHistoryInstructions?.trim();
              const postHistoryInstructions = rawPostHistoryInstructions 
                ? resolveAllKeys(rawPostHistoryInstructions, keyContext)
                : undefined;
              // Store for reuse in tool rounds
              baseSystemPrompt = finalSystemPrompt;
            }

            // Route to appropriate provider
            switch (llmConfig.provider) {
              case 'test-mock': {
                // Test mode: Simulate LLM response with trigger keys for testing
                // This is useful for testing trigger detection without a real LLM
                console.log('[Stream Route] Using TEST-MOCK provider for trigger testing');
                
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
                  const words = mockResponse.split(/(\s+)/);
                  for (const word of words) {
                    yield word;
                    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
                  }
                }();
                break;
              }

              case 'z-ai': {
                // Z.ai does not support native tool calling
                let chatMessages = buildChatMessages(
                  baseSystemPrompt || finalSystemPrompt,
                  allMessages,
                  effectiveCharacter,
                  effectiveUserName,
                  effectiveCharacter.postHistoryInstructions?.trim(),
                  undefined, false, memoryContextString
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }
                generator = streamZAI(chatMessages, llmConfig.apiKey);
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
                  baseSystemPrompt || finalSystemPrompt,
                  allMessages,
                  effectiveCharacter,
                  effectiveUserName,
                  effectiveCharacter.postHistoryInstructions?.trim(),
                  undefined, true, memoryContextString
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  // First call with tools
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamOpenAIWithTools(chatMessages, llmConfig, llmConfig.provider, availableTools, accumulator);

                  // BUFFER content - don't stream to client yet
                  // We need to detect if this is a text-based tool call before showing anything
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                    // DO NOT send to client yet - buffer for tool call detection
                  }

                  console.log(`[Tools] Round 0 buffered ${roundContent.length} chars, finishReason=${accumulator.finishReason}, nativeToolCalls=${accumulator.toolCalls.length}`);

                  // Check for native tool calls first
                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                    // Stream any text content alongside tool calls
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    // Native tool calls detected! Execute them and loop
                    const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller
                    );
                    if (shouldContinue) {
                      const toolResultPairs = accumulator.toolCalls.map(tc => ({
                        success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                      }));
                      toolContextMessages = [
                        ...baseChatMessages,
                        ...buildToolMessagesForOpenAI(accumulator.toolCalls, toolResultPairs),
                      ];
                      accumulatedContent = '';
                      toolRound++;
                      continue;
                    }
                  } else if (mightContainToolCall(roundContent)) {
                    // Check for text-based tool call (model outputting JSON as content)
                    // This handles models like LM Studio that don't properly use native tool calling
                    console.log(`[Tools] Content might contain text-based tool call, attempting parse...`);
                    console.log(`[Tools] Content preview: ${roundContent.slice(0, 200)}...`);
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Tools] ✓ Text-based tool call(s) detected: ${textToolCalls.map(tc => tc.name).join(', ')}`);

                      // Stream any natural text before/after the tool calls
                      const cleanContent = stripToolCallFromText(roundContent);
                      if (cleanContent.trim()) {
                        console.log(`[Tools] Natural text to stream before/after tool call: "${cleanContent.slice(0, 100)}..."`);
                        for (const chunk of splitIntoChunks(cleanContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }

                      // Convert ALL to NativeToolCall format
                      const nativeCalls: NativeToolCall[] = textToolCalls.map((tc, idx) => ({
                        id: `text_call_${Date.now()}_${idx}`,
                        name: tc.name,
                        arguments: tc.arguments,
                        rawArguments: JSON.stringify(tc.arguments),
                      }));

                      // Execute and continue
                      const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        // For text-based calls, inject as user message with tool context
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${displayMessages}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
                        ] as any;
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    } else {
                      // Content looked like tool call but couldn't parse - clean and stream as regular text
                      console.log(`[Tools] ✗ Content looked like tool call but parse failed. Cleaning artifacts and streaming.`);
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                  } else {
                    // Regular text response - stream buffered content to client (clean artifacts)
                    const cleanedContent = cleanModelArtifacts(roundContent);
                    for (const chunk of splitIntoChunks(cleanedContent)) {
                      controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                    }
                  }
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up call with tool results (no tools in request to avoid loops)
                  generator = streamOpenAICompatible(toolContextMessages as any, llmConfig, llmConfig.provider);
                } else {
                  generator = streamOpenAICompatible(chatMessages, llmConfig, llmConfig.provider);
                }
                break;
              }

              case 'anthropic': {
                if (!llmConfig.apiKey) {
                  throw new Error('Anthropic requires an API key');
                }
                let chatMessages = buildChatMessages(
                  baseSystemPrompt || finalSystemPrompt,
                  allMessages,
                  effectiveCharacter,
                  effectiveUserName,
                  effectiveCharacter.postHistoryInstructions?.trim(),
                  undefined, true, memoryContextString
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  baseChatMessages = chatMessages;
                  const toolState = createAnthropicToolState();
                  generator = streamAnthropicWithTools(chatMessages, llmConfig, availableTools, toolState);

                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                    // DO NOT send to client yet - buffer for tool call detection
                  }

                  const toolCalls = anthropicStateToToolCalls(toolState);
                  if (toolCalls.length > 0 && (toolState.stopReason === 'tool_use')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                      toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller
                    );
                    if (shouldContinue) {
                      const toolResultPairs = toolCalls.map(tc => ({
                        success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                      }));
                      const toolMessages = buildToolMessagesForAnthropic(toolCalls, toolResultPairs);
                      accumulatedContent = '';
                      toolContextMessages = [
                        ...baseChatMessages,
                        ...toolMessages.flatMap(m => m),
                      ];
                      toolRound++;
                      continue;
                    }
                  } else if (mightContainToolCall(roundContent)) {
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Tools] ✓ Text-based tool call(s) detected (Anthropic): ${textToolCalls.map(tc => tc.name).join(', ')}`);
                      const cleanContent = stripToolCallFromText(roundContent);
                      if (cleanContent.trim()) {
                        for (const chunk of splitIntoChunks(cleanContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const nativeCalls: NativeToolCall[] = textToolCalls.map((tc, idx) => ({
                        id: `text_call_${Date.now()}_${idx}`,
                        name: tc.name,
                        arguments: tc.arguments,
                        rawArguments: JSON.stringify(tc.arguments),
                      }));
                      const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${displayMessages}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
                        ] as any;
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    } else {
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                  } else {
                    const cleanedContent = cleanModelArtifacts(roundContent);
                    for (const chunk of splitIntoChunks(cleanedContent)) {
                      controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                    }
                  }
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  generator = streamAnthropic(toolContextMessages as any, llmConfig);
                } else {
                  generator = streamAnthropic(chatMessages, llmConfig);
                }
                break;
              }

              case 'ollama': {
                if (shouldUseTools && !isToolRound) {
                  // Use /api/chat with tools support
                  let chatMessages = buildChatMessages(
                    baseSystemPrompt || finalSystemPrompt,
                    allMessages,
                    effectiveCharacter,
                    effectiveUserName,
                    effectiveCharacter.postHistoryInstructions?.trim(),
                    undefined, true, memoryContextString
                  );
                  if (hudContextSection && hudContext) {
                    chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                  }
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamOllamaWithTools(chatMessages, llmConfig, availableTools, accumulator);

                  // BUFFER content for tool call detection
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'tool use')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller
                    );
                    if (shouldContinue) {
                      const toolResultPairs = accumulator.toolCalls.map(tc => ({
                        success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                      }));
                      const toolResultMessages = buildToolMessagesForOllama(accumulator.toolCalls, toolResultPairs);
                      toolContextMessages = [...baseChatMessages, ...toolResultMessages] as any;
                      toolRound++;
                      continue;
                    }
                  } else if (mightContainToolCall(roundContent)) {
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Tools] ✓ Text-based tool call(s) detected (Ollama): ${textToolCalls.map(tc => tc.name).join(', ')}`);
                      const cleanContent = stripToolCallFromText(roundContent);
                      if (cleanContent.trim()) {
                        for (const chunk of splitIntoChunks(cleanContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const nativeCalls: NativeToolCall[] = textToolCalls.map((tc, idx) => ({
                        id: `text_call_${Date.now()}_${idx}`,
                        name: tc.name,
                        arguments: tc.arguments,
                        rawArguments: JSON.stringify(tc.arguments),
                      }));
                      const { newContent: displayMessages, shouldContinue } = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${displayMessages}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
                        ] as any;
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    } else {
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                  } else {
                    const cleanedContent = cleanModelArtifacts(roundContent);
                    for (const chunk of splitIntoChunks(cleanedContent)) {
                      controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                    }
                  }
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up without tools (completion-style)
                  const combinedPrompt = toolContextMessages.map(m => 
                    `${(m as any).role}: ${(m as any).content}`
                  ).join('\n') + `\n${effectiveCharacter.name}:`;
                  generator = streamOllama(combinedPrompt, llmConfig);
                } else {
                  // No tools - use standard completion endpoint
                  const prompt = buildCompletionPrompt({
                    systemPrompt: baseSystemPrompt || finalSystemPrompt,
                    messages: allMessages,
                    character: effectiveCharacter,
                    userName: effectiveUserName,
                    postHistoryInstructions: effectiveCharacter.postHistoryInstructions?.trim(),
                    embeddingsContext: memoryContextString
                  });
                  generator = streamOllama(prompt, llmConfig);
                }
                break;
              }

              case 'text-generation-webui':
              case 'koboldcpp':
              default: {
                const prompt = buildCompletionPrompt({
                  systemPrompt: baseSystemPrompt || finalSystemPrompt,
                  messages: allMessages,
                  character: effectiveCharacter,
                  userName: effectiveUserName,
                  postHistoryInstructions: effectiveCharacter.postHistoryInstructions?.trim(),
                  embeddingsContext: memoryContextString
                });
                generator = streamTextGenerationWebUI(prompt, llmConfig);
                break;
              }
            }

            // Stream the response
            // For tool rounds: buffer → clean artifacts → stream (ensures clean output)
            // For normal rounds: stream directly (preserve real-time feel)
            if (isToolRound) {
              // Buffer the follow-up response to clean model artifacts before sending
              let followUpContent = '';
              for await (const chunk of generator) {
                followUpContent += chunk;
              }
              // Clean special tokens from the follow-up response
              const cleanedFollowUp = cleanModelArtifacts(followUpContent);
              accumulatedContent += cleanedFollowUp;
              console.log(`[Tools] Follow-up round ${toolRound}: ${followUpContent.length} chars → cleaned to ${cleanedFollowUp.length} chars`);
              for (const chunk of splitIntoChunks(cleanedFollowUp)) {
                controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
              }
            } else {
              // Normal response - stream directly in real-time
              for await (const chunk of generator) {
                accumulatedContent += chunk;
                controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
              }
            }

            // Break the tool loop - no more rounds needed
            break;
          }

          // Check if memory extraction should trigger BEFORE closing stream
          // Count by TURNS (user messages) instead of individual messages.
          // A turn = 1 user message + N assistant responses.
          // This gives consistent extraction frequency in both normal and group chats.
          const userMessages = messages.filter(m => m.role === 'user' && !m.isDeleted);
          const turnCount = userMessages.length;
          const extractionFrequency = embeddingsChat.memoryExtractionFrequency || 5;
          const extractionEnabled = embeddingsChat.memoryExtractionEnabled === true;
          const shouldExtract =
            extractionEnabled &&
            accumulatedContent.length > 50 &&
            turnCount > 0 &&
            turnCount % extractionFrequency === 0 &&
            !!llmConfig;

          // Debug logging for extraction decision
          console.log(`[Memory] Normal chat extraction check: enabled=${extractionEnabled}, turns=${turnCount}, freq=${extractionFrequency}, contentLen=${accumulatedContent.length}, shouldExtract=${shouldExtract}`);

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
                // Build chat context for context-aware extraction
                const extractionContextDepth = embeddingsChat.memoryExtractionContextDepth || 0;
                let chatContextForExtraction: string | undefined;
                if (extractionContextDepth > 0) {
                  const contextMessages = messages
                    .filter(m => !m.isDeleted && m.content?.trim())
                    .slice(-(extractionContextDepth * 2 + 1));
                  
                  if (contextMessages.length > 0) {
                    chatContextForExtraction = contextMessages
                      .map(m => {
                        const role = m.role === 'user' ? 'Jugador' : effectiveCharacter.name;
                        const content = m.content.trim().slice(0, 300); // limit per message
                        return `${role}: ${content}`;
                      })
                      .join('\n  ');
                  }
                }

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
                    customPrompt: embeddingsChat.memoryExtractionPrompt,
                    chatContext: chatContextForExtraction, // NEW: pass recent context
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
                  if (result.success) {
                    console.log(`[Memory] Extraction result for ${effectiveCharacter.name}: extracted=${result.count}, saved=${result.saved}, namespace="${result.namespace}"${result.consolidation ? `, consolidated: -${result.consolidation.removed} +${result.consolidation.created}` : ''}`);
                  } else {
                    console.warn(`[Memory] Extraction failed for ${effectiveCharacter.name}:`, result.error);
                  }
                } else {
                  const errorText = await response.text().catch(() => 'unknown');
                  console.warn(`[Memory] Extract-memory API error ${response.status}:`, errorText);
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
