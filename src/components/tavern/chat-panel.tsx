'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { BackgroundWithOverlays } from './background-layer';
import { NovelChatBox } from './novel-chat-box';
import { CharacterSprite } from './character-sprite';
// Unified Trigger System - Single import for all triggers
import { useTriggerSystem } from '@/lib/triggers';
import { useBackgroundTriggers } from '@/hooks/use-background-triggers';
import { useTTS, useTTSAutoGeneration } from '@/hooks/use-tts';
import { useTimelineSpriteSounds } from '@/hooks/use-timeline-sprite-sounds';
import { useProactiveMessages } from '@/hooks/use-proactive-messages';
import { GroupSprites } from './group-sprites';
import { HUDDisplay } from './hud-display';
import { QuestNotifications } from './quest-notifications';
import { InventoryHUD } from '@/components/inventory/inventory-hud';
import { TTSFloatingIndicator } from './tts-playback-controls';
import { Sparkles } from 'lucide-react';
import type { CharacterCard, SummaryData, ChatMessage } from '@/types';
import { EmbeddingsContextContainer } from '@/components/embeddings/embeddings-context-indicator';
import { ToolCallNotification, type ToolCallPhase } from '@/components/tools/tool-call-notification';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import { chatLogger } from '@/lib/logger';
import { generateId } from '@/lib/utils';

export function ChatPanel() {
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingCharacter, setStreamingCharacter] = useState<CharacterCard | null>(null);
  const [streamingProgress, setStreamingProgress] = useState<{ current: number; total: number } | null>(null);
  const [embeddingsContexts, setEmbeddingsContexts] = useState<Array<{
    count: number;
    namespaces: string[];
    topResults: Array<{ content: string; similarity: number; namespace: string; source_type?: string }>;
    characterId?: string;
    characterName?: string;
  }>>([]);
  const [memoryExtractingInfo, setMemoryExtractingInfo] = useState<{ active: boolean; characterNames: string }>({ active: false, characterNames: '' });
  const [toolCallInfo, setToolCallInfo] = useState<{
    active: boolean;
    toolName?: string;
    toolLabel?: string;
    toolIcon?: string;
    params?: Record<string, unknown>;
    result?: { success: boolean; displayMessage: string; duration: number };
    phase: ToolCallPhase;
    callId?: string;
  }>({ active: false, phase: 'idle' });

  // Use proper selectors to subscribe to store changes
  const activeSessionId = useTavernStore((state) => state.activeSessionId);
  const activeCharacterId = useTavernStore((state) => state.activeCharacterId);
  const activeGroupId = useTavernStore((state) => state.activeGroupId);
  const sessions = useTavernStore((state) => state.sessions);
  const characters = useTavernStore((state) => state.characters);
  const groups = useTavernStore((state) => state.groups);
  const settings = useTavernStore((state) => state.settings);
  const isGenerating = useTavernStore((state) => state.isGenerating);
  const activeBackground = useTavernStore((state) => state.activeBackground);
  const activeOverlayBack = useTavernStore((state) => state.activeOverlayBack);
  const activeOverlayFront = useTavernStore((state) => state.activeOverlayFront);
  const personas = useTavernStore((state) => state.personas);
  const activePersonaId = useTavernStore((state) => state.activePersonaId);
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const hudSessionState = useTavernStore((state) => state.hudSessionState);
  const setActiveHUD = useTavernStore((state) => state.setActiveHUD);
  // Lorebooks for prompt injection
  const lorebooks = useTavernStore((state) => state.lorebooks);
  const activeLorebookIds = useTavernStore((state) => state.activeLorebookIds);
  
  // Quests for prompt injection
  const questTemplates = useTavernStore((state) => state.questTemplates);
  const questSettings = useTavernStore((state) => state.questSettings);
  const loadQuestTemplates = useTavernStore((state) => state.loadTemplates);
  
  // Ensure quest templates are loaded (needed for action reward → objective completion)
  useEffect(() => {
    if (questTemplates.length === 0) {
      loadQuestTemplates();
    }
  }, []); // Run once on mount

  // Ensure memory namespaces exist when session is restored from localStorage
  // setActiveSession calls ensure-namespace, but on app restore the session is already
  // active without calling setActiveSession, so we ensure namespaces here
  useEffect(() => {
    if (!activeSessionId) return;

    const ensureNamespaces = async () => {
      try {
        const session = useTavernStore.getState().getSessionById(activeSessionId);
        if (!session) return;

        const state = useTavernStore.getState();
        let memberIds: string[] = [];
        let memberNames: string[] = [];

        if (session.groupId) {
          const group = state.getGroupById?.(session.groupId);
          if (group?.members) {
            const groupCharacters = group.members
              .map((m: any) => state.getCharacterById(m.characterId))
              .filter((c: any) => c !== undefined);
            memberIds = groupCharacters.map((c: any) => c.id);
            memberNames = groupCharacters.map((c: any) => c.name);
          }
        }

        const resp = await fetch('/api/embeddings/ensure-namespace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            characterId: session.characterId,
            characterName: session.characterId ? state.getCharacterById?.(session.characterId)?.name : '',
            groupId: session.groupId,
            groupName: session.groupId ? state.getGroupById?.(session.groupId)?.name : undefined,
            memberIds,
            memberNames,
            sessionId: activeSessionId,
          }),
        });

        if (resp.ok) {
          console.log(`[ChatPanel] Ensured memory namespaces for restored session ${activeSessionId.slice(0, 8)}`);
        }
      } catch (err) {
        // Non-blocking — namespaces are created on-demand anyway
        console.warn('[ChatPanel] Failed to ensure namespaces on restore:', err);
      }
    };

    ensureNamespaces();
  }, [activeSessionId]);
  
  // Sound triggers for {{sonidos}} key resolution
  const soundTriggers = useTavernStore((state) => state.soundTriggers);
  
  const setGenerating = useTavernStore((state) => state.setGenerating);
  const addMessage = useTavernStore((state) => state.addMessage);
  const deleteMessage = useTavernStore((state) => state.deleteMessage);
  const updateMessage = useTavernStore((state) => state.updateMessage);
  const updateSession = useTavernStore((state) => state.updateSession);
  const addSwipeAlternative = useTavernStore((state) => state.addSwipeAlternative);
  // UNIFIED SPRITE SYSTEM: Use per-character sprite state management
  const startSpriteGenerationForCharacter = useTavernStore((state) => state.startGenerationForCharacter);
  const endSpriteGenerationForCharacter = useTavernStore((state) => state.endGenerationForCharacter);
  const endSpriteGenerationForCharacterWithTTS = useTavernStore((state) => state.endGenerationForCharacterWithTTS);
  
  // Memory & Summary System - Track messages and generate summaries
  const summarySettings = useTavernStore((state) => state.summarySettings);
  const incrementMessageCount = useTavernStore((state) => state.incrementMessageCount);
  const shouldGenerateSummary = useTavernStore((state) => state.shouldGenerateSummary);
  const setSessionSummary = useTavernStore((state) => state.setSessionSummary);
  const resetMessageCount = useTavernStore((state) => state.resetMessageCount);
  const initSessionTracking = useTavernStore((state) => state.initSessionTracking);
  const getCharacterMemory = useTavernStore((state) => state.getCharacterMemory);
  const deleteMessagesUpTo = useTavernStore((state) => state.deleteMessagesUpTo);

  // Ref to track ongoing generation and prevent race conditions
  const generationIdRef = useRef<string | null>(null);
  const isGenerationInProgressRef = useRef(false);
  
  // Get derived values from subscribed state
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activePersona = personas.find((p) => p.id === activePersonaId);
  
  // Determine if we're in group mode
  const isGroupMode = !!activeGroupId && !!activeGroup;

  // ============================================
  // LOREBOOK SELECTION LOGIC
  // ============================================
  // Normal Chat:
  //   - Character has lorebooks → use those
  //   - Character has NO lorebooks → use empty (no fallback to global)
  //
  // Group Chat:
  //   - Group has lorebooks → use ONLY those (for all characters)
  //   - Group has NO lorebooks → each character uses their own
  //   - Characters without lorebooks get empty (no fallback)
  // ============================================
  
  // Get effective lorebook IDs based on character or group
  const effectiveLorebookIds = useMemo(() => {
    if (isGroupMode) {
      // Group mode: group lorebooks take priority
      if (activeGroup?.lorebookIds && activeGroup.lorebookIds.length > 0) {
        // Group has lorebooks → use only those
        return activeGroup.lorebookIds;
      }
      // Group has NO lorebooks → return empty (will be handled per-character in API)
      return [];
    } else {
      // Normal chat: character lorebooks only, no fallback
      if (activeCharacter?.lorebookIds && activeCharacter.lorebookIds.length > 0) {
        return activeCharacter.lorebookIds;
      }
      // No lorebooks for this character
      return [];
    }
  }, [isGroupMode, activeGroup?.lorebookIds, activeCharacter?.lorebookIds]);

  // For group chat without group lorebooks: build per-character lorebook map
  const characterLorebooksMap = useMemo(() => {
    if (!isGroupMode) return null;
    
    // If group has lorebooks, all characters use those (handled by effectiveLorebookIds)
    if (activeGroup?.lorebookIds && activeGroup.lorebookIds.length > 0) {
      return null;
    }
    
    // Group has NO lorebooks → build per-character map
    const map: Record<string, string[]> = {};
    const groupCharacterIds = activeGroup?.characterIds ?? [];
    
    for (const charId of groupCharacterIds) {
      const char = characters.find(c => c.id === charId);
      map[charId] = char?.lorebookIds ?? []; // Empty if no lorebooks
    }
    
    return map;
  }, [isGroupMode, activeGroup, characters]);

  // ============================================
  // UNIFIED TRIGGER SYSTEM
  // Single hook for all triggers (sound + sprite)
  // This replaces separate useSoundTriggers and useSpriteTriggers hooks
  // ============================================
  const {
    processStreamingContent: processTriggers,
    resetForNewMessage: resetTriggers,
    clearAllState: clearAllTriggerState,
    completePartialMatches: completeTriggersPartialMatches,
  } = useTriggerSystem({
    soundEnabled: settings.sound?.enabled ?? true,
    spriteEnabled: settings.chatLayout.showCharacterSprite,
    maxSoundsPerMessage: settings.sound?.maxSoundsPerMessage ?? 10,
    activePersona: activePersona,
  });
  
  // Background triggers hook (separate for now, will be integrated later)
  const { scanForBackgroundTriggers, resetDetection: resetBgDetection } = useBackgroundTriggers();
  
  // Timeline Sprite Sounds - plays sounds when sprites with timeline sounds are activated
  useTimelineSpriteSounds();
  
  // TTS hook for text-to-speech functionality
  const { 
    speakWithDualVoice, 
    speak, 
    stop: stopTTS, 
    isPlaying: isTTSPlaying,
    ttsConfig,
    isConnected: isTTSConnected,
  } = useTTS();
  
  // Auto-generation TTS - automatically plays TTS for new assistant messages
  // Pass TTS functions and config from parent to avoid creating new instances
  // Use useMemo to stabilize the messages array reference and prevent unnecessary re-renders
  const messages = useMemo(() => {
    return activeSession?.messages.filter(m => !m.isDeleted) || [];
  }, [activeSession?.messages]);
  useTTSAutoGeneration(messages, {
    enabled: true,
    delay: 500,
    speak,
    speakWithDualVoice,
    ttsConfig,
    isPlaying: isTTSPlaying,
    isConnected: isTTSConnected,
  });

  // ============================================
  // PROACTIVE MESSAGES SYSTEM
  // Characters can send messages without user speaking first
  // ============================================
  const {
    isActive: isProactiveActive,
    isConfigured: isProactiveConfigured,
    inactiveReason: proactiveInactiveReason,
    nextIn: proactiveNextIn,
    sessionCount: proactiveSessionCount,
    isGeneratingProactive,
    triggerNow: triggerProactiveNow,
  } = useProactiveMessages({
    isGenerating,
    onProactiveStreamStart: useCallback((characterId: string, characterName: string) => {
      // Find the character and set streaming state
      const char = characters.find(c => c.id === characterId) || activeCharacter;
      if (char) {
        setStreamingCharacter(char);
        setStreamingContent('');
      }
    }, [characters, activeCharacter]),
    onProactiveStreamToken: useCallback((token: string) => {
      setStreamingContent(prev => prev + token);
    }, []),
    onProactiveStreamEnd: useCallback(() => {
      setStreamingContent('');
      setStreamingCharacter(null);
    }, []),
  });
  
  // Track current streaming message key for triggers
  const streamingMessageKeyRef = useRef<string>('');

  // ============================================
  // HUD SYNCHRONIZATION
  // Auto-activate HUD based on character/group
  // ============================================
  useEffect(() => {
    // Determine the HUD template to use
    const hudTemplateId = isGroupMode
      ? activeGroup?.hudTemplateId
      : activeCharacter?.hudTemplateId;

    // Only update if different from current
    if (hudTemplateId !== hudSessionState.activeTemplateId) {
      setActiveHUD(hudTemplateId || null);
    }
  }, [isGroupMode, activeGroup?.hudTemplateId, activeCharacter?.hudTemplateId, hudSessionState.activeTemplateId, setActiveHUD]);

  // Get active HUD context for prompt injection
  const activeHUDContext = useMemo(() => {
    const activeTemplate = hudTemplates.find(t => t.id === hudSessionState.activeTemplateId);
    if (activeTemplate?.context?.enabled && activeTemplate.context.content.trim()) {
      return activeTemplate.context;
    }
    return undefined;
  }, [hudTemplates, hudSessionState.activeTemplateId]);

  // Pending item message (inventory → chat injection)
  const pendingItemMessage = useTavernStore((state) => state.pendingItemMessage);
  const clearPendingItemMessage = useTavernStore((state) => state.clearPendingItemMessage);

  // Sync ref with store state
  useEffect(() => {
    if (!isGenerating && isGenerationInProgressRef.current) {
      // Store says not generating but we think we are - cleanup
      isGenerationInProgressRef.current = false;
      generationIdRef.current = null;
    }
  }, [isGenerating]);

  // ============================================
  // MEMORY & SUMMARY INTEGRATION
  // Generates summaries when threshold is reached
  // ============================================
  
  // Initialize session tracking when session changes
  useEffect(() => {
    if (activeSessionId && summarySettings.enabled) {
      initSessionTracking(activeSessionId, isGroupMode);
    }
  }, [activeSessionId, summarySettings.enabled, isGroupMode, initSessionTracking]);

  // Function to generate summary when threshold is reached
  const generateSummaryIfNeeded = useCallback(async () => {
    if (!activeSessionId || !summarySettings.enabled || !summarySettings.autoSummarize) {
      return;
    }

    // Check if we should generate a summary
    if (!shouldGenerateSummary(activeSessionId)) {
      return;
    }

    try {
      chatLogger.info('[Memory] Generating summary for session', { sessionId: activeSessionId });

      // Get the current session's messages
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const messages = currentSession?.messages || [];
      const visibleMessages = messages.filter(m => !m.isDeleted);

      // Get the messages to summarize (all except recent ones to keep)
      const messagesToSummarize = visibleMessages.slice(0, -summarySettings.keepRecentMessages);
      
      if (messagesToSummarize.length === 0) {
        return;
      }

      // Get the current summary from the session for incremental update
      const previousSummary = currentSession?.summary?.content;

      // Get LLM config for summary generation
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        chatLogger.warn('[Memory] No active LLM config for summary generation');
        return;
      }

      // Get character name(s) for summary
      const characterName = isGroupMode 
        ? activeGroup?.name || 'Group'
        : activeCharacter?.name || 'Character';

      // Call summary API
      const response = await fetch('/api/chat/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSummarize,
          characterName,
          userName: activePersona?.name || 'User',
          settings: summarySettings,
          previousSummary,
          apiConfig: {
            provider: activeLLMConfig.provider,
            endpoint: activeLLMConfig.endpoint || '',
            apiKey: activeLLMConfig.apiKey,
            model: summarySettings.model || activeLLMConfig.model,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Summary generation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.summary) {
        // Save summary directly to session (overwrites previous)
        setSessionSummary(activeSessionId, {
          content: data.summary.content,
          messageRange: data.summary.messageRange,
          tokens: data.summary.tokens,
          createdAt: data.summary.createdAt,
          model: data.summary.model,
        });
        
        // Delete old messages that were summarized (keep recent ones + first message)
        deleteMessagesUpTo(activeSessionId, summarySettings.keepRecentMessages);
        
        // Reset message count after successful summary
        resetMessageCount(activeSessionId);
        
        chatLogger.info('[Memory] Summary generated successfully', { 
          sessionId: activeSessionId,
          tokens: data.summary.tokens,
          messagesDeleted: messagesToSummarize.length
        });
      } else if (data.error) {
        chatLogger.warn('[Memory] Summary generation returned error', { error: data.error });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      chatLogger.error('[Memory] Summary generation error', { error: errorMessage });
    }
  }, [
    activeSessionId, 
    summarySettings, 
    shouldGenerateSummary, 
    activeSession,
    setSessionSummary, 
    resetMessageCount,
    deleteMessagesUpTo,
    isGroupMode,
    activeGroup,
    activeCharacter,
    activePersona
  ]);

  const handleSend = useCallback(async (userMessage: string) => {
    // Double-check using both state and ref to prevent race conditions
    if (!userMessage.trim()) return;
    if (isGenerating || isGenerationInProgressRef.current) return;
    if (!activeSessionId) return;
    
    // For group mode, we don't need activeCharacter
    if (!isGroupMode && !activeCharacter) return;

    // Ensure quest templates are loaded before building the prompt
    // This prevents race condition where templates aren't available on first message
    if (questTemplates.length === 0) {
      try {
        await loadQuestTemplates();
      } catch {}
    }
    // CRITICAL: Always re-read quest data from the store to avoid stale closures
    // The React hook selector captures values at render time, but handleSend is async
    const latestQuestTemplates = useTavernStore.getState().questTemplates;
    const latestQuestSettings = useTavernStore.getState().questSettings;

    // Generate a unique ID for this generation
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    generationIdRef.current = generationId;
    isGenerationInProgressRef.current = true;

    setGenerating(true);
    setStreamingContent('');
    setStreamingCharacter(null);
    setStreamingProgress(null);
    setEmbeddingsContexts([]);
    
    // Generate a unique message key for this streaming session
    const messageKey = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    streamingMessageKeyRef.current = messageKey;
    resetBgDetection(messageKey);
    // Reset trigger system state for new message (important for peticiones/solicitudes detection)
    resetTriggers(messageKey, activeCharacter);
    
    // Start sprite generation for the character (single mode)
    // This initializes the per-character state for proper sprite tracking
    if (!isGroupMode && activeCharacter) {
      startSpriteGenerationForCharacter(activeCharacter.id);
    }

    // Add user message
    addMessage(activeSessionId, {
      characterId: activeCharacter?.id || 'user',
      role: 'user',
      content: userMessage.trim(),
      isDeleted: false,
      swipeId: generateId(),
      swipeIndex: 0
    });

    // Helper to check if this generation is still the active one
    const isStillActive = () => generationIdRef.current === generationId;

    try {
      // Get the active LLM config
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        throw new Error(t('chat.noLLM'));
      }

      // Get current session data (re-read to get latest quest instances)
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const currentMessages = currentSession?.messages || [];
      const currentSessionQuests = currentSession?.sessionQuests || [];

      // Check if streaming is enabled
      const useStreaming = activeLLMConfig.parameters.stream;
      
      // Get context settings from store
      const contextConfig = settings.context;

      // Handle group chat
      if (isGroupMode && activeGroup) {
        // Get group characters
        const groupCharacterIds = activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || [];
        const groupCharacters = characters.filter(c => groupCharacterIds.includes(c.id));
        
        if (groupCharacters.length === 0) {
          throw new Error(t('chat.noGroupCharacters'));
        }

        // Get active lorebooks for prompt injection
        const activeLorebooks = lorebooks.filter(lb => effectiveLorebookIds.includes(lb.id) && activeLorebookIds.includes(lb.id));
        
        // Get session stats for attribute values
        const sessionStats = currentSession?.sessionStats;

        // Build allCharacters array including persona as pseudo-character for peticiones/solicitudes
        const allCharactersWithPersona = [
          ...characters,
          ...(activePersona?.statsConfig?.enabled ? [{
            id: '__user__',
            name: activePersona.name || 'User',
            statsConfig: activePersona.statsConfig,
          }] as CharacterCard[] : []),
        ];

        // Use group streaming endpoint
        const response = await fetch('/api/chat/group-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            groupId: activeGroupId,
            group: activeGroup,
            characters: groupCharacters,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig,
            lorebooks: activeLorebooks,
            // Pass per-character lorebooks when group has no lorebooks
            characterLorebooksMap: characterLorebooksMap,
            sessionStats,  // Pass session stats for attribute values
            sessionQuests: currentSessionQuests,  // Pass session quests (freshly read)
            questTemplates: latestQuestTemplates,  // Pass quest templates (freshly read)
            questSettings: latestQuestSettings,  // Pass quest settings (freshly read)
            hudContext: activeHUDContext,  // Pass HUD context for prompt injection
            allCharacters: allCharactersWithPersona,  // Pass all characters + persona for peticiones/solicitudes
            toolsSettings: settings.tools,  // Pass tools settings for group chat tool-calling
            soundTriggers,  // Pass sound triggers for {{sonidos}} resolution
            settings,  // Pass settings for {{sonidos}} template
            embeddingsChat: {
              ...settings.embeddingsChat,
              customNamespaces: activeGroup?.embeddingNamespaces,
            },  // Pass embeddings chat settings + group namespace override
            inventoryData: (() => {
              const invState = useTavernStore.getState();
              const invSettings = invState.inventorySettings;
              if (!invSettings.enabled || !invSettings.promptInclude) return undefined;
              const personaId = activePersona?.id || 'default';
              return {
                personaItems: invState.getPersonaItems(personaId),
                equippedItems: invState.getEquippedItems(personaId),
                activeEffects: invState.activeConsumableEffects.filter(e => e.personaId === personaId),
                pendingFallbacks: invState.pendingFallbacks || [],
                currency: activePersona?.currency ?? 0,
                currencyName: activePersona?.currencyName || invSettings.currencyName,
                currencyIcon: activePersona?.currencyIcon || invSettings.currencyIcon,
                inventorySettings: invSettings,
              };
            })(),  // Pass inventory data for prompt injection
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText || t('chat.error.streaming') }));
          throw new Error(errorData.error || t('chat.error.streaming'));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let currentCharacterContent = '';
        let currentCharacter: CharacterCard | null = null;
        // Track group extraction flag from 'done' event
        let groupShouldExtract = false;
        let groupResponses: Array<{ characterId: string; characterName: string; content: string }> = [];

        try {
          while (true) {
            // Check if generation was cancelled
            if (!isStillActive()) {
              reader.cancel();
              break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              const dataMatch = message.match(/^data: (.+)$/s);
              if (!dataMatch) continue;
              
              const data = dataMatch[1];
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'user_turn') {
                  // Group chat reactive strategy detected a peticion targeting the user
                  // Stop generation and let user respond
                  chatLogger.info('Turn stopped for user response', { reason: parsed.reason });
                  setStreamingProgress(null);
                  setStreamingCharacter(null);
                  setGenerating(false);
                  // Optionally show a toast notification
                  return;
                } else if (parsed.type === 'embeddings_context' && parsed.data) {
                  // Embeddings context was retrieved for this character
                  setEmbeddingsContexts(prev => [...prev, {
                    ...parsed.data,
                    characterId: parsed.characterId,
                    characterName: parsed.characterName,
                  }]);
                } else if (parsed.type === 'memory_extracting') {
                  // Memory extraction is running in background
                  const names = parsed.characterNames || parsed.characterName || '';
                  const label = Array.isArray(names) ? names.join(', ') : names;
                  if (label) {
                    setMemoryExtractingInfo({ active: true, characterNames: label });
                    setTimeout(() => setMemoryExtractingInfo(prev => ({ ...prev, active: false })), 8000);
                  }
                } else if (parsed.type === 'tool_call_start') {
                  // Tool call detected - show indicator
                  console.log('[ChatPanel] Tool call started:', parsed.toolName);
                  setToolCallInfo({
                    active: true,
                    toolName: parsed.toolName,
                    toolLabel: parsed.toolLabel,
                    toolIcon: parsed.toolIcon,
                    params: parsed.params,
                    phase: 'executing',
                    callId: parsed.callId,
                  });
                } else if (parsed.type === 'tool_call_result') {
                  // Tool execution completed
                  console.log('[ChatPanel] Tool call result:', parsed.toolName, parsed.success);
                  setToolCallInfo(prev => ({
                    ...prev,
                    active: true,
                    result: { success: parsed.success, displayMessage: parsed.displayMessage, duration: parsed.duration || 0 },
                    phase: 'done',
                    callId: parsed.callId,
                  }));
                  setTimeout(() => setToolCallInfo(prev => ({ ...prev, active: false, phase: 'idle' })), 5000);
                } else if (parsed.type === 'tool_call_error') {
                  // Tool call error
                  console.log('[ChatPanel] Tool call error:', parsed.error);
                  setToolCallInfo(prev => ({
                    ...prev,
                    active: true,
                    result: { success: false, displayMessage: parsed.error, duration: 0 },
                    phase: 'error',
                    callId: parsed.callId,
                  }));
                  setTimeout(() => setToolCallInfo(prev => ({ ...prev, active: false, phase: 'idle' })), 5000);
                } else if (parsed.type === 'quest_activation') {
                  // Quest objective was completed by a tool - execute on client side
                  console.log('[ChatPanel] Quest activation from tool:', parsed.toolName, parsed.activationType, parsed.key);
                  // Execute the objective completion on the CLIENT where the store has real data.
                  // store.completeObjective handles everything:
                  //   - Marks objective as completed
                  //   - Executes objective rewards (attribute, trigger, objective chain)
                  //   - Auto-completes quest if all required objectives done
                  //   - Executes quest rewards on auto-completion
                  //   - Activates quest chain if defined
                  //   - Adds notifications
                  if (parsed.activationType === 'complete_objective' && parsed.metadata && !parsed.metadata.alreadyCompleted) {
                    const store = useTavernStore.getState();
                    store.completeObjective?.(
                      activeSessionId,
                      parsed.metadata.questTemplateId,
                      parsed.metadata.objectiveId,
                      parsed.metadata.characterId,
                    );
                  }
                  // Show immediate toast feedback (store notifications handle quest completion separately)
                  if (!parsed.metadata?.alreadyCompleted && parsed.metadata?.objectiveName) {
                    toast.success(`Objetivo completado: ${parsed.metadata.objectiveName}`);
                  }
                } else if (parsed.type === 'action_activation') {
                  // Action/skill activated by tool - execute on client side
                  console.log('[ChatPanel] Action activation from tool:', parsed.toolName, parsed.skillName);
                  const store = useTavernStore.getState();
                  store.activateSkillByTool?.(
                    activeSessionId,
                    parsed.characterId,
                    parsed.skillName,
                    parsed.skillDescription || '',
                    parsed.activationCosts || [],
                    parsed.activationRewards || [],
                    parsed.skillCompletedDescription || '',
                  );
                  toast.success(`⚔️ Acción: ${parsed.skillName}`);
                } else if (parsed.type === 'solicitud_activation') {
                  // Solicitud activated/completed by tool - execute on client side
                  console.log('[ChatPanel] Solicitud activation from tool:', parsed.toolName, parsed.activationType, parsed.solicitudKey);
                  const store = useTavernStore.getState();
                  if (parsed.activationType === 'create_solicitud' && parsed.targetCharacterId) {
                    store.createSolicitud?.(
                      activeSessionId,
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
                      activeSessionId,
                      parsed.fromCharacterId,
                      parsed.solicitudKey
                    );
                    toast.success(`✅ Solicitud completada: ${parsed.solicitudKey}`);
                  }
                } else if (parsed.type === 'memory_activation') {
                  // Memory tool activation - sync to client-side Character Memory (Zustand)
                  console.log('[ChatPanel] Memory activation from tool:', parsed.toolName, parsed.activationType);
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
                } else if (parsed.type === 'character_start') {
                  currentCharacterContent = '';
                  const char = groupCharacters.find(c => c.id === parsed.characterId);
                  currentCharacter = char || null;
                  setStreamingCharacter(currentCharacter);
                  setStreamingProgress({
                    current: parsed.responseIndex,
                    total: parsed.totalResponses
                  });
                  setStreamingContent('');
                  
                  // UNIFIED SPRITE SYSTEM: Start sprite generation for this character
                  // Each character in the group gets independent sprite tracking
                  if (currentCharacter) {
                    console.log('[ChatPanel] Group - Starting sprite generation for:', currentCharacter.name);
                    startSpriteGenerationForCharacter(currentCharacter.id);
                    
                    // Create a unique messageKey for this character's triggers
                    const characterMessageKey = `${streamingMessageKeyRef.current}_${currentCharacter.id}`;
                    // Reset triggers for this specific character
                    resetTriggers(characterMessageKey, currentCharacter);
                  }
                } else if (parsed.type === 'token' && parsed.content) {
                  currentCharacterContent += parsed.content;
                  setStreamingContent(currentCharacterContent);
                  // UNIFIED TRIGGER SYSTEM: Process sound + sprite triggers in single pass
                  // CRITICAL: Use unique messageKey per character to avoid position conflicts
                  const characterMessageKey = `${streamingMessageKeyRef.current}_${currentCharacter?.id || 'unknown'}`;
                  try {
                    processTriggers(currentCharacterContent, currentCharacter, characterMessageKey, groupCharacters);
                  } catch (triggerError) {
                    console.error('[ChatPanel] Group trigger processing error:', triggerError);
                    // Don't throw - continue streaming even if triggers fail
                  }
                  try {
                    scanForBackgroundTriggers(currentCharacterContent, streamingMessageKeyRef.current);
                  } catch (bgError) {
                    console.error('[ChatPanel] Group background trigger error:', bgError);
                    // Don't throw - continue streaming even if background triggers fail
                  }
                } else if (parsed.type === 'character_done') {
                  if (parsed.fullContent && activeSessionId && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: parsed.characterId,
                      role: 'assistant',
                      content: parsed.fullContent,
                      isDeleted: false,
                      swipeId: generateId(),
                      swipeIndex: 0,
                      isNarratorMessage: parsed.isNarrator || false,
                      metadata: {
                        promptData: parsed.promptSections || []
                      }
                    });

                    // Tick inventory consumable effects after each character response in group
                    const invState = useTavernStore.getState();
                    if (invState.inventorySettings.enabled && activePersona?.id) {
                      const expiredMessages = invState.tickEffects(activePersona.id);
                      if (expiredMessages.length > 0) {
                        invState.removeExpiredEffects(activePersona.id);
                        for (const msg of expiredMessages) {
                          toast.info(msg);
                        }
                      }
                    }
                  }
                  
                  // UNIFIED SPRITE SYSTEM: End sprite generation for this character
                  // This properly handles the return to idle if trigger was activated
                  // IMPORTANT: Only end for the character that just finished, not others
                  const finishedChar = groupCharacters.find(c => c.id === parsed.characterId);
                  if (finishedChar) {
                    console.log('[ChatPanel] Group - Ending sprite generation for:', finishedChar.name);
                    
                    // CRITICAL: Complete any pending partial matches (key:value at end of text)
                    // This ensures trigger sprites like "sprite:test01" are properly detected
                    // Use unique messageKey per character to avoid position conflicts
                    const characterMessageKey = `${streamingMessageKeyRef.current}_${finishedChar.id}`;
                    completeTriggersPartialMatches(characterMessageKey, finishedChar, groupCharacters);
                    
                    const ttsExpected = !!(ttsConfig?.enabled && ttsConfig?.autoGeneration && isTTSConnected);
                    endSpriteGenerationForCharacterWithTTS(finishedChar.id, ttsExpected);
                  }
                  
                  setStreamingContent('');
                  setStreamingCharacter(null);
                } else if (parsed.type === 'character_error') {
                  chatLogger.error(`Character ${parsed.characterName} error`, { error: parsed.error });
                  if (activeSessionId && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: parsed.characterId,
                      role: 'system',
                      content: `⚠️ ${parsed.characterName}: ${parsed.error}`,
                      isDeleted: false,
                      swipeId: generateId(),
                      swipeIndex: 0
                    });
                  }
                } else if (parsed.type === 'done') {
                  // Group stream done - capture shouldExtract flag and responses
                  groupShouldExtract = !!parsed.shouldExtract;
                  groupResponses = (parsed.responses || []) as Array<{ characterId: string; characterName: string; content: string }>;
                } else if (parsed.type === 'error') {
                  // Preserve any accumulated group content before throwing
                  if (accumulatedContent.trim() && activeSessionId && isStillActive()) {
                    chatLogger.warn('Group stream error with partial content', {
                      contentLength: accumulatedContent.length,
                      error: parsed.error,
                    });
                  }
                  throw new Error(parsed.error || 'Error en la generación del servidor');
                }
              } catch (parseError) {
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                chatLogger.debug('Failed to parse SSE data (group)', { data });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        setStreamingProgress(null);
        
        // Client-side memory extraction for group chat
        // Triggered after the stream is fully processed, if server flagged shouldExtract
        if (groupShouldExtract && isStillActive() && activeSessionId) {
          const extractableChars = groupResponses.filter(r => r.content && r.content.length > 50);
          if (extractableChars.length > 0) {
            const charNames = extractableChars.map(r => r.characterName).join(', ');
            setMemoryExtractingInfo({ active: true, characterNames: charNames });
            
            // Run extraction asynchronously (don't block the UI)
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
                        const role = m.role === 'user' ? 'Jugador' : 'Personaje';
                        return `${role}: ${m.content.trim().slice(0, 300)}`;
                      })
                      .join('\n  ');
                  }
                }
                
                let totalSaved = 0;
                
                // Extract last user message for user-memory extraction
                const lastUserMsg = sessionMsgs
                  .filter(m => m.role === 'user' && !m.isDeleted)
                  .slice(-2, -1)[0]?.content;
                
                for (const resp of extractableChars) {
                  try {
                    const extractionResponse = await fetch('/api/embeddings/extract-memory', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        lastMessage: resp.content,
                        characterName: resp.characterName,
                        characterId: resp.characterId,
                        sessionId: activeSessionId,
                        groupId: activeGroupId,
                        userName: personaName,
                        extractFromUser: embeddingsChat.memoryExtractionFromUserEnabled === true,
                        lastUserMessage: lastUserMsg,
                        llmConfig: {
                          provider: currentLLMConfig.provider,
                          endpoint: currentLLMConfig.endpoint,
                          apiKey: currentLLMConfig.apiKey,
                          model: currentLLMConfig.model,
                          parameters: currentLLMConfig.parameters,
                        },
                        minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                        customPrompt: embeddingsChat.groupMemoryExtractionPrompt || embeddingsChat.memoryExtractionPrompt,
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
                        totalSaved += result.saved || 0;
                        console.log(`[Memory] Group extraction result for ${resp.characterName}: extracted=${result.count}, saved=${result.saved}`);
                        
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
                      }
                    }
                  } catch (err) {
                    console.warn(`[Memory] Group extraction failed for ${resp.characterName}:`, err);
                  }
                }
                
                // Also trigger group dynamics extraction if enabled
                if (embeddingsChat.groupDynamicsExtraction && extractableChars.length > 1) {
                  try {
                    const turnLines: string[] = [];
                    const lastUserMsg = sessionMsgs.filter(m => m.role === 'user' && !m.isDeleted).slice(-1)[0];
                    if (lastUserMsg) {
                      turnLines.push(`Jugador: ${lastUserMsg.content.trim().slice(0, 500)}`);
                    }
                    for (const resp of extractableChars) {
                      turnLines.push(`${resp.characterName}: ${resp.content.trim().slice(0, 500)}`);
                    }
                    const fullTurnContext = turnLines.join('\n');
                    
                    if (fullTurnContext.length > 100) {
                      await fetch('/api/embeddings/extract-group-dynamics', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          turnContext: fullTurnContext,
                          groupId: activeGroupId,
                          sessionId: activeSessionId,
                          llmConfig: {
                            provider: currentLLMConfig.provider,
                            endpoint: currentLLMConfig.endpoint,
                            apiKey: currentLLMConfig.apiKey,
                            model: currentLLMConfig.model,
                            parameters: currentLLMConfig.parameters,
                          },
                          minImportance: embeddingsChat.memoryExtractionMinImportance || 2,
                        }),
                      });
                    }
                  } catch (dynErr) {
                    console.warn('[Memory] Group dynamics extraction failed (non-blocking):', dynErr);
                  }
                }
                
                if (totalSaved > 0) {
                  toast.success(`🧠 ${totalSaved} memorias extraídas automáticamente`);
                }
              } catch (err) {
                console.warn('[Memory] Group client-side extraction failed:', err);
              } finally {
                setMemoryExtractingInfo(prev => ({ ...prev, active: false }));
              }
            })();
          }
        }
        
        return;
      }

      // Single character chat
      if (!activeCharacter) return;

      // Get active lorebooks for prompt injection
      const activeLorebooks = lorebooks.filter(lb => effectiveLorebookIds.includes(lb.id) && activeLorebookIds.includes(lb.id));
      
      // Get session stats for attribute values
      const sessionStats = currentSession?.sessionStats;

      if (useStreaming) {
        // Build allCharacters array including persona as pseudo-character for peticiones/solicitudes
        const allCharactersWithPersona = [
          ...characters,
          ...(activePersona?.statsConfig?.enabled ? [{
            id: '__user__',
            name: activePersona.name || 'User',
            statsConfig: activePersona.statsConfig,
          }] as CharacterCard[] : []),
        ];

        // ===== DEBUG: Lorebook Attribute Resolution Tracing =====
        console.group('%c[Lorebook DEBUG] Frontend → Backend Data', 'color: #e65100; font-weight: bold');
        console.log('%c--- Lorebook Selection Debug ---', 'color: #d32f2f; font-weight: bold', {
          isGroupMode,
          characterId: activeCharacter?.id,
          characterName: activeCharacter?.name,
          characterLorebookIds: activeCharacter?.lorebookIds,
          effectiveLorebookIds,
          activeLorebookIds,
          allLorebookIds: lorebooks.map(lb => ({ id: lb.id, name: lb.name, active: lb.active })),
          activeLorebooksCount: activeLorebooks.length,
        });
        console.log('%c--- Active Lorebooks ---', 'color: #1565c0; font-weight: bold', activeLorebooks.map(lb => ({

          id: lb.id,
          name: lb.name,
          active: lb.active,
          entries: lb.entries.filter(e => e.entryType === 'attribute').map(e => ({
            entryType: e.entryType,
            disable: e.disable,
            attributeConfig: e.attributeConfig ? {
              characterId: e.attributeConfig.characterId,
              attributeKey: e.attributeConfig.attributeKey,
              injectionKey: e.attributeConfig.injectionKey,
              mode: e.attributeConfig.mode,
              staticCondition: e.attributeConfig.staticCondition,
              dynamicConditions: e.attributeConfig.dynamicConditions?.map(dc => ({
                operator: dc.operator,
                value: dc.value,
                content: dc.content?.slice(0, 80),
              })),
            } : null,
          })),
        })));
        console.log('%c--- Session Stats ---', 'color: #1565c0; font-weight: bold', {
          hasSessionStats: !!sessionStats,
          initialized: sessionStats?.initialized,
          characterStatsKeys: sessionStats ? Object.keys(sessionStats.characterStats || {}) : [],
          userStats: sessionStats?.characterStats?.['__user__']
            ? {
                hasAttrValues: !!sessionStats.characterStats['__user__'].attributeValues,
                attributes: { ...sessionStats.characterStats['__user__'].attributeValues },
              }
            : '(no __user__ stats)',
          charStats: sessionStats?.characterStats?.[activeCharacter?.id]
            ? {
                hasAttrValues: !!sessionStats.characterStats[activeCharacter!.id].attributeValues,
                attributes: { ...sessionStats.characterStats[activeCharacter!.id].attributeValues },
              }
            : `(no stats for char ${activeCharacter?.id})`,
        });
        console.log('%c--- All Characters (with Persona) ---', 'color: #1565c0; font-weight: bold', allCharactersWithPersona.map(c => ({
          id: c.id,
          name: c.name,
          hasStatsConfig: !!c.statsConfig,
          attributes: c.statsConfig?.attributes?.map(a => ({ key: a.key, name: a.name })),
        })));
        console.groupEnd();
        // ===== END DEBUG =====

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig,
            lorebooks: activeLorebooks,
            sessionStats,  // Pass session stats for attribute values
            sessionQuests: currentSessionQuests,  // Pass session quests (freshly read)
            questTemplates: latestQuestTemplates,  // Pass quest templates (freshly read)
            questSettings: latestQuestSettings,  // Pass quest settings (freshly read)
            hudContext: activeHUDContext,  // Pass HUD context for prompt injection
            summary: activeSession?.summary,  // Pass session summary (single, not array)
            allCharacters: allCharactersWithPersona,  // Pass all characters + persona for peticiones/solicitudes
            soundTriggers,  // Pass sound triggers for {{sonidos}} resolution
            settings,  // Pass settings for {{sonidos}} template
            characterMemory: activeCharacter ? getCharacterMemory(activeCharacter.id) : undefined,  // Pass character memory (events, relationships, notes)
            embeddingsChat: {
              ...settings.embeddingsChat,
              customNamespaces: activeCharacter?.embeddingNamespaces,
            },  // Pass embeddings chat settings + character namespace override
            toolsSettings: settings.tools,  // Pass tool calling configuration
            inventoryData: (() => {
              const invState = useTavernStore.getState();
              const invSettings = invState.inventorySettings;
              if (!invSettings.enabled || !invSettings.promptInclude) return undefined;
              const personaId = activePersona?.id || 'default';
              return {
                personaItems: invState.getPersonaItems(personaId),
                equippedItems: invState.getEquippedItems(personaId),
                activeEffects: invState.activeConsumableEffects.filter(e => e.personaId === personaId),
                pendingFallbacks: invState.pendingFallbacks || [],
                currency: activePersona?.currency ?? 0,
                currencyName: activePersona?.currencyName || invSettings.currencyName,
                currencyIcon: activePersona?.currencyIcon || invSettings.currencyIcon,
                inventorySettings: invSettings,
              };
            })(),  // Pass inventory data for prompt injection
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText || t('chat.error.streaming') }));
          throw new Error(errorData.error || t('chat.error.streaming'));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let buffer = '';
        let promptSections: { type: string; label: string; content: string; color: string }[] = [];

        try {
          while (true) {
            // Check if generation was cancelled
            if (!isStillActive()) {
              reader.cancel();
              break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';

            for (const message of messages) {
              const dataMatch = message.match(/^data: (.+)$/s);
              if (!dataMatch) continue;
              
              const data = dataMatch[1];
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'prompt_data' && parsed.promptSections) {
                  // Capture prompt sections for metadata
                  promptSections = parsed.promptSections;
                } else if (parsed.type === 'lorebook_debug') {
                  // DEBUG: Backend lorebook attribute resolution results
                  console.group('%c[Lorebook DEBUG] Backend Resolution Results', 'color: #e65100; font-weight: bold');
                  console.log('%c--- Final Keys ---', 'color: #2e7d32; font-weight: bold', parsed.lorebookAttributeKeys);
                  console.log('%c--- Per-Entry Debug ---', 'color: #2e7d32; font-weight: bold', parsed.debugEntries);
                  if (parsed.debugEntries) {
                    for (const entry of parsed.debugEntries) {
                      const statusColor = entry.finalResult === '(empty)' ? '#c62828' : '#2e7d32';
                      console.log(
                        `%c[${entry.attributeValue === null ? '⚠ NOT FOUND' : entry.conditionResults.some(c => c.matched) ? '✓ MATCHED' : '✗ NO MATCH'}] ` +
                        `{{${entry.injectionKey}}} | char=${entry.characterId}→${entry.resolvedCharId} | ` +
                        `attr=${entry.attributeKey} | value=${JSON.stringify(entry.attributeValue)} | ` +
                        `mode=${entry.mode}`,
                        `color: ${statusColor}; font-weight: bold`
                      );
                      if (entry.conditionResults.length > 0) {
                        for (const cr of entry.conditionResults) {
                          const cColor = cr.matched ? '#2e7d32' : '#c62828';
                          console.log(`  %c  ${cr.evaluationDetail}  content: "${(cr.content || '').slice(0, 60)}"`, `color: ${cColor}`);
                        }
                      }
                    }
                  }
                  console.log('%c--- Available Stats ---', 'color: #2e7d32; font-weight: bold', parsed.availableStats);
                  console.groupEnd();
                } else if (parsed.type === 'embeddings_context' && parsed.data) {
                  // Embeddings context was retrieved
                  setEmbeddingsContexts(prev => [...prev, parsed.data]);
                } else if (parsed.type === 'memory_extracting') {
                  // Memory extraction is running in background
                  const label = parsed.characterName || '';
                  if (label) {
                    setMemoryExtractingInfo({ active: true, characterNames: label });
                    setTimeout(() => setMemoryExtractingInfo(prev => ({ ...prev, active: false })), 8000);
                  }
                } else if (parsed.type === 'tool_call_start') {
                  // Tool call detected - show indicator
                  console.log('[ChatPanel] Tool call started:', parsed.toolName);
                  setToolCallInfo({
                    active: true,
                    toolName: parsed.toolName,
                    toolLabel: parsed.toolLabel,
                    toolIcon: parsed.toolIcon,
                    params: parsed.params,
                    phase: 'executing',
                    callId: parsed.callId,
                  });
                } else if (parsed.type === 'tool_call_result') {
                  // Tool execution completed
                  console.log('[ChatPanel] Tool call result:', parsed.toolName, parsed.success);
                  setToolCallInfo(prev => ({
                    ...prev,
                    active: true,
                    result: { success: parsed.success, displayMessage: parsed.displayMessage, duration: parsed.duration || 0 },
                    phase: 'done',
                    callId: parsed.callId,
                  }));
                  setTimeout(() => setToolCallInfo(prev => ({ ...prev, active: false, phase: 'idle' })), 5000);
                } else if (parsed.type === 'tool_call_error') {
                  // Tool call error
                  console.log('[ChatPanel] Tool call error:', parsed.error);
                  setToolCallInfo(prev => ({
                    ...prev,
                    active: true,
                    result: { success: false, displayMessage: parsed.error, duration: 0 },
                    phase: 'error',
                    callId: parsed.callId,
                  }));
                  setTimeout(() => setToolCallInfo(prev => ({ ...prev, active: false, phase: 'idle' })), 5000);
                } else if (parsed.type === 'quest_activation') {
                  // Quest objective was completed by a tool - execute on client side
                  console.log('[ChatPanel] Quest activation from tool:', parsed.toolName, parsed.activationType, parsed.key);
                  // Execute the objective completion on the CLIENT where the store has real data.
                  // store.completeObjective handles everything:
                  //   - Marks objective as completed
                  //   - Executes objective rewards (attribute, trigger, objective chain)
                  //   - Auto-completes quest if all required objectives done
                  //   - Executes quest rewards on auto-completion
                  //   - Activates quest chain if defined
                  //   - Adds notifications
                  if (parsed.activationType === 'complete_objective' && parsed.metadata && !parsed.metadata.alreadyCompleted) {
                    const store = useTavernStore.getState();
                    store.completeObjective?.(
                      activeSessionId,
                      parsed.metadata.questTemplateId,
                      parsed.metadata.objectiveId,
                      parsed.metadata.characterId,
                    );
                  }
                  // Show immediate toast feedback (store notifications handle quest completion separately)
                  if (!parsed.metadata?.alreadyCompleted && parsed.metadata?.objectiveName) {
                    toast.success(`Objetivo completado: ${parsed.metadata.objectiveName}`);
                  }
                } else if (parsed.type === 'action_activation') {
                  // Action/skill activated by tool - execute on client side
                  console.log('[ChatPanel] Action activation from tool:', parsed.toolName, parsed.skillName);
                  const store = useTavernStore.getState();
                  store.activateSkillByTool?.(
                    activeSessionId,
                    parsed.characterId,
                    parsed.skillName,
                    parsed.skillDescription || '',
                    parsed.activationCosts || [],
                    parsed.activationRewards || [],
                    parsed.skillCompletedDescription || '',
                  );
                  toast.success(`⚔️ Acción: ${parsed.skillName}`);
                } else if (parsed.type === 'solicitud_activation') {
                  // Solicitud activated/completed by tool - execute on client side
                  console.log('[ChatPanel] Solicitud activation from tool:', parsed.toolName, parsed.activationType, parsed.solicitudKey);
                  const store = useTavernStore.getState();
                  if (parsed.activationType === 'create_solicitud' && parsed.targetCharacterId) {
                    store.createSolicitud?.(
                      activeSessionId,
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
                      activeSessionId,
                      parsed.fromCharacterId,
                      parsed.solicitudKey
                    );
                    toast.success(`✅ Solicitud completada: ${parsed.solicitudKey}`);
                  }
                } else if (parsed.type === 'memory_activation') {
                  // Memory tool activation - sync to client-side Character Memory (Zustand)
                  console.log('[ChatPanel] Memory activation from tool:', parsed.toolName, parsed.activationType);
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
                } else if (parsed.type === 'token' && parsed.content) {
                  accumulatedContent += parsed.content;
                  setStreamingContent(accumulatedContent);
                  // UNIFIED TRIGGER SYSTEM: Process sound + sprite triggers in single pass
                  // Pass allCharactersWithPersona for peticiones/solicitudes system
                  try {
                    processTriggers(accumulatedContent, activeCharacter, streamingMessageKeyRef.current, allCharactersWithPersona);
                  } catch (triggerError) {
                    console.error('[ChatPanel] Trigger processing error:', triggerError);
                    // Don't throw - continue streaming even if triggers fail
                  }
                  try {
                    scanForBackgroundTriggers(accumulatedContent, streamingMessageKeyRef.current);
                  } catch (bgError) {
                    console.error('[ChatPanel] Background trigger error:', bgError);
                    // Don't throw - continue streaming even if background triggers fail
                  }
                } else if (parsed.type === 'error') {
                  // If we have accumulated content, save the partial response
                  // instead of discarding it entirely
                  const partialContent = accumulatedContent.trim();
                  if (partialContent && isStillActive()) {
                    const namePrefix = `${activeCharacter.name}:`;
                    const cleanedMessage = partialContent.startsWith(namePrefix)
                      ? partialContent.slice(namePrefix.length).trim()
                      : partialContent;
                    
                    if (cleanedMessage) {
                      addMessage(activeSessionId, {
                        characterId: activeCharacter.id,
                        role: 'assistant',
                        content: cleanedMessage,
                        isDeleted: false,
                        swipeId: generateId(),
                        swipeIndex: 0,
                        metadata: { promptData: promptSections }
                      });
                    }
                  }
                  setStreamingContent('');
                  // Throw with a more descriptive error message
                  throw new Error(parsed.error || 'Error en la generación del servidor');
                } else if (parsed.type === 'done') {
                  let cleanedMessage = accumulatedContent.trim();
                  
                  const namePrefix = `${activeCharacter.name}:`;
                  if (cleanedMessage.startsWith(namePrefix)) {
                    cleanedMessage = cleanedMessage.slice(namePrefix.length).trim();
                  }
                  
                  if (cleanedMessage && isStillActive()) {
                    addMessage(activeSessionId, {
                      characterId: activeCharacter.id,
                      role: 'assistant',
                      content: cleanedMessage,
                      isDeleted: false,
                      swipeId: generateId(),
                      swipeIndex: 0,
                      metadata: {
                        promptData: promptSections,
                        toolsUsed: parsed.toolsUsed || []
                      }
                    });

                    // Tick inventory consumable effects (decrement turns)
                    const invState = useTavernStore.getState();
                    if (invState.inventorySettings.enabled && activePersona?.id) {
                      const expiredMessages = invState.tickEffects(activePersona.id);
                      if (expiredMessages.length > 0) {
                        // Remove expired effects and show notifications
                        invState.removeExpiredEffects(activePersona.id);
                        for (const msg of expiredMessages) {
                          toast.info(msg);
                        }
                      }
                    }
                  }
                  setStreamingContent('');
                  
                  // Client-side memory extraction for single chat
                  // Triggered after the stream is fully processed, if server flagged shouldExtract
                  if (parsed.shouldExtract && cleanedMessage && isStillActive()) {
                    setMemoryExtractingInfo({ active: true, characterNames: activeCharacter.name });
                    
                    // Run extraction asynchronously (don't block the UI)
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
                        
                        // Extract last user message for user-memory extraction
                        const lastUserMsg = sessionMsgs
                          .filter(m => m.role === 'user' && !m.isDeleted)
                          .slice(-2, -1)[0]?.content;
                        
                        const extractionResponse = await fetch('/api/embeddings/extract-memory', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            lastMessage: extractionMessage,
                            characterName: extractionCharacterName,
                            characterId: extractionCharacterId,
                            sessionId: activeSessionId,
                            userName: personaName,
                            extractFromUser: embeddingsChat.memoryExtractionFromUserEnabled === true,
                            lastUserMessage: lastUserMsg,
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
                            console.log(`[Memory] Extraction result for ${extractionCharacterName}: extracted=${result.count}, saved=${result.saved}`);
                            
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
                        console.warn('[Memory] Client-side extraction failed:', err);
                      } finally {
                        setMemoryExtractingInfo(prev => ({ ...prev, active: false }));
                      }
                    })();
                  }
                }
              } catch (parseError) {
                if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                  throw parseError;
                }
                chatLogger.debug('Failed to parse SSE data (single)', { data });
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } else {
        const response = await fetch('/api/chat/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.trim(),
            sessionId: activeSessionId,
            characterId: activeCharacter.id,
            character: activeCharacter,
            messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
            llmConfig: activeLLMConfig,
            userName: activePersona?.name || 'User',
            persona: activePersona,
            contextConfig,
            lorebooks: activeLorebooks,
            sessionStats,  // Pass session stats for attribute values
            allCharacters: allCharactersWithPersona,  // Pass all characters for peticiones/solicitudes resolution
            sessionQuests: currentSessionQuests,  // Pass session quests (freshly read)
            questTemplates: latestQuestTemplates,  // Pass quest templates (freshly read)
            questSettings: latestQuestSettings,  // Pass quest settings (freshly read)
            hudContext: activeHUDContext,  // Pass HUD context for prompt injection
            characterMemory: activeCharacter ? getCharacterMemory(activeCharacter.id) : undefined  // Pass character memory
          })
        });

        const data = await response.json().catch(() => ({ error: t('chat.error.generation') }));

        if (!response.ok) {
          throw new Error(data.error || t('chat.error.generation'));
        }

        if (isStillActive()) {
          addMessage(activeSessionId, {
            characterId: activeCharacter.id,
            role: 'assistant',
            content: data.message,
            isDeleted: false,
            swipeId: generateId(),
            swipeIndex: 0,
            metadata: {
              tokens: data.usage?.totalTokens,
              model: data.model
            }
          });
        }
      }
    } catch (error) {
      // Capture detailed error information
      console.error('[ChatPanel] Generation error caught:', error);

      const errorMessage = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      chatLogger.error('Generation error', {
        errorMessage: errorMessage,
        stack: errorStack,
        type: typeof error,
        errorString: String(error),
        isError: error instanceof Error,
      });

      if (isStillActive() && activeSessionId) {
        addMessage(activeSessionId, {
          characterId: activeCharacter?.id || 'system',
          role: 'system',
          content: `⚠️ ${error instanceof Error ? error.message : t('chat.error.generation')}`,
          isDeleted: false,
          swipeId: generateId(),
          swipeIndex: 0
        });
      }
    } finally {
      // Only clear generation state if this is still the active generation
      if (isStillActive()) {
        setGenerating(false);
        setStreamingContent('');
        isGenerationInProgressRef.current = false;
        generationIdRef.current = null;
        // End sprite generation for the character
        // If trigger was activated, keeps trigger sprite; otherwise:
        //   - If TTS is enabled → set 'talk' (will show talk sprite until TTS finishes)
        //   - If TTS is disabled → set 'idle'
        if (activeCharacter) {
          // CRITICAL: Complete any pending partial matches (key:value at end of text)
          // This ensures trigger sprites like "sprite:test01" are properly detected
          completeTriggersPartialMatches(streamingMessageKeyRef.current, activeCharacter, characters);
          
          const ttsExpected = !!(ttsConfig?.enabled && ttsConfig?.autoGeneration && isTTSConnected);
          endSpriteGenerationForCharacterWithTTS(activeCharacter.id, ttsExpected);
        }
        
        // ============================================
        // MEMORY & SUMMARY INTEGRATION
        // Increment message count and check for summary generation
        // ============================================
        if (activeSessionId) {
          // Increment message count (one for user, one for assistant = 2 messages per exchange)
          incrementMessageCount(activeSessionId, isGroupMode);
          
          // Check if we need to generate a summary
          // Run asynchronously to not block the UI
          generateSummaryIfNeeded().catch(err => {
            chatLogger.error('[Memory] Background summary generation failed', { err });
          });
        }
      }
    }
  }, [isGenerating, activeSessionId, activeCharacter, activePersona, isGroupMode, activeGroup, characters, addMessage, setGenerating, processTriggers, resetBgDetection, scanForBackgroundTriggers, activeGroupId, settings.context, lorebooks, effectiveLorebookIds, endSpriteGenerationForCharacterWithTTS, ttsConfig, isTTSConnected]);

  // ============================================
  // INVENTORY CHAT INJECTION
  // When items are used/equipped/unequipped, their message
  // is sent as a user chat message (as if the user typed it)
  // We add a brief delay to ensure the HUD and attribute changes
  // are visually rendered BEFORE the message is sent to the LLM
  // ============================================

  // Use a ref for handleSend to avoid the useEffect cleanup race condition.
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  // Use a ref to track the last processed message and avoid the cleanup race:
  // Previously, clearPendingItemMessage() was called BEFORE the setTimeout,
  // which changed pendingItemMessage to null, triggering a re-render that
  // caused the effect cleanup to cancel the setTimeout before it fired.
  // Now we clear the message INSIDE the setTimeout callback (after sending),
  // and use a ref to prevent re-processing the same message.
  const lastProcessedItemMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingItemMessage) return;

    // Skip if we already processed this exact message (prevents re-triggering)
    if (lastProcessedItemMessageRef.current === pendingItemMessage) return;

    if (isGenerating || isGenerationInProgressRef.current) {
      console.log('[ChatPanel] Pending item message waiting (generation in progress)');
      return;
    }

    console.log('[ChatPanel] Processing pending item message:', pendingItemMessage);

    // Mark this message as processed (via ref, doesn't trigger re-render)
    lastProcessedItemMessageRef.current = pendingItemMessage;

    // Perform variable substitution ({{user}} → persona name)
    const currentPersona = useTavernStore.getState().personas.find(
      (p: any) => p.id === useTavernStore.getState().activePersonaId
    );
    let processedMessage = pendingItemMessage;
    if (currentPersona) {
      processedMessage = processedMessage.replace(/\{\{user\}\}/gi, currentPersona.name || 'Usuario');
    }

    // Delay sending to allow the browser to paint the UI updates
    // (HUD showing active effects, attribute changes visible, etc.)
    // before the LLM request starts and potentially blocks rendering.
    // CRITICAL: clearPendingItemMessage is called INSIDE the callback,
    // NOT before the setTimeout. Calling it before would trigger a re-render
    // that causes the effect cleanup to cancel the setTimeout.
    if (processedMessage.trim()) {
      console.log('[ChatPanel] Scheduling item message send in 300ms:', processedMessage);
      const timer = setTimeout(() => {
        console.log('[ChatPanel] Sending item message to LLM:', processedMessage);
        // Clear the pending message AFTER the delay, right before sending.
        // This prevents re-triggering while avoiding the cleanup race condition.
        clearPendingItemMessage();
        lastProcessedItemMessageRef.current = null;
        handleSendRef.current(processedMessage);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Empty message, just clear
      clearPendingItemMessage();
      lastProcessedItemMessageRef.current = null;
    }
  }, [pendingItemMessage, clearPendingItemMessage, isGenerating]);

  // Handle stop generation - cancel the current streaming request
  const handleStopGeneration = useCallback(() => {
    generationIdRef.current = null;
    isGenerationInProgressRef.current = false;
    chatLogger.info('[ChatPanel] Generation stopped by user');
  }, []);

  // Handle regenerate - create a new swipe alternative for an existing message
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (isGenerating || isGenerationInProgressRef.current || !activeSessionId) return;
    
    // Generate a unique ID for this regeneration
    const generationId = `regen_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    generationIdRef.current = generationId;
    isGenerationInProgressRef.current = true;

    setGenerating(true);
    setStreamingContent('');

    // Start sprite generation for the character
    if (activeCharacter) {
      startSpriteGenerationForCharacter(activeCharacter.id);
    }

    // Helper to check if this generation is still the active one
    const isStillActive = () => generationIdRef.current === generationId;

    try {
      // Get the active LLM config
      const { llmConfigs } = useTavernStore.getState();
      const activeLLMConfig = llmConfigs.find(c => c.isActive);
      
      if (!activeLLMConfig) {
        throw new Error(t('chat.error.noConfig'));
      }

      // Get current session messages
      const currentSession = useTavernStore.getState().sessions.find(s => s.id === activeSessionId);
      const currentMessages = currentSession?.messages || [];
      const contextConfig = settings.context;

      // Get active lorebooks for prompt injection
      const activeLorebooks = lorebooks.filter(lb => effectiveLorebookIds.includes(lb.id) && activeLorebookIds.includes(lb.id));
      
      // Get session stats for attribute values
      const sessionStats = currentSession?.sessionStats;

      // Use regenerate endpoint
      const response = await fetch('/api/chat/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          messageId,
          character: activeCharacter,
          characterId: activeCharacter?.id,
          messages: currentMessages.filter((m: { isDeleted: boolean }) => !m.isDeleted),
          llmConfig: activeLLMConfig,
          userName: activePersona?.name || 'User',
          persona: activePersona,
          contextConfig,
          lorebooks: activeLorebooks,
          sessionStats,  // Pass session stats for attribute values
          sessionQuests: currentSession?.sessionQuests,  // Pass session quests
          questTemplates,  // Pass quest templates
          questSettings,  // Pass quest settings
          hudContext: activeHUDContext,  // Pass HUD context for prompt injection
          characterMemory: activeCharacter ? getCharacterMemory(activeCharacter.id) : undefined,  // Pass character memory
          embeddingsChat: settings.embeddingsChat,  // Pass embeddings chat settings
          summary: currentSession?.summary  // Pass summary for memory/context
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText || t('chat.error.regeneration') }));
        throw new Error(errorData.error || t('chat.error.regeneration'));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      try {
        while (true) {
          if (!isStillActive()) {
            reader.cancel();
            break;
          }
          
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const message of messages) {
            const dataMatch = message.match(/^data: (.+)$/s);
            if (!dataMatch) continue;
            
            const data = dataMatch[1];
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'token' && parsed.content) {
                accumulatedContent += parsed.content;
                setStreamingContent(accumulatedContent);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error);
              } else if (parsed.type === 'done' && parsed.content && isStillActive()) {
                // Add the regenerated content as a new swipe alternative
                addSwipeAlternative(activeSessionId, messageId, parsed.content);
              }
            } catch (parseError) {
              if (parseError instanceof Error && !parseError.message.includes('JSON')) {
                throw parseError;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      chatLogger.error('Regeneration error', { error });
    } finally {
      if (isStillActive()) {
        setGenerating(false);
        setStreamingContent('');
        isGenerationInProgressRef.current = false;
        generationIdRef.current = null;
        // End sprite generation for the character
        if (activeCharacter) {
          // CRITICAL: Complete any pending partial matches (key:value at end of text)
          completeTriggersPartialMatches(streamingMessageKeyRef.current, activeCharacter, characters);
          
          const ttsExpected = !!(ttsConfig?.enabled && ttsConfig?.autoGeneration && isTTSConnected);
          endSpriteGenerationForCharacterWithTTS(activeCharacter.id, ttsExpected);
        }
      }
    }
  }, [isGenerating, activeSessionId, activeCharacter, activePersona, addSwipeAlternative, setGenerating, settings.context, lorebooks, effectiveLorebookIds]);

  // Handle edit message
  const handleEdit = useCallback((messageId: string, newContent: string) => {
    if (!activeSessionId) return;
    updateMessage(activeSessionId, messageId, newContent);
  }, [activeSessionId, updateMessage]);

  // Handle speak - play TTS for a message
  const handleSpeak = useCallback((messageId: string, content: string, characterId?: string) => {
    // Stop any currently playing TTS
    if (isTTSPlaying) {
      stopTTS();
    }

    // Get the character's voice settings
    const character = characterId ? characters.find(c => c.id === characterId) : activeCharacter;
    const voiceSettings = character?.voice;

    // Use dual voice system if character has voice settings
    if (voiceSettings?.enabled) {
      speakWithDualVoice(content, voiceSettings, characterId);
    } else {
      // Fall back to global TTS settings
      speak(content, null, characterId);
    }
  }, [activeCharacter, characters, isTTSPlaying, stopTTS, speakWithDualVoice, speak]);

  // Handle replay - re-simulate the response streaming to trigger sprites and sounds
  const handleReplay = useCallback(async (messageId: string, content: string, characterId?: string) => {
    if (isGenerating || isGenerationInProgressRef.current) return;
    
    // Generate a unique ID for this replay
    const replayId = `replay_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    generationIdRef.current = replayId;
    isGenerationInProgressRef.current = true;

    setGenerating(true);
    setStreamingContent('');

    // Determine the character BEFORE resetting triggers
    const replayChar = characterId ? characters.find(c => c.id === characterId) : activeCharacter;
    
    // Generate a unique message key for triggers
    const messageKey = `replay_stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    streamingMessageKeyRef.current = messageKey;
    resetBgDetection(messageKey);
    // Reset with the actual character for proper solicitud state reset
    resetTriggers(messageKey, replayChar || null);

    setStreamingCharacter(replayChar || null);

    // Start sprite generation for the character
    if (replayChar) {
      startSpriteGenerationForCharacter(replayChar.id);
    }

    // Helper to check if this replay is still the active one
    const isStillActive = () => generationIdRef.current === replayId;

    try {
      // Simulate streaming by gradually revealing the content
      const words = content.split(' ');
      let accumulatedContent = '';
      
      // Simulate streaming with a delay between words
      for (let i = 0; i < words.length; i++) {
        if (!isStillActive()) break;
        
        // Add word with space (except for first word)
        accumulatedContent += (i > 0 ? ' ' : '') + words[i];
        setStreamingContent(accumulatedContent);
        
        // UNIFIED TRIGGER SYSTEM: Process sound + sprite triggers in single pass
        // Build allCharactersWithPersona for peticiones/solicitudes system
        const replayCharactersWithPersona = [
          ...characters,
          ...(activePersona?.statsConfig?.enabled ? [{
            id: '__user__',
            name: activePersona.name || 'User',
            statsConfig: activePersona.statsConfig,
          }] as CharacterCard[] : []),
        ];
        try {
          processTriggers(accumulatedContent, replayChar || null, streamingMessageKeyRef.current, replayCharactersWithPersona);
        } catch (triggerError) {
          console.error('[ChatPanel] Replay trigger processing error:', triggerError);
          // Don't throw - continue replay even if triggers fail
        }
        try {
          scanForBackgroundTriggers(accumulatedContent, streamingMessageKeyRef.current);
        } catch (bgError) {
          console.error('[ChatPanel] Replay background trigger error:', bgError);
          // Don't throw - continue replay even if background triggers fail
        }
        
        // Random delay between 30-80ms to simulate realistic typing
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
      }
    } catch (error) {
      // Capture detailed error information
      console.error('[ChatPanel] Replay error caught:', error);
      const errorMessage = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      chatLogger.error('Replay error', {
        errorMessage,
        stack: errorStack,
        type: typeof error,
        characterId,
        hasReplayChar: !!replayChar,
        hasActiveCharacter: !!activeCharacter,
      });
    } finally {
      if (isStillActive()) {
        setGenerating(false);
        setStreamingContent('');
        setStreamingCharacter(null);
        isGenerationInProgressRef.current = false;
        generationIdRef.current = null;
        // End sprite generation for the character
        if (replayChar) {
          // CRITICAL: Complete any pending partial matches (key:value at end of text)
          completeTriggersPartialMatches(streamingMessageKeyRef.current, replayChar, characters);
          
          const ttsExpected = !!(ttsConfig?.enabled && ttsConfig?.autoGeneration && isTTSConnected);
          endSpriteGenerationForCharacterWithTTS(replayChar.id, ttsExpected);
        }
        
        // Play TTS for the replayed message
        if (replayChar && content) {
          const voiceSettings = replayChar.voice;
          if (voiceSettings?.enabled) {
            speakWithDualVoice(content, voiceSettings, characterId);
          } else if (ttsConfig?.enabled) {
            speak(content, null, characterId);
          }
        }
      }
    }
  }, [isGenerating, activeCharacter, characters, activePersona, setGenerating, resetTriggers, resetBgDetection, scanForBackgroundTriggers, processTriggers, startSpriteGenerationForCharacter, endSpriteGenerationForCharacter, setStreamingCharacter, setStreamingContent, speakWithDualVoice, speak, ttsConfig]);

  // Get clearChat from store for proper reset
  const clearChat = useTavernStore((state) => state.clearChat);
  const resetSessionStats = useTavernStore((state) => state.resetSessionStats);

  const handleResetChat = () => {
    if (!activeSessionId) return;
    
    // Use the store's clearChat which properly resets:
    // 1. Messages to first message
    // 2. Session stats to default values
    // 3. Session quests to template defaults (with updated templates)
    // 4. Turn count to 0
    if (confirm(t('chat.resetConfirm'))) {
      clearChat(activeSessionId);
      // Clear ALL trigger detection state so quests can be re-activated
      clearAllTriggerState();
    }
  };

  const handleClearChat = () => {
    if (!activeSessionId) return;
    
    // Clear only messages, keep stats and quests
    if (confirm(t('chat.clearConfirm'))) {
      updateSession(activeSessionId, { 
        messages: [],
        updatedAt: new Date().toISOString()
      });
    }
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex items-center justify-center relative">
        <BackgroundWithOverlays 
          background={activeBackground} 
          overlayBack={activeOverlayBack}
          overlayFront={activeOverlayFront}
          fit={settings.backgroundFit} 
          overlay 
          blur 
          transitionDuration={settings.backgroundTriggers?.transitionDuration || 500}
        />
        <div className="relative z-10 text-center space-y-4 p-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold">{t('chat.welcome.title')}</h2>
          <p className="text-muted-foreground max-w-md">
            {t('chat.welcome.subtitle')}
          </p>
          {/* Proactive indicator when no session */}
          {isProactiveConfigured && (
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300/50 text-xs backdrop-blur-sm border border-amber-500/15 mx-auto w-fit">
              <Sparkles className="h-3 w-3" />
              <span>Proactivo</span>
              <span className="opacity-70">— Inicia un chat para activar</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Novel Mode - Always active
  return (
    <div className="flex-1 h-full relative min-h-0 min-w-0">
      <BackgroundWithOverlays 
        background={activeBackground} 
        overlayBack={activeOverlayBack}
        overlayFront={activeOverlayFront}
        fit={settings.backgroundFit}
        overlay={!!activeBackground && settings.chatLayout.blurBackground}
        transitionDuration={settings.backgroundTriggers?.transitionDuration || 500}
      />

      {/* Character Sprite Area - Single Character Mode */}
      {!isGroupMode && settings.chatLayout.showCharacterSprite && activeCharacter?.avatar && (
        <CharacterSprite
          characterId={activeCharacter.id}
          characterName={activeCharacter.name}
          avatarUrl={activeCharacter.avatar}
          character={activeCharacter}
          isStreaming={isGenerating || isGeneratingProactive}
          hasContent={!!streamingContent}
          isTTSPlaying={isTTSPlaying}
        />
      )}

      {/* Group Sprites - Multiple Characters */}
      {isGroupMode && settings.chatLayout.showCharacterSprite && activeGroup && (
        <GroupSprites
          characters={characters.filter(c => 
            (activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || []).includes(c.id)
          )}
          activeCharacterId={streamingCharacter?.id || null}
          isStreaming={(isGenerating || isGeneratingProactive) && !!streamingContent}
          isTTSPlaying={isTTSPlaying}
          activeGroup={activeGroup}
        />
      )}

      {/* HUD Display */}
      {hudSessionState.activeTemplateId && (
        <HUDDisplay />
      )}

      {/* Proactive Messages Indicator - inline above chatbox */}
      {isProactiveConfigured && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
          {isProactiveActive ? (
            <button
              type="button"
              onClick={triggerProactiveNow}
              disabled={isGeneratingProactive}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs shadow-lg backdrop-blur-sm border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Clic para enviar mensaje proactivo ahora"
            >
              {isGeneratingProactive ? (
                <>
                  <div className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  <span className="font-medium">Generando mensaje...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  <span className="font-medium">Proactivo</span>
                  {proactiveNextIn !== null && proactiveNextIn > 0 && (
                    <span className="opacity-70 tabular-nums">
                      {proactiveNextIn >= 60
                        ? `${Math.floor(proactiveNextIn / 60)}:${String(proactiveNextIn % 60).padStart(2, '0')}`
                        : `${proactiveNextIn}s`
                      }
                    </span>
                  )}
                  {proactiveNextIn !== null && proactiveNextIn === 0 && (
                    <span className="opacity-80">● Listo</span>
                  )}
                </>
              )}
            </button>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300/50 text-xs backdrop-blur-sm border border-amber-500/15"
            >
              <Sparkles className="h-3 w-3" />
              <span>Proactivo</span>
              <span className="opacity-70">
                {proactiveInactiveReason === 'no_session' && '— Inicia un chat'}
                {proactiveInactiveReason === 'no_llm' && '— Configura un LLM'}
                {proactiveInactiveReason === 'group_chat' && '— No disponible en grupo'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Floating Chat Box */}
      <NovelChatBox 
        onSendMessage={(msg) => handleSend(msg)}
        isGenerating={isGenerating}
        isGeneratingProactive={isGeneratingProactive}
        onStopGeneration={handleStopGeneration}
        onResetChat={handleResetChat}
        onClearChat={handleClearChat}
        onRegenerate={handleRegenerate}
        onEdit={handleEdit}
        onReplay={handleReplay}
        onSpeak={handleSpeak}
        streamingContent={streamingContent}
        streamingCharacter={streamingCharacter}
        streamingProgress={streamingProgress}
        isGroupMode={isGroupMode}
        activeGroup={activeGroup}
        activeCharacter={activeCharacter}
        characters={characters}
        activePersona={activePersona}
        ttsPlaying={isTTSPlaying}
        memoryExtracting={memoryExtractingInfo.active}
        sessionId={activeSessionId}
      />

      {/* Quest Notifications */}
      <QuestNotifications />

      {/* Inventory HUD */}
      <InventoryHUD />
      
      {/* TTS Floating Indicator */}
      <TTSFloatingIndicator />
      
      {/* Embeddings Context Indicator */}
      {embeddingsContexts.length > 0 && (
        <EmbeddingsContextContainer contexts={embeddingsContexts} />
      )}

      {/* Memory Extraction Indicator */}
      {memoryExtractingInfo.active && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/90 text-white text-xs shadow-lg backdrop-blur-sm">
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="font-medium">Extrayendo memoria</span>
            <span className="opacity-80">— {memoryExtractingInfo.characterNames}</span>
          </div>
        </div>
      )}

      {/* Tool Call Notification */}
      <ToolCallNotification
        active={toolCallInfo.active}
        toolName={toolCallInfo.toolName}
        toolLabel={toolCallInfo.toolLabel}
        toolIcon={toolCallInfo.toolIcon}
        params={toolCallInfo.params}
        result={toolCallInfo.result}
        phase={toolCallInfo.phase}
        callId={toolCallInfo.callId}
      />
    </div>
  );
}
