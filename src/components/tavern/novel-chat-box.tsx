'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import { ChatMessageBubble } from './chat-message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { EmojiPicker } from './emoji-picker';
import { StreamingText } from './streaming-text';
import { useHotkeys, formatHotkey } from '@/hooks/use-hotkeys';
import {
  Send,
  Loader2,
  GripVertical,
  Settings,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Eraser,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Database,
  ScrollText,
  Check,
  Circle,
  Target,
  Inbox,
  MessageSquare,
  Clock,
  User,
  Gift,
  Star,
  Lock,
  Play,
  Pause,
  Zap,
  List,
  Shuffle,
  Mic,
  Square,
  Ear,
  Radio,
  VolumeX,
  Brain,
  Trash2,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ChatLayoutSettings, CharacterCard, CharacterGroup, Persona, ChatboxAppearanceSettings } from '@/types';
import { DEFAULT_CHATBOX_APPEARANCE, THEME_COLOR_PRESETS } from '@/types';
import { t } from '@/lib/i18n';
import { QuickPetitions } from './user-solicitudes';
import { ThemeEffects, getThemeColors as getThemeColorsUtil } from './theme-effects';
import { useAudioRecorder, useAudioTranscription } from '@/hooks/use-audio-recorder';
import { useWakeWordDetection } from '@/hooks/use-wake-word-detection';

// Tab type for the chatbox
type ChatboxTab = 'chat' | 'solicitudes' | 'misiones' | 'memorias';

interface NovelChatBoxProps {
  onSendMessage: (message: string) => void;
  isGenerating: boolean;
  onResetChat?: () => void;
  onClearChat?: () => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReplay?: (messageId: string, content: string, characterId?: string) => void;
  onSpeak?: (messageId: string, content: string, characterId?: string) => void;
  streamingContent?: string;
  streamingCharacter?: CharacterCard | null;
  streamingProgress?: { current: number; total: number } | null;
  isGroupMode?: boolean;
  activeGroup?: CharacterGroup | null;
  activeCharacter?: CharacterCard | null;
  characters?: CharacterCard[];
  activePersona?: Persona | null;
  /** Whether TTS is currently playing audio (used to pause KWS during TTS) */
  ttsPlaying?: boolean;
  /** Whether memory extraction is currently running (triggers auto-refresh of memories tab) */
  memoryExtracting?: boolean;
  /** Current session ID for session-scoped memory namespaces */
  sessionId?: string;
}

// Format memory date to relative time
function formatMemoryDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// Memory type labels and colors (outside component to avoid re-creation)
const MEMORY_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  hecho: { label: 'Hecho', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  evento: { label: 'Evento', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  relacion: { label: 'Relación', color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  preferencia: { label: 'Preferencia', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  secreto: { label: 'Secreto', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  otro: { label: 'Otro', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
};

// Memory item component (outside main component for stable identity)
function MemoryItem({ memory, onDelete }: {
  memory: { id: string; content: string; namespace: string; metadata: Record<string, any>; created_at: string };
  onDelete: (id: string) => void;
}) {
  const memType = memory.metadata?.memory_type || 'otro';
  const typeConfig = MEMORY_TYPE_CONFIG[memType] || MEMORY_TYPE_CONFIG.otro;
  const importance = memory.metadata?.importance || 3;
  const isConsolidated = memory.metadata?.is_consolidated;
  const createdDate = memory.created_at ? new Date(memory.created_at) : null;

  return (
    <div className="group flex items-start gap-2 p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
      {/* Type indicator bar */}
      <div className={cn("w-1 h-full min-h-[2rem] rounded-full flex-shrink-0 mt-0.5", typeConfig.bgColor.replace('/20', '/60'))} />

      <div className="flex-1 min-w-0">
        {/* Top row: type badge + importance + date */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", typeConfig.bgColor, typeConfig.color)}>
            {typeConfig.label}
          </span>
          {/* Importance stars */}
          <span className="text-[10px] text-amber-400">
            {'★'.repeat(Math.min(importance, 5))}{'☆'.repeat(Math.max(0, 5 - importance))}
          </span>
          {isConsolidated && (
            <span className="text-[9px] text-cyan-400 bg-cyan-500/20 px-1 py-0.5 rounded">
              Consolidada
            </span>
          )}
          <span className="text-[9px] text-muted-foreground ml-auto">
            {createdDate ? formatMemoryDate(createdDate) : ''}
          </span>
        </div>

        {/* Memory content */}
        <p className="text-xs leading-relaxed text-foreground/90 line-clamp-3">
          {memory.content}
        </p>
      </div>

      {/* Delete button (appears on hover) */}
      <button
        onClick={() => onDelete(memory.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 flex-shrink-0"
        title="Eliminar memoria"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export function NovelChatBox({ 
  onSendMessage, 
  isGenerating, 
  onResetChat, 
  onClearChat,
  onRegenerate,
  onEdit,
  onReplay,
  onSpeak,
  streamingContent = '',
  streamingCharacter = null,
  streamingProgress = null,
  isGroupMode = false,
  activeGroup = null,
  activeCharacter = null,
  characters = [],
  activePersona = null,
  ttsPlaying = false,
  memoryExtracting = false,
  sessionId,
}: NovelChatBoxProps) {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatboxTab>('chat');
  const [showAvailableQuests, setShowAvailableQuests] = useState(false);
  const [showAutoQuestConfig, setShowAutoQuestConfig] = useState(false);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  
  // Memories tab state
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memories, setMemories] = useState<Array<{
    id: string;
    content: string;
    namespace: string;
    metadata: Record<string, any>;
    created_at: string;
  }>>([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const {
    activeSessionId,
    getActiveSession,
    settings,
    updateSettings,
    deleteMessage,
    swipeMessage,
    getSwipeCount,
    characters: allCharacters,
    questTemplates,
    questSettings,
    activateUserPeticion,
    getPendingUserSolicitudes,
    acceptUserSolicitud,
    rejectUserSolicitud,
    activateQuest,
    deactivateQuest,
    setQuestSettings,
  } = useTavernStore();

  // ASR config state (loaded from API)
  const [asrConfig, setAsrConfig] = useState<{
    model: string;
    language: string;
    enabled: boolean;
  }>({
    model: 'whisper-small',
    language: 'es',
    enabled: true,
  });

  // KWS config state
  const [kwsConfig, setKwsConfig] = useState<{
    enabled: boolean;
    language: string;
    sensitivity: 'low' | 'medium' | 'high';
    cooldownMs: number;
    silenceDurationMs: number;
    wakeWords: string[];
  }>({
    enabled: false,
    language: 'es-ES',
    sensitivity: 'medium',
    cooldownMs: 2000,
    silenceDurationMs: 1500,
    wakeWords: [],
  });

  // Get wake words from active character OR group members + global config
  const characterWakeWords = useMemo(() => {
    const words: string[] = [];
    
    if (isGroupMode && activeGroup && characters.length > 0) {
      // GROUP MODE: Add all group members' names as wake words
      // This allows the user to address any character in the group
      const groupCharacterIds = activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || [];
      
      for (const charId of groupCharacterIds) {
        const char = characters.find(c => c.id === charId);
        if (char?.name) {
          words.push(char.name);
          // Add alternate names if available
          if (char.data?.alternate_names) {
            words.push(...char.data.alternate_names);
          }
        }
      }
      
      console.log('[KWS] Group mode - wake words:', words);
    } else if (activeCharacter?.name) {
      // SINGLE CHARACTER MODE: Add only the active character's name
      words.push(activeCharacter.name);
      // Add alternate names if available
      if (activeCharacter.data?.alternate_names) {
        words.push(...activeCharacter.data.alternate_names);
      }
      
      console.log('[KWS] Single mode - wake words:', words);
    }
    
    // Add global wake words from config (case-preserved, comparison is case-insensitive)
    if (kwsConfig.wakeWords && kwsConfig.wakeWords.length > 0) {
      words.push(...kwsConfig.wakeWords);
    }
    
    // Remove duplicates
    return [...new Set(words)];
  }, [isGroupMode, activeGroup, activeCharacter, characters, kwsConfig.wakeWords]);

  // Wake Word Detection hook - Uses only Web Speech API (no Whisper needed)
  const {
    isListening: kwsListening,
    isCapturing: kwsCapturing,
    isPausedByTTS: kwsPausedByTTS,
    transcript: kwsTranscript,
    capturedMessage: kwsCapturedMessage,
    lastDetectedWord: kwsLastDetectedWord,
    error: kwsError,
    startListening: startKWS,
    stopListening: stopKWS,
  } = useWakeWordDetection({
    wakeWords: characterWakeWords,
    language: kwsConfig.language,
    silenceDurationMs: kwsConfig.silenceDurationMs,
    cooldownMs: kwsConfig.cooldownMs,
    ttsPlaying,
    onTranscriptUpdate: (transcript, isCapturing) => {
      console.log('[KWS] Transcript:', transcript, 'Capturing:', isCapturing);
    },
    onWakeWordDetected: (word) => {
      console.log('[KWS] Wake word detected:', word);
    },
    onMessageReady: (message, detectedWakeWord) => {
      // Message captured and silence detected - send automatically!
      console.log('[KWS] ✅ Message ready to send:', message, 'wake word:', detectedWakeWord);
      if (message.trim()) {
        // In group mode, prepend the detected wake word so the backend
        // can detect which character was mentioned
        if (isGroupMode && detectedWakeWord) {
          const messageWithWakeWord = `${detectedWakeWord} ${message.trim()}`;
          console.log('[KWS] Group mode - sending with wake word:', messageWithWakeWord);
          onSendMessage(messageWithWakeWord);
        } else {
          // Single mode - send message as-is
          onSendMessage(message.trim());
        }
      }
    },
  });

  // Derive KWS active state: true when listening or paused by TTS
  const kwsActive = kwsListening || kwsPausedByTTS;

  // Load ASR/KWS config on mount
  useEffect(() => {
    const loadAsrConfig = async () => {
      try {
        const response = await fetch('/api/tts/config');
        if (response.ok) {
          const data = await response.json();
          if (data.config?.asr) {
            setAsrConfig({
              model: data.config.asr.model || 'whisper-small',
              language: data.config.asr.language || 'es',
              enabled: data.config.asr.enabled ?? true,
            });
          }
          // Load KWS config
          if (data.config?.kws) {
            setKwsConfig(prev => ({
              ...prev,
              enabled: data.config.kws.enabled ?? false,
              language: data.config.kws.language || 'es-ES',
              sensitivity: data.config.kws.sensitivity || 'medium',
              cooldownMs: data.config.kws.cooldownMs || 2000,
              silenceDurationMs: data.config.vad?.silenceDurationMs || 1500,
              wakeWords: data.config.kws.wakeWords || [],
            }));
          }
        }
      } catch (error) {
        console.error('[NovelChatBox] Failed to load ASR config:', error);
      }
    };
    loadAsrConfig();
  }, []);

  // Handle KWS toggle
  const handleKWSToggle = useCallback(async () => {
    if (kwsActive) {
      stopKWS();
    } else {
      await startKWS();
    }
  }, [kwsActive, startKWS, stopKWS]);

  // Audio recording hooks
  const { transcribe, isTranscribing } = useAudioTranscription();
  
  const {
    isRecording,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    audioBase64,
    reset: resetRecording,
    error: recordingError,
    permissionStatus,
    requestPermission,
    resetError,
  } = useAudioRecorder({
    maxDuration: 60000, // 60 seconds max
    onError: (error) => {
      console.error('[NovelChatBox] Recording error:', error);
    },
  });

  // Handle recording button click
  const handleRecordingClick = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else if (permissionStatus === 'denied') {
      // Try to request permission again
      resetError();
      const granted = await requestPermission();
      if (!granted) {
        console.error('[NovelChatBox] Permission still denied');
      }
    } else {
      const success = await startRecording();
      if (!success) {
        console.error('[NovelChatBox] Failed to start recording');
      }
    }
  }, [isRecording, startRecording, stopRecording, permissionStatus, requestPermission, resetError]);

  // Show recording error feedback
  useEffect(() => {
    if (recordingError) {
      // Could show toast here if available
      console.error('[NovelChatBox] Recording error:', recordingError);
    }
  }, [recordingError]);

  const activeSession = getActiveSession();
  const layout = settings.chatLayout;
  const hotkeys = settings.hotkeys;

  // Get appearance settings
  const appearance = settings.chatboxAppearance || DEFAULT_CHATBOX_APPEARANCE;
  const safeAppearance = useMemo(() => ({
    ...DEFAULT_CHATBOX_APPEARANCE,
    ...appearance,
    enableAnimations: appearance?.enableAnimations ?? DEFAULT_CHATBOX_APPEARANCE.enableAnimations,
    enableParticles: appearance?.enableParticles ?? DEFAULT_CHATBOX_APPEARANCE.enableParticles,
    animationIntensity: appearance?.animationIntensity ?? DEFAULT_CHATBOX_APPEARANCE.animationIntensity,
    background: { ...DEFAULT_CHATBOX_APPEARANCE.background, ...appearance?.background },
    font: { ...DEFAULT_CHATBOX_APPEARANCE.font, ...appearance?.font },
    textFormatting: { ...DEFAULT_CHATBOX_APPEARANCE.textFormatting, ...appearance?.textFormatting },
    textColors: { ...DEFAULT_CHATBOX_APPEARANCE.textColors, ...appearance?.textColors },
    bubbles: { ...DEFAULT_CHATBOX_APPEARANCE.bubbles, ...appearance?.bubbles },
    avatars: { ...DEFAULT_CHATBOX_APPEARANCE.avatars, ...appearance?.avatars },
    streaming: { ...DEFAULT_CHATBOX_APPEARANCE.streaming, ...appearance?.streaming },
    input: { ...DEFAULT_CHATBOX_APPEARANCE.input, ...appearance?.input },
  }), [appearance]);

  // Helper function to convert hex color to rgba with transparency
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Get session stats for the variables panel
  const sessionStats = activeSession?.sessionStats;
  
  // Get session quests for the quests panel
  const sessionQuests = activeSession?.sessionQuests || [];

  // Determine display name for header
  const headerName = isGroupMode 
    ? activeGroup?.name || t('chat.groupTitle')
    : activeCharacter?.name || t('chat.title');

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    if (settings.autoScroll && messagesEndRef.current && activeTab === 'chat') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, settings.autoScroll, isGenerating, streamingContent, activeTab]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Handle transcription when audio is ready
  useEffect(() => {
    if (!audioBase64 || isTranscribing) return;

    const processTranscription = async () => {
      console.log('[NovelChatBox] Processing transcription with model:', asrConfig.model);
      const result = await transcribe(audioBase64, {
        model: asrConfig.model,
        language: asrConfig.language,
      });

      if (result?.text) {
        // Set the transcribed text as input
        setInput(result.text);
        // Focus the textarea so user can edit if needed
        textareaRef.current?.focus();
      }

      // Reset recording state
      resetRecording();
    };

    processTranscription();
  }, [audioBase64, isTranscribing, transcribe, resetRecording, asrConfig]);

  // Handle recording error
  useEffect(() => {
    if (recordingError) {
      console.error('[NovelChatBox] Recording error:', recordingError);
    }
  }, [recordingError]);

  const updateLayout = useCallback((updates: Partial<ChatLayoutSettings>) => {
    updateSettings({
      chatLayout: {
        ...layout,
        ...updates
      }
    });
  }, [layout, updateSettings]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: layout.chatX,
      top: layout.chatY
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      let newX = dragStartRef.current.left + deltaX;
      let newY = dragStartRef.current.top + deltaY;

      // Constrain to container bounds
      const halfWidth = layout.chatWidth / 2;
      const halfHeight = layout.chatHeight / 2;
      newX = Math.max(halfWidth, Math.min(100 - halfWidth, newX));
      newY = Math.max(halfHeight, Math.min(100 - halfHeight, newY));

      updateLayout({ chatX: newX, chatY: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, layout.chatWidth, layout.chatHeight, updateLayout]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: layout.chatWidth,
      height: layout.chatHeight
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;

      let newWidth = Math.max(25, Math.min(90, resizeStartRef.current.width + deltaX * 2));
      let newHeight = Math.max(30, Math.min(90, resizeStartRef.current.height + deltaY * 2));

      updateLayout({ chatWidth: newWidth, chatHeight: newHeight });
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, updateLayout]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const sendKey = hotkeys.send || 'Enter';
    const newLineKey = hotkeys.newLine || 'Shift+Enter';
    
    // Check if this is the send hotkey
    const isSendKey = sendKey.toLowerCase() === 'enter' && e.key === 'Enter' && !e.shiftKey;
    const isNewLineKey = newLineKey.toLowerCase() === 'shift+enter' && e.key === 'Enter' && e.shiftKey;
    
    if (isSendKey) {
      e.preventDefault();
      handleSend();
    } else if (isNewLineKey) {
      // Let the default behavior (new line) happen
      return;
    }
  };

  // Hotkeys for regenerate and swipe (global)
  useHotkeys(hotkeys, {
    onRegenerate: () => {
      if (!isGenerating && activeSession && activeSession.messages.length > 0) {
        // Get last assistant message
        const lastAssistantMsg = [...activeSession.messages].reverse().find(m => m.role === 'assistant' && !m.isDeleted);
        if (lastAssistantMsg) {
          // Trigger regenerate by deleting and resending
          deleteMessage(activeSessionId!, lastAssistantMsg.id);
          setInput('');
        }
      }
    },
    onSwipeLeft: () => {
      // Could be used for message swiping in future
    },
    onSwipeRight: () => {
      // Could be used for message swiping in future
    }
  }, !isGenerating);

  const handleQuickReply = (reply: string) => {
    setInput(reply);
    textareaRef.current?.focus();
  };

  // Get pending user solicitudes
  const pendingUserSolicitudes = activeSessionId 
    ? getPendingUserSolicitudes(activeSessionId)
    : [];

  // Handle user activating a peticion
  const handleActivatePeticion = (
    targetCharacterId: string,
    solicitudKey: string,
    description: string,
    completionDescription?: string
  ) => {
    if (!activeSessionId) return;
    
    activateUserPeticion(
      activeSessionId,
      targetCharacterId,
      solicitudKey,
      description,
      completionDescription,
      activePersona?.name || 'Usuario'
    );
  };

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  // Quest handlers
  const handleQuestToggle = (templateId: string, currentStatus: string) => {
    if (!activeSessionId) return;
    
    if (currentStatus === 'available') {
      activateQuest(activeSessionId, templateId);
    } else if (currentStatus === 'active') {
      deactivateQuest(activeSessionId, templateId);
    }
  };

  const handleAutoQuestChange = (updates: Partial<typeof questSettings>) => {
    setQuestSettings(updates);
  };

  // Priority colors for quests
  const priorityColors: Record<string, { bg: string; text: string; border: string; progress: string }> = {
    main: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/40',
      progress: 'bg-amber-500',
    },
    side: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/40',
      progress: 'bg-blue-500',
    },
    hidden: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-400',
      border: 'border-slate-500/40',
      progress: 'bg-slate-500',
    },
  };

  // Get theme colors for tabs
  const getThemeColors = useCallback(() => {
    const theme = safeAppearance.theme;
    
    // Check special themes first
    if (theme in THEME_COLOR_PRESETS) {
      const preset = THEME_COLOR_PRESETS[theme];
      return { primary: preset.primary, secondary: preset.secondary };
    }
    
    const presets: Record<string, { primary: string; secondary: string }> = {
      default: { primary: '#3b82f6', secondary: '#6366f1' },
      midnight: { primary: '#6366f1', secondary: '#8b5cf6' },
      forest: { primary: '#22c55e', secondary: '#16a34a' },
      sunset: { primary: '#f97316', secondary: '#ef4444' },
      ocean: { primary: '#0ea5e9', secondary: '#06b6d4' },
      lavender: { primary: '#a855f7', secondary: '#d946ef' },
      cherry: { primary: '#ec4899', secondary: '#f43f5e' },
      custom: safeAppearance.customThemeColors || { primary: '#3b82f6', secondary: '#6366f1' },
    };
    return presets[theme] || presets.default;
  }, [safeAppearance.theme, safeAppearance.customThemeColors]);

  const themeColors = getThemeColors();

  // ============================================
  // MEMORIES TAB - Load & Delete memories
  // ============================================
  const loadMemories = useCallback(async () => {
    if (memoriesLoaded) return;
    setMemoriesLoading(true);
    try {
      const sessionSuffix = sessionId ? `-${sessionId}` : '';
      let namespacesToFetch: string[] = [];
      if (isGroupMode && activeGroup) {
        // Group mode: fetch session-scoped group namespace + each member's character namespace
        const memberIds = activeGroup.members?.map(m => m.characterId) || activeGroup.characterIds || [];
        // Prioritize session-scoped namespaces (primary), also fallback to generic (for manually created lore)
        const sessionNS = sessionSuffix ? [`group-${activeGroup.id}${sessionSuffix}`, ...memberIds.map(id => `character-${id}${sessionSuffix}`)] : [];
        const genericNS = [`group-${activeGroup.id}`, ...memberIds.map(id => `character-${id}`)];
        namespacesToFetch = [...sessionNS, ...genericNS];
      } else if (activeCharacter) {
        // Single mode: fetch session-scoped character namespace
        // Also include generic namespace for backward compat and manually created lore
        namespacesToFetch = [`character-${activeCharacter.id}${sessionSuffix}`];
        if (sessionSuffix) namespacesToFetch.push(`character-${activeCharacter.id}`);
      }

      if (namespacesToFetch.length === 0) {
        setMemoriesLoaded(true);
        setMemoriesLoading(false);
        return;
      }

      // Deduplicate namespaces
      const uniqueNamespaces = [...new Set(namespacesToFetch)];

      // Fetch all namespaces in parallel
      const results = await Promise.all(
        uniqueNamespaces.map(ns =>
          fetch(`/api/embeddings?namespace=${encodeURIComponent(ns)}&source_type=memory&limit=200`)
            .then(r => r.json())
            .then(data => (data.success ? data.data.embeddings : []))
            .catch(() => [])
        )
      );

      // Flatten, deduplicate by id, and sort by created_at (newest first)
      const seenIds = new Set<string>();
      const allMemories = results
        .flat()
        .filter((m: any) => {
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        })
        .sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setMemories(allMemories);
      setMemoriesLoaded(true);
    } catch (error) {
      console.error('[NovelChatBox] Failed to load memories:', error);
    } finally {
      setMemoriesLoading(false);
    }
  }, [isGroupMode, activeGroup, activeCharacter, memoriesLoaded, sessionId]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    try {
      const response = await fetch(`/api/embeddings/${memoryId}`, { method: 'DELETE' });
      if (response.ok) {
        setMemories(prev => prev.filter(m => m.id !== memoryId));
      }
    } catch (error) {
      console.error('[NovelChatBox] Failed to delete memory:', error);
    }
  }, []);

  // Reset memories when character/group/session changes
  useEffect(() => {
    setMemoriesLoaded(false);
    setMemories([]);
  }, [activeCharacter?.id, activeGroup?.id, isGroupMode, sessionId]);

  // Load memories when tab is selected
  useEffect(() => {
    if (activeTab === 'memorias') {
      loadMemories();
    }
  }, [activeTab, loadMemories]);

  // Auto-refresh memories after extraction completes
  // When memoryExtracting goes from true → false, wait a few seconds then refresh
  const prevExtractingRef = useRef(memoryExtracting);
  useEffect(() => {
    if (prevExtractingRef.current && !memoryExtracting) {
      // Extraction just finished — refresh memories after a delay
      const timer = setTimeout(() => {
        setMemoriesLoaded(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    prevExtractingRef.current = memoryExtracting;
  }, [memoryExtracting]);

  // Get character name for a namespace
  const getCharacterNameForNamespace = useCallback((ns: string) => {
    if (ns.startsWith('character-')) {
      const charId = ns.replace('character-', '');
      return characters.find(c => c.id === charId)?.name || ns;
    }
    if (ns.startsWith('group-')) {
      return activeGroup?.name || 'Grupo';
    }
    return ns;
  }, [characters, activeGroup]);

  if (!activeSession) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-20 flex flex-col rounded-lg shadow-2xl overflow-hidden transition-colors",
        isDragging && "cursor-grabbing",
        isResizing && "cursor-nwse-resize"
      )}
      style={{
        left: `${layout.chatX}%`,
        top: `${layout.chatY}%`,
        transform: 'translate(-50%, -50%)',
        width: `${layout.chatWidth}%`,
        height: isCollapsed ? 'auto' : `${layout.chatHeight}%`,
        minHeight: isCollapsed ? 'auto' : '180px',
        maxHeight: isCollapsed ? 'auto' : '95vh',
        backgroundColor: safeAppearance.background.customBackgroundColor || `hsl(var(--background) / ${layout.chatOpacity})`,
        backdropFilter: safeAppearance.background.useGlassEffect ? `blur(${safeAppearance.background.blur}px)` : layout.blurBackground ? 'blur(12px)' : undefined,
        opacity: safeAppearance.background.transparency,
      }}
    >
      {/* Theme Effects Layer */}
      <ThemeEffects
        theme={safeAppearance.theme}
        enableAnimations={safeAppearance.enableAnimations}
        enableParticles={safeAppearance.enableParticles}
        intensity={safeAppearance.animationIntensity}
        className="z-0"
      />
      
      {/* Drag Handle / Header with Tabs */}
      <div
        className="flex flex-col bg-background/50 border-b cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            
            {/* Avatar in header */}
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              {isGroupMode ? (
                <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                  <Users className="w-3 h-3 text-white" />
                </div>
              ) : activeCharacter?.avatar ? (
                <img 
                  src={activeCharacter.avatar} 
                  alt={activeCharacter.name}
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">
                    {activeCharacter?.name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>
            
            <span className="text-sm font-medium truncate max-w-[100px]">
              {headerName}
            </span>
            
            {/* Turn count - only show on chat tab (1 turn = 1 user message) */}
            {activeTab === 'chat' && (
              <span className="text-xs text-muted-foreground">
                {activeSession.messages.filter(m => !m.isDeleted && m.role === 'user').length}{t('chat.turnsCount')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Session Variables Popover */}
            <Popover open={showVariables} onOpenChange={setShowVariables}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Database className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    {t('chatbox.sessionVariables')}
                  </h4>
                  
                  {!sessionStats?.initialized ? (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <Database className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      {t('chatbox.noVariables')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* For each character with stats */}
                      {Object.entries(sessionStats.characterStats).map(([charId, charStats]) => {
                        const character = allCharacters.find(c => c.id === charId);
                        if (!character) return null;
                        
                        const attributeValues = charStats.attributeValues;
                        const attributeDefs = character.statsConfig?.attributes || [];
                        
                        if (Object.keys(attributeValues).length === 0) return null;
                        
                        return (
                          <div key={charId} className="space-y-2">
                            {/* Character Header */}
                            <div className="flex items-center gap-2 pb-1 border-b">
                              <div className="w-5 h-5 rounded-full overflow-hidden">
                                {character.avatar ? (
                                  <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                                    <span className="text-white font-bold text-[10px]">{character.name?.[0]?.toUpperCase()}</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs font-medium">{character.name}</span>
                            </div>
                            
                            {/* Attributes Grid */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {Object.entries(attributeValues).map(([key, value]) => {
                                const attrDef = attributeDefs.find(a => a.key === key);
                                const icon = attrDef?.icon;
                                const color = attrDef?.color || 'default';
                                
                                const colorClasses: Record<string, string> = {
                                  red: 'bg-red-500/20 border-red-500/30 text-red-400',
                                  green: 'bg-green-500/20 border-green-500/30 text-green-400',
                                  blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                                  yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
                                  purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
                                  orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
                                  cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
                                  default: 'bg-white/10 border-white/20 text-white/80',
                                };
                                
                                return (
                                  <div
                                    key={key}
                                    className={cn(
                                      'flex items-center gap-1.5 px-2 py-1 rounded border text-xs',
                                      colorClasses[color] || colorClasses.default
                                    )}
                                  >
                                    {icon && <span className="text-xs">{icon}</span>}
                                    <span className="text-muted-foreground truncate">{attrDef?.name || key}:</span>
                                    <span className="font-medium">{String(value)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Session Events Section */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center gap-2 pb-1">
                          <span className="text-xs font-medium text-amber-400">Eventos de Sesión</span>
                        </div>
                        <div className="space-y-1.5">
                          {/* ultimo_objetivo_completado */}
                          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-amber-500/10 border-amber-500/20 text-xs">
                            <span className="text-muted-foreground shrink-0">Objetivo completado:</span>
                            <span className="text-amber-400">{sessionStats.ultimo_objetivo_completado || 'N/A'}</span>
                          </div>
                          {/* ultima_solicitud_realizada */}
                          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-xs">
                            <span className="text-muted-foreground shrink-0">Solicitud realizada:</span>
                            <span className="text-emerald-400">{sessionStats.ultima_solicitud_realizada || 'N/A'}</span>
                          </div>
                          {/* ultima_solicitud_completada */}
                          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-cyan-500/10 border-cyan-500/20 text-xs">
                            <span className="text-muted-foreground shrink-0">Solicitud completada:</span>
                            <span className="text-cyan-400">{sessionStats.ultima_solicitud_completada || 'N/A'}</span>
                          </div>
                          {/* ultima_accion_realizada */}
                          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded border bg-purple-500/10 border-purple-500/20 text-xs">
                            <span className="text-muted-foreground shrink-0">Acción realizada:</span>
                            <span className="text-purple-400">{sessionStats.ultima_accion_realizada || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Settings Popover */}
            <Popover open={showSettings} onOpenChange={setShowSettings}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">{t('chatbox.settings')}</h4>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">{t('chatbox.width')} {Math.round(layout.chatWidth)}%</label>
                    <Slider
                      value={[layout.chatWidth]}
                      onValueChange={([value]) => updateLayout({ chatWidth: value })}
                      min={25}
                      max={90}
                      step={1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">{t('chatbox.height')} {Math.round(layout.chatHeight)}%</label>
                    <Slider
                      value={[layout.chatHeight]}
                      onValueChange={([value]) => updateLayout({ chatHeight: value })}
                      min={20}
                      max={90}
                      step={1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">{t('chatbox.opacity')} {Math.round(layout.chatOpacity * 100)}%</label>
                    <Slider
                      value={[layout.chatOpacity * 100]}
                      onValueChange={([value]) => updateLayout({ chatOpacity: value / 100 })}
                      min={50}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">{t('chatbox.blurBackground')}</label>
                    <Button
                      variant={layout.blurBackground ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => updateLayout({ blurBackground: !layout.blurBackground })}
                    >
                      {layout.blurBackground ? t('common.on') : t('common.off')}
                    </Button>
                  </div>

                  {/* Chat Actions */}
                  <div className="pt-2 border-t space-y-2">
                    <label className="text-xs text-muted-foreground">{t('chatbox.actions')}</label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => {
                          setShowSettings(false);
                          onResetChat?.();
                        }}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {t('common.reset')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          setShowSettings(false);
                          onClearChat?.();
                        }}
                      >
                        <Eraser className="w-3 h-3 mr-1" />
                        {t('common.clear')}
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      updateLayout({
                        chatWidth: 60,
                        chatHeight: 70,
                        chatX: 50,
                        chatY: 50,
                        chatOpacity: 0.95
                      });
                    }}
                  >
                    {t('chat.resetPosition')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Tab Bar */}
        {!isCollapsed && (
          <div 
            className="flex items-center gap-0.5 px-2 pb-1.5 border-b border-border/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Chat Tab */}
            <button
              onClick={() => setActiveTab('chat')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'chat' 
                  ? "text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              style={activeTab === 'chat' ? {
                backgroundColor: themeColors.primary,
              } : undefined}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            
            {/* Solicitudes Tab */}
            <button
              onClick={() => setActiveTab('solicitudes')}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'solicitudes' 
                  ? "text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              style={activeTab === 'solicitudes' ? {
                backgroundColor: themeColors.primary,
              } : undefined}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Solicitudes</span>
              {pendingUserSolicitudes.length > 0 && (
                <Badge 
                  className="ml-0.5 h-4 min-w-4 px-1 text-[9px] font-bold"
                  style={{ 
                    backgroundColor: activeTab === 'solicitudes' ? 'rgba(255,255,255,0.3)' : themeColors.primary,
                    color: 'white'
                  }}
                >
                  {pendingUserSolicitudes.length}
                </Badge>
              )}
            </button>
            
            {/* Misiones Tab */}
            <button
              onClick={() => setActiveTab('misiones')}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'misiones' 
                  ? "text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              style={activeTab === 'misiones' ? {
                backgroundColor: themeColors.primary,
              } : undefined}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Misiones</span>
              {sessionQuests.filter(q => q.status === 'active').length > 0 && (
                <Badge 
                  className="ml-0.5 h-4 min-w-4 px-1 text-[9px] font-bold"
                  style={{ 
                    backgroundColor: activeTab === 'misiones' ? 'rgba(255,255,255,0.3)' : themeColors.primary,
                    color: 'white'
                  }}
                >
                  {sessionQuests.filter(q => q.status === 'active').length}
                </Badge>
              )}
            </button>
            
            {/* Memorias Tab */}
            <button
              onClick={() => setActiveTab('memorias')}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === 'memorias' 
                  ? "text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              style={activeTab === 'memorias' ? {
                backgroundColor: themeColors.primary,
              } : undefined}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Memorias</span>
              {memories.length > 0 && (
                <Badge 
                  className="ml-0.5 h-4 min-w-4 px-1 text-[9px] font-bold"
                  style={{ 
                    backgroundColor: activeTab === 'memorias' ? 'rgba(255,255,255,0.3)' : themeColors.primary,
                    color: 'white'
                  }}
                >
                  {memories.length}
                </Badge>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      {!isCollapsed && (
        <>
          {/* Chat Tab Content */}
          {activeTab === 'chat' && (
            <>
              <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
                <div className="p-2 space-y-2">
                  {activeSession.messages.filter(m => {
                    // Filter deleted messages
                    if (m.isDeleted) return false;

                    // Check if this is a narrator message and if narrator is hidden from chat
                    if (isGroupMode && activeGroup?.narratorSettings?.hiddenFromChat && m.role === 'assistant') {
                      // Find if this character is a narrator
                      const memberInfo = activeGroup.members?.find(mem => mem.characterId === m.characterId);
                      if (memberInfo?.isNarrator) {
                        return false; // Hide narrator messages from chat display
                      }
                    }

                    return true;
                  }).map((message) => {
                    // Determine character for this message
                    let messageCharacter: CharacterCard | undefined;
                    let displayName: string | undefined;
                    let displayAvatar: string | undefined;
                    let isNarratorMessage = false;

                    if (message.role === 'user') {
                      displayName = activePersona?.name || t('message.you');
                      displayAvatar = activePersona?.avatar || undefined;
                    } else if (isGroupMode) {
                      // Use allCharacters from store if characters prop is empty
                      const characterList = characters.length > 0 ? characters : allCharacters;
                      messageCharacter = characterList.find(c => c.id === message.characterId);
                      displayName = messageCharacter?.name;
                      displayAvatar = messageCharacter?.avatar;

                      // Check if this character is a narrator in the group
                      if (activeGroup?.members) {
                        const memberInfo = activeGroup.members.find(m => m.characterId === message.characterId);
                        isNarratorMessage = memberInfo?.isNarrator || false;
                      }

                      // Debug: log if character not found
                      if (!messageCharacter && message.characterId) {
                        console.warn('[NovelChatBox] Character not found:', message.characterId, 'Available:', characterList.map(c => c.id));
                      }
                    } else {
                      messageCharacter = activeCharacter || undefined;
                      displayName = activeCharacter?.name;
                      displayAvatar = activeCharacter?.avatar;
                    }

                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        characterName={displayName}
                        characterAvatar={displayAvatar}
                        userName={activePersona?.name || t('message.you')}
                        userAvatar={activePersona?.avatar || undefined}
                        showTimestamp={settings.showTimestamps}
                        showTokens={settings.showTokens}
                        onDelete={() => deleteMessage(activeSessionId!, message.id)}
                        displayMode={settings.messageDisplay}
                        onSwipe={(direction) => swipeMessage(activeSessionId!, message.id, direction)}
                        hasAlternatives={(message.swipes?.length || 1) > 1}
                        currentIndex={message.swipeIndex || 0}
                        totalAlternatives={message.swipes?.length || 1}
                        onRegenerate={() => onRegenerate?.(message.id)}
                        onEdit={onEdit}
                        onReplay={onReplay}
                        onSpeak={() => onSpeak?.(message.id, message.content, message.characterId)}
                        isNarrator={isNarratorMessage}
                      />
                    );
                  })}

                  {/* Streaming Message or Typing Indicator */}
                  {isGenerating && (
                    <div className="flex gap-2 py-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      {/* Avatar */}
                      <div 
                        className={cn(
                          'overflow-hidden flex-shrink-0 flex items-center justify-center',
                          safeAppearance.avatars.size === 'sm' ? 'w-8 h-8' : 
                          safeAppearance.avatars.size === 'md' ? 'w-10 h-10' :
                          safeAppearance.avatars.size === 'lg' ? 'w-12 h-12' : 'w-14 h-14',
                          safeAppearance.avatars.shape === 'circle' ? 'rounded-full' :
                          safeAppearance.avatars.shape === 'square' ? 'rounded-none' :
                          safeAppearance.avatars.shape === 'rounded' ? 'rounded-lg' : 'rounded-sm'
                        )}
                        style={{
                          borderWidth: safeAppearance.avatars.showBorder ? safeAppearance.avatars.borderWidth : 0,
                          borderColor: safeAppearance.avatars.borderColor,
                          borderStyle: 'solid',
                        }}
                      >
                        {isGroupMode ? (
                          // In group mode, only show avatar when we know which character is responding
                          streamingCharacter ? (
                            streamingCharacter.avatar ? (
                              <img 
                                src={streamingCharacter.avatar} 
                                alt={streamingCharacter.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                                <span className="text-white font-bold text-xs">
                                  {streamingCharacter.name?.[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                            )
                          ) : (
                            // Waiting for character_start event - show loading indicator
                            <div className="w-full h-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                              <span className="text-white font-bold text-xs animate-pulse">?</span>
                            </div>
                          )
                        ) : activeCharacter?.avatar ? (
                          <img 
                            src={activeCharacter.avatar} 
                            alt={activeCharacter.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {activeCharacter?.name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Name above bubble */}
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium">
                            {isGroupMode 
                              ? (streamingCharacter?.name || 'Preparando...')
                              : activeCharacter?.name || 'Assistant'}
                          </span>
                          {streamingProgress && (
                            <span className="text-[10px] text-muted-foreground">
                              ({streamingProgress.current}/{streamingProgress.total})
                            </span>
                          )}
                        </div>
                        
                        {/* Content bubble */}
                        <div 
                          className="px-3 py-2"
                          style={{
                            backgroundColor: hexToRgba(safeAppearance.bubbles.characterBubbleColor, safeAppearance.bubbles.transparency),
                            borderRadius: safeAppearance.bubbles.borderRadius,
                            borderTopLeftRadius: 4,
                            maxWidth: `${safeAppearance.bubbles.maxWidth}%`,
                            boxShadow: safeAppearance.bubbles.shadowEnabled 
                              ? safeAppearance.bubbles.shadowIntensity === 'soft' ? '0 1px 3px rgba(0,0,0,0.1)' :
                                safeAppearance.bubbles.shadowIntensity === 'medium' ? '0 4px 6px rgba(0,0,0,0.15)' :
                                '0 10px 15px rgba(0,0,0,0.2)' : undefined,
                          }}
                        >
                          {streamingContent ? (
                            <div 
                              className="text-xs"
                              style={{ 
                                color: safeAppearance.bubbles.characterBubbleTextColor,
                              }}
                            >
                              {streamingContent}
                              {safeAppearance.streaming.showCursor && (
                                <span 
                                  className="inline-block ml-0.5 animate-pulse"
                                  style={{ color: safeAppearance.streaming.cursorColor }}
                                >
                                  {safeAppearance.streaming.cursorStyle === 'block' ? '▋' :
                                   safeAppearance.streaming.cursorStyle === 'line' ? '|' :
                                   safeAppearance.streaming.cursorStyle === 'underscore' ? '_' : '●'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Auto-scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Replies - Compact */}
              {settings.quickReplies.length > 0 && (
                <div className="px-2 py-1 flex gap-1 overflow-x-auto border-t bg-background/30 flex-shrink-0">
                  {settings.quickReplies.slice(0, 4).map((reply, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs flex-shrink-0"
                      onClick={() => handleQuickReply(reply)}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>
              )}

              {/* User Peticiones - Quick Tags */}
              <QuickPetitions
                activePersona={activePersona}
                activeCharacter={activeCharacter}
                characters={isGroupMode ? (characters.length > 0 ? characters : allCharacters) : (activeCharacter ? [activeCharacter] : [])}
                onActivatePeticion={handleActivatePeticion}
              />

              {/* Input Area - Always visible */}
              <div 
                className="p-2 border-t flex-shrink-0"
                style={{
                  backgroundColor: safeAppearance.input.backgroundColor,
                  borderColor: safeAppearance.input.borderColor,
                }}
              >
                <div className="flex gap-2 items-end">
                  <EmojiPicker onEmojiSelect={(emoji) => setInput(prev => prev + emoji)} />
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.messagePlaceholder')}
                    className="min-h-[32px] max-h-[80px] resize-none flex-1 placeholder:text-muted-foreground"
                    style={{
                      color: safeAppearance.input.textColor,
                      borderColor: safeAppearance.input.borderColor,
                      borderRadius: safeAppearance.input.borderRadius,
                      fontSize: safeAppearance.input.fontSize === 'sm' ? '0.75rem' : 
                               safeAppearance.input.fontSize === 'lg' ? '1.125rem' : '1rem',
                    }}
                    disabled={isGenerating || isTranscribing}
                    rows={1}
                  />
                  {/* Voice Recording Button */}
                  <Button
                    type="button"
                    size="icon"
                    variant={isRecording ? "destructive" : recordingError ? "destructive" : "outline"}
                    className={cn(
                      "h-8 w-8 flex-shrink-0 transition-all",
                      isRecording && "animate-pulse bg-red-600 hover:bg-red-700",
                      permissionStatus === 'denied' && "border-amber-500 hover:bg-amber-500/10"
                    )}
                    onClick={handleRecordingClick}
                    disabled={isGenerating || isTranscribing}
                    title={
                      permissionStatus === 'denied' 
                        ? 'Clic para solicitar permiso de micrófono'
                        : recordingError 
                          ? recordingError 
                          : isRecording 
                            ? 'Detener grabación' 
                            : 'Grabar mensaje de voz'
                    }
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : permissionStatus === 'denied' ? (
                      <Mic className="w-4 h-4 text-amber-500" />
                    ) : isRecording ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                  {/* KWS Toggle Button */}
                  <Button
                    type="button"
                    size="icon"
                    variant={kwsActive ? "default" : "outline"}
                    className={cn(
                      "h-8 w-8 flex-shrink-0 transition-all",
                      kwsActive && kwsPausedByTTS && "animate-pulse bg-amber-600 hover:bg-amber-700",
                      kwsActive && !kwsPausedByTTS && "animate-pulse bg-green-600 hover:bg-green-700"
                    )}
                    onClick={handleKWSToggle}
                    disabled={isGenerating || isTranscribing}
                    title={
                      kwsPausedByTTS
                        ? 'KWS en pausa (TTS reproduciendo)'
                        : kwsActive
                          ? 'Desactivar escucha por voz'
                          : `Activar escucha por voz (${activeCharacter?.name || 'KWS'})`
                    }
                  >
                    {kwsPausedByTTS ? (
                      <VolumeX className="w-4 h-4" />
                    ) : kwsActive ? (
                      <Radio className="w-4 h-4" />
                    ) : (
                      <Ear className="w-4 h-4" />
                    )}
                  </Button>
                  {/* Recording Duration Indicator */}
                  {isRecording && (
                    <span className="text-xs text-red-500 font-mono min-w-[40px] animate-pulse">
                      {Math.floor(recordingDuration / 60000)}:{String(Math.floor((recordingDuration % 60000) / 1000)).padStart(2, '0')}
                    </span>
                  )}
                  {/* KWS Status Indicator */}
                  {kwsActive && !kwsCapturing && (
                    <span className={cn(
                      "text-xs font-mono min-w-[50px]",
                      kwsPausedByTTS
                        ? "text-amber-400 animate-pulse"
                        : "text-green-500 animate-pulse"
                    )}>
                      {kwsPausedByTTS ? '🔇 EN PAUSA' : '🎧 ESCUCHANDO'}
                    </span>
                  )}
                  {/* KWS Capturing Indicator - After wake word detected */}
                  {kwsCapturing && (
                    <span className={cn(
                      "text-xs font-mono min-w-[50px]",
                      "text-amber-400 animate-pulse"
                    )}>
                      🎤 CAPTURANDO...
                    </span>
                  )}
                  {/* KWS Transcript Preview - Shows what KWS is detecting in real-time */}
                  {kwsActive && kwsTranscript && (
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full border max-w-[200px] overflow-hidden",
                      kwsCapturing
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-green-500/10 border-green-500/20"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0",
                        kwsCapturing ? "bg-amber-500" : "bg-green-500"
                      )} />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-end">
                          <span className={cn(
                            "text-[10px] italic whitespace-nowrap",
                            kwsCapturing ? "text-amber-300" : "text-green-400"
                          )}>
                            &quot;{kwsTranscript.length > 35 ? '...' + kwsTranscript.slice(-35) : kwsTranscript}&quot;
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Wake Word Detected Indicator */}
                  {kwsLastDetectedWord && kwsCapturing && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-400 font-medium">
                        {kwsLastDetectedWord} →
                      </span>
                    </div>
                  )}
                  {/* Message being captured - will be sent on silence */}
                  {kwsCapturing && kwsCapturedMessage && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 max-w-[200px] overflow-hidden">
                      <Send className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-end">
                          <span className="text-[10px] text-blue-300 whitespace-nowrap">
                            {kwsCapturedMessage.length > 35 ? '...' + kwsCapturedMessage.slice(-35) : kwsCapturedMessage}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Permission denied warning - now clickable */}
                  {permissionStatus === 'denied' && !isRecording && !isTranscribing && (
                    <button 
                      onClick={handleRecordingClick}
                      className="text-xs text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span className="opacity-70">🔓 Solicitar permiso</span>
                    </button>
                  )}
                  <Button
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={handleSend}
                    disabled={!input.trim() || isGenerating || isTranscribing}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Solicitudes Tab Content */}
          {activeTab === 'solicitudes' && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Inbox className="w-4 h-4 text-amber-500" />
                  <h4 className="font-medium text-sm">Solicitudes Recibidas</h4>
                  {pendingUserSolicitudes.length > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 text-[10px]">
                      {pendingUserSolicitudes.length} pendientes
                    </Badge>
                  )}
                </div>
                
                {pendingUserSolicitudes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No tienes solicitudes pendientes</p>
                    <p className="text-xs mt-1 opacity-70">Los personajes pueden enviarte solicitudes durante la conversación</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Group by character */}
                    {Array.from(new Map(pendingUserSolicitudes.map(s => [s.fromCharacterName, s])).values()).reduce((acc, s) => {
                      const existing = acc.find(g => g.characterName === s.fromCharacterName);
                      if (existing) {
                        existing.solicitudes.push(s);
                      } else {
                        acc.push({ characterName: s.fromCharacterName, solicitudes: [s] });
                      }
                      return acc;
                    }, [] as { characterName: string; solicitudes: typeof pendingUserSolicitudes }).map((group) => (
                      <div key={group.characterName} className="space-y-2">
                        {/* Character Header */}
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-lg">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{group.characterName}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
                            {group.solicitudes.length}
                          </Badge>
                        </div>
                        
                        {/* Solicitudes for this character */}
                        {group.solicitudes.map((solicitud) => (
                          <div
                            key={solicitud.id}
                            className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 transition-colors"
                          >
                            {/* Key and time */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <code className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono text-amber-300">
                                {solicitud.key}
                              </code>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(solicitud.createdAt)}
                              </span>
                            </div>
                            
                            {/* Description */}
                            <p className="text-xs text-foreground/80 mb-3 leading-relaxed">
                              {solicitud.description}
                            </p>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs flex-1 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                                onClick={() => {
                                  if (activeSessionId) {
                                    acceptUserSolicitud(activeSessionId, solicitud.id);
                                  }
                                }}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Aceptar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs flex-1 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                onClick={() => {
                                  if (activeSessionId) {
                                    rejectUserSolicitud(activeSessionId, solicitud.id);
                                  }
                                }}
                              >
                                <Circle className="w-3.5 h-3.5 mr-1" />
                                Rechazar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Misiones Tab Content */}
          {activeTab === 'misiones' && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                {/* Header with quest counts */}
                <div className="flex items-center gap-2 mb-3">
                  <ScrollText className="w-4 h-4 text-amber-500" />
                  <h4 className="font-medium text-sm">{t('chatbox.quests')}</h4>
                  {sessionQuests.filter(q => q.status === 'active').length > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                      {sessionQuests.filter(q => q.status === 'active').length} activas
                    </Badge>
                  )}
                  {sessionQuests.filter(q => q.status === 'available').length > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                      +{sessionQuests.filter(q => q.status === 'available').length} disp.
                    </Badge>
                  )}
                </div>
                
                {!questSettings.enabled ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('chatbox.questsDisabled')}</p>
                  </div>
                ) : sessionQuests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('chatbox.noQuests')}</p>
                    <p className="text-xs mt-1 opacity-70">Las misiones aparecerán según avances en la conversación</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Active Quests */}
                    {sessionQuests.filter(q => q.status === 'active').length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-1">
                          Activas
                        </div>
                        {sessionQuests.filter(q => q.status === 'active').map(quest => {
                          const template = questTemplates.find(t => t.id === quest.templateId);
                          if (!template) return null;
                          
                          const colors = priorityColors[template.priority] || priorityColors.main;
                          const completedObjectives = quest.objectives.filter(o => o.isCompleted).length;
                          const totalObjectives = quest.objectives.length;
                          const isExpanded = expandedQuestId === quest.templateId;
                          
                          // Get objectives with template data
                          const objectives = template.objectives.map(obj => {
                            const instanceObj = quest.objectives.find(o => o.templateId === obj.id);
                            return {
                              ...obj,
                              currentCount: instanceObj?.currentCount ?? 0,
                              isCompleted: instanceObj?.isCompleted ?? false,
                            };
                          });
                          
                          return (
                            <div
                              key={quest.templateId}
                              className={cn(
                                'rounded-lg border transition-all',
                                colors.bg,
                                colors.border,
                                'hover:bg-white/5'
                              )}
                            >
                              {/* Quest Header */}
                              <div className="flex items-start gap-2 p-2">
                                {/* Icon */}
                                <div className={cn(
                                  'flex items-center justify-center rounded-lg shrink-0 w-10 h-10',
                                  colors.bg,
                                  'border',
                                  colors.border
                                )}>
                                  <span className="text-xl">{template.icon || '📜'}</span>
                                </div>
                                
                                {/* Quest Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span 
                                      className={cn(
                                        'font-medium truncate cursor-pointer hover:underline text-sm',
                                        colors.text
                                      )}
                                      onClick={() => setExpandedQuestId(isExpanded ? null : quest.templateId)}
                                    >
                                      {template.name}
                                    </span>
                                    {template.priority === 'main' && (
                                      <Star className="w-3 h-3 text-amber-400 shrink-0" />
                                    )}
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
                                      <div
                                        className={cn('h-full rounded-full transition-all', colors.progress)}
                                        style={{ width: `${quest.progress}%` }}
                                      />
                                    </div>
                                    <span className={cn('text-[10px] font-medium', colors.text)}>
                                      {Math.round(quest.progress)}%
                                    </span>
                                  </div>
                                  
                                  {/* Objective Count */}
                                  <div className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                                    <Target className="w-3 h-3" />
                                    <span>{completedObjectives}/{totalObjectives} objetivos</span>
                                    {template.rewards.length > 0 && (
                                      <>
                                        <span className="mx-1">•</span>
                                        <Gift className="w-3 h-3" />
                                        <span>{template.rewards.length} recompensas</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Deactivate Button */}
                                <button
                                  onClick={() => handleQuestToggle(template.id, 'active')}
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors shrink-0',
                                    'hover:bg-red-500/20 text-red-400/60 hover:text-red-400'
                                  )}
                                  title="Desactivar misión"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              
                              {/* Objectives (Expanded) */}
                              {isExpanded && objectives.length > 0 && (
                                <div className="border-t border-white/10 p-2 pt-2">
                                  <div className="space-y-1">
                                    {objectives.map((obj) => {
                                      const objProgress = obj.targetCount > 0 
                                        ? Math.min(100, (obj.currentCount / obj.targetCount) * 100)
                                        : (obj.isCompleted ? 100 : 0);
                                      
                                      return (
                                        <div 
                                          key={obj.id}
                                          className={cn(
                                            'flex items-center gap-2 rounded px-1.5 py-1',
                                            obj.isCompleted 
                                              ? 'bg-green-500/10 text-green-400' 
                                              : 'bg-white/5 text-white/70',
                                            'transition-colors'
                                          )}
                                        >
                                          {/* Checkbox */}
                                          <div className={cn(
                                            'flex items-center justify-center rounded-full shrink-0 transition-all w-5 h-5',
                                            obj.isCompleted 
                                              ? 'bg-green-500 text-white' 
                                              : 'border border-white/30'
                                          )}>
                                            {obj.isCompleted && <Check className="w-3 h-3" />}
                                          </div>
                                          
                                          {/* Description */}
                                          <span className={cn(
                                            'flex-1 truncate text-xs',
                                            obj.isCompleted && 'line-through opacity-70'
                                          )}>
                                            {obj.description}
                                          </span>
                                          
                                          {/* Counter (if multi-target) */}
                                          {obj.targetCount > 1 && (
                                            <span className={cn(
                                              'text-[10px] font-medium px-1.5 py-0.5 rounded',
                                              obj.isCompleted 
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-white/10 text-white/50'
                                            )}>
                                              {obj.currentCount}/{obj.targetCount}
                                            </span>
                                          )}
                                          
                                          {/* Optional badge */}
                                          {obj.isOptional && !obj.isCompleted && (
                                            <span className="text-[8px] text-white/30 uppercase tracking-wider">
                                              opt
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              {/* Description (if expanded) */}
                              {isExpanded && template.description && (
                                <div className="px-2 pb-2">
                                  <p className="text-[10px] text-white/40 line-clamp-2">
                                    {template.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Available Quests */}
                    {sessionQuests.filter(q => q.status === 'available').length > 0 && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowAvailableQuests(!showAvailableQuests)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-blue-400 hover:bg-white/5 rounded transition-colors"
                        >
                          <Circle className="w-3 h-3" />
                          <span className="flex-1 text-left">{t('chatbox.availableQuests')} ({sessionQuests.filter(q => q.status === 'available').length})</span>
                          {showAvailableQuests ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        
                        {showAvailableQuests && (
                          <div className="space-y-1">
                            {sessionQuests.filter(q => q.status === 'available').map(quest => {
                              const template = questTemplates.find(t => t.id === quest.templateId);
                              if (!template) return null;
                              
                              const colors = priorityColors[template.priority] || priorityColors.main;
                              
                              return (
                                <button
                                  key={quest.templateId}
                                  onClick={() => handleQuestToggle(template.id, 'available')}
                                  className={cn(
                                    'w-full flex items-center gap-2 p-2 rounded-lg border transition-all',
                                    'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                                    'group'
                                  )}
                                >
                                  {/* Icon */}
                                  <div className={cn(
                                    'flex items-center justify-center rounded-lg w-8 h-8 shrink-0',
                                    colors.bg,
                                    'border',
                                    colors.border,
                                    'group-hover:border-white/30'
                                  )}>
                                    <span className="text-lg">{template.icon || '📜'}</span>
                                  </div>
                                  
                                  {/* Info */}
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-1">
                                      <span className={cn('font-medium truncate text-xs', colors.text)}>
                                        {template.name}
                                      </span>
                                      {template.priority === 'main' && (
                                        <Star className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                      )}
                                    </div>
                                    {template.description && (
                                      <p className="text-[10px] text-white/40 truncate mt-0.5">
                                        {template.description}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {/* Activate Button */}
                                  <div className={cn(
                                    'p-1.5 rounded-lg transition-all',
                                    'bg-green-500/10 text-green-400 group-hover:bg-green-500/20'
                                  )}>
                                    <Play className="w-3.5 h-3.5" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Completed Quests */}
                    {sessionQuests.filter(q => q.status === 'completed').length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-1 mt-4 pt-3 border-t">
                          {t('chatbox.completedQuests')}
                        </div>
                        {sessionQuests.filter(q => q.status === 'completed').slice(0, 5).map(quest => {
                          const template = questTemplates.find(t => t.id === quest.templateId);
                          if (!template) return null;
                          
                          return (
                            <div
                              key={quest.templateId}
                              className="p-3 rounded-lg border bg-green-500/10 border-green-500/30"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{template.icon || '📜'}</span>
                                <span className="text-sm truncate flex-1 line-through opacity-70">{template.name}</span>
                                <Check className="w-4 h-4 text-green-500" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Auto Quest Configuration */}
                    <div className="pt-3 border-t border-white/10">
                      <button
                        onClick={() => setShowAutoQuestConfig(!showAutoQuestConfig)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors',
                          questSettings.autoQuestEnabled
                            ? 'text-violet-400 hover:bg-violet-500/10'
                            : 'text-white/50 hover:bg-white/5'
                        )}
                      >
                        <Zap className={cn(
                          'w-3 h-3',
                          questSettings.autoQuestEnabled && 'animate-pulse'
                        )} />
                        <span className="flex-1 text-left">Auto Quest</span>
                        {questSettings.autoQuestEnabled && (
                          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-[10px]">
                            ON
                          </Badge>
                        )}
                        {showAutoQuestConfig ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      
                      {showAutoQuestConfig && (
                        <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 space-y-3">
                          {/* Enable Switch */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/70">Activar automáticamente</span>
                            <button
                              onClick={() => handleAutoQuestChange({ autoQuestEnabled: !questSettings.autoQuestEnabled })}
                              className={cn(
                                'relative w-10 h-5 rounded-full transition-colors',
                                questSettings.autoQuestEnabled ? 'bg-violet-500' : 'bg-white/20'
                              )}
                            >
                              <div className={cn(
                                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                                questSettings.autoQuestEnabled ? 'translate-x-5' : 'translate-x-0.5'
                              )} />
                            </button>
                          </div>
                          
                          {/* Interval Setting */}
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">
                              Cada X turnos/mensajes:
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={questSettings.autoQuestInterval}
                              onChange={(e) => handleAutoQuestChange({ 
                                autoQuestInterval: Math.max(1, parseInt(e.target.value) || 5) 
                              })}
                              className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 rounded text-white/80 focus:outline-none focus:border-violet-500/50"
                              disabled={!questSettings.autoQuestEnabled}
                            />
                          </div>
                          
                          {/* Mode Selection */}
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Modo de selección:</label>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAutoQuestChange({ autoQuestMode: 'random' })}
                                disabled={!questSettings.autoQuestEnabled}
                                className={cn(
                                  'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
                                  questSettings.autoQuestMode === 'random'
                                    ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                                    : 'bg-white/5 text-white/50 border border-white/10',
                                  !questSettings.autoQuestEnabled && 'opacity-50 cursor-not-allowed'
                                )}
                              >
                                <Shuffle className="w-3 h-3" />
                                Random
                              </button>
                              <button
                                onClick={() => handleAutoQuestChange({ autoQuestMode: 'list' })}
                                disabled={!questSettings.autoQuestEnabled}
                                className={cn(
                                  'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors',
                                  questSettings.autoQuestMode === 'list'
                                    ? 'bg-violet-500/30 text-violet-300 border border-violet-500/50'
                                    : 'bg-white/5 text-white/50 border border-white/10',
                                  !questSettings.autoQuestEnabled && 'opacity-50 cursor-not-allowed'
                                )}
                              >
                                <List className="w-3 h-3" />
                                Lista
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Memorias Tab Content */}
          {activeTab === 'memorias' && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-violet-500" />
                  <h4 className="font-medium text-sm">Memorias del Personaje</h4>
                  {memories.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {memories.length}
                    </Badge>
                  )}
                </div>

                {/* Loading */}
                {memoriesLoading && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando memorias...
                  </div>
                )}

                {/* Empty State */}
                {!memoriesLoading && memories.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">
                      {isGroupMode 
                        ? 'Sin memorias extraídas para este grupo'
                        : 'Sin memorias extraídas para este personaje'
                      }
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                      Las memorias se extraen automáticamente durante la conversación
                    </p>
                  </div>
                )}

                {/* Memories List */}
                {!memoriesLoading && memories.length > 0 && (
                  <div className="space-y-2">
                    {/* Group memories by character in group mode */}
                    {isGroupMode ? (
                      // In group mode, group by namespace
                      Object.entries(
                        memories.reduce<Record<string, typeof memories>>((acc, mem) => {
                          if (!acc[mem.namespace]) acc[mem.namespace] = [];
                          acc[mem.namespace].push(mem);
                          return acc;
                        }, {})
                      ).map(([namespace, nsMemories]) => (
                        <div key={namespace} className="space-y-1.5">
                          <div className="flex items-center gap-1.5 px-1 py-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                            <span className="text-xs font-medium text-violet-400">
                              {getCharacterNameForNamespace(namespace)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({nsMemories.length})
                            </span>
                          </div>
                          {nsMemories.map(memory => (
                            <MemoryItem
                              key={memory.id}
                              memory={memory}
                              onDelete={deleteMemory}
                            />
                          ))}
                        </div>
                      ))
                    ) : (
                      // Single mode: flat list
                      memories.map(memory => (
                        <MemoryItem
                          key={memory.id}
                          memory={memory}
                          onDelete={deleteMemory}
                        />
                      ))
                    )}
                  </div>
                )}

                {/* Info Footer */}
                {!memoriesLoading && memories.length > 0 && (
                  <div className="pt-2 border-t mt-2 space-y-2">
                    <p className="text-[10px] text-muted-foreground text-center">
                      🧠 Namespace: <code className="text-violet-400">{isGroupMode && activeGroup ? `group-${activeGroup.id}${sessionId ? `-${sessionId.slice(0, 8)}` : ''}` : activeCharacter ? `character-${activeCharacter.id}${sessionId ? `-${sessionId.slice(0, 8)}` : ''}` : '—'}</code>
                    </p>
                    <p className="text-[10px] text-muted-foreground text-center">
                      💡 Para gestionar más memorias, ve a Configuración → Embeddings → Examinar
                    </p>
                  </div>
                )}

                {/* Empty state - more helpful info */}
                {!memoriesLoading && memories.length === 0 && (
                  <div className="pt-2 border-t mt-2 space-y-2">
                    <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
                      <p className="text-[10px] font-medium text-foreground">Para activar la extracción automática:</p>
                      <ol className="text-[10px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                        <li>Ollama debe estar corriendo con un modelo de embeddings</li>
                        <li>Configuración → Embeddings → Usar embeddings en chat ✅</li>
                        <li>Configuración → Embeddings → Extracción Automática ✅</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Resize Handles */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/30" />
          </div>
        </>
      )}
    </div>
  );
}
