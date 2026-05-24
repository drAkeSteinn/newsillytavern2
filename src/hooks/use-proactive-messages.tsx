'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import type { ProactiveMessagesConfig, ProactiveMessageInfo } from '@/types';

interface UseProactiveMessagesOptions {
  /** Whether the chat panel is currently generating (block proactive during generation) */
  isGenerating: boolean;
  /** Called to add a proactive message to the chat */
  onProactiveMessage?: (message: {
    characterId: string;
    content: string;
    metadata: { proactiveInfo: ProactiveMessageInfo };
  }) => void;
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
  const activeLLMConfigId = useTavernStore((state) => state.activeLLMConfigId);
  const personas = useTavernStore((state) => state.personas);
  const activePersonaId = useTavernStore((state) => state.activePersonaId);
  const addMessage = useTavernStore((state) => state.addMessage);
  const lorebooks = useTavernStore((state) => state.lorebooks);
  const activeLorebookIds = useTavernStore((state) => state.activeLorebookIds);

  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const llmConfig = llmConfigs.find((c) => c.id === activeLLMConfigId);
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
      const recentMessages = activeSession.messages
        .filter((m) => !m.isDeleted)
        .slice(-20)
        .map((m) => ({
          characterId: m.characterId,
          role: m.role,
          content: m.content,
          isDeleted: m.isDeleted,
        }));

      const characterLorebookIds = activeCharacter.lorebookIds || [];
      const effectiveIds = characterLorebookIds.filter(id => activeLorebookIds.includes(id));
      const activeLorebooks = lorebooks.filter(lb => effectiveIds.includes(lb.id));

      const response = await fetch('/api/chat/proactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: activeCharacter,
          messages: recentMessages,
          llmConfig,
          userName: activePersona?.name || 'User',
          persona: activePersona || undefined,
          lorebooks: activeLorebooks,
          sessionStats: activeSession.sessionStats,
          proactiveConfig: config,
          reason: reason === 'manual' ? 'timer_idle' : reason,
          lastActivityAt: lastActivityTimeRef.current,
        }),
      });

      const result = await response.json();

      if (result.success && result.message) {
        sessionCountRef.current += 1;
        setSessionCount(sessionCountRef.current);

        const proactiveInfo: ProactiveMessageInfo = {
          isProactive: true,
          triggeredAt: result.timestamp,
          reason: reason === 'manual' ? 'timer_idle' : reason,
          characterName: result.characterName || activeCharacter.name,
        };

        if (onProactiveMessage) {
          onProactiveMessage({
            characterId: activeCharacter.id,
            content: result.message,
            metadata: { proactiveInfo },
          });
        } else {
          addMessage(activeSession.id, {
            characterId: activeCharacter.id,
            role: 'assistant',
            content: result.message,
            isDeleted: false,
            swipeId: `proactive_${Date.now()}`,
            swipeIndex: 0,
            metadata: { proactiveInfo },
          });
        }

        lastActivityTimeRef.current = Date.now();

        toast(`${activeCharacter.name} te envió un mensaje`, {
          description: result.message.slice(0, 80) + (result.message.length > 80 ? '...' : ''),
          icon: <Sparkles className="h-4 w-4 text-amber-400" />,
          duration: 4000,
        });
      } else if (!result.success && result.error) {
        toast('Error en mensaje proactivo', {
          description: result.error,
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.warn('[Proactive] Failed to generate message:', error?.message);
      toast('Error en mensaje proactivo', {
        description: error?.message || 'Error de conexión',
        duration: 3000,
      });
    } finally {
      setIsGeneratingProactive(false);
    }
  }, [activeCharacter, activeSession, llmConfig, config, activePersona, onProactiveMessage, addMessage, lorebooks, activeLorebookIds, isGeneratingProactive]);

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
