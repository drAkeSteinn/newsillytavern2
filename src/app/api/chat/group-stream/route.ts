// ============================================
// Group Stream Route - Simplified with unified key resolution
// ============================================
//
// Key resolution happens in buildGroupSystemPrompt():
// - Template variables: {{user}}, {{char}}, {{userpersona}}
// - Stats keys: {{resistencia}}, {{habilidades}}, etc.
// - All sections are processed consistently

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, CharacterGroup, PromptSection, Lorebook, SessionStats, HUDContextConfig, QuestSettings, QuestTemplate, SessionQuestInstance, SessionSummary, SolicitudInstance } from '@/types';
import { DEFAULT_QUEST_SETTINGS } from '@/types';
import {
  createSSEJSON,
  createErrorResponse,
  createSSEStreamResponse,
  cleanResponseContent,
  buildGroupSystemPrompt,
  buildGroupChatMessages,
  buildPostHistorySection,
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
  type ContextConfig
} from '@/lib/context-manager';
import { detectMentions } from '@/lib/mention-detector';
import { buildQuestPromptSection } from '@/lib/triggers/handlers/quest-handler';
import { retrieveEmbeddingsContext, formatEmbeddingsForSSE } from '@/lib/embeddings/chat-context';
import type { EmbeddingsChatSettings, ToolsSettings } from '@/types';
import {
  getAllToolDefinitions,
  getToolDefinitionsByIds,
  executeTool,
  createToolCallAccumulator,
  hasToolCalls,
  buildToolMessagesForOpenAI,
  buildToolMessagesForOllama,
  buildToolMessagesForAnthropic,
  createAnthropicToolState,
  anthropicStateToToolCalls,
  type NativeToolCall,
} from '@/lib/tools';
import {
  streamOpenAIWithTools,
  streamOllamaWithTools,
  streamAnthropicWithTools,
} from '@/lib/llm/providers';

// ============================================
// Responder Selection Logic
// ============================================

/**
 * Result of responder selection including metadata about why certain characters were selected
 */
interface ResponderSelectionResult {
  responders: CharacterCard[];
  stopForUser: boolean;        // True if a peticion targets the user
  reasons: Map<string, string>; // characterId -> reason for selection
}

/**
 * Get characters that have pending solicitudes (requests they need to respond to)
 */
function getCharactersWithPendingSolicitudes(
  sessionStats: SessionStats | undefined,
  eligibleCharacterIds: string[]
): { characterId: string; fromCharacterName: string }[] {
  if (!sessionStats?.solicitudes?.characterSolicitudes) {
    return [];
  }

  const result: { characterId: string; fromCharacterName: string }[] = [];

  for (const characterId of eligibleCharacterIds) {
    const solicitudes = sessionStats.solicitudes.characterSolicitudes[characterId];
    if (solicitudes) {
      const pendingSolicitudes = solicitudes.filter(s => s.status === 'pending');
      if (pendingSolicitudes.length > 0) {
        result.push({
          characterId,
          fromCharacterName: pendingSolicitudes[0].fromCharacterName
        });
      }
    }
  }

  return result;
}

/**
 * Check if there are pending solicitudes targeting the user
 */
function hasPendingSolicitudesForUser(
  sessionStats: SessionStats | undefined
): boolean {
  if (!sessionStats?.solicitudes?.characterSolicitudes) {
    return false;
  }

  const userSolicitudes = sessionStats.solicitudes.characterSolicitudes['__user__'];
  return userSolicitudes?.some(s => s.status === 'pending') ?? false;
}

/**
 * Determine responders based on strategy
 * Note: Narrators are excluded from normal response flow and handled separately
 */
function getResponders(
  message: string,
  characters: CharacterCard[],
  group: CharacterGroup,
  lastResponderId?: string,
  sessionStats?: SessionStats
): ResponderSelectionResult {
  const strategy = group.activationStrategy;
  const minResponses = group.minResponsesPerTurn ?? 1;
  const maxResponses = group.maxResponsesPerTurn ?? 3;

  // Get active members, EXCLUDING narrators (they have their own response logic)
  const activeMemberIds = (group.members || [])
    .filter(m => m.isActive && m.isPresent !== false && !m.isNarrator)
    .map(m => m.characterId);

  // If no members defined, use characterIds (excluding narrators)
  const eligibleIds = activeMemberIds.length > 0
    ? activeMemberIds
    : (group.characterIds || []).filter(id => {
        const member = (group.members || []).find(m => m.characterId === id);
        return !member?.isNarrator;
      });

  // Filter to only characters that exist and are eligible
  const eligibleCharacters = characters.filter(c => eligibleIds.includes(c.id));

  if (eligibleCharacters.length === 0) {
    return { responders: [], stopForUser: false, reasons: new Map() };
  }

  // Get ordered member IDs (excluding narrators)
  const orderedIds = (group.members || [])
    .filter(m => !m.isNarrator)
    .sort((a, b) => a.joinOrder - b.joinOrder)
    .map(m => m.characterId);

  const reasons = new Map<string, string>();

  switch (strategy) {
    case 'all': {
      // All active members respond (no limit for 'all' strategy)
      eligibleCharacters.forEach(c => reasons.set(c.id, 'Todos responden'));
      return { responders: eligibleCharacters, stopForUser: false, reasons };
    }

    case 'reactive': {
      // ========================================
      // REACTIVE STRATEGY with Solicitud Support
      // ========================================
      // Priority:
      // 1. If peticion targets user -> STOP, let user respond
      // 2. Characters with pending solicitudes respond
      // 3. Mentioned characters respond
      // 4. Fill to minResponses if needed

      // Check if user has pending solicitudes
      const stopForUser = hasPendingSolicitudesForUser(sessionStats);
      if (stopForUser) {
        console.log('[getResponders] Peticion targets user, stopping turn for user response');
        return { responders: [], stopForUser: true, reasons: new Map() };
      }

      // Detect mentions
      const mentions = detectMentions(message, characters, group);
      const mentionedIds = mentions.map(m => m.characterId);
      const mentionedCharacters = eligibleCharacters.filter(c => mentionedIds.includes(c.id));
      mentionedCharacters.forEach(c => reasons.set(c.id, 'Mencionado en el mensaje'));

      // Get characters with pending solicitudes
      const charactersWithSolicitudes = getCharactersWithPendingSolicitudes(sessionStats, eligibleIds);
      const solicitudCharacterIds = charactersWithSolicitudes.map(s => s.characterId);
      const solicitudCharacters = eligibleCharacters.filter(c => solicitudCharacterIds.includes(c.id));

      // Add solicitud reasons (don't overwrite mention reasons)
      solicitudCharacters.forEach(c => {
        if (!reasons.has(c.id)) {
          const solicitudInfo = charactersWithSolicitudes.find(s => s.characterId === c.id);
          reasons.set(c.id, `Tiene solicitud pendiente de ${solicitudInfo?.fromCharacterName || 'otro personaje'}`);
        }
      });

      // Combine: unique characters from mentions and solicitudes
      const combinedIds = new Set([...mentionedIds, ...solicitudCharacterIds]);
      let selectedCharacters = eligibleCharacters.filter(c => combinedIds.has(c.id));

      // If no mentions or solicitudes, fill to minResponses
      if (selectedCharacters.length === 0) {
        // Select first eligible character as default
        selectedCharacters = [eligibleCharacters[0]];
        reasons.set(eligibleCharacters[0].id, 'Personaje por defecto (sin menciones ni solicitudes)');
      }

      // Ensure we have at least minResponses (but respect maxResponses)
      if (selectedCharacters.length < minResponses) {
        const remaining = eligibleCharacters
          .filter(c => !combinedIds.has(c.id))
          .slice(0, minResponses - selectedCharacters.length);
        remaining.forEach(c => reasons.set(c.id, 'Para alcanzar mínimo de respuestas'));
        selectedCharacters = [...selectedCharacters, ...remaining];
      }

      // Limit to maxResponses
      const limitedResponders = selectedCharacters.slice(0, maxResponses);

      console.log('[getResponders] Reactive selection:', {
        mentionedIds,
        solicitudCharacterIds,
        selectedCount: limitedResponders.length,
        minResponses,
        maxResponses,
        stopForUser
      });

      return { responders: limitedResponders, stopForUser, reasons };
    }

    case 'round_robin': {
      // Take turns in order
      const sortedIds = orderedIds.length > 0 ? orderedIds : eligibleIds;

      let nextIndex = 0;
      if (lastResponderId) {
        const lastIndex = sortedIds.indexOf(lastResponderId);
        if (lastIndex !== -1) {
          nextIndex = (lastIndex + 1) % sortedIds.length;
        }
      }

      const roundRobinChar = characters.find(c => c.id === sortedIds[nextIndex]);
      if (roundRobinChar) {
        reasons.set(roundRobinChar.id, 'Turno rotativo');
      }
      return { responders: roundRobinChar ? [roundRobinChar] : [], stopForUser: false, reasons };
    }

    case 'random': {
      // Random selection
      const shuffled = [...eligibleCharacters].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(maxResponses, shuffled.length));
      selected.forEach(c => reasons.set(c.id, 'Selección aleatoria'));
      return { responders: selected, stopForUser: false, reasons };
    }

    case 'smart': {
      // AI-like decision: mentioned characters + contextually relevant
      const mentions = detectMentions(message, characters, group);
      const mentionedIds = mentions.map(m => m.characterId);
      const mentionedChars = eligibleCharacters.filter(c => mentionedIds.includes(c.id));
      mentionedChars.forEach(c => reasons.set(c.id, 'Mencionado en el mensaje'));

      // Add contextually relevant characters
      const remainingChars = eligibleCharacters.filter(c => !mentionedIds.includes(c.id));
      const additionalCount = Math.max(0, Math.min(maxResponses - mentionedChars.length, 1));

      // Check if character name or tags appear in message
      const relevantChars = remainingChars.filter(c => {
        const keywords = [...c.tags, c.name.toLowerCase()];
        return keywords.some(kw => message.toLowerCase().includes(kw.toLowerCase()));
      }).slice(0, additionalCount);
      relevantChars.forEach(c => reasons.set(c.id, 'Contextualmente relevante'));

      const result = [...mentionedChars, ...relevantChars].slice(0, maxResponses);

      // If no one selected, default to first
      if (result.length === 0 && eligibleCharacters.length > 0) {
        result.push(eligibleCharacters[0]);
        reasons.set(eligibleCharacters[0].id, 'Personaje por defecto');
      }

      return { responders: result, stopForUser: false, reasons };
    }

    default: {
      // Default to first active character
      if (eligibleCharacters.length > 0) {
        reasons.set(eligibleCharacters[0].id, 'Personaje por defecto');
      }
      return { responders: eligibleCharacters.slice(0, 1), stopForUser: false, reasons };
    }
  }
}

// ============================================
// Group Tool Execution Helper
// ============================================

/**
 * Execute detected tool calls for group chat and send SSE events.
 * Returns { results: display messages, shouldContinue: true if tools were executed }
 */
async function executeGroupToolCalls(
  toolCalls: NativeToolCall[],
  availableTools: Array<{ id: string; name: string; label: string; icon: string }>,
  character: CharacterCard,
  sessionId: string,
  userName: string,
  controller: { enqueue: (chunk: string) => void },
): Promise<{ results: string; shouldContinue: boolean }> {
  if (toolCalls.length === 0) {
    return { results: '', shouldContinue: false };
  }

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

    console.log(`[GroupStream-Tools] Executing: ${tc.name}`, tc.arguments);

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

    console.log(`[GroupStream-Tools] ${tc.name}: success=${toolResult.success}`);

    if (toolResult.displayMessage) {
      allDisplayMessages += (allDisplayMessages ? '\n' : '') + toolResult.displayMessage;
    }
  }

  return { results: allDisplayMessages, shouldContinue: true };
}

// ============================================
// Main Route Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request (automatically detects group request)
    const validation = validateRequest(null, body);
    if (!validation.success) {
      return createErrorResponse(validation.error, 400);
    }

    const {
      message,
      group,
      characters,
      messages = [],
      llmConfig,
      userName = 'User',
      persona,
      lastResponderId,
      sessionStats,
      hudContext
    } = validation.data;

    // Extract lorebooks from body (not validated by validation.ts)
    const lorebooks: Lorebook[] = body.lorebooks || [];

    // Extract Quest data for pre-LLM integration (NEW FORMAT)
    const questTemplates: QuestTemplate[] = body.questTemplates || [];
    const sessionQuests: SessionQuestInstance[] = body.sessionQuests || [];
    const questSettings: QuestSettings = {
      ...DEFAULT_QUEST_SETTINGS,
      ...(body.questSettings || {})
    };

    // Extract summaries for memory/context compression
    const summary: SessionSummary | undefined = body.summary;

    // Extract embeddings chat settings
    const embeddingsChat: Partial<EmbeddingsChatSettings> = body.embeddingsChat || {};
    const sessionId: string | undefined = body.sessionId;

    // Extract tools settings for tool/action system (native tool calling only)
    const toolsSettings: ToolsSettings = {
      enabled: body.toolsSettings?.enabled ?? true,
      maxToolCallsPerTurn: body.toolsSettings?.maxToolCallsPerTurn ?? 2,
      characterConfigs: body.toolsSettings?.characterConfigs || [],
    };

    // Cast sessionStats to proper type
    const typedSessionStats = sessionStats as SessionStats | undefined;

    // Cast hudContext to proper type
    const typedHUDContext = hudContext as HUDContextConfig | undefined;

    // Extract per-character lorebook map for when group has no lorebooks
    const characterLorebooksMap: Record<string, string[]> = body.characterLorebooksMap || {};

    // Determine if we should use per-character lorebooks
    const useGroupLorebooks = lorebooks.length > 0;

    // Extract narrator-related data
    const turnCount: number = body.turnCount || 0;
    const activeQuestsCount: number = sessionQuests.filter(q => q.status === 'active').length;
    const narratorLastTurn: number = body.narratorLastTurn || -999; // Turn when narrator last spoke

    // Get narrator settings from group
    const narratorSettings = group.narratorSettings;

    // Find narrator character (if any)
    const narratorMember = (group.members || []).find(m => m.isNarrator);
    const narratorCharacter = narratorMember
      ? characters.find(c => c.id === narratorMember.characterId)
      : null;

    // Determine if narrator should intervene based on conditions
    const shouldNarratorIntervene = (): boolean => {
      if (!narratorCharacter || !narratorSettings) return false;

      const { conditional } = narratorSettings;

      // Check turn interval
      if (conditional.minTurnInterval > 0) {
        const turnsSinceLastNarration = turnCount - narratorLastTurn;
        if (turnsSinceLastNarration < conditional.minTurnInterval) {
          return false;
        }
      }

      // Check if only when no active quests
      if (conditional.onlyWhenNoActiveQuests && activeQuestsCount > 0) {
        return false;
      }

      return true;
    };

    const narratorCanIntervene = shouldNarratorIntervene();

    if (!llmConfig) {
      return createErrorResponse('No LLM configuration provided', 400);
    }

    // Sanitize user message
    const sanitizedMessage = sanitizeInput(message);

    // Determine which characters should respond
    const selectionResult = getResponders(sanitizedMessage, characters, group, lastResponderId, typedSessionStats);
    const { responders, stopForUser, reasons } = selectionResult;

    // If stopForUser is true, return a special response indicating user should respond
    if (stopForUser) {
      // Create a stream that immediately returns a "user_turn" event
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(createSSEJSON({
            type: 'user_turn',
            reason: 'Hay una petición pendiente dirigida a ti. Espera tu respuesta.'
          }));
          controller.close();
        }
      });
      return createSSEStreamResponse(stream);
    }

    if (responders.length === 0) {
      return createErrorResponse('No active characters to respond', 400);
    }

    // Log responder selection reasons
    console.log('[Group Stream Route] Selected responders:', responders.map(r => ({
      name: r.name,
      reason: reasons.get(r.id)
    })));

    // Get effective user name
    const effectiveUserName = getEffectiveUserName(persona, userName);

    // Build context configuration from request or use defaults
    const contextConfig: Partial<ContextConfig> = body.contextConfig || {};

    // Apply sliding window to messages
    const contextWindow = selectContextMessages(messages, llmConfig, contextConfig);

    // Build group-level lorebook section if group has lorebooks
    let groupLorebookSection: PromptSection | null = null;
    if (useGroupLorebooks && lorebooks.length > 0) {
      const result = buildLorebookSectionForPrompt(
        messages,
        lorebooks,
        {
          scanDepth: contextConfig.scanDepth,
          tokenBudget: 2048
        }
      );
      groupLorebookSection = result.section;
    }

    // Note: HUD context section is built inside the character loop
    // so it can resolve keys for each specific character

    // Note: Quest section is built inside the character loop
    // so each character sees only their relevant objectives

    // ========================================
    // Narrator Integration
    // ========================================
    // Add narrator to responders based on response mode and conditions
    let narratorAddedToResponders = false;
    if (narratorCharacter && narratorCanIntervene && narratorSettings) {
      const mode = narratorSettings.responseMode;
      if (mode === 'turn_start') {
        // Add narrator at the beginning
        responders.unshift(narratorCharacter);
        narratorAddedToResponders = true;
      } else if (mode === 'turn_end' || mode === 'before_each' || mode === 'after_each') {
        // Add narrator at the end (for turn_end, before_each, after_each we treat similarly for now)
        responders.push(narratorCharacter);
        narratorAddedToResponders = true;
      }
    }

    // Create a TransformStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const responsesThisTurn: Array<{ characterId: string; characterName: string; content: string }> = [];

        try {
          // Generate responses sequentially
          for (let i = 0; i < responders.length; i++) {
            const responder = responders[i];

            // Send character_start event
            controller.enqueue(createSSEJSON({
              type: 'character_start',
              characterId: responder.id,
              characterName: responder.name,
              responseIndex: i + 1,
              totalResponses: responders.length
            }));

            // Determine lorebook section for this character
            let lorebookSectionForCharacter: PromptSection | null = groupLorebookSection;

            // ========================================
            // Embeddings Context Retrieval (per-character)
            // ========================================
            // If group has custom namespaces, use those; otherwise fall back to character's own namespaces
            const groupNamespaces = group.embeddingNamespaces;
            const characterNamespaces = responder.embeddingNamespaces;
            const effectiveEmbeddingsChat = (groupNamespaces && groupNamespaces.length > 0)
              ? { ...embeddingsChat, customNamespaces: groupNamespaces }
              : (characterNamespaces && characterNamespaces.length > 0)
                ? { ...embeddingsChat, customNamespaces: characterNamespaces }
                : embeddingsChat;

            // Enrich search query with recent context for better semantic matching
            const searchCtxDepth = effectiveEmbeddingsChat.searchContextDepth || 0;
            let groupEnrichedQuery = sanitizedMessage;
            if (searchCtxDepth > 0) {
              const recentHist = messages
                .filter(m => !m.isDeleted)
                .slice(-(searchCtxDepth * 2 + 1))
                .map(m => m.content?.trim())
                .filter(Boolean)
                .slice(0, -1);
              if (recentHist.length > 0) {
                groupEnrichedQuery = recentHist.join(' ') + ' ' + sanitizedMessage;
              }
            }

            const embeddingsResult = await retrieveEmbeddingsContext(
              groupEnrichedQuery,
              responder.id,
              sessionId,
              effectiveEmbeddingsChat,
              group.id,
            );
            
            if (embeddingsResult.found) {
              console.log(`[Group Stream] Retrieved ${embeddingsResult.count} embeddings for ${responder.name}`);
            }

            // If group has no lorebooks, use character's own lorebooks
            if (!useGroupLorebooks) {
              const characterLorebookIds = characterLorebooksMap[responder.id] || [];
              if (characterLorebookIds.length > 0) {
                const characterLorebooksFiltered = lorebooks.filter(lb =>
                  characterLorebookIds.includes(lb.id) && lb.active
                );

                if (characterLorebooksFiltered.length > 0) {
                  const result = buildLorebookSectionForPrompt(
                    messages,
                    characterLorebooksFiltered,
                    {
                      scanDepth: contextConfig.scanDepth,
                      tokenBudget: 2048
                    }
                  );
                  lorebookSectionForCharacter = result.section;
                }
              } else {
                lorebookSectionForCharacter = null;
              }
            }

            // ========================================
            // Build system prompt with unified key resolution
            // ========================================
            // This handles ALL key resolution internally:
            // - Template variables: {{user}}, {{char}}, {{userpersona}}
            // - Stats keys: {{resistencia}}, {{habilidades}}, etc.
            // - All sections including post-history instructions
            const { prompt: systemPrompt, sections: promptSections } = buildGroupSystemPrompt(
              responder,
              group,
              effectiveUserName,
              persona,
              lorebookSectionForCharacter,
              typedSessionStats,
              undefined, // postHistoryInstructions
              characters // allCharacters - needed for peticiones/solicitudes resolution
            );

            // Build key resolution context for this character
            const resolvedStats = resolveStats({
              characterId: responder.id,
              statsConfig: responder.statsConfig,
              sessionStats: typedSessionStats,
              allCharacters: characters,
              userName: effectiveUserName,
              characterName: responder.name,
            });
            const keyContext = buildKeyResolutionContext(
              responder,
              effectiveUserName,
              persona,
              resolvedStats,
              typedSessionStats  // Pass sessionStats for {{eventos}} key resolution
            );

            // Build HUD context section for this character (resolves keys!)
            const hudContextSection = typedHUDContext ? buildHUDContextSection(typedHUDContext, keyContext) : null;

            // Send embeddings context metadata to the client for UI display
            if (embeddingsResult.found) {
              controller.enqueue(createSSEJSON({
                type: 'embeddings_context',
                data: formatEmbeddingsForSSE(embeddingsResult),
                characterId: responder.id,
                characterName: responder.name,
              }));
            }

            // Check if this responder is a narrator in the group (MUST be before buildQuestPromptSection)
            const responderMember = group.members?.find(m => m.characterId === responder.id);
            const isResponderNarrator = responderMember?.isNarrator || false;

            // Build quest section for this character (filters objectives by characterId)
            // For narrator, show both active and available quests with different format
            let resolvedQuestSection: PromptSection | null = null;
            if (questSettings.enabled && questSettings.promptInclude && sessionQuests.length > 0 && questTemplates.length > 0) {
              const questSectionContent = buildQuestPromptSection(
                questTemplates,
                sessionQuests,
                questSettings.promptTemplate || DEFAULT_QUEST_SETTINGS.promptTemplate,
                responder.id,  // Filter objectives for this character
                isResponderNarrator  // Pass narrator flag for different format
              );
              if (questSectionContent) {
                const resolvedQuestContent = resolveAllKeys(questSectionContent, keyContext);
                resolvedQuestSection = {
                  type: 'quest',
                  label: 'Active Quests',
                  content: resolvedQuestContent,
                  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                };
              }
            }

            // Non-memory embeddings: append to system prompt (static knowledge)
            // Memory embeddings: inject as separate system message before chat history
            const memoryContextString = embeddingsResult.memoryContextString?.trim()
              ? `[${embeddingsResult.memorySection?.label || 'MEMORIA DEL PERSONAJE'}]\n${embeddingsResult.memoryContextString}`
              : undefined;

            // Add non-memory embeddings + quest section to the system prompt
            let finalSystemPrompt = systemPrompt;
            if (embeddingsResult.nonMemoryContextString?.trim()) {
              finalSystemPrompt += `\n\n[${embeddingsResult.nonMemorySection?.label || 'CONTEXTO'}]\n${embeddingsResult.nonMemoryContextString}`;
            }
            if (resolvedQuestSection) {
              finalSystemPrompt += `\n\n[${resolvedQuestSection.label}]\n${resolvedQuestSection.content}`;
            }

            // ===== TOOL/ACTION SYSTEM (Native Tool Calling) =====
            // Tools are NOT injected into the system prompt - sent via API's native tools parameter
            const charToolConfig = toolsSettings.characterConfigs.find(
              c => c.characterId === responder.id
            );
            const charEnabledToolIds = charToolConfig?.enabledTools || [];
            const charAvailableTools = charEnabledToolIds.length > 0
              ? getToolDefinitionsByIds(charEnabledToolIds)
              : getAllToolDefinitions();
            const charToolsEnabled = toolsSettings.enabled && charAvailableTools.length > 0;
            const charSupportsTools = ['openai', 'vllm', 'lm-studio', 'custom', 'anthropic', 'ollama'].includes(llmConfig.provider);
            const charShouldUseTools = charToolsEnabled && charSupportsTools;

            // Build chat messages with previous responses from this turn
            const previousResponses = responsesThisTurn.map(r => ({
              characterName: r.characterName,
              content: r.content
            }));

            // Check if the last message is already the user's current message
            const lastMessage = contextWindow.messages[contextWindow.messages.length - 1];
            const isLastMessageCurrentUser = lastMessage?.role === 'user' &&
              lastMessage?.content === sanitizedMessage;

            // Create summary message if summary exists (inject at start of chat history)
            const summaryMessage = summary ? {
              id: 'summary-' + Date.now(),
              role: 'assistant' as const,
              content: `[Previous Conversation Summary]\n${summary.content}`,
              characterId: responder.id,
              isDeleted: false,
              timestamp: summary.createdAt,
              swipeId: 'summary',
              swipeIndex: 0
            } : null;

            // Build messages: summary (if exists) + context window messages + user message
            let baseMessages = isLastMessageCurrentUser
              ? contextWindow.messages
              : [...contextWindow.messages, createUserMessage(sanitizedMessage)];
            
            // Inject summary at the START of chat history
            const messagesForPrompt = summaryMessage 
              ? [summaryMessage, ...baseMessages] 
              : baseMessages;

            // Resolve keys in post-history instructions BEFORE passing to buildGroupChatMessages
            // This ensures {{user}}, {{char}}, {{stats}}, etc. are replaced
            const rawPostHistoryInstructions = responder.postHistoryInstructions?.trim();
            const resolvedPostHistoryInstructions = rawPostHistoryInstructions
              ? resolveAllKeys(rawPostHistoryInstructions, keyContext)
              : undefined;

            // Build post-history section for prompt viewer (pass raw instructions, function will resolve keys)
            const postHistorySection = buildPostHistorySection(
              responder.postHistoryInstructions,
              keyContext
            );

            // Note: isResponderNarrator is already defined above before buildQuestPromptSection

            const { chatMessages, chatHistorySection } = buildGroupChatMessages(
              finalSystemPrompt,
              messagesForPrompt,
              responder,
              characters,
              effectiveUserName,
              previousResponses,
              resolvedPostHistoryInstructions,  // Post-history instructions AFTER chat (with keys resolved)
              undefined,  // authorNote
              isResponderNarrator,  // If responder is narrator, they see all messages
              memoryContextString  // Memory embeddings before chat history
            );

            // Combine prompt sections with chat history for the viewer
            // Order: System -> [CONTEXTO] non-memory -> Quest -> [MEMORIA] memory -> Chat History -> Post-History
            // Non-memory stays with character definition. Memory goes before chat history for recency primacy.
            const personaIndex = promptSections.findIndex(s => s.type === 'persona');
            const prePersonaSections = personaIndex >= 0 ? promptSections.slice(0, personaIndex + 1) : promptSections;
            const postPersonaSections = personaIndex >= 0 ? promptSections.slice(personaIndex + 1) : [];

            let allPromptSections: PromptSection[] = chatHistorySection
              ? [...prePersonaSections, ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []), ...postPersonaSections, ...(resolvedQuestSection ? [resolvedQuestSection] : []), ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []), chatHistorySection, ...(postHistorySection ? [postHistorySection] : [])]
              : [...prePersonaSections, ...(embeddingsResult.nonMemorySection ? [embeddingsResult.nonMemorySection] : []), ...postPersonaSections, ...(resolvedQuestSection ? [resolvedQuestSection] : []), ...(embeddingsResult.memorySection ? [embeddingsResult.memorySection] : []), ...(postHistorySection ? [postHistorySection] : [])];

            // Inject HUD context into sections if enabled
            if (hudContextSection && typedHUDContext) {
              allPromptSections = injectHUDContextIntoSections(allPromptSections, hudContextSection, typedHUDContext.position);
            }

            // Generate response
            let fullContent = '';

            try {
              // Get the appropriate streaming generator based on provider
              // For tool-aware providers (openai, anthropic, ollama), the stream is consumed inline
              // and generator is NOT assigned. The `if (generator)` check after the switch handles this.
              let generator: AsyncGenerator<string> | undefined;

              // Inject HUD context into chat messages if enabled
              const finalChatMessages = hudContextSection && typedHUDContext
                ? injectHUDContextIntoMessages(chatMessages, hudContextSection, typedHUDContext.position)
                : chatMessages;

              switch (llmConfig.provider) {
                case 'test-mock': {
                  // Test mode: Simulate LLM response with peticion keys for testing
                  console.log('[Group Stream Route] Using TEST-MOCK provider for peticiones testing');
                  
                  // Use custom mock response from config, or default response
                  const mockResponse = llmConfig.mockResponse || `*El personaje te mira con interés*

¡Hola! Me alegra verte por aquí. Tenía algo que pedirte...

[peticion_test]

¿Podrías ayudarme con algo?`;
                  
                  console.log('[Group Stream Route] Mock response for', responder.name, ':', mockResponse.slice(0, 100) + '...');
                  
                  generator = async function* mockGenerator() {
                    // Stream character by character to simulate real streaming
                    for (const char of mockResponse) {
                      yield char;
                      // Small delay to simulate network latency
                      await new Promise(resolve => setTimeout(resolve, 15));
                    }
                  }();
                  break;
                }

                case 'z-ai': {
                  generator = streamZAI(finalChatMessages, llmConfig.apiKey);
                  break;
                }

                case 'openai':
                case 'vllm':
                case 'lm-studio':
                case 'custom': {
                  if (!llmConfig.endpoint) {
                    throw new Error(`${llmConfig.provider} requires an endpoint URL`);
                  }
                  if (charShouldUseTools) {
                    // Use tool-aware streaming
                    const openaiMessages = finalChatMessages.map((m, idx) => ({
                      role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                      content: m.content
                    }));
                    const accumulator = createToolCallAccumulator(charAvailableTools);
                    let roundContent = '';
                    
                    for await (const chunk of streamOpenAIWithTools(openaiMessages as any, llmConfig, llmConfig.provider, charAvailableTools, accumulator)) {
                      roundContent += chunk;
                      fullContent += chunk;
                      controller.enqueue(createSSEJSON({
                        type: 'token',
                        characterId: responder.id,
                        characterName: responder.name,
                        content: chunk
                      }));
                    }

                    if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'stop')) {
                      // Tool calls detected! Execute them
                      const { results: displayMessages, shouldContinue } = await executeGroupToolCalls(
                        accumulator.toolCalls, charAvailableTools, responder, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        // Build follow-up messages with tool results
                        const toolResultPairs = accumulator.toolCalls.map(tc => ({
                          success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                        }));
                        const toolMessages = buildToolMessagesForOpenAI(accumulator.toolCalls, toolResultPairs);
                        const followUpMessages = [...openaiMessages, ...toolMessages];
                        
                        // Clear previous content (tool call JSON) and stream follow-up response
                        fullContent = '';
                        for await (const chunk of streamOpenAICompatible(followUpMessages as any, llmConfig, llmConfig.provider)) {
                          fullContent += chunk;
                          controller.enqueue(createSSEJSON({
                            type: 'token',
                            characterId: responder.id,
                            characterName: responder.name,
                            content: chunk
                          }));
                        }
                      }
                    }
                  } else {
                    // Standard streaming without tools
                    const openaiMessages = finalChatMessages.map((m, idx) => ({
                      role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                      content: m.content
                    }));
                    generator = streamOpenAICompatible(openaiMessages, llmConfig, llmConfig.provider);
                  }
                  break;
                }

                case 'anthropic': {
                  if (!llmConfig.apiKey) {
                    throw new Error('Anthropic requires an API key');
                  }
                  if (charShouldUseTools) {
                    const anthropicMessages = finalChatMessages.map((m, idx) => ({
                      role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                      content: m.content
                    }));
                    const toolState = createAnthropicToolState();
                    let roundContent = '';
                    
                    for await (const chunk of streamAnthropicWithTools(anthropicMessages as any, llmConfig, charAvailableTools, toolState)) {
                      roundContent += chunk;
                      fullContent += chunk;
                      controller.enqueue(createSSEJSON({
                        type: 'token',
                        characterId: responder.id,
                        characterName: responder.name,
                        content: chunk
                      }));
                    }

                    const toolCalls = anthropicStateToToolCalls(toolState);
                    if (toolCalls.length > 0 && (toolState.stopReason === 'tool_use')) {
                      const { results: displayMessages, shouldContinue } = await executeGroupToolCalls(
                        toolCalls, charAvailableTools, responder, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        const toolResultPairs = toolCalls.map(tc => ({
                          success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                        }));
                        const toolMessages = buildToolMessagesForAnthropic(toolCalls, toolResultPairs);
                        const followUpMessages = [...anthropicMessages, ...toolMessages.flatMap(m => m)];
                        
                        fullContent = '';
                        for await (const chunk of streamAnthropic(followUpMessages as any, llmConfig)) {
                          fullContent += chunk;
                          controller.enqueue(createSSEJSON({
                            type: 'token',
                            characterId: responder.id,
                            characterName: responder.name,
                            content: chunk
                          }));
                        }
                      }
                    }
                  } else {
                    const anthropicMessages = finalChatMessages.map((m, idx) => ({
                      role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                      content: m.content
                    }));
                    generator = streamAnthropic(anthropicMessages, llmConfig);
                  }
                  break;
                }

                case 'ollama': {
                  if (charShouldUseTools) {
                    // Use /api/chat with tools support
                    const ollamaMessages = finalChatMessages.map((m, idx) => ({
                      role: m.role === 'assistant' && idx === 0 ? 'system' : m.role,
                      content: m.content
                    }));
                    const accumulator = createToolCallAccumulator(charAvailableTools);
                    let roundContent = '';
                    
                    for await (const chunk of streamOllamaWithTools(ollamaMessages as any, llmConfig, charAvailableTools, accumulator)) {
                      roundContent += chunk;
                      fullContent += chunk;
                      controller.enqueue(createSSEJSON({
                        type: 'token',
                        characterId: responder.id,
                        characterName: responder.name,
                        content: chunk
                      }));
                    }

                    if (hasToolCalls(accumulator) && (accumulator.finishReason === 'tool_calls' || accumulator.finishReason === 'tool use')) {
                      const { results: displayMessages, shouldContinue } = await executeGroupToolCalls(
                        accumulator.toolCalls, charAvailableTools, responder, sessionId || '', effectiveUserName, controller
                      );
                      if (shouldContinue) {
                        const toolResultPairs = accumulator.toolCalls.map(tc => ({
                          success: true, displayMessage: displayMessages || `[${tc.name} ejecutada]`
                        }));
                        const toolResultMessages = buildToolMessagesForOllama(accumulator.toolCalls, toolResultPairs);
                        const followUpMessages = [...ollamaMessages, ...toolResultMessages];
                        
                        fullContent = '';
                        const combinedPrompt = followUpMessages.map(m =>
                          `${(m as any).role}: ${(m as any).content}`
                        ).join('\n') + `\n${responder.name}:`;
                        for await (const chunk of streamOllama(combinedPrompt, llmConfig)) {
                          fullContent += chunk;
                          controller.enqueue(createSSEJSON({
                            type: 'token',
                            characterId: responder.id,
                            characterName: responder.name,
                            content: chunk
                          }));
                        }
                      }
                    }
                  } else {
                    // Standard completion prompt (no tools)
                    const prompt = buildCompletionPrompt({
                      systemPrompt: finalSystemPrompt,
                      messages: messagesForPrompt,
                      character: responder,
                      userName: effectiveUserName,
                      postHistoryInstructions: resolvedPostHistoryInstructions,
                      embeddingsContext: memoryContextString
                    });
                    generator = streamOllama(prompt, llmConfig);
                  }
                  break;
                }

                case 'text-generation-webui':
                case 'koboldcpp':
                default: {
                  // These providers don't support native tool calling
                  const prompt = buildCompletionPrompt({
                    systemPrompt: finalSystemPrompt,
                    messages: messagesForPrompt,
                    character: responder,
                    userName: effectiveUserName,
                    postHistoryInstructions: resolvedPostHistoryInstructions,
                    embeddingsContext: memoryContextString
                  });
                  generator = streamTextGenerationWebUI(prompt, llmConfig);
                  break;
                }
              }

              // For providers that don't use inline tool streaming, consume the generator
              if (generator) {
                for await (const chunk of generator) {
                  fullContent += chunk;
                  // Stream token to client
                  controller.enqueue(createSSEJSON({
                    type: 'token',
                    characterId: responder.id,
                    characterName: responder.name,
                    content: chunk
                  }));
                }
              }

              // Clean up the response (remove character name prefix if present)
              const cleanedContent = cleanResponseContent(fullContent, responder.name);

              // Store response for next character's context
              responsesThisTurn.push({
                characterId: responder.id,
                characterName: responder.name,
                content: cleanedContent
              });

              // Send character_done event with prompt sections (including chat history)
              // Include isNarrator flag so frontend can tag the message appropriately
              controller.enqueue(createSSEJSON({
                type: 'character_done',
                characterId: responder.id,
                characterName: responder.name,
                fullContent: cleanedContent,
                promptSections: allPromptSections,
                isNarrator: isResponderNarrator
              }));

            } catch (charError) {
              // Send character_error event but continue with other characters
              controller.enqueue(createSSEJSON({
                type: 'character_error',
                characterId: responder.id,
                characterName: responder.name,
                error: charError instanceof Error ? charError.message : 'Unknown error'
              }));
            }
          }

          // Check if memory extraction should trigger BEFORE closing stream
          // Count by TURNS (user messages) instead of individual messages.
          // A turn = 1 user message + N assistant responses.
          const userMessages = messages.filter(m => m.role === 'user' && !m.isDeleted);
          const turnCount = userMessages.length;
          const extractionFrequency = embeddingsChat.memoryExtractionFrequency || 5;
          const extractionEnabled = embeddingsChat.memoryExtractionEnabled === true;
          const shouldExtractGroupMemory =
            extractionEnabled &&
            responsesThisTurn.length > 0 &&
            turnCount > 0 &&
            turnCount % extractionFrequency === 0 &&
            !!llmConfig;

          // Debug logging for extraction decision
          console.log(`[Memory] Group chat extraction check: enabled=${extractionEnabled}, turns=${turnCount}, freq=${extractionFrequency}, responders=${responsesThisTurn.length}, shouldExtract=${shouldExtractGroupMemory}`);

          if (shouldExtractGroupMemory) {
            const extractableChars = responsesThisTurn
              .filter(r => r.content && r.content.length > 50)
              .map(r => r.characterName);
            if (extractableChars.length > 0) {
              controller.enqueue(createSSEJSON({
                type: 'memory_extracting',
                characterNames: extractableChars,
              }));
            }
          }

          // Send final done event with all responses
          controller.enqueue(createSSEJSON({
            type: 'done',
            responses: responsesThisTurn
          }));
          controller.close();

          // Async: Extract memory from each responder's response (fire-and-forget)
          if (shouldExtractGroupMemory) {
            setTimeout(async () => {
              try {
                // Build full turn context for context-aware extraction
                const extractionCtxDepth = embeddingsChat.memoryExtractionContextDepth || 0;
                let groupChatContext: string | undefined;
                if (extractionCtxDepth > 0) {
                  const recentForCtx = messages
                    .filter(m => !m.isDeleted && m.content?.trim())
                    .slice(-(extractionCtxDepth * 2 + 1));
                  if (recentForCtx.length > 0) {
                    groupChatContext = recentForCtx
                      .map(m => {
                        const role = m.role === 'user' ? 'Jugador' : m.role === 'assistant' ? 'Personaje' : m.role;
                        return `${role}: ${m.content.trim().slice(0, 300)}`;
                      })
                      .join('\n  ');
                  }
                }

                // Build current turn context (user message + all responses)
                const turnLines: string[] = [];
                turnLines.push(`Jugador: ${sanitizedMessage}`);
                for (const resp of responsesThisTurn) {
                  if (resp.content) {
                    turnLines.push(`${resp.characterName}: ${resp.content.trim().slice(0, 500)}`);
                  }
                }
                const fullTurnContext = turnLines.join('\n');

                // Extract individual character memories with turn context
                for (const resp of responsesThisTurn) {
                  if (resp.content && resp.content.length > 50) {
                    // Build character-specific context: include the full turn so the LLM sees all responses
                    const characterContext = groupChatContext || fullTurnContext;

                    const response = await fetch('/api/embeddings/extract-memory', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        lastMessage: resp.content,
                        characterName: resp.characterName,
                        characterId: resp.characterId,
                        sessionId: sessionId || '',
                        groupId: group.id,
                        llmConfig: {
                          provider: llmConfig.provider,
                          endpoint: llmConfig.endpoint,
                          apiKey: llmConfig.apiKey,
                          model: llmConfig.model,
                          parameters: llmConfig.parameters,
                        },
                        minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                        customPrompt: embeddingsChat.groupMemoryExtractionPrompt || embeddingsChat.memoryExtractionPrompt,
                        chatContext: characterContext, // NEW: pass turn context
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
                        console.log(`[Memory] Group extraction result for ${resp.characterName}: extracted=${result.count}, saved=${result.saved}, namespace="${result.namespace}"${result.consolidation ? `, consolidated: -${result.consolidation.removed} +${result.consolidation.created}` : ''}`);
                      } else {
                        console.warn(`[Memory] Group extraction failed for ${resp.characterName}:`, result.error);
                      }
                    } else {
                      const errorText = await response.text().catch(() => 'unknown');
                      console.warn(`[Memory] Group extract-memory API error ${response.status}:`, errorText);
                    }
                  }
                }

                // Extract group dynamics if enabled
                if (embeddingsChat.groupDynamicsExtraction && responsesThisTurn.length > 1 && fullTurnContext.length > 100) {
                  try {
                    const dynResponse = await fetch('/api/embeddings/extract-group-dynamics', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        turnContext: fullTurnContext,
                        groupId: group.id,
                        sessionId: sessionId || '',
                        llmConfig: {
                          provider: llmConfig.provider,
                          endpoint: llmConfig.endpoint,
                          apiKey: llmConfig.apiKey,
                          model: llmConfig.model,
                          parameters: llmConfig.parameters,
                        },
                        minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                      }),
                    });
                    if (dynResponse.ok) {
                      const dynResult = await dynResponse.json();
                      if (dynResult.success && dynResult.saved > 0) {
                        console.log(`[Memory] Extracted ${dynResult.saved} group dynamics for group ${group.id}`);
                      }
                    }
                  } catch (dynErr) {
                    console.warn('[Memory] Group dynamics extraction failed (non-blocking):', dynErr);
                  }
                }
              } catch (err) {
                console.warn('[Memory] Async group extraction failed:', err);
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
      error instanceof Error ? error.message : 'Failed to stream group response',
      500
    );
  }
}
