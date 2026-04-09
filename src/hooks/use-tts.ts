// ============================================
// useTTS Hook - TTS integration for chat
// Handles TTS playback, auto-generation, and voice settings
// Optimized to prevent unnecessary re-renders
// ============================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { 
  ttsService,
  parseTextSegments,
  filterSegments,
  cleanTextForTTS,
} from '@/lib/tts';
import { unlockAudio } from '@/lib/tts/tts-service';
import type { 
  CharacterVoiceSettings, 
  CharacterVoiceConfig, 
  TTSWebUIConfig,
  TTSQueueItem,
} from '@/types';
import { DEFAULT_TTS_WEBUI_CONFIG } from '@/lib/tts/types';

interface UseTTSOptions {
  autoPlayOnNewMessage?: boolean;
}

interface UseTTSReturn {
  // State
  isPlaying: boolean;
  isPaused: boolean;
  currentQueue: TTSQueueItem[];
  ttsConfig: TTSWebUIConfig | null;
  isLoadingConfig: boolean;
  isConnected: boolean;
  connectionError: string | null;
  autoplayBlocked: boolean;
  
  // Actions
  speak: (
    text: string, 
    voiceSettings?: CharacterVoiceSettings | null,
    characterId?: string
  ) => Promise<void>;
  speakWithDualVoice: (
    text: string,
    voiceSettings: CharacterVoiceSettings,
    characterId?: string
  ) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  unlockAudio: () => Promise<boolean>;
  
  // Config
  loadConfig: () => Promise<void>;
  loadVoices: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { autoPlayOnNewMessage = true } = options;
  
  // Local state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQueue, setCurrentQueue] = useState<TTSQueueItem[]>([]);
  const [ttsConfig, setTtsConfig] = useState<TTSWebUIConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  
  // Refs
  const lastMessageIdRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const currentQueueLengthRef = useRef(0); // Track queue length to avoid stale closure

  // Check TTS connection status (uses cached status when within cooldown)
  const checkConnection = useCallback(async (forceCheck = false): Promise<boolean> => {
    if (!ttsConfig?.enabled) {
      return false;
    }

    try {
      const result = await ttsService.testConnection(forceCheck);
      const connected = result.status === 'online';
      setIsConnected(connected);
      setConnectionError(connected ? null : result.error || 'Connection failed');
      return connected;
    } catch (error) {
      setIsConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      return false;
    }
  }, [ttsConfig?.enabled]);

  // Load TTS config from API
  const loadConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetch('/api/tts/config');
      const data = await response.json();
      if (data.success && data.config?.tts) {
        const config = {
          ...DEFAULT_TTS_WEBUI_CONFIG,
          ...data.config.tts,
        };
        setTtsConfig(config);
        ttsService.setConfig(config);
      } else {
        setTtsConfig(DEFAULT_TTS_WEBUI_CONFIG);
        ttsService.setConfig(DEFAULT_TTS_WEBUI_CONFIG);
      }
    } catch (error) {
      console.warn('[useTTS] Failed to load config:', error);
      setTtsConfig(DEFAULT_TTS_WEBUI_CONFIG);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Set up TTS service callbacks - only once
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    ttsService.setCallbacks({
      onPlaybackStart: () => {
        setIsPlaying(true);
        setIsPaused(false);
      },
      onPlaybackEnd: () => {
        setIsPaused(false);
        // NOTE: Do NOT read isPlaying here — it's still true at this point.
        // The correct isPlaying state will be synced by onQueueUpdate,
        // which fires AFTER playNext() updates this.isPlaying.
      },
      onPlaybackError: (item, error) => {
        // Don't log errors for autoplay-blocked items — that's expected behavior
        if (item.status !== 'autoplay_blocked') {
          console.warn('[useTTS] Playback error for text "' + (item.text?.substring(0, 40) || '?') + '...":', error);
        }
        setIsPlaying(false);
        setIsPaused(false);
      },
      onAutoplayBlocked: () => {
        console.warn('[useTTS] Autoplay blocked — click anywhere to enable audio playback');
        setAutoplayBlocked(true);
        setIsPlaying(false);
        // Auto-clear the blocked state after 10 seconds (user likely won't click)
        setTimeout(() => {
          setAutoplayBlocked(false);
        }, 10000);
      },
      onQueueUpdate: (queue) => {
        // ALWAYS sync isPlaying from the service — this is the authoritative source.
        // playNext() sets this.isPlaying = false BEFORE calling onQueueUpdate,
        // and processQueue() sets it = true BEFORE calling onQueueUpdate,
        // so we always get the correct value here.
        const serviceIsPlaying = ttsService.getIsPlaying();
        setIsPlaying(serviceIsPlaying);

        // Update queue display — use ref to avoid stale closure on currentQueue
        const prevLen = currentQueueLengthRef.current;
        currentQueueLengthRef.current = queue.length;
        if (queue.length !== prevLen) {
          setCurrentQueue([...queue]);
        }
      },
    });
  }, []); // Empty deps - only run once

  // Check connection when config loads, with adaptive interval
  // Online → check every 30s, Offline → check every 2min (service handles cooldown internally)
  useEffect(() => {
    if (!ttsConfig?.enabled) return;
    
    checkConnection(true); // Force first check
    // The service caches results, so we can call frequently — it won't actually
    // make network requests unless the cooldown has expired
    connectionCheckIntervalRef.current = setInterval(() => {
      checkConnection(); // Uses cached result if within cooldown
    }, 30000);
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
    };
  }, [ttsConfig?.enabled, checkConnection]);

  // Speak text with single voice (simple mode)
  const speak = useCallback(async (
    text: string,
    voiceSettings?: CharacterVoiceSettings | null,
    characterId?: string
  ) => {
    if (!ttsConfig?.enabled) {
      console.log('[useTTS] TTS is disabled');
      return;
    }

    // Check cached connection status first — avoid network request if known offline
    const cachedStatus = ttsService.getCachedConnectionStatus();
    if (cachedStatus === 'offline') {
      return; // Silently skip — server is known to be offline
    }

    // If status is 'online', skip the async check — we know it works
    // If status is 'unknown', don't block with a network check —
    // let addToQueue proceed and the service will handle connection errors on generation
    if (cachedStatus === 'online') {
      // Already confirmed online — proceed directly
    } else {
      // Status is 'unknown' — do a quick connection check
      const connected = await checkConnection();
      if (!connected) {
        return;
      }
    }

    // Use voice settings or fall back to global config
    const voiceConfig: CharacterVoiceConfig = voiceSettings?.dialogueVoice || {
      enabled: true,
      voiceId: ttsConfig.defaultVoice || 'default',
      exaggeration: ttsConfig.exaggeration,
      cfgWeight: ttsConfig.cfgWeight,
      temperature: ttsConfig.temperature,
      speed: ttsConfig.speed,
      language: ttsConfig.language,
    };

    // Process text based on generation options (positive logic)
    const filterOpts = {
      generateDialogues: voiceSettings?.generateDialogues ?? ttsConfig.generateDialogues ?? true,
      generateNarrations: voiceSettings?.generateNarrations ?? ttsConfig.generateNarrations ?? true,
      generatePlainText: voiceSettings?.generatePlainText ?? ttsConfig.generatePlainText ?? true,
    };

    const segments = parseTextSegments(text);
    const filtered = filterSegments(segments, filterOpts);

    // Clean and join text
    const cleanText = filtered
      .map(s => cleanTextForTTS(s.text))
      .filter(t => t.length > 0)
      .join(' ');

    if (!cleanText) {
      console.log('[useTTS] No text to speak after filtering');
      return;
    }

    // Add to queue
    ttsService.addToQueue(cleanText, voiceConfig, { characterId });
  }, [ttsConfig, checkConnection]);

  // Speak with dual voice (dialogue + narrator)
  const speakWithDualVoice = useCallback(async (
    text: string,
    voiceSettings: CharacterVoiceSettings,
    characterId?: string
  ) => {
    if (!ttsConfig?.enabled) {
      console.log('[useTTS] TTS is disabled');
      return;
    }

    // Check cached connection status first — avoid network request if known offline
    const cachedStatus = ttsService.getCachedConnectionStatus();
    if (cachedStatus === 'offline') {
      return; // Silently skip — server is known to be offline
    }

    // If status is 'online', skip the async check — we know it works
    if (cachedStatus === 'online') {
      // Already confirmed online — proceed directly
    } else {
      // Status is 'unknown' — do a quick connection check
      const connected = await checkConnection();
      if (!connected) {
        return;
      }
    }

    if (!voiceSettings.enabled) {
      console.log('[useTTS] Voice disabled for this character');
      return;
    }

    // Process text with dual voice settings
    const segments = ttsService.processTextForDualVoice(text, {
      dialogueVoice: voiceSettings.dialogueVoice,
      narratorVoice: voiceSettings.narratorVoice,
      generateDialogues: voiceSettings.generateDialogues,
      generateNarrations: voiceSettings.generateNarrations,
      generatePlainText: voiceSettings.generatePlainText,
    });

    if (segments.length === 0) {
      console.log('[useTTS] No text segments to speak');
      return;
    }

    // Add each segment to the queue
    for (const segment of segments) {
      if (segment.voiceConfig.enabled) {
        ttsService.addToQueue(segment.text, segment.voiceConfig, { characterId });
      }
    }
  }, [ttsConfig, checkConnection]);

  // Stop playback
  const stop = useCallback(() => {
    ttsService.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentQueue([]);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    ttsService.pause();
    setIsPaused(true);
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    ttsService.resume();
    setIsPaused(false);
  }, []);

  // Load voices
  const loadVoices = useCallback(async () => {
    await ttsService.fetchVoices(true);
  }, []);

  return {
    isPlaying,
    isPaused,
    currentQueue,
    ttsConfig,
    isLoadingConfig,
    isConnected,
    connectionError,
    autoplayBlocked,
    speak,
    speakWithDualVoice,
    stop,
    pause,
    resume,
    unlockAudio,
    loadConfig,
    loadVoices,
    checkConnection,
  };
}

// ============================================
// useTTSAutoGeneration Hook
// Automatically plays TTS for new messages
// Uses refs to avoid stale closures — fires TTS synchronously
// ============================================

interface UseTTSAutoGenerationOptions {
  enabled?: boolean;
  delay?: number; // Ignored — TTS fires synchronously now
  speak?: (text: string, voiceSettings?: CharacterVoiceSettings | null, characterId?: string) => Promise<void>;
  speakWithDualVoice?: (text: string, voiceSettings: CharacterVoiceSettings, characterId?: string) => Promise<void>;
  ttsConfig: TTSWebUIConfig | null;
  isPlaying?: boolean;
  isConnected?: boolean;
}

export function useTTSAutoGeneration(
  messages: Array<{ id: string; role: string; content: string; characterId?: string }>,
  options: UseTTSAutoGenerationOptions
) {
  const { 
    enabled = true, 
    speak,
    speakWithDualVoice,
    ttsConfig,
    isPlaying,
    isConnected
  } = options;
  
  const lastProcessedIdRef = useRef<string>('');
  const lastMessageCountRef = useRef<number>(0);

  // Use refs to always have the latest function references — avoids stale closures
  const speakRef = useRef(speak);
  const speakWithDualVoiceRef = useRef(speakWithDualVoice);
  
  const characters = useTavernStore((state) => state.characters);
  const charactersRef = useRef(characters);

  // Sync refs inside the effect (not during render)
  useEffect(() => {
    speakRef.current = speak;
    speakWithDualVoiceRef.current = speakWithDualVoice;
    charactersRef.current = characters;
  }, [speak, speakWithDualVoice, characters]);

  useEffect(() => {
    const currentMessageCount = messages.length;
    const lastMessage = messages[messages.length - 1];

    // Check all conditions
    if (!enabled) return;
    if (!ttsConfig?.enabled) return;
    if (!ttsConfig?.autoGeneration) return;
    if (!speak || !speakWithDualVoice) return;

    // Check connection using the SERVICE's cached status directly.
    // We do NOT rely on React's isConnected state here because it starts as false
    // and only becomes true after the first async checkConnection() completes.
    // If a message arrives before the check completes, auto-TTS would be skipped.
    // Using the service's cache is synchronous and always up-to-date.
    const cachedStatus = ttsService.getCachedConnectionStatus();
    if (cachedStatus === 'offline') return;
    // If status is 'unknown' or 'online', proceed — let the service handle connection errors

    // Check if message count increased (new message added)
    lastMessageCountRef.current = currentMessageCount;
    
    if (!lastMessage) return;

    // Skip if already processed
    if (lastMessage.id === lastProcessedIdRef.current) return;
    
    // Skip if is user or system message
    if (lastMessage.role === 'user' || lastMessage.role === 'system') {
      lastProcessedIdRef.current = lastMessage.id;
      return;
    }

    // Mark as processed immediately to prevent duplicate processing
    lastProcessedIdRef.current = lastMessage.id;

    const character = charactersRef.current.find(c => c.id === lastMessage.characterId);
    const voiceSettings = character?.voice;

    if (voiceSettings?.enabled) {
      speakWithDualVoiceRef.current?.(lastMessage.content, voiceSettings, lastMessage.characterId);
    } else if (ttsConfig?.enabled) {
      speakRef.current?.(lastMessage.content, null, lastMessage.characterId);
    }
    // No cleanup needed — TTS was fired synchronously into the queue
  }, [
    messages,
    enabled,
    ttsConfig?.enabled,
    ttsConfig?.autoGeneration,
    speak,
    speakWithDualVoice,
  ]);

  return { isPlaying: isPlaying ?? false };
}
