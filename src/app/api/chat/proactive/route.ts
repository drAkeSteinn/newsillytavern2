// ============================================
// Chat Proactive Route - Full parity with stream route
// ============================================
//
// Generates a proactive message when a character speaks
// without user input. Uses SSE streaming with full
// tool/action support, embeddings, key resolution, etc.

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance, SessionSummary, SoundTrigger, AppSettings, CharacterStatsConfig, CharacterMemory } from '@/types';
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
  streamGrok,
  buildLorebookSectionForPrompt,
  buildMemorySection,
  buildHUDContextSection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections,
  resolveAllKeys,
  buildKeyResolutionContext,
  resolveStats,
} from '@/lib/llm';
import type { InventoryPromptData } from '@/lib/llm';
import {
  sanitizeInput
} from '@/lib/validations';
import {
  selectContextMessages,
  getContextStats,
  estimateContentTokens,
  type ContextConfig
} from '@/lib/context-manager';
import { retrieveEmbeddingsContext, formatEmbeddingsForSSE } from '@/lib/embeddings/chat-context';
import { processResponseAndReinforceMemories, isReinforcementEnabled } from '@/lib/embeddings/memory-reinforcement';
import type { EmbeddingsChatSettings, ToolsSettings } from '@/types';
import {
  getAllToolDefinitions,
  getToolDefinitionsByIds,
  resolveToolDefinitionsKeys,
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
  buildPromptBasedToolsSection,
} from '@/lib/tools';
import {
  streamZAIWithTools,
  streamOpenAIWithTools,
  streamOllamaWithTools,
  streamAnthropicWithTools,
  streamGrokWithTools,
  streamTextGenerationWebUIWithTools,
} from '@/lib/llm/providers';
import type { NativeToolCall } from '@/lib/tools';

// ============================================
// Tool Execution Helper
// ============================================

interface QuestActivation {
  type: 'activate_quest' | 'complete_objective' | 'progress_objective';
  key: string;
  metadata?: Record<string, unknown>;
}

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
  sessionQuests?: SessionQuestInstance[],
  questTemplates?: QuestTemplate[],
  statsConfig?: CharacterStatsConfig,
  sessionStats?: SessionStats,
  allCharacters?: CharacterCard[],
  characterMemory?: CharacterMemory,
  lorebooks?: Lorebook[],
): Promise<{ newContent: string; shouldContinue: boolean; toolResults: Array<{ success: boolean; displayMessage: string }>; questActivations: QuestActivation[]; toolsUsed: Array<{ name: string; label: string; icon: string; success: boolean }> }> {
  if (toolCalls.length === 0 || currentRound >= maxRounds) {
    return { newContent: '', shouldContinue: false, toolResults: [], questActivations: [], toolsUsed: [] };
  }

  const toolResults: Array<{ success: boolean; displayMessage: string }> = [];
  const questActivations: QuestActivation[] = [];
  const toolsUsed: Array<{ name: string; label: string; icon: string; success: boolean }> = [];
  let allDisplayMessages = '';

  for (let i = 0; i < toolCalls.length; i++) {
    const tc = toolCalls[i];
    const toolDef = availableTools.find(t => t.name === tc.name);
    const callId = `${Date.now()}_${i}`;

    // Send tool_call_start event
    controller.enqueue(createSSEJSON({
      type: 'tool_call_start',
      toolName: tc.name,
      toolLabel: toolDef?.label || tc.name,
      toolIcon: toolDef?.icon || 'Wrench',
      params: tc.arguments,
      callId,
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
        sessionQuests,
        questTemplates,
        statsConfig: character.statsConfig,
        sessionStats,
        allCharacters,
        characterMemory,
        lorebooks,
      },
    );

    // Send tool_call_result event
    controller.enqueue(createSSEJSON({
      type: 'tool_call_result',
      toolName: tc.name,
      success: toolResult.success,
      displayMessage: toolResult.displayMessage,
      duration: toolResult.duration || 0,
      callId,
    }));

    // Check for quest activation and send SSE event
    if (toolResult.questActivation) {
      const activation = toolResult.questActivation;
      console.log(`[Tools] Quest activation from ${tc.name}:`, activation);
      
      controller.enqueue(createSSEJSON({
        type: 'quest_activation',
        toolName: tc.name,
        activationType: activation.type,
        key: activation.key,
        metadata: activation.metadata,
      }));
      
      questActivations.push(activation);
    }

    // Check for action/skill activation and send SSE event
    if (toolResult.actionActivation) {
      const action = toolResult.actionActivation;
      console.log(`[Tools] Action activation from ${tc.name}:`, action.skillName);
      
      controller.enqueue(createSSEJSON({
        type: 'action_activation',
        toolName: tc.name,
        skillId: action.skillId,
        skillName: action.skillName,
        skillDescription: action.skillDescription,
        skillCompletedDescription: action.skillCompletedDescription,
        activationCosts: action.activationCosts,
        activationRewards: action.activationRewards,
        characterId: action.characterId,
      }));
    }

    // Check for stat modification from modify_stat tool and send SSE event
    if (toolResult.statActivation) {
      const stat = toolResult.statActivation;
      console.log(`[Tools] Stat activation from ${tc.name}:`, stat.attributeKey, stat.oldValue, '→', stat.newValue);
      
      controller.enqueue(createSSEJSON({
        type: 'stat_activation',
        toolName: tc.name,
        characterId: stat.characterId,
        attributeKey: stat.attributeKey,
        attributeName: stat.attributeName,
        attributeType: stat.attributeType,
        oldValue: stat.oldValue,
        newValue: stat.newValue,
        reason: stat.reason,
      }));
    }

    // Check for solicitud activation/completion and send SSE event
    if (toolResult.solicitudActivation) {
      const sol = toolResult.solicitudActivation;
      console.log(`[Tools] Solicitud activation from ${tc.name}:`, sol.type, sol.solicitudKey);
      
      controller.enqueue(createSSEJSON({
        type: 'solicitud_activation',
        toolName: tc.name,
        activationType: sol.type,
        solicitudKey: sol.solicitudKey,
        targetCharacterId: sol.targetCharacterId,
        targetCharacterName: sol.targetCharacterName,
        fromCharacterId: sol.fromCharacterId,
        fromCharacterName: sol.fromCharacterName,
        description: sol.description,
        completionDescription: sol.completionDescription,
        peticionKey: sol.peticionKey,
      }));
    }

    // Check for memory activation (sync to client-side Character Memory)
    if (toolResult.memoryActivation) {
      const mem = toolResult.memoryActivation;
      console.log(`[Tools] Memory activation from ${tc.name}:`, mem.type);
      
      controller.enqueue(createSSEJSON({
        type: 'memory_activation',
        toolName: tc.name,
        activationType: mem.type,
        characterId: mem.characterId,
        eventData: mem.eventData,
        relationshipData: mem.relationshipData,
        noteContent: mem.noteContent,
        deleteEventId: mem.deleteEventId,
        deleteEmbeddingId: mem.deleteEmbeddingId,
      }));
    }

    console.log(`[Tools] Tool ${tc.name}: success=${toolResult.success} duration=${toolResult.duration}ms`, toolResult.displayMessage);

    toolResults.push({ success: toolResult.success, displayMessage: toolResult.displayMessage });
    toolsUsed.push({
      name: tc.name,
      label: toolDef?.label || tc.name,
      icon: toolDef?.icon || 'Wrench',
      success: toolResult.success,
    });
    if (toolResult.displayMessage) {
      allDisplayMessages += (allDisplayMessages ? '\n' : '') + toolResult.displayMessage;
    }
  }

  // Return the display messages as content, tool results, and signal that a follow-up call is needed
  return {
    newContent: allDisplayMessages,
    shouldContinue: true, // Always continue to get the LLM's natural response
    toolResults,
    questActivations,
    toolsUsed,
  };
}

/**
 * POST /api/chat/proactive
 *
 * Generates a proactive message for a character using SSE streaming.
 * Full feature parity with the stream route including tools, embeddings,
 * key resolution, memory reinforcement, and extraction.
 */
export async function POST(request: NextRequest) {
  try {
    // Capture auth headers from Z.ai gateway for token resolution
    const incomingXToken = request.headers.get('X-Token');
    const fcSecurityToken = request.headers.get('x-fc-security-token');

    const body = await request.json();

    // Extract required fields from body
    const {
      character,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      proactiveConfig,
      reason = 'timer_idle',
      lastActivityAt,
      // FASE 3: Proactividad Inteligente
      usedNudgeIndices: clientUsedNudgeIndices = [],
      recentTopics: clientRecentTopics = [],
      isGroupChat = false,
    } = body;

    // Validate required fields
    if (!character?.name || !llmConfig?.provider) {
      return createErrorResponse('Missing required fields: character, llmConfig', 400);
    }

    if (!proactiveConfig?.enabled) {
      return createErrorResponse('Proactive messages are disabled for this character', 400);
    }

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Validate API key for providers that require one
    const providersRequiringApiKey = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'grok'];
    if (providersRequiringApiKey.includes(llmConfig.provider) && !llmConfig.apiKey) {
      return createErrorResponse(
        `API Key is required for ${llmConfig.provider} provider. Please configure it in Settings.`,
        400
      );
    }

    // Validate endpoint for providers that require one
    const providersRequiringEndpoint = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama', 'text-generation-webui', 'koboldcpp'];
    if (providersRequiringEndpoint.includes(llmConfig.provider) && !llmConfig.endpoint) {
      return createErrorResponse(
        `Endpoint URL is required for ${llmConfig.provider} provider. Please configure it in Settings.`,
        400
      );
    }

    // If using Z.ai provider, collect gateway-forwarded auth headers
    let zaiRuntimeToken: string | undefined;
    if (llmConfig.provider === 'z-ai') {
      const gatewayToken = incomingXToken || fcSecurityToken || undefined;
      if (gatewayToken) {
        zaiRuntimeToken = gatewayToken;
        console.log(`[Proactive Route] Z.ai runtime token available (${gatewayToken.length} chars, source: ${incomingXToken ? 'X-Token' : 'fc-security-token'})`);
      } else {
        console.log(`[Proactive Route] Z.ai: no gateway token available, using config file only`);
      }
    }

    console.log(`[Proactive] Generating proactive message for "${character.name}" (reason: ${reason})`);

    // Extract all additional fields from body (matching stream route)
    const lorebooks: Lorebook[] = body.lorebooks || [];
    const sessionStats: SessionStats | undefined = body.sessionStats;
    const allCharacters: CharacterCard[] = body.allCharacters || [character];

    // Extract HUD context from body
    const hudContext: HUDContextConfig | undefined = body.hudContext;

    // Extract Quest data
    const questTemplates: QuestTemplate[] = body.questTemplates || [];
    const sessionQuests: SessionQuestInstance[] = body.sessionQuests || [];
    const questSettings: QuestSettings = {
      ...DEFAULT_QUEST_SETTINGS,
      ...(body.questSettings || {})
    };

    // Extract Sound data for {{sonidos}} key resolution
    const soundTriggers: SoundTrigger[] = body.soundTriggers || [];
    const soundSettings = body.settings?.sound;

    // Extract summary for memory/context compression
    const summary: SessionSummary | undefined = body.summary;

    // Extract embeddings chat settings
    const embeddingsChat: Partial<EmbeddingsChatSettings> = body.embeddingsChat || {};
    const characterMemory: CharacterMemory | undefined = body.characterMemory;
    const sessionId: string | undefined = body.sessionId;
    const characterId: string | undefined = body.characterId;
    const inventoryData: InventoryPromptData | undefined = body.inventoryData;

    // Extract tools settings
    const toolsSettings: ToolsSettings = {
      enabled: body.toolsSettings?.enabled ?? true,
      maxToolCallsPerTurn: body.toolsSettings?.maxToolCallsPerTurn ?? 2,
      characterConfigs: body.toolsSettings?.characterConfigs || [],
      usePromptBasedFallback: body.toolsSettings?.usePromptBasedFallback ?? false,
      disabledTools: body.toolsSettings?.disabledTools || [],
    };

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
    const { plan: lorebookPlan, lorebookAttributeKeys, lorebookEntryKeyMap, lorebookDebugEntries } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: (contextConfig as any).scanDepth,
        userName: effectiveUserName,
        charName: effectiveCharacter?.name,
      },
      { sessionStats, characterId: effectiveCharacter?.id, characters: allCharacters }
    );

    // ========================================
    // DEBUG: Build lorebook debug data for SSE event
    // ========================================
    const lorebookDebugData = {
      lorebookAttributeKeys,
      debugEntries: lorebookDebugEntries,
      availableStats: sessionStats
        ? Object.fromEntries(
            Object.entries(sessionStats.characterStats || {}).map(([charId, cs]) => [
              charId,
              cs?.attributeValues ? { ...cs.attributeValues } : '(no values)',
            ])
          )
        : '(no sessionStats)',
    };

    // ========================================
    // Embeddings Context Retrieval
    // ========================================
    // For proactive messages, use recent chat context as the search query
    // since there's no new user message
    let enrichedSearchQuery = '';
    const searchContextDepth = embeddingsChat.searchContextDepth || 0;
    if (searchContextDepth > 0) {
      const recentHistory = messages
        .filter(m => !m.isDeleted)
        .slice(-(searchContextDepth * 2))
        .map(m => m.content?.trim())
        .filter(Boolean);
      
      if (recentHistory.length > 0) {
        enrichedSearchQuery = recentHistory.join(' ');
      }
    } else {
      // Use last few messages as search context
      const recentHistory = messages
        .filter(m => !m.isDeleted)
        .slice(-4)
        .map(m => m.content?.trim())
        .filter(Boolean);
      
      if (recentHistory.length > 0) {
        enrichedSearchQuery = recentHistory.join(' ');
      }
    }

    // Safety: smart truncation based on embedding model's context window.
    try {
      const { MODEL_CONTEXT_LENGTHS, DEFAULT_CONTEXT_LENGTH, CHARS_PER_TOKEN } = await import('@/lib/embeddings/types');
      const { loadConfig } = await import('@/lib/embeddings/config-persistence');
      const embConfig = loadConfig();
      const modelKey = embConfig.model || 'bge-m3:567m';
      const modelCtx = MODEL_CONTEXT_LENGTHS[modelKey]
        || MODEL_CONTEXT_LENGTHS[modelKey.split(':')[0]]
        || DEFAULT_CONTEXT_LENGTH;
      const maxQueryChars = Math.floor(modelCtx * 0.75 * CHARS_PER_TOKEN);

      if (enrichedSearchQuery.length > maxQueryChars) {
        // For proactive: keep the most recent part (end of the string)
        enrichedSearchQuery = enrichedSearchQuery.slice(-maxQueryChars);
        console.warn(
          `[Proactive Route] Search query trimmed to ${enrichedSearchQuery.length} chars ` +
          `(model: ${modelKey}, context: ${modelCtx} tokens)`
        );
      }
    } catch { /* fallback: Ollama client handles truncation */ }

    // Retrieve relevant embeddings based on enriched query and settings
    // Pass Character Memory events for deduplication (avoid duplicate memory in prompt)
    const existingMemoryEvents = characterMemory?.events?.map(e => ({
      content: e.content,
      importance: e.importance,
    }));

    // Extract last assistant message for bidirectional search
    const lastAssistantMsg = messages
      .filter(m => !m.isDeleted && m.role === 'assistant')
      .pop()?.content;

    const embeddingsResult = await retrieveEmbeddingsContext(
      enrichedSearchQuery,
      characterId || effectiveCharacter.id,
      sessionId,
      embeddingsChat,
      undefined, // groupId
      existingMemoryEvents, // for deduplication
      lastAssistantMsg, // bidirectional search with last assistant message
    );
    
    if (embeddingsResult.found) {
      console.log(`[Proactive Route] Retrieved ${embeddingsResult.count} embeddings from namespaces: ${embeddingsResult.searchedNamespaces.join(', ')}`);
    }

    // ========================================
    // Build system prompt with unified key resolution
    // ========================================
    const { prompt: systemPrompt, sections: systemSections, lorebookChatInjections, exampleMessages } = buildSystemPrompt(
      effectiveCharacter,
      effectiveUserName,
      persona,
      lorebookPlan,
      sessionStats,
      allCharacters, // Pass all characters for peticiones/solicitudes resolution
      soundTriggers,
      soundSettings,
      questTemplates,
      sessionQuests,
      questSettings,
      lorebookAttributeKeys,
      inventoryData,    // Pass inventory data for Inventory V2 section
      lorebookEntryKeyMap // Pass lorebook entry key map for {{entryKey}} resolution
    );

    // Build key resolution context for HUD context and quest sections
    let streamPersonaResolvedStats: import('@/types').ResolvedStats | null = null;
    if (persona?.statsConfig?.enabled && sessionStats) {
      streamPersonaResolvedStats = resolveStats({
        characterId: '__user__',
        statsConfig: persona.statsConfig,
        sessionStats,
      });
    }
    const resolvedStats = resolveStats({
      characterId: effectiveCharacter.id,
      statsConfig: effectiveCharacter.statsConfig,
      sessionStats: sessionStats,
      allCharacters,
      userName: effectiveUserName,
      characterName: effectiveCharacter.name,
      questTemplates,
      personaDescription: persona?.description,
      personaResolvedStats: streamPersonaResolvedStats,
    });

    // Build outlet sections map from lorebook plan for {{outlet::name}} macro resolution
    const outletSections: Record<string, string> = {};
    if (lorebookPlan?.outletSections.length) {
      for (const outletSection of lorebookPlan.outletSections) {
        const match = outletSection.label.match(/^World Info \((.+)\)$/);
        const outletName = match ? match[1] : outletSection.label;
        outletSections[outletName] = outletSection.content;
      }
    }

    const keyContext = buildKeyResolutionContext(
      effectiveCharacter,
      effectiveUserName,
      persona,
      resolvedStats,
      sessionStats,
      soundTriggers,
      soundSettings,
      streamPersonaResolvedStats,
      questTemplates,
      sessionQuests,
      questSettings,
      outletSections,
      lorebookAttributeKeys,
      inventoryData     // Pass inventory data for {{inventory}} and {{currency}} key resolution
    );

    // Build HUD context section if enabled (now resolves keys!)
    const hudContextSection = hudContext ? buildHUDContextSection(hudContext, keyContext) : null;

    // Build chat history sections (for prompt viewer)
    const chatHistorySections = buildChatHistorySections(
      contextWindow.messages,
      effectiveCharacter.name,
      effectiveUserName
    );

    // Build post-history instructions section (for prompt viewer)
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
        label: 'Recuerdos Anteriores',
        content: `[RECUERDOS ANTERIORES]\n${summary.content}`,
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
      };
      // Create a synthetic message for chat history injection
      summaryMessage = {
        id: 'summary-' + Date.now(),
        role: 'assistant',
        content: `[RECUERDOS ANTERIORES]\n${summary.content}`,
        characterId: effectiveCharacter.id,
        isDeleted: false,
        timestamp: summary.createdAt,
        swipeId: 'summary',
        swipeIndex: 0,
        swipes: [`[RECUERDOS ANTERIORES]\n${summary.content}`]
      };
    }

    // Combine all sections in order for prompt viewer
    const personaIndex = systemSections.findIndex(s => s.type === 'persona');
    const prePersonaSections = personaIndex >= 0 ? systemSections.slice(0, personaIndex + 1) : systemSections;
    const postPersonaSections = personaIndex >= 0 ? systemSections.slice(personaIndex + 1) : [];

    // Build character memory section from Zustand store data (events, relationships, notes)
    const characterMemorySection = characterMemory
      ? buildMemorySection(characterMemory, effectiveCharacter.name || 'Character')
      : null;

    let allPromptSections: PromptSection[] = [
      ...prePersonaSections,
      ...postPersonaSections,
      ...(summarySection ? [summarySection] : []),
      ...(characterMemorySection ? [characterMemorySection] : []),  // Character memory: before embeddings
      ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []),
      ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []),
      ...chatHistorySections,
      ...(postHistorySection ? [postHistorySection] : [])
    ];

    // Inject HUD context into sections if enabled
    if (hudContextSection && hudContext) {
      allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, hudContext.position);
    }

    // Build combined embeddings context
    // If embeddings found memory results, skip Character Memory content here to avoid duplication
    // (Character Memory is still shown in the prompt viewer as a separate section)
    const contextParts: string[] = [];

    const embeddingsFoundMemory = embeddingsResult.found && embeddingsResult.memoryCount > 0;
    if (characterMemorySection && !embeddingsFoundMemory) {
      contextParts.push(characterMemorySection.content);
    }

    if (embeddingsResult.nonMemoryContextString?.trim()) {
      contextParts.push(embeddingsResult.nonMemoryContextString);
    }
    if (embeddingsResult.memoryContextString?.trim()) {
      contextParts.push(embeddingsResult.memoryContextString);
    }
    const embeddingsContext = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

    // Re-evaluate context window with reserved tokens for summary + embeddings
    // This reduces chat history when summary/embeddings use significant budget
    const pSummaryTokens = summary?.content ? estimateContentTokens(`[RECUERDOS ANTERIORES]\n${summary.content}`) : 0;
    const pEmbeddingsTokens = embeddingsContext ? estimateContentTokens(embeddingsContext) : 0;
    const pReservedTokens = pSummaryTokens + pEmbeddingsTokens;
    
    let finalContextWindow = contextWindow;
    if (pReservedTokens > 200) {
      const adjustedProactiveConfig: Partial<ContextConfig> = {
        ...contextConfig,
        reservedTokens: pReservedTokens,
      };
      finalContextWindow = selectContextMessages(messages, llmConfig, adjustedProactiveConfig);
      console.log(`[Proactive Context Budget] Reserved ${pReservedTokens} tokens (summary: ${pSummaryTokens}, embeddings: ${pEmbeddingsTokens}). Chat messages: ${contextWindow.messages.length} → ${finalContextWindow.messages.length}`);
    }

    // Update prompt viewer sections if context window was re-evaluated
    let finalChatHistorySections = chatHistorySections;
    let finalAllPromptSections = allPromptSections;
    if (finalContextWindow !== contextWindow) {
      finalChatHistorySections = buildChatHistorySections(
        finalContextWindow.messages,
        effectiveCharacter.name,
        effectiveUserName
      );
      finalAllPromptSections = [
        ...prePersonaSections,
        ...postPersonaSections,
        ...(summarySection ? [summarySection] : []),
        ...(characterMemorySection ? [characterMemorySection] : []),
        ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []),
        ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []),
        ...finalChatHistorySections,
        ...(postHistorySection ? [postHistorySection] : [])
      ];
      if (hudContextSection && hudContext) {
        finalAllPromptSections = injectHUDContextIntoSections(finalAllPromptSections, hudContextSection, hudContext.position);
      }
    }

    // Build proactive instruction with template variables (NOT JS interpolation)
    const defaultInstruction = `Estás enviando un mensaje a {{user}} sin que haya hablado primero. La conversación ha estado inactiva por un tiempo. Reacciona de forma natural a la situación. Puedes:
- Comentar algo que está ocurriendo a tu alrededor
- Expresar un pensamiento o sentimiento
- Iniciar un nuevo tema de conversación
- Preguntar algo a {{user}}
- Reaccionar al silencio o al paso del tiempo
- Realizar una acción disponible si encaja naturalmente en la escena (ej. *se acerca*, *mira alrededor*, *suspira*)

Mantén tu mensaje breve y natural (1-3 párrafos máximo). NO menciones que estás siendo proactivo o que {{user}} no ha hablado. Mantente en personaje en todo momento.`;

    // Group chat proactive instruction variants by strategy (FASE 3)
    const groupChatStrategy = proactiveConfig.groupChatStrategy || 'any_speaker';

    const groupChatInstructions: Record<string, string> = {
      any_speaker: `Estás en una conversación grupal. Alguien ha hablado recientemente y decides reaccionar o intervenir de forma natural. Puedes:
- Reaccionar a lo que alguien dijo
- Añadir tu perspectiva al tema actual
- Expresar un pensamiento o sentimiento sobre la situación
- Interactuar con otro personaje presente
- Realizar una acción que encaje naturalmente en la escena

Mantén tu mensaje breve y natural (1-3 párrafos máximo). NO menciones que estás siendo proactivo. Mantente en personaje en todo momento. Sé selectivo: no reacciones a TODO, solo cuando tengas algo significativo que aportar.`,

      mentioned_only: `Estás en una conversación grupal y alguien te ha mencionado directamente por nombre. Debes responder a lo que te han dicho. Puedes:
- Responder directamente a quien te mencionó
- Reaccionar a lo que se te pidió o preguntó
- Expresar tu opinión sobre el tema del que te hablaron
- Interactuar con quien te mencionó de forma natural

Mantén tu mensaje breve y natural (1-3 párrafos máximo). NO menciones que estás siendo proactivo. Mantente en personaje en todo momento. Solo responde cuando te mencionen explícitamente.`,

      emotional_reaction: `Estás en una conversación grupal y algo que se ha dicho te afecta emocionalmente de forma significativa. Reacciona de manera coherente con tu estado emocional. Puedes:
- Expresar una reacción emocional intensa (alegría, enojo, sorpresa, tristeza)
- Realizar una acción que refleje tu estado emocional (*se levanta*, *aprieta los puños*, *sonríe ampliamente*)
- Intervenir cuando algo te afecte profundamente
- Mostrar una reacción visible que otros personajes podrían notar

Mantén tu mensaje breve y natural (1-3 párrafos máximo). NO menciones que estás siendo proactivo. Mantente en personaje en todo momento. Solo reacciones emocionales fuertes, no intervengas en todo.`
    };

    const groupChatInstruction = groupChatInstructions[groupChatStrategy] || groupChatInstructions.any_speaker;

    // Resolve template variables in custom prompt OR default instruction
    const rawProactiveInstruction = proactiveConfig.customPrompt?.trim()
      || (isGroupChat ? groupChatInstruction : defaultInstruction);
    const proactiveInstruction = resolveAllKeys(rawProactiveInstruction, keyContext);

    // Build the final system prompt
    let finalSystemPrompt = systemPrompt;
    finalSystemPrompt += `\n\n[Proactive Message Instruction]\n${proactiveInstruction}`;

    // ─── FASE 9: Contexto para Proactividad ───
    // Inject deep conversation context into the system prompt for more coherent proactive messages.
    // This goes beyond FASE 3's nudge-level context by adding emotional, relationship,
    // quest, and abandoned topic context directly into the system prompt.
    const contextInSystemPrompt = proactiveConfig.contextInSystemPrompt ?? true;
    const contextMsgMaxChars = proactiveConfig.contextMessageMaxChars ?? 300;
    const contextMsgCount = proactiveConfig.contextMessagesCount ?? 3;

    // Build enriched context sections
    const proactiveContextSections: string[] = [];

    // 1. Emotional state context (if enabled and available)
    if (proactiveConfig.includeEmotionalContext !== false) {
      const charStats = sessionStats?.characterStats?.[effectiveCharacter.id];
      const emotionalState = charStats?.emotionalState;
      const emotionalConfig = effectiveCharacter.emotionalConfig;
      if (emotionalState && emotionalConfig?.enabled) {
        proactiveContextSections.push(
          `[Estado Emocional Actual]\n` +
          `Actualmente te encuentras: ${emotionalState}\n` +
          `Esto debe influir en cómo decides iniciar la conversación. ` +
          `Si estás triste, quizás busques consuelo. Si estás enojado, podrías ser más directo. ` +
          `Si estás feliz, compartirás tu entusiasmo.`
        );
      }
    }

    // 2. Relationship context (if enabled and available)
    if (proactiveConfig.includeRelationshipContext !== false && characterMemory?.relationships) {
      const relationships = characterMemory.relationships;
      if (relationships.length > 0) {
        const relLines = relationships
          .filter(r => r.targetName === effectiveUserName || r.targetId === '__user__')
          .slice(0, 3)
          .map(r => {
            const parts = [`Con ${r.targetName}: `];
            if (r.relationship) parts.push(r.relationship);
            if (r.sentiment) parts.push(`(sentimiento: ${r.sentiment})`);
            if (r.notes) parts.push(`— ${r.notes}`);
            return parts.join(' ');
          });
        if (relLines.length > 0) {
          proactiveContextSections.push(
            `[Relación con ${effectiveUserName}]\n` +
            relLines.join('\n') +
            `\nConsidera esta relación al decidir qué decir. Tu mensaje debe ser consistente con tu historia juntos.`
          );
        }
      }
    }

    // 3. Active quests context (if enabled and available)
    if (proactiveConfig.includeQuestContext !== false && sessionQuests && sessionQuests.length > 0) {
      const activeQuests = sessionQuests.filter(q => q.status === 'active');
      if (activeQuests.length > 0) {
        const questLines = activeQuests.slice(0, 3).map(q => {
          const template = questTemplates.find(t => t.id === q.templateId);
          const name = template?.name || q.templateId;
          const objProgress = q.objectives
            ?.filter(o => o.isVisible)
            .map(o => o.isCompleted ? '✅' : '⬜')
            .join(' ') || '';
          return `- ${name} ${objProgress}`;
        });
        proactiveContextSections.push(
          `[Misiones Activas]\n` +
          questLines.join('\n') +
          `\nPuedes hacer referencia sutil a estas misiones o avanzar en ellas si es natural en la conversación.`
        );
      }
    }

    // 4. Recent conversation context (improved format)
    if (contextMsgCount > 0) {
      const recentMsgs = messages
        .filter((m: any) => !m.isDeleted && m.content?.trim())
        .slice(-(contextMsgCount * 2)); // *2 for both user and assistant messages
      if (recentMsgs.length > 0) {
        const contextLines = recentMsgs.map((m: any) => {
          const speaker = m.role === 'user' ? effectiveUserName : (effectiveCharacter?.name || 'Personaje');
          const maxChars = contextMsgMaxChars > 0 ? contextMsgMaxChars : 9999;
          const content = m.content.trim();
          const truncated = content.length > maxChars
            ? content.slice(0, maxChars) + '...'
            : content;
          return `${speaker}: ${truncated}`;
        });
        const contextSection = `[Contexto reciente de la conversación]\n` +
          `Esto es lo que se ha hablado últimamente:\n` +
          contextLines.join('\n') + '\n' +
          `Usa este contexto para que tu mensaje sea coherente con la conversación actual. ` +
          `No repitas lo que ya se dijo; en su lugar, continúa naturalmente desde aquí.`;
        proactiveContextSections.push(contextSection);
      }
    }

    // 5. Abandoned topic detection (if enabled)
    if (proactiveConfig.retomarAbandonedTopics) {
      const threshold = proactiveConfig.abandonedTopicThreshold ?? 10;
      const nonDeletedMessages = messages.filter((m: any) => !m.isDeleted);
      const totalMessages = nonDeletedMessages.length;
      
      if (totalMessages > threshold) {
        // Look at messages from the "mid-conversation" range (not too recent, not too old)
        // to find topics that were discussed but then abandoned
        const olderMessages = nonDeletedMessages.slice(
          Math.max(0, totalMessages - threshold * 3),
          Math.max(0, totalMessages - threshold)
        );
        const recentMessages = nonDeletedMessages.slice(Math.max(0, totalMessages - threshold));
        
        // Extract key phrases from older messages (simple heuristic)
        const olderContent = olderMessages
          .map((m: any) => m.content?.trim())
          .filter(Boolean)
          .join(' ');
        
        // Check if any recent proactive messages already covered older topics
        const recentProactiveTopics = recentMessages
          .filter((m: any) => m.metadata?.proactiveInfo?.topic)
          .map((m: any) => m.metadata.proactiveInfo.topic.toLowerCase());
        
        // Extract potential topics from older messages (nouns/key phrases)
        const topicIndicators = [
          'hablar de', 'mencionar', 'conversar sobre', 'discutir', 'hablar sobre',
          'tratar de', 'tocar el tema', 'mencionaste', 'dijiste que', 'mencionó',
          'preguntar por', 'interesarse en', 'curioso sobre',
        ];
        
        const abandonedTopics: string[] = [];
        for (const indicator of topicIndicators) {
          const idx = olderContent.toLowerCase().indexOf(indicator);
          if (idx !== -1) {
            // Extract the topic following the indicator
            const afterIndicator = olderContent.slice(idx + indicator.length).trim();
            const topicMatch = afterIndicator.match(/^(.{5,60}?)[.,;!?]/);
            if (topicMatch) {
              const topic = topicMatch[1].trim();
              // Check if this topic was NOT recently covered
              const wasCovered = recentProactiveTopics.some(t => 
                t.includes(topic.toLowerCase().slice(0, 10)) || 
                topic.toLowerCase().slice(0, 10).includes(t)
              );
              if (!wasCovered && !abandonedTopics.includes(topic)) {
                abandonedTopics.push(topic);
              }
            }
          }
        }
        
        if (abandonedTopics.length > 0) {
          proactiveContextSections.push(
            `[Temas abandonados que puedes retomar]\n` +
            `Se habló recientemente de: ${abandonedTopics.slice(0, 3).join(', ')}\n` +
            `Pero el tema parece haberse abandonado. Si es natural, puedes retomar alguno de estos temas ` +
            `en tu mensaje proactivo. No es obligatorio — solo si encaja con la conversación.`
          );
        }
      }
    }

    // 6. Thematic cooldown instruction (moved from nudge to system prompt when contextInSystemPrompt)
    const cooldownMinutes = proactiveConfig.thematicCooldownMinutes ?? 0;
    if (cooldownMinutes > 0 && clientRecentTopics.length > 0) {
      const topicList = clientRecentTopics.slice(0, 5).join(', ');
      proactiveContextSections.push(
        `[Evita repetir estos temas recientes: ${topicList}]`
      );
    }

    // Inject all context sections into system prompt (FASE 9)
    if (contextInSystemPrompt && proactiveContextSections.length > 0) {
      finalSystemPrompt += '\n\n' + proactiveContextSections.join('\n\n');
    }

    // ===== TOOL/ACTION SYSTEM (Native + Prompt-Based Tool Calling) =====
    const characterToolConfig = toolsSettings.characterConfigs.find(
      c => c.characterId === effectiveCharacter.id
    );
    const enabledToolIds = characterToolConfig?.enabledTools || [];
    let availableTools = enabledToolIds.length > 0
      ? getToolDefinitionsByIds(enabledToolIds)
      : getAllToolDefinitions();
    
    // Filter out globally disabled tools
    const globalDisabled = toolsSettings.disabledTools || [];
    if (globalDisabled.length > 0) {
      availableTools = availableTools.filter(t => !globalDisabled.includes(t.id));
    }
    
    const toolsEnabled = toolsSettings.enabled && availableTools.length > 0;

    // Resolve {{keys}} in tool descriptions and parameter descriptions
    if (toolsEnabled && availableTools.length > 0) {
      availableTools = resolveToolDefinitionsKeys(availableTools, keyContext);
    }

    // Determine if the current provider supports native tool calling
    const supportsNativeTools = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama', 'z-ai', 'grok', 'text-generation-webui', 'koboldcpp'].includes(llmConfig.provider);
    const shouldUseTools = toolsEnabled && supportsNativeTools && !toolsSettings.usePromptBasedFallback;

    // Only inject text-based tool instructions into the system prompt when the provider
    // does NOT support native tool calling.
    if (toolsEnabled && availableTools.length > 0 && !shouldUseTools) {
      const toolPromptSection = buildPromptBasedToolsSection(availableTools, effectiveCharacter.name);
      if (toolPromptSection) {
        finalSystemPrompt += `\n\n${toolPromptSection}`;
      }
    }

    if (shouldUseTools) {
      console.log(`[Tools] Native tool calling enabled for ${effectiveCharacter.name} (${llmConfig.provider}):`, availableTools.map(t => t.name));
    } else if (toolsEnabled && toolsSettings.usePromptBasedFallback) {
      console.log(`[Tools] Prompt-based fallback enabled for ${effectiveCharacter.name} (${llmConfig.provider}) - using text instructions in system prompt`);
    } else if (toolsEnabled && !supportsNativeTools) {
      console.log(`[Tools] Tools enabled but provider ${llmConfig.provider} does not support native tool calling - using prompt-based instructions`);
    } else if (!toolsEnabled) {
      console.log(`[Tools] Tools DISABLED. toolsSettings.enabled=${toolsSettings.enabled}, availableTools=${availableTools.length}`);
    }

    // Build proactive LLM config - keep user's configured values, only set defaults if not configured
    const proactiveLLMConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: llmConfig.parameters?.temperature ?? 0.9,
      },
    };

    // ─── FASE 3: Proactividad Inteligente ───
    // Build nudge message with template variables resolved
    // Support: nudge template rotation, context injection, thematic cooldown

    // 1. Select nudge template (with rotation if pool exists)
    const defaultNudgeMessage = `[La escena continúa] {{user}} parece distraído así que {{char}} decide hacer o decir algo para que todo continúe.`;

    // Build the full pool: primary nudgeTemplate + alternative nudgeTemplates
    const nudgePool: string[] = [];
    if (proactiveConfig.nudgeTemplate?.trim()) {
      nudgePool.push(proactiveConfig.nudgeTemplate.trim());
    }
    if (proactiveConfig.nudgeTemplates && proactiveConfig.nudgeTemplates.length > 0) {
      for (const tmpl of proactiveConfig.nudgeTemplates) {
        if (tmpl.trim() && !nudgePool.includes(tmpl.trim())) {
          nudgePool.push(tmpl.trim());
        }
      }
    }
    // If pool is empty, add default
    if (nudgePool.length === 0) {
      nudgePool.push(defaultNudgeMessage);
    }

    // Select nudge template with rotation (avoid repeating recently used)
    let selectedNudgeIndex = 0;
    if (nudgePool.length > 1) {
      // Find indices not recently used
      const unusedIndices = nudgePool.map((_, i) => i).filter(i => !clientUsedNudgeIndices.includes(i));
      if (unusedIndices.length > 0) {
        // Pick a random one from unused
        selectedNudgeIndex = unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
      } else {
        // All recently used, reset rotation - pick random
        selectedNudgeIndex = Math.floor(Math.random() * nudgePool.length);
      }
    }
    const rawNudgeMessage = nudgePool[selectedNudgeIndex];

    // 2. Build context snippet from recent messages (if enabled)
    // FASE 9: Only append to nudge if contextInSystemPrompt is false
    // (if true, context was already injected into the system prompt above)
    let contextSnippet = '';
    if (!contextInSystemPrompt && contextMsgCount > 0) {
      const recentMsgs = messages
        .filter((m: any) => !m.isDeleted && m.content?.trim())
        .slice(-(contextMsgCount * 2)); // *2 because we include both user and assistant messages
      if (recentMsgs.length > 0) {
        const contextLines = recentMsgs.map((m: any) => {
          const speaker = m.role === 'user' ? effectiveUserName : (effectiveCharacter?.name || 'Personaje');
          const maxChars = contextMsgMaxChars > 0 ? contextMsgMaxChars : 9999;
          const content = m.content.trim();
          const truncated = content.length > maxChars
            ? content.slice(0, maxChars) + '...'
            : content;
          return `${speaker}: ${truncated}`;
        });
        contextSnippet = `\n\n[Contexto reciente de la conversación]\n${contextLines.join('\n')}`;
      }
    }

    // 3. Build thematic cooldown instruction (if enabled)
    // FASE 9: Only append to nudge if contextInSystemPrompt is false
    let cooldownInstruction = '';
    if (!contextInSystemPrompt && cooldownMinutes > 0 && clientRecentTopics.length > 0) {
      const topicList = clientRecentTopics.slice(0, 5).join(', ');
      cooldownInstruction = `\n\n[Evita repetir estos temas recientes: ${topicList}. Elige un tema diferente o enfoque nuevo para tu mensaje.]`;
    }

    // 4. Resolve all keys in the nudge
    let nudgeContent = resolveAllKeys(rawNudgeMessage, keyContext);

    // 5. Append context and cooldown to the nudge content (only if not already in system prompt)
    if (contextSnippet) {
      nudgeContent += contextSnippet;
    }
    if (cooldownInstruction) {
      nudgeContent += cooldownInstruction;
    }

    // Add proactive instruction, context, and nudge sections to prompt viewer
    allPromptSections.push(
      {
        type: 'instructions',
        label: '✨ Proactive Message Instruction',
        content: proactiveInstruction,
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      },
    );
    // Add FASE 9 context sections to prompt viewer
    if (proactiveContextSections.length > 0) {
      allPromptSections.push({
        type: 'system',
        label: '🧠 Contexto para Proactividad (FASE 9)',
        content: proactiveContextSections.join('\n\n'),
        color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      });
    }
    allPromptSections.push(
      {
        type: 'user',
        label: '✨ Nudge (Proactive User Message)',
        content: nudgeContent,
        color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200',
      }
    );

    // Build the allMessages array:
    // - Summary message (if exists)
    // - Context window messages
    // - Nudge message (as the last user message)
    let allMessages: ChatMessage[] = summaryMessage
      ? [summaryMessage, ...finalContextWindow.messages]
      : [...finalContextWindow.messages];

    // Add nudge as the last user message
    allMessages = [...allMessages, {
      id: 'nudge-' + Date.now(),
      role: 'user' as const,
      characterId: effectiveCharacter.id,
      content: nudgeContent,
      isDeleted: false,
      timestamp: new Date().toISOString(),
      swipeId: 'nudge',
      swipeIndex: 0,
      swipes: [nudgeContent],
    }]

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send proactive_start as the FIRST event
          controller.enqueue(createSSEJSON({
            type: 'proactive_start',
            characterId: effectiveCharacter.id,
            characterName: effectiveCharacter.name,
            reason,
            nudgeIndex: selectedNudgeIndex,
          }));

          // Send prompt data
          controller.enqueue(createSSEJSON({
            type: 'prompt_data',
            promptSections: finalAllPromptSections
          }));

          // DEBUG: Send lorebook attribute resolution debug data
          if (lorebookDebugEntries && lorebookDebugEntries.length > 0) {
            controller.enqueue(createSSEJSON({
              type: 'lorebook_debug',
              ...lorebookDebugData,
            }));
          }
          
          // Send embeddings context metadata to the client for UI display
          if (embeddingsResult.found) {
            controller.enqueue(createSSEJSON({
              type: 'embeddings_context',
              data: formatEmbeddingsForSSE(embeddingsResult)
            }));
          }

          let generator: AsyncGenerator<string>;

          // Get post-history instructions from character and RESOLVE ALL KEYS
          const rawPostHistoryInstructions = effectiveCharacter.postHistoryInstructions?.trim();
          const postHistoryInstructions = rawPostHistoryInstructions 
            ? resolveAllKeys(rawPostHistoryInstructions, keyContext)
            : undefined;

          // Route to appropriate provider
          let accumulatedContent = '';
          const maxToolRounds = toolsSettings.maxToolCallsPerTurn || 2;
          let toolRound = 0;
          let toolContextMessages: Array<Record<string, unknown>> = [];
          let allToolsUsed: Array<{ name: string; label: string; icon: string; success: boolean }> = [];
          let allQuestActivations: QuestActivation[] = [];

          // Build the initial chat messages once (shared across tool rounds)
          let baseChatMessages: import('@/lib/llm/types').ChatApiMessage[] | null = null;
          let baseSystemPrompt: string | null = null;

          while (toolRound <= maxToolRounds) {
            let generator: AsyncGenerator<string>;
            let isToolRound = toolRound > 0;

            if (toolRound === 0) {
              baseSystemPrompt = finalSystemPrompt;
            }

            // Route to appropriate provider
            switch (llmConfig.provider) {
              case 'test-mock': {
                console.log('[Proactive] Using TEST-MOCK provider');
                const mockResponse = llmConfig.mockResponse || `*Suspira pensativamente* ¿Sabes? Se me ocurre que podríamos hacer algo interesante...`;
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
                let chatMessages = buildChatMessages(
                  baseSystemPrompt || finalSystemPrompt,
                  allMessages,
                  effectiveCharacter,
                  effectiveUserName,
                  effectiveCharacter.postHistoryInstructions?.trim(),
                  undefined, true, embeddingsContext,
                  lorebookChatInjections,
                  exampleMessages
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  // First call with tools
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamZAIWithTools(chatMessages, availableTools, accumulator, zaiRuntimeToken);

                  // BUFFER content - don't stream to client yet
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  console.log(`[Z.ai+Tools] Round 0 buffered ${roundContent.length} chars, finishReason=${accumulator.finishReason}, nativeToolCalls=${accumulator.toolCalls.length}`);

                  // Check for native tool calls
                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = toolResult.toolResults.length > 0
                        ? toolResult.toolResults
                        : accumulator.toolCalls.map(tc => ({
                            success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
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
                    console.log(`[Z.ai+Tools] Content might contain text-based tool call, attempting parse...`);
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Z.ai+Tools] Text-based tool call(s) detected: ${textToolCalls.map(tc => tc.name).join(', ')}`);
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${toolResult.newContent}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
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
                    // No tool calls detected - stream the buffered content (clean artifacts)
                    const cleanedZaiContent = cleanModelArtifacts(roundContent);
                    for (const chunk of splitIntoChunks(cleanedZaiContent)) {
                      controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                    }
                    accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  }
                } else if (isToolRound && toolContextMessages.length > 0) {
                  // Follow-up call after tool execution
                  console.log(`[Z.ai+Tools] Tool round ${toolRound}: sending ${toolContextMessages.length} messages (incl. tool results)`);
                  generator = streamZAI(toolContextMessages, zaiRuntimeToken);
                  for await (const chunk of generator) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                } else {
                  // No tools enabled - normal streaming
                  generator = streamZAI(chatMessages, zaiRuntimeToken);
                  for await (const chunk of generator) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                }
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
                  undefined, true, embeddingsContext,
                  lorebookChatInjections,
                  exampleMessages
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamOpenAIWithTools(chatMessages, proactiveLLMConfig, llmConfig.provider, availableTools, accumulator);

                  // BUFFER content - don't stream to client yet
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  console.log(`[Tools] Round 0 buffered ${roundContent.length} chars, finishReason=${accumulator.finishReason}, nativeToolCalls=${accumulator.toolCalls.length}`);

                  // Check for native tool calls first
                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = toolResult.toolResults.length > 0
                        ? toolResult.toolResults
                        : accumulator.toolCalls.map(tc => ({
                            success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
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
                    console.log(`[Tools] Content might contain text-based tool call, attempting parse...`);
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Tools] ✓ Text-based tool call(s) detected: ${textToolCalls.map(tc => tc.name).join(', ')}`);
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${toolResult.newContent}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
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
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up call with tool results
                  generator = streamOpenAICompatible(toolContextMessages as any, proactiveLLMConfig, llmConfig.provider);
                } else {
                  generator = streamOpenAICompatible(chatMessages, proactiveLLMConfig, llmConfig.provider);
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
                  undefined, true, embeddingsContext,
                  lorebookChatInjections,
                  exampleMessages
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  baseChatMessages = chatMessages;
                  const toolState = createAnthropicToolState();
                  generator = streamAnthropicWithTools(chatMessages, proactiveLLMConfig, availableTools, toolState);

                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  const toolCalls = anthropicStateToToolCalls(toolState);
                  if (toolCalls.length > 0 && (toolState.stopReason === 'tool_use')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = toolResult.toolResults.length > 0
                        ? toolResult.toolResults
                        : toolCalls.map(tc => ({
                            success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${toolResult.newContent}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
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
                  generator = streamAnthropic(toolContextMessages as any, proactiveLLMConfig);
                } else {
                  generator = streamAnthropic(chatMessages, proactiveLLMConfig);
                }
                break;
              }

              case 'ollama': {
                console.log(`[Proactive] Ollama case: shouldUseTools=${shouldUseTools}, isToolRound=${isToolRound}, toolRound=${toolRound}`);
                if (shouldUseTools && !isToolRound) {
                  let chatMessages = buildChatMessages(
                    baseSystemPrompt || finalSystemPrompt,
                    allMessages,
                    effectiveCharacter,
                    effectiveUserName,
                    effectiveCharacter.postHistoryInstructions?.trim(),
                    undefined, true, embeddingsContext,
                    lorebookChatInjections,
                  exampleMessages
                  );
                  if (hudContextSection && hudContext) {
                    chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                  }
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamOllamaWithTools(chatMessages, proactiveLLMConfig, availableTools, accumulator);

                  // BUFFER content for tool call detection
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  if (hasToolCalls(accumulator)) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = toolResult.toolResults.length > 0
                        ? toolResult.toolResults
                        : accumulator.toolCalls.map(tc => ({
                            success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${toolResult.newContent}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
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
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  const toolFollowAccumulator = createToolCallAccumulator(availableTools);
                  generator = streamOllamaWithTools(toolContextMessages as any, proactiveLLMConfig, [], toolFollowAccumulator);
                } else {
                  const prompt = buildCompletionPrompt({
                    systemPrompt: baseSystemPrompt || finalSystemPrompt,
                    messages: allMessages,
                    character: effectiveCharacter,
                    userName: effectiveUserName,
                    postHistoryInstructions: effectiveCharacter.postHistoryInstructions?.trim(),
                    embeddingsContext: embeddingsContext,
                    exampleMessages: exampleMessages,
                    allCharacters: allCharacters  // Pass all characters for proper speaker attribution
                  });
                  generator = streamOllama(prompt, proactiveLLMConfig);
                }
                break;
              }

              case 'grok': {
                console.log(`[Proactive] Grok case: shouldUseTools=${shouldUseTools}, isToolRound=${isToolRound}, toolRound=${toolRound}`);
                let chatMessages = buildChatMessages(
                  baseSystemPrompt || finalSystemPrompt,
                  allMessages,
                  effectiveCharacter,
                  effectiveUserName,
                  effectiveCharacter.postHistoryInstructions?.trim(),
                  undefined, true, embeddingsContext,
                  lorebookChatInjections,
                  exampleMessages
                );
                if (hudContextSection && hudContext) {
                  chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                }

                if (shouldUseTools && !isToolRound) {
                  baseChatMessages = chatMessages;
                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamGrokWithTools(chatMessages, proactiveLLMConfig, availableTools, accumulator);

                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  console.log(`[Grok+Tools] Round 0 buffered ${roundContent.length} chars, finishReason=${accumulator.finishReason}, nativeToolCalls=${accumulator.toolCalls.length}`);

                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = toolResult.toolResults.length > 0
                        ? toolResult.toolResults
                        : accumulator.toolCalls.map(tc => ({
                            success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
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
                    const textToolCalls = parseAllToolCallsFromText(roundContent);
                    if (textToolCalls.length > 0) {
                      console.log(`[Grok+Tools] Text-based tool call(s) detected: ${textToolCalls.map(tc => tc.name).join(', ')}`);
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        const toolNames = textToolCalls.map(tc => tc.name).join(', ');
                        toolContextMessages = [
                          ...baseChatMessages,
                          { role: 'user', content: `[Resultado de herramientas: ${toolNames}]\n${toolResult.newContent}\n\nResponde de forma natural usando esta información. No menciones las herramientas ni el proceso interno.` },
                        ] as any;
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    }
                  }

                  // No tool calls detected - stream buffered content (clean artifacts)
                  console.log(`[Grok+Tools] No tool calls detected, streaming ${accumulatedContent.length} chars`);
                  const cleanedGrokContent = cleanModelArtifacts(accumulatedContent);
                  for (const chunk of splitIntoChunks(cleanedGrokContent)) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  generator = streamGrokWithTools(toolContextMessages as any, proactiveLLMConfig, [], createToolCallAccumulator(availableTools));
                } else {
                  generator = streamGrok(chatMessages, proactiveLLMConfig);
                }
                break;
              }

              case 'text-generation-webui':
              case 'koboldcpp': {
                if (shouldUseTools) {
                  console.log(`[Proactive] TextGenerationWebUI case: shouldUseTools=${shouldUseTools}`);
                  let chatMessages = buildChatMessages(
                    baseSystemPrompt || finalSystemPrompt,
                    allMessages,
                    effectiveCharacter,
                    effectiveUserName,
                    effectiveCharacter.postHistoryInstructions?.trim(),
                    undefined, true, embeddingsContext,
                    lorebookChatInjections,
                  exampleMessages
                  );
                  if (hudContextSection && hudContext) {
                    chatMessages = injectHUDContextIntoMessages(chatMessages, hudContextSection, hudContext.position);
                  }

                  const accumulator = createToolCallAccumulator(availableTools);
                  generator = streamTextGenerationWebUIWithTools(chatMessages, proactiveLLMConfig, availableTools, accumulator);

                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  console.log(`[TextGenWebUI+Tools] Round buffered ${roundContent.length} chars, finishReason=${accumulator.finishReason}, toolCalls=${accumulator.toolCalls.length}`);

                  if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                    if (roundContent.trim()) {
                      for (const chunk of splitIntoChunks(roundContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                    }
                    const toolResult = await executeToolCallsAndContinue(
                      accumulator.toolCalls, availableTools, toolRound, maxToolRounds,
                      effectiveCharacter, sessionId || '', effectiveUserName, controller,
                      sessionQuests, questTemplates,
                      effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory,
                      lorebooks
                    );
                    allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                    allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                    if (toolResult.shouldContinue) {
                      const toolResultPairs = accumulator.toolCalls.map(tc => ({
                        success: true, displayMessage: toolResult.newContent || `[${tc.name} ejecutada]`
                      }));
                      const tgwToolContextMessages = [
                        ...chatMessages,
                        ...buildToolMessagesForOpenAI(accumulator.toolCalls, toolResultPairs),
                      ];
                      accumulatedContent = '';
                      toolRound++;
                      toolContextMessages = tgwToolContextMessages as any;
                      continue;
                    }
                  }

                  // No tool calls detected - stream buffered content (clean artifacts)
                  console.log(`[TextGenWebUI+Tools] No tool calls detected, streaming ${roundContent.length} chars`);
                  const cleanedTGWContent = cleanModelArtifacts(roundContent);
                  for (const chunk of splitIntoChunks(cleanedTGWContent)) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else {
                  if (!proactiveLLMConfig.endpoint) {
                    throw new Error(`${llmConfig.provider} requires an endpoint URL`);
                  }
                  const prompt = buildCompletionPrompt({
                    systemPrompt: baseSystemPrompt || finalSystemPrompt,
                    messages: allMessages,
                    character: effectiveCharacter,
                    userName: effectiveUserName,
                    postHistoryInstructions: effectiveCharacter.postHistoryInstructions?.trim(),
                    embeddingsContext: embeddingsContext,
                    exampleMessages: exampleMessages,
                    allCharacters: allCharacters  // Pass all characters for proper speaker attribution
                  });
                  generator = streamTextGenerationWebUI(prompt, proactiveLLMConfig);
                }
                break;
              }

              default: {
                const prompt = buildCompletionPrompt({
                  systemPrompt: baseSystemPrompt || finalSystemPrompt,
                  messages: allMessages,
                  character: effectiveCharacter,
                  userName: effectiveUserName,
                  postHistoryInstructions: effectiveCharacter.postHistoryInstructions?.trim(),
                  embeddingsContext: embeddingsContext,
                  exampleMessages: exampleMessages,
                  allCharacters: allCharacters  // Pass all characters for proper speaker attribution
                });
                generator = streamTextGenerationWebUI(prompt, proactiveLLMConfig);
                break;
              }
            }

            // Send updated prompt_data for tool call follow-up rounds
            if (isToolRound && toolContextMessages.length > 0) {
              const toolContextContent = toolContextMessages
                .map((msg) => {
                  const role = (msg.role as string) || 'unknown';
                  const content = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content, null, 2);
                  const truncated = content.length > 2000
                    ? content.slice(0, 2000) + '\n... [truncated]'
                    : content;
                  return `[${role}]: ${truncated}`;
                })
                .join('\n\n');

              const followUpSections: PromptSection[] = [
                ...allPromptSections,
                {
                  type: 'instructions' as const,
                  label: `[Tool Follow-up — Round ${toolRound}]`,
                  content: toolContextContent,
                  color: 'text-amber-400',
                },
              ];
              controller.enqueue(createSSEJSON({
                type: 'prompt_data',
                promptSections: followUpSections,
              }));
            }

            // Stream the response
            // For tool rounds: buffer → clean artifacts → stream
            // For normal rounds: stream directly
            if (isToolRound) {
              let followUpContent = '';
              for await (const chunk of generator) {
                followUpContent += chunk;
              }
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

          // ========================================
          // Memory Reinforcement
          // ========================================
          if (accumulatedContent.length > 50 && embeddingsResult?.searchedNamespaces?.length > 0) {
            const reinforcementEnabled = isReinforcementEnabled(embeddingsChat);
            if (reinforcementEnabled) {
              const reinforcementNamespaces = embeddingsResult.searchedNamespaces.filter(
                ns => ns.startsWith('memory-')
              );
              
              if (reinforcementNamespaces.length > 0) {
                // Fire and forget - don't block the response
                setTimeout(async () => {
                  try {
                    const threshold = embeddingsChat.memoryReinforcementThreshold || 0.7;
                    const result = await processResponseAndReinforceMemories(
                      accumulatedContent,
                      reinforcementNamespaces,
                      true,
                      threshold
                    );
                    
                    if (result.reinforced > 0) {
                      console.log(`[MemoryReinforcement] Reinforced ${result.reinforced} memories`);
                    }
                  } catch (err) {
                    console.warn('[MemoryReinforcement] Failed:', err);
                  }
                }, 0);
              }
            }
          }

          // Check if memory extraction should trigger
          // The client will handle the actual extraction call after receiving 'done'.
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

          console.log(`[Memory] Proactive extraction check: enabled=${extractionEnabled}, turns=${turnCount}, freq=${extractionFrequency}, contentLen=${accumulatedContent.length}, shouldExtract=${shouldExtract}`);

          // Send done signal with shouldExtract flag so client can trigger extraction
          controller.enqueue(createSSEJSON({ 
            type: 'done',
            toolsUsed: allToolsUsed,
            questActivations: allQuestActivations,
            isProactive: true,
            characterId: effectiveCharacter.id,
            characterName: effectiveCharacter.name,
            reason,
            shouldExtract,
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
      error instanceof Error ? error.message : 'Failed to generate proactive message',
      500
    );
  }
}
