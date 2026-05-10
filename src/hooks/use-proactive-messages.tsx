'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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

interface UseProactiveMessagesReturn {
  /** Whether proactive messages are currently active for the active character */
  isActive: boolean;
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
 * Proactive messages are sent by the character without the user speaking first,
 * based on a configurable interval timer.
 */
export function useProactiveMessages({
  isGenerating,
  onProactiveMessage,
}: UseProactiveMessagesOptions): UseProactiveMessagesReturn {
  const [nextIn, setNextIn] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [isGeneratingProactive, setIsGeneratingProactive] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(Date.now());
  const sessionCountRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const lastMessageTimestampRef = useRef<string>('');

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
  const isActive = !!(config?.enabled && activeCharacter && !activeGroupId && activeSession && llmConfig);

  // Track last message timestamp — inactivity is measured by time between messages
  useEffect(() => {
    if (!activeSession) return;
    const messages = activeSession.messages.filter((m) => !m.isDeleted);
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.timestamp !== lastMessageTimestampRef.current) {
      lastMessageTimestampRef.current = lastMsg.timestamp;
      // Reset the inactivity timer to the time of the last message
      lastMessageTimeRef.current = Date.now();
    }
  }, [activeSession?.messages?.length]);

  // Generate a proactive message
  const generateProactiveMessage = useCallback(async (reason: 'timer_idle' | 'timer_away' = 'timer_idle') => {
    if (!activeCharacter || !activeSession || !llmConfig || !config) return;
    if (isGeneratingRef.current || isGeneratingProactive) return;

    // Check minimum messages requirement
    const messageCount = activeSession.messages.filter((m) => !m.isDeleted).length;
    if (messageCount < (config.minMessagesBeforeStart ?? 5)) {
      return;
    }

    // Check max per session
    if (config.maxPerSession > 0 && sessionCountRef.current >= config.maxPerSession) {
      // Don't clear the timer, just skip this one
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

      // Get active lorebooks for this character
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
          reason,
          lastActivityAt: lastMessageTimeRef.current,
        }),
      });

      const result = await response.json();

      if (result.success && result.message) {
        sessionCountRef.current += 1;
        setSessionCount(sessionCountRef.current);

        const proactiveInfo: ProactiveMessageInfo = {
          isProactive: true,
          triggeredAt: result.timestamp,
          reason,
          characterName: result.characterName || activeCharacter.name,
        };

        if (onProactiveMessage) {
          onProactiveMessage({
            characterId: activeCharacter.id,
            content: result.message,
            metadata: { proactiveInfo },
          });
        } else {
          // Direct add to store
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

        toast(`${activeCharacter.name} te envió un mensaje`, {
          description: result.message.slice(0, 80) + (result.message.length > 80 ? '...' : ''),
          icon: <Sparkles className="h-4 w-4 text-amber-400" />,
          duration: 4000,
        });
      }
    } catch (error: any) {
      console.warn('[Proactive] Failed to generate message:', error?.message);
    } finally {
      setIsGeneratingProactive(false);
      // Reset inactivity timer after sending a proactive message
      lastMessageTimeRef.current = Date.now();
    }
  }, [activeCharacter, activeSession, llmConfig, config, activePersona, onProactiveMessage, addMessage]);

  // Main timer logic
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isActive) {
      setNextIn(null);
      return;
    }

    const intervalMs = (config?.intervalSeconds ?? 300) * 1000;

    // Update countdown every second
    const countdownRef = setInterval(() => {
      const elapsed = Date.now() - lastMessageTimeRef.current;
      const remaining = Math.max(0, Math.floor((intervalMs - elapsed) / 1000));
      setNextIn(remaining);
    }, 1000);

    // Check every 5 seconds if it's time to send
    timerRef.current = setInterval(() => {
      if (isGeneratingRef.current || isGeneratingProactive) return;

      const elapsed = Date.now() - lastMessageTimeRef.current;

      if (elapsed >= intervalMs) {
        // Determine reason based on document visibility and allowed states
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
      clearInterval(countdownRef);
    };
  }, [isActive, config?.intervalSeconds, generateProactiveMessage, isGeneratingProactive]);

  // Manual trigger (for testing)
  const triggerNow = useCallback(async () => {
    await generateProactiveMessage('timer_idle');
  }, [generateProactiveMessage]);

  return {
    isActive,
    nextIn: isActive ? nextIn : null,
    sessionCount,
    isGeneratingProactive,
    triggerNow,
  };
}
