// ============================================
// TTS Types - Voice System Type Definitions
// ============================================

/**
 * Configuration for a single voice (dialogue or narrator)
 * Can override global TTS settings
 */
export interface CharacterVoiceConfig {
  enabled: boolean;
  voiceId: string;              // Voice ID from TTS-WebUI (e.g., "voices/chatterbox/es-rick.wav")
  
  // Parameters that override global config
  exaggeration?: number;        // 0-1, expressiveness (default: 0.5)
  cfgWeight?: number;           // 0-1, classifier-free guidance (default: 0.5)
  temperature?: number;         // 0-2, sampling variability (default: 0.8)
  speed?: number;               // 0.5-2, speech speed multiplier (default: 1.0)
  
  // For multilingual model
  language?: string;            // Language code: es, en, ja, etc.
}

/**
 * Complete voice settings for a character
 * Supports dual voice system: dialogue voice + narrator voice
 */
export interface CharacterVoiceSettings {
  enabled: boolean;             // TTS enabled for this character
  
  // Voice for dialogues (text in "quotes")
  dialogueVoice: CharacterVoiceConfig;
  
  // Voice for narrator (text in *asterisks*)
  narratorVoice: CharacterVoiceConfig;
  
  // Text generation options (what to generate)
  // Positive logic: true = generate, false = skip
  generateDialogues: boolean;       // Generate dialogues ("text in quotes")
  generateNarrations: boolean;      // Generate narrations (*text in asterisks*)
  generatePlainText: boolean;       // Generate plain text (no quotes or asterisks)
  
  // Legacy compatibility
  emotionMapping?: Record<string, string>;
}

/**
 * Global TTS configuration
 */
export interface TTSWebUIConfig {
  enabled: boolean;
  autoGeneration: boolean;       // Auto-play TTS on new messages
  baseUrl: string;               // TTS-WebUI endpoint
  model: string;                 // Default TTS model
  whisperModel: string;          // Whisper model for ASR
  
  // Default values (can be overridden per character)
  defaultVoice?: string;
  speed: number;
  responseFormat: 'mp3' | 'wav' | 'ogg' | 'flac';
  language?: string;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
  
  // Global text generation options (what to generate)
  // Positive logic: true = generate, false = skip
  generateDialogues: boolean;       // Generate dialogues ("text in quotes")
  generateNarrations: boolean;      // Generate narrations (*text in asterisks*)
  generatePlainText: boolean;       // Generate plain text (no quotes or asterisks)
  
  applyRegex: boolean;
  customRegex?: string;
}

/**
 * Parsed text segment for TTS
 */
export interface TextSegment {
  type: 'dialogue' | 'narrator' | 'plain';
  text: string;
}

/**
 * Voice info from TTS-WebUI
 */
export interface VoiceInfo {
  id: string;                    // Voice ID (path)
  name: string;                  // Display name
  path: string;                  // Full path
  language?: string;             // Detected language
}

/**
 * TTS Queue item for playback
 */
export interface TTSQueueItem {
  id: string;
  text: string;
  voiceConfig: CharacterVoiceConfig;
  characterId?: string;
  priority: number;
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'completed' | 'error' | 'autoplay_blocked';
  audioUrl?: string;
  audioBlob?: Blob;
  error?: string;
}

/**
 * TTS playback state
 */
export interface TTSPlaybackState {
  isPlaying: boolean;
  currentItem: TTSQueueItem | null;
  queue: TTSQueueItem[];
  volume: number;
}

/**
 * Default voice configurations
 */
export const DEFAULT_VOICE_CONFIG: CharacterVoiceConfig = {
  enabled: true,
  voiceId: 'default',
  exaggeration: 0.5,
  cfgWeight: 0.5,
  temperature: 0.8,
  speed: 1.0,
};

export const DEFAULT_CHARACTER_VOICE_SETTINGS: CharacterVoiceSettings = {
  enabled: false,
  dialogueVoice: { ...DEFAULT_VOICE_CONFIG },
  narratorVoice: { ...DEFAULT_VOICE_CONFIG },
  generateDialogues: true,      // By default, generate all text types
  generateNarrations: true,
  generatePlainText: true,
};

export const DEFAULT_TTS_WEBUI_CONFIG: TTSWebUIConfig = {
  enabled: false,
  autoGeneration: false,
  baseUrl: 'http://localhost:7778',
  model: 'multilingual',
  whisperModel: 'whisper-large-v3',
  speed: 1.0,
  responseFormat: 'wav',
  language: 'es',
  exaggeration: 0.5,
  cfgWeight: 0.5,
  temperature: 0.8,
  generateDialogues: true,      // By default, generate all text types
  generateNarrations: true,
  generatePlainText: true,
  applyRegex: false,
};
