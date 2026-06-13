// ============================================
// Chat Stream Route - Simplified with unified key resolution
// ============================================
//
// Key resolution happens in buildSystemPrompt():
// - Template variables: {{user}}, {{char}}, {{userpersona}}
// - Stats keys: {{resistencia}}, {{habilidades}}, etc.
// - All sections are processed consistently

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance, SessionSummary, SoundTrigger, AppSettings, CharacterStatsConfig, CharacterMemory, InventoryV2Settings, PersonaInventoryEntry, Item, ActiveConsumableEffect, SessionEquipmentEntry } from '@/types';
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
  buildInventorySection,
  injectHUDContextIntoMessages,
  injectHUDContextIntoSections,
  resolveAllKeys,
  buildKeyResolutionContext,
  resolveStats,
  type InventoryPromptData,
} from '@/lib/llm';
import {
  validateRequest,
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
  finalizeToolCalls,
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

export async function POST(request: NextRequest) {
  try {
    // Capture auth headers from Z.ai gateway for token resolution
    // Only use actual JWT tokens - session IDs are NOT valid X-Tokens
    const incomingXToken = request.headers.get('X-Token');
    const fcSecurityToken = request.headers.get('x-fc-security-token');

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
    
    // Extract character memory (events, relationships, notes from Zustand store)
    const characterMemory: CharacterMemory | undefined = body.characterMemory;
    
    // Extract tools settings for tool/action system (native tool calling only)
    const toolsSettings: ToolsSettings = {
      enabled: body.toolsSettings?.enabled ?? true,
      maxToolCallsPerTurn: body.toolsSettings?.maxToolCallsPerTurn ?? 4,
      characterConfigs: body.toolsSettings?.characterConfigs || [],
      usePromptBasedFallback: body.toolsSettings?.usePromptBasedFallback ?? false,
      disabledTools: body.toolsSettings?.disabledTools || [],
    };

    // Extract inventory data for Inventory V2 system
    const inventoryData: InventoryPromptData | undefined = body.inventoryData;

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
    // The SDK v0.0.17+ reads config from /etc/.z-ai-config and uses the "token" field for X-Token.
    // Gateway headers are passed as runtime overrides to the provider.
    let zaiRuntimeToken: string | undefined;
    if (llmConfig.provider === 'z-ai') {
      // Only use actual auth tokens (not session IDs)
      const gatewayToken = incomingXToken || fcSecurityToken || undefined;
      if (gatewayToken) {
        zaiRuntimeToken = gatewayToken;
        console.log(`[Stream Route] Z.ai runtime token available (${gatewayToken.length} chars, source: ${incomingXToken ? 'X-Token' : 'fc-security-token'})`);
      } else {
        console.log(`[Stream Route] Z.ai: no gateway token available, using config file only`);
      }
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
    const { plan: lorebookPlan, lorebookAttributeKeys, lorebookEntryKeyMap, lorebookDebugEntries } = buildLorebookSectionForPrompt(
      messages,
      lorebooks,
      {
        scanDepth: contextConfig.scanDepth,
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

    // Smart truncation: limit query to the embedding model's context window.
    // Prioritize the user's CURRENT message over history when truncating.
    // The Ollama client also handles truncation, but this avoids sending huge payloads.
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
        // Smart: keep the user's message intact, truncate history prefix
        const userMsgLen = sanitizedMessage.length;
        if (userMsgLen >= maxQueryChars) {
          // User message alone exceeds limit — truncate it
          enrichedSearchQuery = sanitizedMessage.slice(0, maxQueryChars);
        } else {
          // Keep full user message + as much recent history as fits
          const budgetForHistory = maxQueryChars - userMsgLen - 1; // -1 for separator
          enrichedSearchQuery = enrichedSearchQuery.slice(
            Math.max(0, enrichedSearchQuery.length - maxQueryChars)
          );
        }
        console.warn(
          `[Stream Route] Search query trimmed to ${enrichedSearchQuery.length} chars ` +
          `(model: ${modelKey}, context: ${modelCtx} tokens)`
        );
      }
    } catch { /* fallback: no truncation at this level, Ollama client handles it */ }

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
    const { prompt: systemPrompt, sections: systemSections, lorebookChatInjections, exampleMessages } = buildSystemPrompt(
      effectiveCharacter,
      effectiveUserName,
      persona,
      lorebookPlan,
      sessionStats,
      allCharacters, // Pass all characters for peticiones/solicitudes resolution
      soundTriggers, // Pass soundTriggers for {{sonidos}} resolution
      soundSettings,  // Pass sound settings for {{sonidos}} template
      questTemplates,  // Pass quest templates for {{activeQuests}} key resolution
      sessionQuests,   // Pass session quests for {{activeQuests}} key resolution
      questSettings,    // Pass quest settings for {{activeQuests}} key resolution
      lorebookAttributeKeys,
      inventoryData,    // Pass inventory data for Inventory V2 section
      lorebookEntryKeyMap // Pass lorebook entry key map for {{entryKey}} resolution
    );

    // Session stats now already include item effects (applied directly to SessionStats
    // when items are activated/equipped in the store). No need for virtual overlay.
    const effectiveSessionStats = sessionStats;

    // Resolve persona stats first for comprehensive key resolution
    let streamPersonaResolvedStats: import('@/types').ResolvedStats | null = null;
    if (persona?.statsConfig?.enabled && effectiveSessionStats) {
      streamPersonaResolvedStats = resolveStats({
        characterId: '__user__',
        statsConfig: persona.statsConfig,
        sessionStats: effectiveSessionStats,
      });
    }
    const resolvedStats = resolveStats({
      characterId: effectiveCharacter.id,
      statsConfig: effectiveCharacter.statsConfig,
      sessionStats: effectiveSessionStats,
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
      sessionStats,  // Pass sessionStats for {{eventos}} key resolution
      soundTriggers,   // Pass soundTriggers for {{sonidos}} key resolution
      soundSettings,  // Pass sound settings for {{sonidos}} template
      streamPersonaResolvedStats,  // Pass persona resolved stats
      questTemplates,  // Pass quest templates for {{activeQuests}}
      sessionQuests,   // Pass session quests for {{activeQuests}}
      questSettings,    // Pass quest settings
      outletSections,   // Pass outlet sections for {{outlet::name}}
      lorebookAttributeKeys,  // Pass lorebook attribute keys for {{injectionKey}}
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
        swipeIndex: 0
      };
    }

    // Combine all sections in order for prompt viewer
    // Order: System -> Summary -> Quest -> Character Memory -> [CONTEXTO] non-memory -> [MEMORIA] memory -> Chat History -> Post-History
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
      ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []),  // Non-memory: before chat
      ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []),  // Memory: before chat
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

    // Only include Character Memory content if embeddings didn't find any memory results,
    // or if embeddings are disabled. When embeddings ARE active and found memory, the
    // dedup already ensures we don't have exact duplicates, but there can be semantic overlap.
    // The [MEMORIA RELEVANTE] section from embeddings is more targeted/relevant.
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

    // Build the final system prompt (tools only, quest content resolved via {{activeQuests}} key)
    let finalSystemPrompt = systemPrompt;

    // ===== TOOL/ACTION SYSTEM (Native + Prompt-Based Tool Calling) =====
    // Build available tools for this character
    const characterToolConfig = toolsSettings.characterConfigs.find(
      c => c.characterId === effectiveCharacter.id
    );
    const enabledToolIds = characterToolConfig?.enabledTools || [];
    let availableTools = enabledToolIds.length > 0
      ? getToolDefinitionsByIds(enabledToolIds)
      : getAllToolDefinitions(); // All tools enabled if no specific config
    
    // Filter out globally disabled tools
    const globalDisabled = toolsSettings.disabledTools || [];
    if (globalDisabled.length > 0) {
      availableTools = availableTools.filter(t => !globalDisabled.includes(t.id));
    }
    
    const toolsEnabled = toolsSettings.enabled && availableTools.length > 0;

    // Resolve {{keys}} in tool descriptions and parameter descriptions
    // This ensures {{user}}, {{char}}, {{userpersona}}, stats keys, etc.
    // are properly replaced before tools are sent to the LLM (both native and prompt-based)
    if (toolsEnabled && availableTools.length > 0) {
      availableTools = resolveToolDefinitionsKeys(availableTools, keyContext);
    }

    // Determine if the current provider supports native tool calling
    const supportsNativeTools = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama', 'z-ai', 'grok', 'text-generation-webui', 'koboldcpp'].includes(llmConfig.provider);
    // If usePromptBasedFallback is true, disable native tools so prompt-based injection is used instead
    const shouldUseTools = toolsEnabled && supportsNativeTools && !toolsSettings.usePromptBasedFallback;

    // Only inject text-based tool instructions into the system prompt when the provider
    // does NOT support native tool calling. Models with native tool calling (Ollama, OpenAI,
    // Anthropic) will receive tools via the API body, and injecting text instructions
    // CONFUSES them — they end up outputting ```tool_call``` as text instead of using
    // the native tool_calls mechanism.
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

    // Re-evaluate context window with reserved tokens for summary + embeddings
    // This reduces chat history when summary/embeddings use significant budget
    const summaryTokens = summary?.content ? estimateContentTokens(`[RECUERDOS ANTERIORES]\n${summary.content}`) : 0;
    const embeddingsTokens = embeddingsContext ? estimateContentTokens(embeddingsContext) : 0;
    const reservedTokens = summaryTokens + embeddingsTokens;
    
    let finalContextWindow = contextWindow;
    if (reservedTokens > 200) {
      // Re-apply context window with reduced budget
      const adjustedConfig: Partial<ContextConfig> = {
        ...contextConfig,
        reservedTokens,
      };
      finalContextWindow = selectContextMessages(messages, llmConfig, adjustedConfig);
      console.log(`[Context Budget] Reserved ${reservedTokens} tokens (summary: ${summaryTokens}, embeddings: ${embeddingsTokens}). Chat messages: ${contextWindow.messages.length} → ${finalContextWindow.messages.length}`);
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

    // Prepare messages with new user message (use context-windowed messages)
    // Check if the last message is already the user's current message to avoid duplicates.
    // The frontend adds the message to the store BEFORE sending the request, so the
    // messages array may already contain the user's message. Without this check, the
    // message gets duplicated → buildChatMessages merges them → LLM sees "hola\nhola".
    const lastCtxMessage = finalContextWindow.messages[finalContextWindow.messages.length - 1];
    const isLastMessageCurrentUser = lastCtxMessage?.role === 'user' &&
      lastCtxMessage?.content === sanitizedMessage;

    // Inject summary at the START of chat history if it exists
    let allMessages = summaryMessage
      ? [summaryMessage, ...finalContextWindow.messages]
      : [...finalContextWindow.messages];

    if (!isLastMessageCurrentUser) {
      allMessages = [...allMessages, createUserMessage(sanitizedMessage)];
    }

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send prompt data at the start
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
          let allToolsUsed: Array<{ name: string; label: string; icon: string; success: boolean }> = [];
          let allQuestActivations: import('@/types').QuestActivation[] = [];

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
                      const toolResult = await executeToolCallsAndContinue(
                        textToolCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        toolContextMessages = [
                          ...baseChatMessages,
                          ...buildToolMessagesForOpenAI(textToolCalls, toolResult.toolResults),
                        ];
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    }
                  }

                  // No tool calls detected - stream the buffered content (clean artifacts)
                  console.log(`[Z.ai+Tools] No tool calls detected, streaming ${roundContent.length} chars`);
                  const cleanedZaiContent = cleanModelArtifacts(roundContent);
                  for (const chunk of splitIntoChunks(cleanedZaiContent)) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                  // Fix: Update accumulatedContent to cleaned version
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                } else if (isToolRound && toolContextMessages.length > 0) {
                  // Follow-up call after tool execution - include tools so the character can chain actions
                  const canUseMoreTools = shouldUseTools && toolRound < maxToolRounds;
                  if (canUseMoreTools) {
                    console.log(`[Z.ai+Tools] Tool round ${toolRound}: sending ${toolContextMessages.length} messages with tools (character can chain actions)`);
                    const accumulator = createToolCallAccumulator(availableTools);
                    generator = streamZAIWithTools(toolContextMessages, availableTools, accumulator, zaiRuntimeToken);

                    // Buffer content for potential tool call detection
                    let roundContent = '';
                    for await (const chunk of generator) {
                      roundContent += chunk;
                      accumulatedContent += chunk;
                    }

                    const toolCalls = finalizeToolCalls(accumulator);
                    if (toolCalls.length > 0 && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                      // Another tool call detected - stream buffered content and execute
                      if (roundContent.trim()) {
                        for (const chunk of splitIntoChunks(roundContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const toolResult = await executeToolCallsAndContinue(
                        toolCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      toolContextMessages = buildToolMessagesForOpenAI(toolContextMessages, toolCalls, toolResult);
                      toolRound++;
                      isToolRound = true;
                      continue;
                    } else {
                      // No more tool calls - stream the response
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                      accumulatedContent = cleanModelArtifacts(accumulatedContent);
                    }
                  } else {
                    console.log(`[Z.ai+Tools] Tool round ${toolRound}: sending ${toolContextMessages.length} messages (final round, no tools)`);
                    generator = streamZAI(toolContextMessages, zaiRuntimeToken);
                    for await (const chunk of generator) {
                      controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                    }
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
                      const toolResult = await executeToolCallsAndContinue(
                        nativeCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...toolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...toolResult.questActivations];
                      if (toolResult.shouldContinue) {
                        // For text-based calls, inject as user message with tool context
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
                  // Fix: Update accumulatedContent to cleaned version so memory extraction/reinforcement
                  // operates on clean text (without model artifacts, tool syntax, etc.)
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up call with tool results - include tools so the character can chain actions
                  const canUseMoreTools = toolRound < maxToolRounds;
                  if (canUseMoreTools) {
                    console.log(`[OpenAI+Tools] Tool round ${toolRound}: sending tool results with tools (character can chain actions)`);
                    const accumulator = createToolCallAccumulator(availableTools);
                    generator = streamOpenAIWithTools(toolContextMessages as any, llmConfig, availableTools, accumulator);

                    let roundContent = '';
                    for await (const chunk of generator) {
                      roundContent += chunk;
                      accumulatedContent += chunk;
                    }

                    const toolCalls = finalizeToolCalls(accumulator);
                    if (toolCalls.length > 0 && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                      if (roundContent.trim()) {
                        for (const chunk of splitIntoChunks(roundContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const toolResult = await executeToolCallsAndContinue(
                        toolCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      toolContextMessages = buildToolMessagesForOpenAI(toolContextMessages, toolCalls, toolResult);
                      toolRound++;
                      isToolRound = true;
                      continue;
                    } else {
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                      accumulatedContent = cleanModelArtifacts(accumulatedContent);
                    }
                  } else {
                    generator = streamOpenAICompatible(toolContextMessages as any, llmConfig, llmConfig.provider);
                  }
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
                  // Follow-up call with tool results - include tools so the character can chain actions
                  const canUseMoreTools = toolRound < maxToolRounds;
                  if (canUseMoreTools) {
                    console.log(`[Anthropic+Tools] Tool round ${toolRound}: sending tool results with tools (character can chain actions)`);
                    const toolState = createAnthropicToolState();
                    generator = streamAnthropicWithTools(toolContextMessages as any, llmConfig, availableTools, toolState);

                    let roundContent = '';
                    for await (const chunk of generator) {
                      roundContent += chunk;
                      accumulatedContent += chunk;
                    }

                    const toolCalls = anthropicStateToToolCalls(toolState);
                    if (toolCalls.length > 0 && toolState.stopReason === 'tool_use') {
                      if (roundContent.trim()) {
                        for (const chunk of splitIntoChunks(roundContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const toolResult = await executeToolCallsAndContinue(
                        toolCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      toolContextMessages = buildToolMessagesForAnthropic(toolContextMessages, toolCalls, toolResult);
                      toolRound++;
                      isToolRound = true;
                      continue;
                    } else {
                      const cleanedContent = cleanModelArtifacts(roundContent);
                      for (const chunk of splitIntoChunks(cleanedContent)) {
                        controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                      }
                      accumulatedContent = cleanModelArtifacts(accumulatedContent);
                    }
                  } else {
                    generator = streamAnthropic(toolContextMessages as any, llmConfig);
                  }
                } else {
                  generator = streamAnthropic(chatMessages, llmConfig);
                }
                break;
              }

              case 'ollama': {
                console.log(`[Stream] Ollama case: shouldUseTools=${shouldUseTools}, isToolRound=${isToolRound}, toolRound=${toolRound}`);
                if (shouldUseTools && !isToolRound) {
                  // Use /api/chat with tools support
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
                  generator = streamOllamaWithTools(chatMessages, llmConfig, availableTools, accumulator);

                  // BUFFER content for tool call detection
                  let roundContent = '';
                  for await (const chunk of generator) {
                    roundContent += chunk;
                    accumulatedContent += chunk;
                  }

                  // Ollama sends done_reason: "stop" for BOTH normal responses AND tool calls.
                  // We detect tool calls by checking if toolCalls were accumulated, NOT by done_reason.
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
                  // Fix: Update accumulatedContent to cleaned version
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up: send tool results back to Ollama - include tools so character can chain actions
                  const canUseMoreTools = toolRound < maxToolRounds;
                  const ollamaFollowUpTools = canUseMoreTools ? availableTools : [];
                  const toolFollowAccumulator = createToolCallAccumulator(availableTools);
                  generator = streamOllamaWithTools(toolContextMessages as any, llmConfig, ollamaFollowUpTools, toolFollowAccumulator);
                } else {
                  // No tools - use standard completion endpoint
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
                  generator = streamOllama(prompt, llmConfig);
                }
                break;
              }

              case 'grok': {
                console.log(`[Stream] Grok case: shouldUseTools=${shouldUseTools}, isToolRound=${isToolRound}, toolRound=${toolRound}`);
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
                  generator = streamGrokWithTools(chatMessages, llmConfig, availableTools, accumulator);

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
                        for (const chunk of splitIntoChunks(cleanedContent)) {
                          controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                        }
                      }
                      const textToolResult = await executeToolCallsAndContinue(
                        textToolCalls, availableTools, toolRound, maxToolRounds,
                        effectiveCharacter, sessionId || '', effectiveUserName, controller,
                        sessionQuests, questTemplates,
                        effectiveCharacter.statsConfig, sessionStats, allCharacters, characterMemory
                      );
                      allToolsUsed = [...allToolsUsed, ...textToolResult.toolsUsed];
                      allQuestActivations = [...allQuestActivations, ...textToolResult.questActivations];
                      if (textToolResult.shouldContinue) {
                        toolContextMessages = [
                          ...baseChatMessages,
                          ...buildToolMessagesForOpenAI(textToolCalls, textToolResult.toolResults),
                        ];
                        accumulatedContent = '';
                        toolRound++;
                        continue;
                      }
                    }
                  }

                  // No tool calls detected - stream buffered content (clean artifacts)
                  console.log(`[Grok+Tools] No tool calls detected, streaming ${roundContent.length} chars`);
                  const cleanedGrokContent = cleanModelArtifacts(roundContent);
                  for (const chunk of splitIntoChunks(cleanedGrokContent)) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                  // Fix: Update accumulatedContent to cleaned version
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
                } else if (shouldUseTools && isToolRound) {
                  // Follow-up with tool results - include tools so character can chain actions
                  const canUseMoreTools = toolRound < maxToolRounds;
                  const grokFollowUpTools = canUseMoreTools ? availableTools : [];
                  generator = streamGrokWithTools(toolContextMessages as any, llmConfig, grokFollowUpTools, createToolCallAccumulator(availableTools));
                } else {
                  generator = streamGrok(chatMessages, llmConfig);
                }
                break;
              }

              case 'text-generation-webui':
              case 'koboldcpp': {
                if (shouldUseTools) {
                  console.log(`[Stream] TextGenerationWebUI case: shouldUseTools=${shouldUseTools}`);
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
                  generator = streamTextGenerationWebUIWithTools(chatMessages, llmConfig, availableTools, accumulator);

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
                      const toolContextMessages = [
                        ...chatMessages,
                        ...buildToolMessagesForOpenAI(accumulator.toolCalls, toolResultPairs),
                      ];
                      accumulatedContent = '';
                      toolRound++;
                      toolContext.push(...toolContextMessages.map(m => ({
                        role: m.role,
                        content: m.content || '',
                        toolCallId: (m as any).toolCallId,
                        name: (m as any).name,
                      })));
                      continue;
                    }
                  }

                  // No tool calls detected - stream buffered content (clean artifacts)
                  console.log(`[TextGenWebUI+Tools] No tool calls detected, streaming ${roundContent.length} chars`);
                  const cleanedTGWContent = cleanModelArtifacts(roundContent);
                  for (const chunk of splitIntoChunks(cleanedTGWContent)) {
                    controller.enqueue(createSSEJSON({ type: 'token', content: chunk }));
                  }
                  // Fix: Update accumulatedContent to cleaned version
                  accumulatedContent = cleanModelArtifacts(accumulatedContent);
                  toolRound = maxToolRounds + 1;
                  continue;
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
                  generator = streamTextGenerationWebUI(prompt, llmConfig);
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
                generator = streamTextGenerationWebUI(prompt, llmConfig);
                break;
              }
            }

            // Send updated prompt_data for tool call follow-up rounds
            // so the prompt viewer shows the complete prompt sent to the LLM
            if (isToolRound && toolContextMessages.length > 0) {
              // Build a tool follow-up section from the tool context messages
              const toolContextContent = toolContextMessages
                .map((msg) => {
                  const role = (msg.role as string) || 'unknown';
                  const content = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content, null, 2);
                  // Truncate very long tool results for readability
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

          // ========================================
          // Memory Reinforcement
          // Check if LLM referenced any existing memories and boost their importance
          // ========================================
          if (accumulatedContent.length > 50 && embeddingsResult?.searchedNamespaces?.length > 0) {
            const reinforcementEnabled = isReinforcementEnabled(embeddingsChat);
            if (reinforcementEnabled) {
              // Get namespaces to check for memory reinforcement
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
          // Count by TURNS (user messages) instead of individual messages.
          // A turn = 1 user message + N assistant responses.
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

          console.log(`[Memory] Normal chat extraction check: enabled=${extractionEnabled}, turns=${turnCount}, freq=${extractionFrequency}, contentLen=${accumulatedContent.length}, shouldExtract=${shouldExtract}`);

          // ========================================
          // Emotional State Evaluation Check (FASE 5)
          // Determine if the client should evaluate the character's emotional state
          // after receiving the response. The client will call /api/chat/emotion.
          // ========================================
          const emotionalConfig = effectiveCharacter.emotionalConfig;
          const shouldEvaluateEmotion =
            !!emotionalConfig?.enabled &&
            emotionalConfig.states.length > 0 &&
            accumulatedContent.length > 20 &&
            !!llmConfig;

          if (shouldEvaluateEmotion) {
            console.log(`[Emotion] Should evaluate emotion: enabled=${emotionalConfig.enabled}, states=${emotionalConfig.states.length}, interval=${emotionalConfig.evaluationInterval}`);
          }

          // Send done signal with shouldExtract flag and shouldEvaluateEmotion flag so client can trigger both
          controller.enqueue(createSSEJSON({ 
            type: 'done',
            toolsUsed: allToolsUsed,
            questActivations: allQuestActivations,
            shouldExtract,
            shouldEvaluateEmotion,
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
      error instanceof Error ? error.message : 'Failed to stream response',
      500
    );
  }
}
