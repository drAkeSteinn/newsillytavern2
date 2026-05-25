'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import type { ProactiveMessagesConfig, ProactiveMessageInfo } from '@/types';

interface ProactiveMessageMetadata {
  proactiveInfo: ProactiveMessageInfo;
  promptData?: { type: string; label: string; content: string; color: string }[];
  toolsUsed?: { name: string; label: string; icon: string; success: boolean }[];
}

interface UseProactiveMessagesOptions {
  /** Whether the chat panel is currently generating (block proactive during generation) */
  isGenerating: boolean;
  /** Called to add a proactive message to the chat */
  onProactiveMessage?: (message: {
    characterId: string;
    content: string;
    metadata: ProactiveMessageMetadata;
  }) => void;
  /** Called when a proactive message starts streaming (for real-time display) */
  onProactiveStreamStart?: (characterId: string, characterName: string) => void;
  /** Called with streaming token content for real-time display */
  onProactiveStreamToken?: (token: string) => void;
  /** Called when proactive streaming ends (success or error) */
  onProactiveStreamEnd?: () => void;
}

/** Why proactive is not active (for UI feedback) */
export type ProactiveInactiveReason = 
  | 'no_character'      // No character selected
  | 'not_configured'    // Character doesn't have proactive messages enabled
  | 'group_chat'        // Active chat is a group chat (not supported)
  | 'no_session'        // No active chat session
  | 'no_llm'            // No LLM provider configured
  | null;               // Active and running

interface UseProactiveMessagesReturn {
  /** Whether proactive messages are currently active for the active character */
  isActive: boolean;
  /** Whether the active character has proactive messages configured (enabled in settings) */
  isConfigured: boolean;
  /** Reason proactive is not active (null when active) */
  inactiveReason: ProactiveInactiveReason;
  /** Seconds until next proactive message */
  nextIn: number | null;
  /** Total proactive messages sent this session */
  sessionCount: number;
  /** Whether a proactive message is currently being generated */
  isGeneratingProactive: boolean;
  /** Manually trigger a proactive message (for testing) */
  triggerNow: () => Promise<void>;
}

/**
 * Hook that manages proactive message timers for the active character.
 * 
 * Timer Logic:
 * ─────────────
 * 1. When a chat session is active, the timer measures inactivity (time since last message)
 * 2. If inactivity >= configured intervalSeconds → trigger proactive message
 * 3. Any new message (user or character) resets the inactivity timer
 * 4. Proactive messages are NOT sent during LLM generation
 * 5. Session count tracks how many proactive messages have been sent
 * 6. allowedStates determines WHEN to trigger: 'idle' (user present but quiet) or 'user_away' (tab hidden)
 */
export function useProactiveMessages({
  isGenerating,
  onProactiveMessage,
  onProactiveStreamStart,
  onProactiveStreamToken,
  onProactiveStreamEnd,
}: UseProactiveMessagesOptions): UseProactiveMessagesReturn {
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [isGeneratingProactive, setIsGeneratingProactive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const sessionCountRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const lastMessageIdRef = useRef<string>('');
  const isActiveRef = useRef(false);

  // Keep refs in sync with props
  isGeneratingRef.current = isGenerating;

  // Get store state
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const activeCharacterId = useTavernStore((state) => state.activeCharacterId);
  const activeGroupId = useTavernStore((state) => state.activeGroupId);
  const characters = useTavernStore((state) => state.characters);
  const sessions = useTavernStore((state) => state.sessions);
  const llmConfigs = useTavernStore((state) => state.llmConfigs);
  const personas = useTavernStore((state) => state.personas);
  const activePersonaId = useTavernStore((state) => state.activePersonaId);
  const addMessage = useTavernStore((state) => state.addMessage);
  const lorebooks = useTavernStore((state) => state.lorebooks);
  const activeLorebookIds = useTavernStore((state) => state.activeLorebookIds);
  const settings = useTavernStore((state) => state.settings);
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const questSettings = useTavernStore((state) => state.questSettings);
  const soundTriggers = useTavernStore((state) => state.soundTriggers);
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const hudSessionState = useTavernStore((state) => state.hudSessionState);

  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const llmConfig = llmConfigs.find((c) => c.isActive);
  const activePersona = personas.find((p) => p.id === activePersonaId);

  const config: ProactiveMessagesConfig | undefined = activeCharacter?.proactiveMessages;

  // Determine inactive reason for UI feedback
  const inactiveReason: ProactiveInactiveReason = useMemo(() => {
    if (!activeCharacter) return 'no_character';
    if (!config?.enabled) return 'not_configured';
    if (activeGroupId) return 'group_chat';
    if (!activeSession) return 'no_session';
    if (!llmConfig) return 'no_llm';
    return null; // Active!
  }, [activeCharacter, config?.enabled, activeGroupId, activeSession, llmConfig]);

  const isConfigured = !!(config?.enabled && activeCharacter);
  const isActive = inactiveReason === null;
  isActiveRef.current = isActive;

  // ─── Initialize from session data ───
  useEffect(() => {
    if (!activeSession) {
      lastActivityTimeRef.current = Date.now();
      sessionCountRef.current = 0;
      setSessionCount(0);
      return;
    }

    const messages = activeSession.messages.filter((m) => !m.isDeleted);

    // Count existing proactive messages in session for accurate session count
    const existingProactiveCount = messages.filter(
      (m) => m.metadata?.proactiveInfo?.isProactive
    ).length;
    sessionCountRef.current = existingProactiveCount;
    setSessionCount(existingProactiveCount);

    // Set last activity time from the last message's timestamp
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const lastMsgTime = new Date(lastMsg.timestamp).getTime();
      if (!isNaN(lastMsgTime) && lastMsgTime <= Date.now()) {
        lastActivityTimeRef.current = lastMsgTime;
      } else {
        lastActivityTimeRef.current = Date.now();
      }
      lastMessageIdRef.current = lastMsg.id || lastMsg.timestamp;
    } else {
      lastActivityTimeRef.current = Date.now();
      lastMessageIdRef.current = '';
    }
  }, [activeSessionId, activeCharacterId]);

  // ─── Track new messages to reset inactivity timer ───
  useEffect(() => {
    if (!activeSession) return;
    const messages = activeSession.messages.filter((m) => !m.isDeleted);
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const msgKey = lastMsg.id || lastMsg.timestamp;

    if (msgKey !== lastMessageIdRef.current && lastMessageIdRef.current !== '') {
      lastMessageIdRef.current = msgKey;
      lastActivityTimeRef.current = Date.now();
    }
  }, [activeSession?.messages?.length]);

  // ─── Generate a proactive message ───
  const generateProactiveMessage = useCallback(async (reason: 'timer_idle' | 'timer_away' | 'manual' = 'timer_idle') => {
    if (!activeCharacter || !activeSession || !llmConfig || !config) return;
    if (isGeneratingRef.current || isGeneratingProactive) return;

    // Check minimum messages requirement
    const messageCount = activeSession.messages.filter((m) => !m.isDeleted).length;
    if (messageCount < (config.minMessagesBeforeStart ?? 5)) {
      toast('Mensajes proactivos', {
        description: `Se necesitan al menos ${config.minMessagesBeforeStart ?? 5} mensajes en el chat antes de activar los mensajes proactivos.`,
        duration: 3000,
      });
      return;
    }

    // Check max per session
    if (config.maxPerSession > 0 && sessionCountRef.current >= config.maxPerSession) {
      toast('Mensajes proactivos', {
        description: `Se alcanzó el límite de ${config.maxPerSession} mensajes proactivos por sesión.`,
        duration: 3000,
      });
      return;
    }

    setIsGeneratingProactive(true);

    try {
      // Re-read latest state from store inside the callback
      const { questTemplates, questSettings, settings, soundTriggers, characters, hudTemplates, hudSessionState } = useTavernStore.getState();
      const latestSession = useTavernStore.getState().sessions.find((s: any) => s.id === useTavernStore.getState().activeSessionId);

      const allMessages = latestSession?.messages
        .filter((m: any) => !m.isDeleted)
        .map((m: any) => ({
          id: m.id,
          characterId: m.characterId,
          role: m.role,
          content: m.content,
          isDeleted: m.isDeleted,
          timestamp: m.timestamp,
        })) || [];

      const characterLorebookIds = activeCharacter.lorebookIds || [];
      const effectiveIds = characterLorebookIds.filter(id => activeLorebookIds.includes(id));
      const activeLorebooks = lorebooks.filter(lb => effectiveIds.includes(lb.id));

      // Build allCharacters including persona as pseudo-character for peticiones/solicitudes
      const allCharactersWithPersona = [
        ...characters,
        ...(activePersona?.statsConfig?.enabled ? [{
          id: '__user__',
          name: activePersona.name || 'User',
          statsConfig: activePersona.statsConfig,
        }] as any[] : []),
      ];

      // Build HUD context from active template
      const activeHUDTemplate = hudTemplates.find((t: any) => t.id === hudSessionState.activeTemplateId);
      const hudContext = activeHUDTemplate?.context?.enabled && activeHUDTemplate.context.content.trim()
        ? activeHUDTemplate.context
        : undefined;

      // Get session quests and summary
      const sessionQuests = latestSession?.sessionQuests || [];
      const summary = latestSession?.summary;

      const response = await fetch('/api/chat/proactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: activeCharacter,
          messages: allMessages,
          llmConfig,
          userName: activePersona?.name || 'User',
          persona: activePersona || undefined,
          lorebooks: activeLorebooks,
          sessionStats: latestSession?.sessionStats,
          proactiveConfig: config,
          reason: reason === 'manual' ? 'timer_idle' : reason,
          lastActivityAt: lastActivityTimeRef.current,
          // NEW: All additional data fields matching stream route
          allCharacters: allCharactersWithPersona,
          questTemplates,
          sessionQuests,
          questSettings,
          hudContext,
          embeddingsChat: {
            ...settings.embeddingsChat,
            customNamespaces: activeCharacter?.embeddingNamespaces,
          },
          toolsSettings: settings.tools,
          summary,
          contextConfig: settings.context,
          sessionId: useTavernStore.getState().activeSessionId,
          characterId: activeCharacter.id,
          soundTriggers,
          settings,
          characterMemory: activeCharacter ? useTavernStore.getState().getCharacterMemory(activeCharacter.id) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error en mensaje proactivo' }));
        throw new Error(errorData.error || 'Error en mensaje proactivo');
      }

      // ─── SSE Streaming Response Handling ───
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let promptSections: { type: string; label: string; content: string; color: string }[] = [];
      let toolsUsed: { name: string; label: string; icon: string; success: boolean }[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const sseMessages = buffer.split('\n\n');
          buffer = sseMessages.pop() || '';

          for (const sseMessage of sseMessages) {
            const dataMatch = sseMessage.match(/^data: (.+)$/s);
            if (!dataMatch) continue;

            try {
              const parsed = JSON.parse(dataMatch[1]);

              switch (parsed.type) {
                case 'prompt_data':
                  // Capture prompt sections for metadata (same as regular chat)
                  if (parsed.promptSections) {
                    promptSections = parsed.promptSections;
                  }
                  break;

                case 'proactive_start':
                  // Stream initialized - notify UI for real-time display
                  console.log(`[Proactive] Stream started for ${parsed.characterName} (reason: ${parsed.reason})`);
                  onProactiveStreamStart?.(parsed.characterId, parsed.characterName);
                  break;

                case 'token':
                  if (parsed.content) {
                    accumulatedContent += parsed.content;
                    onProactiveStreamToken?.(parsed.content);
                  }
                  break;

                case 'tool_call_start':
                  console.log('[Proactive] Tool call started:', parsed.toolName);
                  break;

                case 'tool_call_result':
                  console.log('[Proactive] Tool call result:', parsed.toolName, parsed.success);
                  // Accumulate tool results for metadata
                  toolsUsed.push({
                    name: parsed.toolName || 'unknown',
                    label: parsed.toolLabel || parsed.toolName || 'unknown',
                    icon: parsed.toolIcon || 'Wrench',
                    success: parsed.success !== false,
                  });
                  break;

                case 'quest_activation':
                  console.log('[Proactive] Quest activation:', parsed.toolName, parsed.activationType, parsed.key);
                  // Execute the objective completion on the client store
                  if (parsed.activationType === 'complete_objective' && parsed.metadata && !parsed.metadata.alreadyCompleted) {
                    const store = useTavernStore.getState();
                    store.completeObjective?.(
                      useTavernStore.getState().activeSessionId,
                      parsed.metadata.questTemplateId,
                      parsed.metadata.objectiveId,
                      parsed.metadata.characterId,
                    );
                  }
                  if (!parsed.metadata?.alreadyCompleted && parsed.metadata?.objectiveName) {
                    toast.success(`Objetivo completado: ${parsed.metadata.objectiveName}`);
                  }
                  break;

                case 'action_activation':
                  console.log('[Proactive] Action activation:', parsed.toolName, parsed.skillName);
                  {
                    const store = useTavernStore.getState();
                    store.activateSkillByTool?.(
                      useTavernStore.getState().activeSessionId,
                      parsed.characterId,
                      parsed.skillName,
                      parsed.skillDescription || '',
                      parsed.activationCosts || [],
                      parsed.activationRewards || [],
                    );
                    toast.success(`⚔️ Acción: ${parsed.skillName}`);
                  }
                  break;

                case 'solicitud_activation':
                  console.log('[Proactive] Solicitud activation:', parsed.toolName, parsed.activationType, parsed.solicitudKey);
                  {
                    const store = useTavernStore.getState();
                    const sid = useTavernStore.getState().activeSessionId;
                    if (parsed.activationType === 'create_solicitud' && parsed.targetCharacterId) {
                      store.createSolicitud?.(
                        sid,
                        parsed.targetCharacterId,
                        {
                          key: parsed.solicitudKey,
                          peticionKey: parsed.peticionKey,
                          fromCharacterId: parsed.fromCharacterId,
                          fromCharacterName: parsed.fromCharacterName,
                          description: parsed.description || '',
                          completionDescription: parsed.completionDescription,
                        }
                      );
                      toast.success(`📬 Petición: ${parsed.peticionKey || parsed.solicitudKey} → ${parsed.targetCharacterName || ''}`);
                    } else if (parsed.activationType === 'complete_solicitud') {
                      store.completeSolicitud?.(
                        sid,
                        parsed.fromCharacterId,
                        parsed.solicitudKey
                      );
                      toast.success(`✅ Solicitud completada: ${parsed.solicitudKey}`);
                    }
                  }
                  break;

                case 'memory_activation':
                  // Memory tool activation - sync to client-side Character Memory (Zustand)
                  console.log('[Proactive] Memory activation from tool:', parsed.toolName, parsed.activationType);
                  {
                    const store = useTavernStore.getState();
                    if (parsed.activationType === 'save_memory' && parsed.eventData) {
                      store.addMemoryEvent(parsed.characterId, {
                        id: parsed.eventData.id,
                        type: parsed.eventData.type as any,
                        content: parsed.eventData.content,
                        importance: parsed.eventData.importance,
                        timestamp: new Date().toISOString(),
                        embeddingId: parsed.eventData.embeddingId,
                        sessionId: parsed.eventData.sessionId,
                      });
                      toast.success(`🧠 Memoria guardada: ${parsed.eventData.content.slice(0, 50)}...`);
                    } else if (parsed.activationType === 'update_relationship' && parsed.relationshipData) {
                      store.updateRelationship(parsed.characterId, {
                        targetId: parsed.relationshipData.targetId,
                        targetName: parsed.relationshipData.targetName,
                        relationship: parsed.relationshipData.relationship,
                        sentiment: parsed.relationshipData.sentiment,
                        notes: parsed.relationshipData.notes,
                        lastUpdated: new Date().toISOString(),
                      });
                      toast.success(`💜 Relación actualizada: ${parsed.relationshipData.targetName}`);
                    } else if (parsed.activationType === 'save_note' && parsed.noteContent) {
                      const existingMemory = store.getCharacterMemory(parsed.characterId);
                      store.setCharacterNotes(parsed.characterId, 
                        existingMemory?.notes ? `${existingMemory.notes}\n${parsed.noteContent}` : parsed.noteContent);
                    }
                  }
                  break;

                case 'embeddings_context':
                  // Embeddings context metadata - logged for debugging
                  console.log('[Proactive] Embeddings context retrieved');
                  break;

                case 'memory_extracting':
                  // Memory extraction running in background
                  console.log('[Proactive] Memory extraction in progress');
                  break;

                case 'done':
                  // Final event - message is complete, add to store
                  onProactiveStreamEnd?.();
                  if (accumulatedContent.trim()) {
                    // Clean up character name prefix if present
                    let cleanedMessage = accumulatedContent.trim();
                    const namePrefix = `${activeCharacter.name}:`;
                    if (cleanedMessage.startsWith(namePrefix)) {
                      cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
                    }

                    if (cleanedMessage) {
                      sessionCountRef.current += 1;
                      setSessionCount(sessionCountRef.current);

                      const proactiveReason = reason === 'manual' ? 'timer_idle' : reason;
                      const proactiveInfo: ProactiveMessageInfo = {
                        isProactive: true,
                        triggeredAt: new Date().toISOString(),
                        reason: proactiveReason,
                        characterName: parsed.characterName || activeCharacter.name,
                      };

                      // Prefer toolsUsed from the done event (authoritative server list)
                      // Fall back to locally accumulated tools from tool_call_result events
                      const finalToolsUsed = (parsed.toolsUsed && parsed.toolsUsed.length > 0)
                        ? parsed.toolsUsed
                        : (toolsUsed.length > 0 ? toolsUsed : undefined);

                      const messageMetadata: ProactiveMessageMetadata = {
                        proactiveInfo,
                        promptData: promptSections.length > 0 ? promptSections : undefined,
                        toolsUsed: finalToolsUsed,
                      };

                      if (onProactiveMessage) {
                        onProactiveMessage({
                          characterId: activeCharacter.id,
                          content: cleanedMessage,
                          metadata: messageMetadata,
                        });
                      } else {
                        addMessage(activeSession.id, {
                          characterId: activeCharacter.id,
                          role: 'assistant',
                          content: cleanedMessage,
                          isDeleted: false,
                          swipeId: `proactive_${Date.now()}`,
                          swipeIndex: 0,
                          metadata: messageMetadata,
                        });
                      }

                      lastActivityTimeRef.current = Date.now();

                      toast(`${activeCharacter.name} te envió un mensaje`, {
                        description: cleanedMessage.slice(0, 80) + (cleanedMessage.length > 80 ? '...' : ''),
                        icon: <Sparkles className="h-4 w-4 text-amber-400" />,
                        duration: 4000,
                      });

                      // Client-side memory extraction for proactive messages
                      // Triggered after the stream is fully processed, if server flagged shouldExtract
                      if (parsed.shouldExtract && cleanedMessage) {
                        const extractionMessage = cleanedMessage;
                        const extractionCharacterId = activeCharacter.id;
                        const extractionCharacterName = activeCharacter.name;
                        (async () => {
                          try {
                            const state = useTavernStore.getState();
                            const currentLLMConfig = state.llmConfigs.find(c => c.isActive);
                            const embeddingsChat = state.settings.embeddingsChat;
                            const currentSession = state.sessions.find(s => s.id === activeSessionId);
                            const sessionMsgs = currentSession?.messages || [];
                            const personaName = activePersona?.name || 'User';

                            if (!currentLLMConfig) return;

                            // Build chat context for context-aware extraction
                            const extractionContextDepth = embeddingsChat.memoryExtractionContextDepth || 0;
                            let chatContextForExtraction: string | undefined;
                            if (extractionContextDepth > 0) {
                              const contextMessages = sessionMsgs
                                .filter(m => !m.isDeleted && m.content?.trim())
                                .slice(-(extractionContextDepth * 2 + 1));
                              if (contextMessages.length > 0) {
                                chatContextForExtraction = contextMessages
                                  .map(m => {
                                    const role = m.role === 'user' ? 'Jugador' : extractionCharacterName;
                                    const content = m.content.trim().slice(0, 300);
                                    return `${role}: ${content}`;
                                  })
                                  .join('\n  ');
                              }
                            }

                            const extractionResponse = await fetch('/api/embeddings/extract-memory', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                lastMessage: extractionMessage,
                                characterName: extractionCharacterName,
                                characterId: extractionCharacterId,
                                sessionId: activeSessionId || '',
                                userName: personaName,
                                llmConfig: {
                                  provider: currentLLMConfig.provider,
                                  endpoint: currentLLMConfig.endpoint,
                                  apiKey: currentLLMConfig.apiKey,
                                  model: currentLLMConfig.model,
                                  parameters: currentLLMConfig.parameters,
                                },
                                minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                                customPrompt: embeddingsChat.memoryExtractionPrompt,
                                chatContext: chatContextForExtraction,
                                consolidationSettings: embeddingsChat.memoryConsolidationEnabled ? {
                                  enabled: true,
                                  threshold: embeddingsChat.memoryConsolidationThreshold || 50,
                                  keepRecent: embeddingsChat.memoryConsolidationKeepRecent || 10,
                                  keepHighImportance: embeddingsChat.memoryConsolidationKeepHighImportance || 4,
                                } : undefined,
                                extractionModelConfig: embeddingsChat.extractionModelEnabled ? {
                                  extractionModelEnabled: true,
                                  extractionModelProvider: embeddingsChat.extractionModelProvider,
                                  extractionModelEndpoint: embeddingsChat.extractionModelEndpoint,
                                  extractionModelApiKey: embeddingsChat.extractionModelApiKey,
                                  extractionModelName: embeddingsChat.extractionModelName,
                                } : undefined,
                              }),
                            });

                            if (extractionResponse.ok) {
                              const result = await extractionResponse.json();
                              if (result.success) {
                                console.log(`[Memory] Proactive extraction result for ${extractionCharacterName}: extracted=${result.count}, saved=${result.saved}`);

                                // Sync memoryActivations to Character Memory
                                if (result.memoryActivations && result.memoryActivations.length > 0) {
                                  const store = useTavernStore.getState();
                                  for (const activation of result.memoryActivations) {
                                    store.addMemoryEvent(activation.characterId, {
                                      id: activation.eventData.id,
                                      type: activation.eventData.type as any,
                                      content: activation.eventData.content,
                                      importance: activation.eventData.importance,
                                      timestamp: new Date().toISOString(),
                                      embeddingId: activation.eventData.embeddingId,
                                      sessionId: activation.eventData.sessionId,
                                    });
                                  }
                                }

                                if (result.saved > 0) {
                                  toast.success(`🧠 ${result.saved} memorias extraídas automáticamente`);
                                }
                              }
                            }
                          } catch (err) {
                            console.warn('[Memory] Proactive client-side extraction failed:', err);
                          }
                        })();
                      }
                    }
                  }
                  break;

                case 'error':
                  onProactiveStreamEnd?.();
                  throw new Error(parsed.error || 'Error en la generación del mensaje proactivo');

                default:
                  // Unknown event type - ignore
                  break;
              }
            } catch (parseError) {
              // Re-throw errors from 'error' SSE events; skip invalid JSON
              if (parseError instanceof Error && parseError.message.includes('Error en')) {
                throw parseError;
              }
              // Otherwise skip (invalid JSON, etc.)
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      onProactiveStreamEnd?.();
      console.warn('[Proactive] Failed to generate message:', error?.message);
      toast('Error en mensaje proactivo', {
        description: error?.message || 'Error de conexión',
        duration: 3000,
      });
    } finally {
      setIsGeneratingProactive(false);
    }
  }, [activeCharacter, activeSession, llmConfig, config, activePersona, onProactiveMessage, onProactiveStreamStart, onProactiveStreamToken, onProactiveStreamEnd, addMessage, lorebooks, activeLorebookIds, isGeneratingProactive]);

  // ─── Main timer logic ───
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!isActive) {
      setNextIn(null);
      return;
    }

    const intervalMs = (config?.intervalSeconds ?? 300) * 1000;

    // Update countdown every second
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityTimeRef.current;
      const remaining = Math.max(0, Math.floor((intervalMs - elapsed) / 1000));
      setNextIn(remaining);
    }, 1000);

    // Check every 5 seconds if it's time to send
    timerRef.current = setInterval(() => {
      if (isGeneratingRef.current || isGeneratingProactive) return;
      if (!isActiveRef.current) return;

      const elapsed = Date.now() - lastActivityTimeRef.current;

      if (elapsed >= intervalMs) {
        const isHidden = document.hidden;
        const allowedStates = config?.allowedStates ?? ['idle'];

        if (isHidden && !allowedStates.includes('user_away')) return;
        if (!isHidden && !allowedStates.includes('idle')) return;

        const reason: 'timer_idle' | 'timer_away' = isHidden ? 'timer_away' : 'timer_idle';
        generateProactiveMessage(reason);
      }
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isActive, config?.intervalSeconds, generateProactiveMessage, isGeneratingProactive]);

  // Manual trigger (for testing)
  const triggerNow = useCallback(async () => {
    if (!activeCharacter || !activeSession || !llmConfig || !config) {
      toast('Mensajes proactivos', {
        description: 'Se requiere un personaje con proactive activado, una sesión de chat y un proveedor LLM configurado.',
        duration: 3000,
      });
      return;
    }
    await generateProactiveMessage('manual');
  }, [generateProactiveMessage, activeCharacter, activeSession, llmConfig, config]);

  return {
    isActive,
    isConfigured,
    inactiveReason,
    nextIn: isActive ? nextIn : null,
    sessionCount,
    isGeneratingProactive,
    triggerNow,
  };
}
