// ============================================
// TAVERNFLOW - Type Definitions
// ============================================

// ============ Atmosphere Types ============

// Atmosphere layer type (how it's rendered)
export type AtmosphereRenderType = 'css' | 'canvas' | 'overlay' | 'shader';

// Atmosphere category for grouping
export type AtmosphereCategory = 
  | 'precipitation'  // rain, snow, hail
  | 'particles'      // fireflies, leaves, dust, embers
  | 'fog'            // fog, mist, haze
  | 'light'          // sun rays, lightning, aurora
  | 'overlay'        // color filters, vignette, lens effects
  | 'ambient';       // background ambient effects

// Single atmosphere layer definition
export interface AtmosphereLayer {
  id: string;
  name: string;
  category: AtmosphereCategory;
  renderType: AtmosphereRenderType;
  
  // Visual settings
  intensity: number;         // 0-1, controls particle count/speed
  speed: number;             // Animation speed multiplier
  opacity: number;           // Layer opacity 0-1
  color?: string;            // Primary color (hex or rgba)
  colorSecondary?: string;   // Secondary color for gradients
  
  // Size/density settings
  density?: number;          // Particle density
  sizeMin?: number;          // Min particle size
  sizeMax?: number;          // Max particle size
  
  // Direction/movement
  direction?: number;        // Direction in degrees (0 = down, 90 = right)
  windSpeed?: number;        // Wind effect on particles
  
  // CSS/Canvas specific settings
  cssClass?: string;         // CSS class for CSS-based effects
  spriteUrl?: string;        // Sprite URL for overlay/particle effects
  
  // Animation settings
  loop?: boolean;            // Loop animation
  duration?: number;         // Duration in ms for non-looping effects
  
  // Trigger keywords
  triggerKeys: string[];     // Keywords that activate this layer
  contextKeys?: string[];    // Additional context keys required
  
  // Audio
  audioLoopUrl?: string;     // Ambient audio loop
  audioVolume?: number;      // Volume 0-1
  
  // State
  active: boolean;
  priority: number;          // Rendering priority (higher = on top)
}

// Preset atmosphere configuration
export interface AtmospherePreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;             // Emoji or icon name
  thumbnail?: string;        // Preview image
  layers: AtmosphereLayer[]; // Layers in this preset
  transitionDuration?: number; // Time to transition to this preset
}

// Active atmosphere state
export interface AtmosphereState {
  activeLayers: AtmosphereLayer[];
  activePresetId: string | null;
  transitionProgress: number; // 0-1 for smooth transitions
  audioEnabled: boolean;
  globalIntensity: number;    // Multiplier for all layers
}

// Atmosphere settings
export interface AtmosphereSettings {
  enabled: boolean;
  autoDetect: boolean;        // Auto-detect from messages
  realtimeEnabled: boolean;   // Detect during streaming
  globalIntensity: number;    // Global intensity multiplier
  globalVolume: number;       // Global audio volume
  transitionDuration: number; // Default transition time
  showPreview: boolean;       // Show preview in settings
  performanceMode: 'quality' | 'balanced' | 'performance';
}

// Atmosphere trigger result
export interface AtmosphereTriggerHit {
  layerId: string;
  layer?: AtmosphereLayer;
  presetId?: string;
  preset?: AtmospherePreset;
  intensity?: number;         // Detected intensity from context
}

// ============ Character Card Types ============

// ============ Sprite System Types (V2) ============

// Sprite Index Entry - available sprites from filesystem
export interface SpriteIndexEntry {
  label: string;             // Unique label for this sprite
  filename: string;          // Original filename
  url: string;               // Full URL to the sprite
  thumb?: string;            // Thumbnail URL
  pack?: string;             // Pack name this belongs to
  expressions?: string[];    // Available expressions
}

// Sprite Index - cached index of available sprites
export interface SpriteIndex {
  sprites: SpriteIndexEntry[];
  lastUpdated: number;
  source: string;            // Where sprites were scanned from
}

// Sprite Lock State - keeps sprite fixed for duration
export interface SpriteLockState {
  active: boolean;
  spriteUrl: string;
  until: number;             // Timestamp ms; 0 = infinite
  lastApplyAt: number;
}

// Sprite Trigger Hit - result of matching sprite triggers (V2)
export interface SpriteTriggerHit {
  packId: string;
  collectionId?: string;        // V2: Trigger collection ID
  spriteLabel: string | null;
  spriteUrl: string;
  returnToIdleMs?: number;
  cooldownMs?: number;
  score?: number;
  useTimelineSounds?: boolean;  // Whether to play timeline sounds for this sprite
}

// ============================================
// NEW SPRITE PACK SYSTEM (V2)
// ============================================

/**
 * Sprite Pack Entry - Individual sprite within a pack
 * Simple container with no trigger logic
 */
export interface SpritePackEntryV2 {
  id: string;
  label: string;             // Display name
  url: string;               // URL to the sprite
  thumbnail?: string;        // Preview thumbnail
  tags?: string[];           // For filtering/searching
  isAnimated?: boolean;      // Is GIF/WebM

  // Timeline data for sounds (optional)
  // When configured, sounds will play when this sprite is activated
  timeline?: SpriteTimelineData;
}

/**
 * Sprite Pack V2 - Simple container for sprites (no trigger logic)
 * Used as base for State Collections and Trigger Collections
 */
export interface SpritePackV2 {
  id: string;
  name: string;
  description?: string;
  sprites: SpritePackEntryV2[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// STATE COLLECTION V2 (Reference to Pack)
// ============================================

/**
 * State Collection V2 - References a SpritePack with behavior config
 * Used for idle, talk, thinking states
 */
export interface StateCollectionV2 {
  state: SpriteState;              // 'idle' | 'talk' | 'thinking'
  
  // Reference to sprite pack
  packId: string;
  
  // Behavior when selecting sprite from pack
  behavior: 'principal' | 'random' | 'list';
  
  // For 'principal' mode - which sprite to use
  principalSpriteId?: string;
  
  // For 'list' mode - custom ordering
  spriteOrder?: string[];          // Array of sprite IDs
  
  // Sprites to exclude from this state
  excludedSpriteIds?: string[];
  
  // Current index for 'list' mode rotation
  currentIndex?: number;
}

// ============================================
// TRIGGER COLLECTION SYSTEM
// ============================================

/**
 * Sprite Chain Step - Single step in a sprite animation chain
 */
export interface SpriteChainStep {
  spriteId: string;                // ID of sprite to show
  durationMs: number;              // How long to show (0 = wait forever)
  transition?: 'none' | 'fade' | 'slide';
}

/**
 * Sprite Chain - Sequence of sprites to play
 * Replaces displayTime with animated sequence
 */
export interface SpriteChain {
  enabled: boolean;
  steps: SpriteChainStep[];
  loop: boolean;                   // Repeat infinitely
  interruptible: boolean;          // Can be interrupted by new trigger
}

/**
 * Sound Chain Step - Single step in a sound sequence
 */
export interface SoundChainStep {
  soundTriggerKey: string;         // Key of existing sound trigger
  soundUrl?: string;               // Or direct URL to sound file
  delayMs: number;                 // Delay before playing
  volume?: number;                 // Override volume (0-1)
}

/**
 * Sound Chain - Sequence of sounds to play
 */
export interface SoundChain {
  enabled: boolean;
  steps: SoundChainStep[];
  stopOnInterrupt: boolean;        // Stop sounds if trigger interrupted
  overlap?: boolean;               // Allow overlapping sounds
  volume?: number;                 // Global volume for chain (0-1)
}

/**
 * Fallback mode for trigger sprites
 */
export type TriggerFallbackMode = 'idle_collection' | 'custom_sprite' | 'collection_default';

/**
 * Sprite Trigger Config - Individual sprite configuration within a trigger collection
 */
export interface SpriteTriggerConfig {
  spriteId: string;

  // Keys for activation
  key: string;                     // Primary key
  keys?: string[];                 // Alternative keys
  requirePipes: boolean;
  caseSensitive: boolean;

  // Fallback configuration
  fallbackMode: TriggerFallbackMode;
  fallbackSpriteId?: string;       // For 'custom_sprite' mode
  fallbackDelayMs?: number;        // Override collection default

  // Sprite chain for animation sequences
  spriteChain?: SpriteChain;

  // Timeline sounds - When enabled, plays sounds configured in sprite's timeline
  useTimelineSounds: boolean;      // Default: false

  // Enable/disable this sprite config
  enabled: boolean;
}

/**
 * Trigger Collection - Collection of triggers using a sprite pack
 */
export interface TriggerCollection {
  id: string;
  name: string;
  active: boolean;
  priority: number;                // Higher = more important (default: 1)

  // Reference to sprite pack
  packId: string;

  // Collection-level key activation
  collectionKey: string;           // Main key that activates collection
  collectionKeys?: string[];       // Alternative keys
  collectionKeyRequirePipes?: boolean;
  collectionKeyCaseSensitive?: boolean;

  // Behavior when activated by collection key
  collectionBehavior: 'principal' | 'random' | 'list';
  principalSpriteId?: string;      // For 'principal' mode

  // Default fallback (used if sprite config doesn't override)
  fallbackMode: TriggerFallbackMode;
  fallbackSpriteId?: string;
  fallbackDelayMs: number;         // 0 = persist forever

  // Sprite chain for animation sequences
  spriteChain?: SpriteChain;

  // Timeline sounds - When enabled, plays sounds configured in sprite's timeline
  // This is the default for the collection, individual sprite configs can override
  useTimelineSounds: boolean;      // Default: false

  // Cooldown
  cooldownMs: number;

  // Individual sprite configurations
  spriteConfigs: Record<string, SpriteTriggerConfig>;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TRIGGER QUEUE SYSTEM
// ============================================

/**
 * Trigger Queue Entry - Pending trigger in queue
 */
export interface TriggerQueueEntry {
  id: string;
  triggerCollectionId: string;
  spriteId?: string;               // If triggered by individual sprite key
  spriteUrl: string;               // URL of the sprite to show
  spriteLabel?: string;            // Label for display
  triggeredAt: number;
  source: 'collection_key' | 'sprite_key';
  
  // Fallback configuration
  fallbackMode?: TriggerFallbackMode;
  fallbackDelayMs?: number;
  fallbackSpriteId?: string;
  fallbackSpriteUrl?: string;      // URL of fallback sprite (resolved when queued)
}

/**
 * Active Trigger - Currently executing trigger
 */
export interface ActiveTrigger {
  triggerCollectionId: string;
  spriteId: string;
  startedAt: number;
  
  // Chain progress
  chainProgress?: {
    currentStep: number;
    chainType: 'sprite' | 'sound';
    totalSteps: number;
  };
  
  // Fallback scheduled
  fallbackScheduled: boolean;
  fallbackAt?: number;             // When fallback should execute
}

/**
 * Trigger Queue State - Per-character queue management
 */
export interface TriggerQueueState {
  // Queued triggers waiting to execute
  queue: TriggerQueueEntry[];
  
  // Currently active trigger
  active: ActiveTrigger | null;
  
  // Configuration
  maxQueueSize: number;            // Default: 5
}

export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  mesExample: string;
  creatorNotes: string;
  characterNote: string;  // Character's Note - sent to AI to influence behavior
  systemPrompt: string;
  postHistoryInstructions: string;
  authorNote: string;     // Author's Note - injected after chat history, before post-history instructions
  alternateGreetings: string[];
  tags: string[];
  avatar: string;
  sprites: CharacterSprite[];
  spriteConfig?: SpriteConfig;  // Sprite configuration for this character
  
  // SPRITE SYSTEM V2
  spritePacksV2?: SpritePackV2[];           // Packs of sprites (containers)
  stateCollectionsV2?: StateCollectionV2[];  // State collections (idle/talk/thinking)
  triggerCollections?: TriggerCollection[];  // Trigger collections
  spriteIndex?: SpriteIndex;                 // Cached sprite file index
  
  voice: CharacterVoiceSettings | null;
  hudTemplateId?: string | null;  // HUD template to use for this character
  lorebookIds?: string[];         // Lorebooks to use for this character
  questTemplateIds?: string[];       // Quest templates to use for this character
  embeddingNamespaces?: string[];   // Embedding namespaces to search during chat (overrides strategy)
  statsConfig?: CharacterStatsConfig;  // Stats system configuration (attributes, skills, etc.)
  createdAt: string;
  updatedAt: string;
}

// Sprite state type (only standard states)
export type SpriteState = 'idle' | 'talk' | 'thinking';

// Sprite role in a collection
export type SpriteRole = 'principal' | 'alternate';

// Collection behavior mode
export type CollectionBehavior = 'principal' | 'random' | 'list';

// Sprite collection entry (sprite with role in a state collection)
export interface StateCollectionEntry {
  id: string;
  spriteLabel: string;       // Label from custom sprites
  spriteUrl: string;         // Direct URL to the sprite
  role: SpriteRole;          // Principal or alternate
  order: number;             // For list mode ordering
}

// State sprite collection (for idle, talk, thinking)
export interface StateSpriteCollection {
  entries: StateCollectionEntry[];  // Sprites in this collection
  behavior: CollectionBehavior;     // How to select sprite
  currentIndex: number;             // Current index for list mode rotation
}

// Single sprite with state mapping
export interface CharacterSprite {
  id: string;
  name: string;
  expression: string;  // Legacy: kept for backward compatibility
  imageUrl: string;
  state?: SpriteState;  // Which state this sprite is for
  animations?: SpriteAnimation[];
}

// Sprite configuration for a character
export interface SpriteConfig {
  enabled: boolean;
  collection?: string;  // Selected collection name
  sprites: {
    [key in SpriteState]?: string;  // Legacy: URL to sprite for each state (backward compatibility)
  };
  // New: Collection-based system for idle, talk, thinking
  stateCollections?: {
    [key in SpriteState]?: StateSpriteCollection;
  };
}

export interface SpriteAnimation {
  type: 'idle' | 'talking' | 'excited' | 'sad' | 'angry' | 'thinking';
  frames: string[];
  frameDuration: number;
  loop: boolean;
}

// Sprite collection from the filesystem
export interface SpriteCollection {
  id: string;
  name: string;
  path: string;
  files: SpriteFile[];
}

export interface SpriteFile {
  name: string;
  url: string;
  type: 'image' | 'animation';
}

// ============ Chat Types ============

export interface ChatMessage {
  id: string;
  characterId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isDeleted: boolean;
  swipeId: string;
  swipeIndex: number;
  swipes: string[];           // Array of all swipe alternatives (content is swipes[swipeIndex])
  isNarratorMessage?: boolean; // Message from narrator (hidden from prompt building but triggers still work)
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  finishReason?: string;
  promptData?: PromptSection[];  // Store the prompt sent to LLM
}

// Prompt section for displaying in prompt viewer
export interface PromptSection {
  type: 'system' | 'persona' | 'character_description' | 'personality' | 'scenario' | 'example_dialogue' | 'character_note' | 'lorebook' | 'author_note' | 'post_history' | 'chat_history' | 'instructions' | 'quest' | 'memory' | 'context';
  label: string;
  content: string;
  color: string;  // Tailwind color class for the section header
}

export interface ChatSession {
  id: string;
  characterId: string;
  groupId?: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  background?: string;
  scenario?: string;
  sessionStats?: SessionStats;  // Stats values for this session (per character)
  sessionQuests?: SessionQuestInstance[];  // NEW: Active quests in this session
  turnCount?: number;             // NEW: Turn counter
  summary?: SessionSummary;       // Last conversation summary (overwritten on each new summary)
}

// Session summary - stored directly in the session JSON
export interface SessionSummary {
  content: string;           // The summary text
  messageRange: {
    start: number;           // Index of first message summarized
    end: number;             // Index of last message summarized
  };
  tokens: number;            // Approximate token count
  createdAt: string;
  model?: string;            // Model used for generation
}

// ============ Group Types ============

export interface GroupMember {
  characterId: string;
  isActive: boolean;      // Can respond
  isPresent: boolean;     // Is in the scene
  isNarrator: boolean;    // Is a narrator (ghost character, messages hidden from others)
  joinOrder: number;      // Order they joined the group
}

export type GroupActivationStrategy =
  | 'all'           // All active members respond
  | 'round_robin'   // Take turns in order
  | 'random'        // Random selection
  | 'reactive'      // Only mentioned characters respond
  | 'smart';        // AI decides who should respond

// Narrator response timing modes
export type NarratorResponseMode =
  | 'turn_start'      // Narrator speaks at the beginning of each turn
  | 'turn_end'        // Narrator speaks at the end of each turn
  | 'before_each'     // Narrator speaks before each character
  | 'after_each';     // Narrator speaks after each character

// Narrator conditional intervention settings
export interface NarratorConditionalSettings {
  minTurnInterval: number;        // Minimum turns between narrator interventions (0 = always)
  onlyWhenNoActiveQuests: boolean; // Only intervene when no active quests
}

// Complete narrator settings for a group
export interface NarratorSettings {
  responseMode: NarratorResponseMode;
  customPrompt?: string;          // Custom prompt for the narrator (separate from group prompt)
  conditional: NarratorConditionalSettings;
  hiddenFromChat: boolean;        // Hide narrator messages from chat display entirely
  showSprite: boolean;            // Show narrator sprite on screen (default: false)
}

export interface CharacterGroup {
  id: string;
  name: string;
  description: string;
  characterIds: string[];     // Legacy: simple list of character IDs
  members: GroupMember[];     // Enhanced: detailed member info
  avatar: string;
  systemPrompt: string;
  activationStrategy: GroupActivationStrategy;
  minResponsesPerTurn: number;  // Minimum responses per turn (for reactive/random/smart)
  maxResponsesPerTurn: number;  // Limit responses per turn (except 'all' strategy)
  allowMentions: boolean;       // Enable mention detection
  mentionTriggers: string[];    // Additional mention trigger words
  conversationStyle: 'sequential' | 'parallel';  // How responses are generated
  hudTemplateId?: string | null;  // HUD template to use for this group
  lorebookIds?: string[];         // Lorebooks to use for this group
  questTemplateIds?: string[];       // Quest templates to use for this group
  embeddingNamespaces?: string[];   // Embedding namespaces to search during chat (overrides strategy)
  narratorSettings?: NarratorSettings;  // Narrator behavior configuration
  createdAt: string;
  updatedAt: string;
}

export interface MentionDetectionResult {
  characterId: string;
  characterName: string;
  triggerType: 'name' | 'alias' | 'pronoun' | 'keyword';
  matchedText: string;
  position: number;
}

export interface GroupStreamEvent {
  type: 'character_start' | 'token' | 'character_done' | 'character_error' | 'done' | 'error';
  characterId?: string;
  characterName?: string;
  content?: string;
  error?: string;
}

// ============ LLM Configuration Types ============

export interface LLMConfig {
  id: string;
  name: string;
  provider: LLMProvider;
  endpoint: string;
  apiKey?: string;
  model: string;
  parameters: LLMParameters;
  isActive: boolean;
  // Test Mock provider settings
  mockResponse?: string;  // Custom response for test-mock provider
}

export type LLMProvider = 
  | 'text-generation-webui'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'koboldcpp'
  | 'vllm'
  | 'lm-studio'
  | 'z-ai'
  | 'grok'
  | 'custom'
  | 'test-mock';  // Test provider for peticiones/solicitudes testing

export interface LLMParameters {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  contextSize: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopStrings: string[];
  stream: boolean;
}

// ============ Prompt Template Types ============

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  assistantPrompt: string;
  contextTemplate: string;
  characterTemplate: string;
  groupTemplate: string;
  isDefault: boolean;
}

// ============ TTS Types ============

export interface TTSConfig {
  id: string;
  name: string;
  provider: TTSProvider;
  endpoint: string;
  apiKey?: string;
  voice: string;
  speed: number;
  pitch: number;
  isActive: boolean;
  // TTS-WebUI specific settings
  model?: string;                    // TTS model to use (e.g., 'chatterbox-tts', 'kokoro')
  referenceAudio?: string;           // Path/URL to reference audio for voice cloning
  language?: string;                 // Language code for multilingual models
}

export type TTSProvider = 
  | 'tts-webui'                      // TTS-WebUI (OpenAI compatible, Chatterbox, Whisper)
  | 'edge-tts'
  | 'elevenlabs'
  | 'coqui'
  | 'bark'
  | 'silero'
  | 'z-ai'                           // Z.ai SDK TTS
  | 'custom';

// TTS-WebUI specific configuration
export interface TTSWebUIConfig {
  enabled: boolean;
  autoGeneration: boolean;           // Auto-play TTS on new messages
  baseUrl: string;                   // e.g., 'http://localhost:7778'
  model: string;                     // Default TTS model (chatterbox, multilingual, chatterbox-turbo, etc.)
  whisperModel: string;              // Default Whisper model for ASR
  defaultVoice?: string;             // Default voice/reference audio path (e.g., 'voices/chatterbox/es-rick.wav')
  speed: number;                     // Speech speed multiplier
  responseFormat: 'mp3' | 'wav' | 'ogg' | 'flac';
  language?: string;                 // Language for multilingual models (es, en, ja, etc.)
  // Advanced TTS parameters
  exaggeration: number;              // 0-1, controls expressiveness (default: 0.5)
  cfgWeight: number;                 // 0-1, classifier-free guidance weight (default: 0.5)
  temperature: number;               // 0-2, sampling temperature (default: 0.8)
  // Text generation options (what to generate)
  // Positive logic: true = generate, false = skip
  generateDialogues: boolean;        // Generate dialogues ("text in quotes")
  generateNarrations: boolean;       // Generate narrations (*text in asterisks*)
  generatePlainText: boolean;        // Generate plain text (no quotes or asterisks)
  applyRegex: boolean;               // Apply custom regex filter
  customRegex?: string;              // Custom regex pattern to apply
}

// Voice reference for voice cloning
export interface VoiceReference {
  id: string;
  name: string;
  characterId?: string;              // Associated character (optional)
  audioPath: string;                 // Path to reference audio file
  description?: string;              // Description of the voice
  createdAt: string;
}

export interface VoiceSettings {
  enabled: boolean;
  voiceId: string;
  speed: number;
  pitch: number;
  emotionMapping: Record<string, string>;
}

// ============================================
// DUAL VOICE SYSTEM (Dialogue + Narrator)
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
  generateDialogues: boolean;        // Generate dialogues ("text in quotes")
  generateNarrations: boolean;       // Generate narrations (*text in asterisks*)
  generatePlainText: boolean;        // Generate plain text (no quotes or asterisks)
  // Legacy compatibility
  emotionMapping?: Record<string, string>;
}

// Default voice configurations
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
  generateDialogues: true,       // By default, generate all text types
  generateNarrations: true,
  generatePlainText: true,
};

// ASR (Speech-to-Text) configuration
export interface ASRConfig {
  enabled: boolean;
  provider: 'tts-webui' | 'whisper' | 'z-ai';
  endpoint?: string;
  model: string;                     // e.g., 'whisper-large-v3'
  language?: string;
}

// ============ KWS (Keyword Spotting / Wake Word) Types ============

/**
 * Wake Word configuration
 * Controls how the system detects activation phrases
 */
export interface WakeWordConfig {
  enabled: boolean;
  wakeWords: string[];               // e.g., ["hey luna", "luna", "oye luna"]
  sensitivity: 'low' | 'medium' | 'high';  // Detection sensitivity
  cooldownMs: number;                // Cooldown between detections (default: 3000ms)
  language?: string;                 // Language for speech recognition (e.g., 'es-ES')
}

/**
 * VAD (Voice Activity Detection) configuration
 * Controls automatic recording stop based on silence detection
 */
export interface VADConfig {
  enabled: boolean;                  // Enable auto-stop on silence
  silenceThreshold: number;          // Audio level threshold (0-100, default: 30)
  silenceDurationMs: number;         // Silence duration to trigger stop (default: 1500ms)
  minRecordingMs: number;            // Minimum recording time before VAD can stop (default: 500ms)
  maxRecordingMs: number;            // Maximum recording time (default: 30000ms)
}

/**
 * Result of wake word detection
 */
export interface WakeWordDetectionResult {
  characterId: string;
  wakeWord: string;
  confidence: number;                // 0-1 confidence score
  timestamp: number;                 // Detection timestamp
}

// Default configurations
export const DEFAULT_WAKE_WORD_CONFIG: WakeWordConfig = {
  enabled: false,
  wakeWords: [],
  sensitivity: 'medium',
  cooldownMs: 3000,
  language: 'es-ES',
};

export const DEFAULT_VAD_CONFIG: VADConfig = {
  enabled: true,
  silenceThreshold: 30,
  silenceDurationMs: 1500,
  minRecordingMs: 500,
  maxRecordingMs: 30000,
};

// ============ Background Types ============

export interface Background {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  category: string;
  tags: string[];
}

// ============ Persona Types ============

export interface Persona {
  id: string;
  name: string;
  description: string;  // The user's personality/description
  avatar: string;       // User's avatar image
  isActive: boolean;    // Currently selected persona
  // Stats system for user (peticiones/solicitudes)
  statsConfig?: CharacterStatsConfig;
  createdAt: string;
  updatedAt: string;
}

// ============ Sound Types ============

export interface SoundTrigger {
  id: string;
  name: string;
  description: string;              // Description of the sound for {{sonidos}} template
  characterIds: string[];           // Characters this sound is associated with (for {{sonidos}} filtering)
  active: boolean;
  keywords: string[];
  keywordsEnabled: Record<string, boolean>;
  collection: string;
  playMode: 'random' | 'cyclic';
  volume: number;
  cooldown: number;
  delay: number;
  currentIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface SoundCollection {
  name: string;
  path: string;
  files: string[];
}

export interface SoundSettings {
  enabled: boolean;
  globalVolume: number;
  maxSoundsPerMessage: number;
  globalCooldown: number;
  realtimeEnabled: boolean;
  // Template for {{sonidos}} key resolution
  soundListPrefix?: string;         // Text before the sound list
  soundListSuffix?: string;         // Text after the sound list
}

// Sound Sequence Trigger - plays multiple sound triggers in sequence
export interface SoundSequenceTrigger {
  id: string;
  name: string;
  active: boolean;
  activationKey: string;           // Key detected by post-LLM system
  activationKeys?: string[];       // Alternative keys
  activationKeyCaseSensitive?: boolean;
  sequence: string[];              // Array of sound trigger keywords to play in order
                                   // Each entry references an existing sound trigger's keyword
  volume: number;                  // Override volume (0-1), or use individual trigger volumes
  delayBetween: number;            // Delay in ms between each sound in sequence
  cooldown: number;                // Cooldown before this sequence can trigger again
  createdAt: string;
  updatedAt: string;
}

// ============ Background Trigger Types ============

export type OverlayPlacement = 'none' | 'back' | 'front';

export interface BackgroundItem {
  backgroundLabel: string;    // Name/label for this background
  backgroundUrl?: string;     // Direct URL (optional, can be resolved from index)
  key: string;                // BG-key that must match in message
  overlayLabel?: string;      // Optional overlay image label
  overlayPlacement: OverlayPlacement;
  overlayUrl?: string;        // Direct URL for overlay (optional)
  enabled: boolean;
  spriteLoc?: {               // Saved sprite position for this background
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface BackgroundPack {
  id: string;
  title: string;
  active: boolean;
  keywords: string[];         // Pack-level keywords (must match first)
  requirePipes: boolean;      // Keywords must be wrapped in |pipes|
  caseSensitive: boolean;     // Case sensitivity for matching
  requireBgKey: boolean;      // BG-key must also match (if false, any item can be picked)
  cooldown: number;           // Cooldown in ms between triggers
  playMode: 'random' | 'cyclic';  // How to select background when multiple match
  items: BackgroundItem[];
  currentIndex: number;       // For cyclic mode
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundIndexEntry {
  label: string;              // Unique label for this background
  filename: string;           // Original filename
  url: string;                // Full URL to the background image
  thumb?: string;             // Thumbnail URL
  pack: string;               // Pack name this belongs to
}

export interface BackgroundIndex {
  backgrounds: BackgroundIndexEntry[];
  lastUpdated: number;
  source: string;             // Where backgrounds were scanned from
}

// ============ Background Collection with Metadata ============

/**
 * Background entry within a collection (from JSON metadata)
 */
export interface BackgroundCollectionEntry {
  id: string;                 // Unique ID within collection
  name: string;               // Display name (e.g., "Bosque Nocturno")
  url: string;                // URL to the background image
  triggerKeys: string[];      // Primary keywords that trigger this background
  contextKeys: string[];      // Secondary keywords that must ALSO be present
  tags?: string[];            // Optional tags for organization
  transitionDuration?: number; // Override transition duration (ms)
}

/**
 * Background file from filesystem
 */
export interface BackgroundFile {
  name: string;               // Filename
  url: string;                // URL path to the file
  type: 'image' | 'video';    // Media type
}

/**
 * Background collection with JSON metadata
 * Each collection folder can have a collection.json file
 */
export interface BackgroundCollection {
  name: string;               // Collection name (folder name)
  path: string;               // Path to collection folder
  description?: string;       // Optional description
  version?: string;           // Optional version string
  transitionDuration?: number; // Default transition duration for this collection
  entries: BackgroundCollectionEntry[];
  files: BackgroundFile[];    // All files in the collection with metadata
}

// ============ Background Trigger Pack (Unified System) ============

/**
 * Match mode for background triggers
 * - any_any: ANY trigger key AND ANY context key (default)
 * - all_any: ALL trigger keys AND ANY context key
 * - any_all: ANY trigger key AND ALL context keys
 * - all_all: ALL trigger keys AND ALL context keys
 */
export type BackgroundMatchMode = 'any_any' | 'all_any' | 'any_all' | 'all_all';

/**
 * Transition types for background changes
 */
export type BackgroundTransitionType = 
  | 'none' 
  | 'fade' 
  | 'slide-left' 
  | 'slide-right' 
  | 'slide-up' 
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'crossfade';

/**
 * Overlay positioning
 */
export type OverlayPosition = 'back' | 'front' | 'fill';

/**
 * Background overlay - layer displayed over/under main background
 */
export interface BackgroundOverlay {
  id: string;
  url: string;                 // URL to overlay image/video
  name: string;                // Display name
  position: OverlayPosition;   // back = behind main, front = on top
  opacity: number;             // 0-1
  blendMode?: string;          // CSS blend mode (overlay, multiply, screen, etc.)
  animated?: boolean;          // For animated overlays (rain, snow, etc.)
  animationSpeed?: number;     // Animation speed multiplier
}

/**
 * Background variant - alternative version of same background
 * e.g., day/night versions of same location
 */
export interface BackgroundVariant {
  id: string;
  name: string;                // e.g., "Night", "Sunset", "Rain"
  url: string;                 // URL to variant background
  timeOfDay?: 'day' | 'night' | 'dawn' | 'dusk' | 'any';
  weather?: 'clear' | 'rain' | 'snow' | 'storm' | 'any';
  triggerKeys: string[];       // Keywords that activate this variant
  contextKeys: string[];       // Additional context required
  overlays: BackgroundOverlay[]; // Overlays specific to this variant
}

/**
 * Individual background item within a trigger pack
 */
export interface BackgroundTriggerItem {
  id: string;
  backgroundUrl: string;      // URL to the background
  backgroundName: string;     // Display name
  triggerKeys: string[];      // Primary keywords
  contextKeys: string[];      // Secondary keywords
  matchMode?: BackgroundMatchMode;  // Override pack's default match mode
  enabled: boolean;
  priority: number;           // Higher = more important (0-100)
  transitionDuration?: number; // Custom transition duration
  transitionType?: BackgroundTransitionType; // Custom transition
  // Overlays for this background
  overlays: BackgroundOverlay[];
  // Variants (day/night, etc.)
  variants: BackgroundVariant[];
}

/**
 * Background Trigger Pack - integrates with unified trigger system
 * Supports priority, multiple match modes, overlays, variants, and return to default
 */
export interface BackgroundTriggerPack {
  id: string;
  name: string;
  active: boolean;
  collection: string;         // Collection name to use
  priority: number;           // Pack priority (higher = checked first, 0-100)
  cooldown: number;           // Cooldown in ms (0 = no cooldown)
  matchMode: BackgroundMatchMode;  // Default match mode for items
  transitionDuration: number; // Default transition duration in ms
  transitionType: BackgroundTransitionType;  // Transition effect
  items: BackgroundTriggerItem[];
  // Default overlays applied to all backgrounds in this pack
  defaultOverlays: BackgroundOverlay[];
  // Return to default settings
  returnToDefault: boolean;   // Enable return to default after inactivity
  returnToDefaultAfter: number; // Time in ms before returning to default
  defaultBackground: string;  // URL to default background for this pack
  createdAt: string;
  updatedAt: string;
}

export interface BackgroundTriggerSettings {
  enabled: boolean;
  globalCooldown: number;     // Global cooldown between any background changes
  realtimeEnabled: boolean;   // Detect during streaming
  transitionDuration: number; // Default fade transition duration in ms
  defaultTransitionType: BackgroundTransitionType; // Default transition
  // Global return to default
  returnToDefaultEnabled: boolean;  // Enable global return to default
  returnToDefaultAfter: number;     // Time in ms (default 5 minutes)
  defaultBackgroundUrl: string;     // Global default background
  // Global overlays (always applied)
  globalOverlays: BackgroundOverlay[];
}

export interface BackgroundTriggerHit {
  packId: string;
  pack?: BackgroundTriggerPack;
  backgroundUrl: string;
  backgroundName: string;
  transitionDuration: number;
  transitionType: BackgroundTransitionType;
  priority: number;
  overlays: BackgroundOverlay[];
  variant?: BackgroundVariant;
}

// ============ Settings Types ============

export interface ChatLayoutSettings {
  novelMode: boolean;
  chatWidth: number;      // percentage (20-100)
  chatHeight: number;     // percentage (30-100)
  chatX: number;          // percentage (0-100)
  chatY: number;          // percentage (0-100)
  chatOpacity: number;    // 0-1
  blurBackground: boolean;
  showCharacterSprite: boolean;
}

export type BackgroundFit = 'cover' | 'contain' | 'stretch';

// Context settings for message limits
export interface ContextSettings {
  maxMessages: number;           // Maximum messages in context (sliding window)
  maxTokens: number;             // Maximum tokens for context
  keepFirstN: number;            // Always keep first N messages
  keepLastN: number;             // Always keep last N messages
  enableSummaries: boolean;      // Enable future summarization
  summaryThreshold: number;      // When to trigger summarization
}

// ============ Chatbox Appearance Settings ============

// Predefined themes
export type ChatboxTheme = 
  | 'default'      // Dark/Light based on system
  | 'midnight'     // Deep dark blue
  | 'forest'       // Green nature theme
  | 'sunset'       // Warm orange/red
  | 'ocean'        // Blue ocean theme
  | 'lavender'     // Soft purple
  | 'cherry'       // Pink sakura theme
  | 'custom'       // User-defined colors
  | 'cyberpunk'    // Neon effects, glitch animations
  | 'steampunk'    // Victorian industrial, brass/copper
  | 'gothic'       // Dark elegant, ornate borders
  | 'retro'        // 80s/90s CRT aesthetic
  | 'pixelart';    // 8-bit/16-bit retro gaming

// Avatar shape options
export type AvatarShape = 'circle' | 'square' | 'rounded' | 'rectangular';

// Bubble style options
export type BubbleStyleType = 'modern' | 'classic' | 'minimal' | 'neon' | 'elegant' | 'dark';

// Streaming animation style
export type StreamingAnimationStyle = 'typing-cursor' | 'fade-in' | 'grow' | 'typewriter';

// Cursor style for streaming
export type StreamingCursorStyle = 'block' | 'line' | 'underscore' | 'dot';

// Font family options
export type FontFamilyType = 'system' | 'serif' | 'sans' | 'mono' | 'custom';

// Background settings for chatbox
export interface ChatboxBackgroundSettings {
  transparency: number;        // 0-1, background opacity
  blur: number;                // 0-20, blur radius in pixels
  useGlassEffect: boolean;     // Glassmorphism effect
  customBackgroundColor?: string; // Custom background color (hex)
}

// Font settings for chatbox
export interface ChatboxFontSettings {
  fontFamily: FontFamilyType;
  customFontFamily?: string;   // For custom font
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  lineHeight: 'tight' | 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider';
}

// Text formatting settings
export interface ChatboxTextFormatting {
  enableMarkdown: boolean;
  enableCodeHighlight: boolean;
  enableQuotes: boolean;       // Show quotes in blockquote style
  codeBlockTheme: 'dark' | 'light' | 'auto';
}

// Text colors for different message types
export interface ChatboxTextColors {
  userMessage: string;         // Color for user messages
  characterMessage: string;    // Color for character/assistant messages
  narratorMessage: string;     // Color for narrator messages
  systemMessage: string;       // Color for system messages
  linkColor: string;           // Color for links
  codeColor: string;           // Color for inline code
}

// Message bubble settings
export interface MessageBubbleSettings {
  style: BubbleStyleType;
  transparency: number;        // 0-1
  borderRadius: number;        // 0-32, border radius in pixels
  shadowEnabled: boolean;
  shadowIntensity: 'none' | 'soft' | 'medium' | 'strong';
  maxWidth: number;            // 50-100, percentage
  
  // Colors for different bubble types
  userBubbleColor: string;
  userBubbleTextColor: string;
  characterBubbleColor: string;
  characterBubbleTextColor: string;
  narratorBubbleColor: string;
  narratorBubbleTextColor: string;
  systemBubbleColor: string;
  systemBubbleTextColor: string;
}

// Avatar settings
export interface ChatboxAvatarSettings {
  show: boolean;
  shape: AvatarShape;
  size: 'sm' | 'md' | 'lg' | 'xl';
  borderRadius: number;        // 0-50, for square/rounded shapes
  showBorder: boolean;
  borderColor: string;
  borderWidth: number;         // 1-4
}

// Streaming/typing settings
export interface ChatboxStreamingSettings {
  animationStyle: StreamingAnimationStyle;
  animationSpeed: number;      // 10-200, characters per second
  streamingTextColor: string;
  cursorStyle: StreamingCursorStyle;
  cursorColor: string;
  cursorBlinkRate: number;     // 200-1000, blink rate in ms
  showCursor: boolean;
}

// Input box settings
export interface ChatboxInputSettings {
  backgroundColor: string;
  textColor: string;
  placeholderColor: string;
  borderColor: string;
  borderRadius: number;
  focusBorderColor: string;
  fontSize: 'sm' | 'base' | 'lg';
}

// Theme color presets for special themes
export interface ThemeColorPreset {
  primary: string;
  secondary: string;
  background: string;
  accent: string;
}

// Theme color presets map
export const THEME_COLOR_PRESETS: Record<string, ThemeColorPreset> = {
  cyberpunk: {
    primary: '#00FFFF',    // Neon Cyan
    secondary: '#FF00FF',  // Neon Magenta
    background: '#0A0A0F', // Deep Black
    accent: '#39FF14',     // Toxic Green
  },
  steampunk: {
    primary: '#B5A642',    // Brass
    secondary: '#B87333',  // Copper
    background: '#3C2415', // Dark Leather
    accent: '#4A7C59',     // Patina Green
  },
  gothic: {
    primary: '#C0C0C0',    // Silver
    secondary: '#8B0000',  // Blood Red
    background: '#0D0D0D', // Deep Black
    accent: '#9966CC',     // Amethyst
  },
  retro: {
    primary: '#00FF00',    // CGA Green
    secondary: '#00FFFF',  // CGA Cyan
    background: '#0A0A0A', // CRT Black
    accent: '#FF00FF',     // CGA Magenta
  },
  pixelart: {
    primary: '#00A800',    // NES Green
    secondary: '#F83800',  // NES Red
    background: '#0A0A0A', // Black
    accent: '#FCFCFC',     // White
  },
};

// Complete chatbox appearance settings
export interface ChatboxAppearanceSettings {
  // Theme
  theme: ChatboxTheme;
  customThemeColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  
  // Components
  background: ChatboxBackgroundSettings;
  font: ChatboxFontSettings;
  textFormatting: ChatboxTextFormatting;
  textColors: ChatboxTextColors;
  bubbles: MessageBubbleSettings;
  avatars: ChatboxAvatarSettings;
  streaming: ChatboxStreamingSettings;
  input: ChatboxInputSettings;
  
  // Spacing
  messageSpacing: 'compact' | 'normal' | 'spacious';
  groupMessages: boolean;      // Group consecutive messages from same sender
  showTimestamps: boolean;
  showTokens: boolean;
  
  // Animations
  animateEntry: boolean;
  entryAnimation: 'fade' | 'slide' | 'scale' | 'none';
  animationDurationMs: number;
  
  // Theme Effects (NEW)
  enableAnimations: boolean;   // Enable animated theme effects
  enableParticles: boolean;    // Enable floating particles
  animationIntensity: number;  // 0-100, controls animation speed/visibility
}

// Default chatbox appearance settings
export const DEFAULT_CHATBOX_APPEARANCE: ChatboxAppearanceSettings = {
  theme: 'default',
  
  background: {
    transparency: 0.95,
    blur: 8,
    useGlassEffect: true,
  },
  
  font: {
    fontFamily: 'system',
    fontSize: 'base',
    fontWeight: 'normal',
    lineHeight: 'relaxed',
    letterSpacing: 'normal',
  },
  
  textFormatting: {
    enableMarkdown: true,
    enableCodeHighlight: true,
    enableQuotes: true,
    codeBlockTheme: 'auto',
  },
  
  textColors: {
    userMessage: '#3b82f6',
    characterMessage: '#f59e0b',
    narratorMessage: '#8b5cf6',
    systemMessage: '#6b7280',
    linkColor: '#3b82f6',
    codeColor: '#10b981',
  },
  
  bubbles: {
    style: 'modern',
    transparency: 1,
    borderRadius: 16,
    shadowEnabled: true,
    shadowIntensity: 'soft',
    maxWidth: 85,
    userBubbleColor: '#3b82f6',
    userBubbleTextColor: '#ffffff',
    characterBubbleColor: '#27272a',
    characterBubbleTextColor: '#fafafa',
    narratorBubbleColor: '#7c3aed',
    narratorBubbleTextColor: '#ffffff',
    systemBubbleColor: '#3f3f46',
    systemBubbleTextColor: '#a1a1aa',
  },
  
  avatars: {
    show: true,
    shape: 'circle',
    size: 'md',
    borderRadius: 8,
    showBorder: true,
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  
  streaming: {
    animationStyle: 'typing-cursor',
    animationSpeed: 50,
    streamingTextColor: '#fbbf24',
    cursorStyle: 'block',
    cursorColor: '#fbbf24',
    cursorBlinkRate: 530,
    showCursor: true,
  },
  
  input: {
    backgroundColor: '#18181b',
    textColor: '#fafafa',
    placeholderColor: '#71717a',
    borderColor: '#3f3f46',
    borderRadius: 12,
    focusBorderColor: '#3b82f6',
    fontSize: 'base',
  },
  
  messageSpacing: 'normal',
  groupMessages: false,
  showTimestamps: true,
  showTokens: true,
  
  animateEntry: true,
  entryAnimation: 'fade',
  animationDurationMs: 200,
  
  // Theme Effects
  enableAnimations: true,
  enableParticles: true,
  animationIntensity: 50,
};

export interface QuickReplyItem {
  /** Label shown on the button in the chatbox */
  label: string;
  /** Actual text sent as the user message */
  response: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  messageDisplay: 'bubble' | 'compact' | 'full';
  showTimestamps: boolean;
  showTokens: boolean;
  autoScroll: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  confirmDelete: boolean;
  defaultBackground: string;
  backgroundFit: BackgroundFit;
  swipeEnabled: boolean;
  quickReplies: QuickReplyItem[];
  hotkeys: Record<string, string>;
  sound: SoundSettings;
  backgroundTriggers: BackgroundTriggerSettings;
  chatLayout: ChatLayoutSettings;
  context: ContextSettings;
  chatboxAppearance: ChatboxAppearanceSettings;
  embeddingsChat: EmbeddingsChatSettings;
  tools?: ToolsSettings;
}

// ============ Embeddings Chat Integration Settings ============

export interface EmbeddingsChatSettings {
  /** Enable automatic embeddings context retrieval during chat */
  enabled: boolean;
  /** Maximum token budget for embeddings context (approximate, in chars) */
  maxTokenBudget: number;
  /** Strategy for selecting which namespaces to search */
  namespaceStrategy: 'global' | 'character' | 'session';
  /** Whether to show retrieved embeddings in the prompt viewer */
  showInPromptViewer: boolean;
  /** Custom namespaces override from character/group assignment (takes priority over strategy) */
  customNamespaces?: string[];
  /** Enable automatic memory extraction from chat messages */
  memoryExtractionEnabled?: boolean;
  /** Extract memories every N messages (default: 5) */
  memoryExtractionFrequency?: number;
  /** Minimum importance (1-5) to save extracted memories (default: 2) */
  memoryExtractionMinImportance?: number;
  /** Enable automatic memory consolidation when namespace exceeds threshold */
  memoryConsolidationEnabled?: boolean;
  /** Consolidate when namespace exceeds this many memory embeddings (default: 50) */
  memoryConsolidationThreshold?: number;
  /** Keep this many most recent memories protected from consolidation (default: 10) */
  memoryConsolidationKeepRecent?: number;
  /** Keep all memories with importance >= this value (default: 4) */
  memoryConsolidationKeepHighImportance?: number;
  /** Custom prompt for memory extraction (overrides default prompt) */
  memoryExtractionPrompt?: string;
  /** Custom prompt for group memory extraction (overrides default group prompt) */
  groupMemoryExtractionPrompt?: string;
  /** Number of recent messages to include as context for memory extraction (0 = only last response, default: 2) */
  memoryExtractionContextDepth?: number;
  /** Number of recent messages to enrich the embedding search query (0 = only user message, default: 1) */
  searchContextDepth?: number;
  /** Enable group dynamics extraction in group chats (extracts inter-character relationships) */
  groupDynamicsExtraction?: boolean;
}

// ============ Tools / Actions Settings ============

export type ToolCategory = 'in_character' | 'cognitive' | 'real_world' | 'system';
export type ToolPermissionMode = 'auto' | 'ask';

export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  enum?: string[];
  default?: unknown;
  required: boolean;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameterDef>;
  required: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  label: string;
  icon: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameterSchema;
  permissionMode: ToolPermissionMode;
}

export interface CharacterToolConfig {
  characterId: string;
  enabledTools: string[];
}

export interface ToolsSettings {
  enabled: boolean;
  maxToolCallsPerTurn: number;
  characterConfigs: CharacterToolConfig[];
  usePromptBasedFallback?: boolean; // If true, always use prompt-based tools instead of native, even for providers that support native tool calling
}

export const DEFAULT_TOOLS_SETTINGS: ToolsSettings = {
  enabled: true,
  maxToolCallsPerTurn: 2,
  characterConfigs: [],
  usePromptBasedFallback: false,
};

// ============ API Types ============

export interface GenerateRequest {
  messages: ChatMessage[];
  character: CharacterCard;
  systemPrompt: string;
  parameters: LLMParameters;
  stream: boolean;
}

export interface GenerateResponse {
  message: ChatMessage;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  error?: string;
}

// ============ File Storage Types ============

export interface StorageData {
  characters: CharacterCard[];
  groups: CharacterGroup[];
  sessions: ChatSession[];
  backgrounds: Background[];
  llmConfigs: LLMConfig[];
  ttsConfigs: TTSConfig[];
  promptTemplates: PromptTemplate[];
  settings: AppSettings;
}

// ============ Character Card Import/Export ============

export interface CharacterCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    character_note?: string;  // Character's Note - sent to AI to influence behavior
    system_prompt: string;
    post_history_instructions: string;
    author_note?: string;     // Author's Note - injected after chat history
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

// TavernCardImage type for PNG files with embedded character data
// These are PNG images with Base64 encoded JSON in tEXt chunks
export type TavernCardImage = Blob;

// ============ Lorebook Types (SillyTavern Compatible) ============

/**
 * POSITION DIFFERENCES FROM SILLYTAVERN:
 * ========================================
 * SillyTavern uses named positions:
 * - Before Char Defs
 * - After Char Defs
 * - Before Example Messages
 * - After Example Messages
 * - Top of Author's Note
 * - Bottom of Author's Note
 * - @ Depth (with role selection)
 * - Outlet (uses {{outlet::Name}} macro)
 *
 * This project uses numeric positions (simpler model):
 * - 0: After system prompt (~equivalent to After Char Defs)
 * - 1: After last user message
 * - 2: Before last user message
 * - 3: After last assistant message
 * - 4: Before last assistant message
 * - 5: At top of chat (before history)
 * - 6: At bottom of chat (after all messages)
 * - 7: Outlet (manual placement via {{outlet::name}})
 *
 * REGEX SUPPORT:
 * ==============
 * Keys can be regex patterns. If a key starts with '/' and ends with '/',
 * it will be treated as a JavaScript regex pattern.
 * Example: /(?:weather|rain|sunny)/i
 */
export type LorebookPosition = 
  | 0   // After system prompt
  | 1   // After user message
  | 2   // Before user message  
  | 3   // After assistant message
  | 4   // Before assistant message
  | 5   // At top of chat
  | 6   // At bottom of chat (newest messages)
  | 7;  // Outlet (custom position, use outletName field)

export type LorebookLogic = 
  | 'AND_ANY'    // Match ANY primary key AND ANY secondary key
  | 'NOT_ALL'    // NOT match ALL primary keys
  | 'NOT_ANY'    // NOT match ANY primary key
  | 'AND_ALL';   // Match ALL primary keys

export interface LorebookEntry {
  uid: number;                    // Unique identifier
  key: string[];                  // Primary keywords (supports regex with /pattern/flags)
  keysecondary: string[];         // Secondary keywords (optional, supports regex)
  comment: string;                // Entry title/description
  content: string;                // Content to inject
  constant: boolean;              // Always active
  selective: boolean;             // Use secondary keys
  order: number;                  // Insertion order (higher = later)
  position: LorebookPosition;     // Where to inject
  outletName?: string;            // Outlet name (used when position = 7)
  disable: boolean;               // Entry disabled
  excludeRecursion: boolean;      // Exclude from recursive scanning
  preventRecursion: boolean;      // Prevent this entry from triggering others
  delayUntilRecursion: boolean;   // Only activate during recursion
  probability: number;            // Activation probability (0-100)
  useProbability: boolean;        // Use probability check
  depth: number;                  // Scan depth (messages to scan back)
  selectLogic: number;            // 0 = AND_ANY, 1 = NOT_ALL, 2 = NOT_ANY, 3 = AND_ALL
  group: string;                  // Group name
  groupOverride: boolean;         // Override group settings
  groupWeight: number;            // Weight within group (for random selection)
  scanDepth: number | null;       // Custom scan depth (null = use global)
  caseSensitive: boolean | null;  // Case sensitive matching (null = use global)
  matchWholeWords: boolean | null; // Match whole words only
  useGroupScoring: boolean | null; // Use group scoring
  automationId: string;           // Automation ID
  role: number | null;            // Role (0 = system, 1 = user, 2 = assistant)
  vectorized: boolean;            // Vectorized for semantic search
  displayIndex: number;           // Display order in UI
  extensions: Record<string, unknown>; // Extension data
}

export interface LorebookSettings {
  scanDepth: number;              // Global scan depth
  caseSensitive: boolean;         // Global case sensitivity
  matchWholeWords: boolean;       // Global whole word matching
  useGroupScoring: boolean;       // Use group scoring
  automationId: string;           // Default automation ID
  tokenBudget: number;            // Max tokens for lorebook content
  recursionLimit: number;         // Max recursion depth
}

export interface Lorebook {
  id: string;                     // Internal ID
  name: string;                   // Lorebook name
  description: string;            // Lorebook description
  entries: LorebookEntry[];       // Entries (converted from object for easier handling)
  settings: LorebookSettings;     // Lorebook settings
  characterId?: string;           // Attached to character (optional)
  tags: string[];                 // Tags for organization
  active: boolean;                // Lorebook active
  createdAt: string;
  updatedAt: string;
}

// SillyTavern Lorebook format (for import/export)
export interface SillyTavernLorebook {
  entries: Record<string, LorebookEntry>;
  settings?: Partial<LorebookSettings>;
}

// ============ HUD Types ============

// HUD field type
export type HUDFieldType = 'number' | 'enum' | 'string' | 'boolean';

// HUD field display style
export type HUDFieldStyle = 
  | 'default'      // Standard label + value
  | 'progress'     // Progress bar (for numbers)
  | 'badge'        // Badge/pill style
  | 'icon'         // Icon with value
  | 'chip'         // Small chip/tag
  | 'status'       // Status indicator with dot
  | 'gauge'        // Circular gauge (for numbers)
  | 'separator'    // Horizontal separator line
  | 'label-only'   // Just the label, no value shown
  | 'pill'         // Rounded pill with background
  | 'meter'        // Vertical meter bar
  | 'dots';        // Dots indicator (for numbers 1-5 or boolean)

// HUD position on screen
export type HUDPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// HUD overall style
export type HUDStyle =
  | 'minimal'     // Sin fondo, solo texto
  | 'card'        // Fondo con bordes
  | 'panel'       // Panel expandido
  | 'glass'       // Efecto cristal/glassmorphism
  | 'neon'        // Brillo neón cyberpunk
  | 'holographic' // Efecto holográfico futurista
  | 'fantasy'     // Estilo medieval/fantasía
  | 'retro';      // Estilo retro pixelado

// Single HUD field definition
export interface HUDField {
  id: string;
  name: string;              // Display name: "HP", "Turno", "Intensidad"
  key: string;               // Primary key to match (backward compatibility)
  keys?: string[];           // Multiple keys to match: ["HP:", "HP=", "hp:", "hp="]
  caseSensitive?: boolean;   // Whether to distinguish uppercase/lowercase (default: false)
  type: HUDFieldType;
  
  // For number type
  min?: number;
  max?: number;
  
  // For enum type
  options?: string[];        // ["baja", "media", "alta", "extrema", "clímax"]
  
  // Default value
  defaultValue: string | number | boolean;
  
  // Display settings
  style: HUDFieldStyle;
  color?: string;            // Tailwind color: "red", "green", "blue"
  icon?: string;             // Emoji or icon name
  showLabel?: boolean;       // Show field name
  
  // For progress style
  showValue?: boolean;
  unit?: string;             // "%", "pts", etc.
}

// HUD Context injection position (reuses LorebookPosition values)
// 0 = After system prompt, 1 = After user message, 2 = Before user message
// 3 = After assistant message, 4 = Before assistant message
// 5 = At top of chat, 6 = At bottom of chat, 7 = Custom/outlet
export type HUDContextPosition = LorebookPosition;

// HUD Context configuration - text to inject into prompt
export interface HUDContextConfig {
  enabled: boolean;              // Whether context injection is active
  content: string;               // The text content to inject
  position: HUDContextPosition;  // Where to inject in the prompt
  scanDepth?: number;            // How many messages back to consider (optional)
}

// HUD Template - reusable configuration
export interface HUDTemplate {
  id: string;
  name: string;              // "Sistema Combate RPG", "Romance Stats"
  description?: string;
  
  // Fields
  fields: HUDField[];
  
  // Context injection (new feature)
  context?: HUDContextConfig;
  
  // Display settings
  position: HUDPosition;
  style: HUDStyle;
  opacity: number;           // 0-1
  compact: boolean;          // Compact mode
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Active HUD state in session (runtime, not persisted)
export interface HUDSessionState {
  activeTemplateId: string | null;
  fieldValues: Record<string, string | number | boolean>;
  lastUpdated: number;
}

// HUD trigger result
export interface HUDTriggerHit {
  templateId: string;
  fieldId: string;
  fieldName: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
}

// ============ Memory & Summary Types ============

// Memory event - a significant occurrence in the roleplay
export interface MemoryEvent {
  id: string;
  type: 'fact' | 'relationship' | 'event' | 'emotion' | 'location' | 'item' | 'state_change';
  content: string;           // Description of what happened/was learned
  characterId?: string;      // Related character (if any)
  timestamp: string;
  importance: number;        // 0-1, how important to remember
  metadata?: Record<string, unknown>;
}

// Character memory - persistent memory for a character
export interface CharacterMemory {
  id: string;
  characterId: string;
  events: MemoryEvent[];
  relationships: RelationshipMemory[];  // Track relationships with other characters/users
  notes: string;              // User-editable notes
  lastUpdated: string;
}

// Relationship memory - how the character feels about someone
export interface RelationshipMemory {
  targetId: string;          // Character ID or 'user' for the user
  targetName: string;
  relationship: string;     // e.g., "close friend", "rival", "lover", "stranger"
  sentiment: number;         // -100 to 100, negative to positive
  notes: string;
  lastUpdated: string;
}

// Summary data - compressed conversation history
export interface SummaryData {
  id: string;
  sessionId: string;
  content: string;           // The summary text
  messageRange: {
    start: number;           // Index of first message summarized
    end: number;             // Index of last message summarized
  };
  tokens: number;            // Approximate token count
  createdAt: string;
  model?: string;            // Model used for generation
}

// Summary settings configuration
export interface SummarySettings {
  enabled: boolean;
  autoSummarize: boolean;           // Auto-generate summaries
  
  // Message interval settings (separate for normal chat and groups)
  normalChatInterval: number;       // Messages between summaries for normal chat
  groupChatInterval: number;        // Messages between summaries for group chat
  
  triggerThreshold: number;         // Legacy: Messages before triggering summary
  keepRecentMessages: number;       // Messages to keep unsummarized
  maxSummaryTokens: number;         // Max tokens for summary output
  promptTemplate: string;           // Custom prompt template
  model?: string;                   // Model to use for summaries (fallback to main)
  
  // Summary behavior
  summarizeOnTurnEnd: boolean;      // Summarize at end of turn (group chat)
  includeCharacterThoughts: boolean; // Include character internal thoughts in summary
  preserveEmotionalMoments: boolean; // Highlight emotional moments
}

// Default summary settings
export const DEFAULT_SUMMARY_SETTINGS: SummarySettings = {
  enabled: false,
  autoSummarize: true,
  
  // Default intervals
  normalChatInterval: 20,           // Every 20 messages in normal chat
  groupChatInterval: 15,            // Every 15 messages in group chat (more frequent due to multiple chars)
  
  triggerThreshold: 20,
  keepRecentMessages: 10,
  maxSummaryTokens: 500,
  promptTemplate: `You are a conversation summarizer for a roleplay chat. Your task is to create a concise but comprehensive summary of the conversation.

**Instructions:**
1. Preserve key events, decisions, and plot developments
2. Track emotional moments and character development
3. Note important dialogue exchanges
4. Keep track of items, locations, and relationships
5. Maintain chronological order

**Format:**
Write a narrative summary (not bullet points) that captures the essence of the conversation.

**Conversation to summarize:**
{{conversation}}

**Summary:**`,
  summarizeOnTurnEnd: true,
  includeCharacterThoughts: true,
  preserveEmotionalMoments: true,
};

// Extended ChatSession with memory and summary fields (to be merged with existing)
export interface ChatSessionMemory {
  summaries: SummaryData[];
  currentSummaryId?: string;
  memoryEnabled: boolean;
  lastSummaryAt?: string;
}

// ============ Quest System Types (Renovado) ============
//
// El sistema de misiones ahora usa:
// - QuestTemplate: Plantillas guardadas en JSON separados
// - SessionQuestInstance: Instancias en la sesión JSON
// - QuestReward: Triggers unificados (attribute, sprite, sound, background)

// ============================================
// QUEST STATUS
// ============================================

export type QuestStatus = 
  | 'locked'      // No disponible (prerrequisitos no cumplidos)
  | 'available'   // Disponible para activar
  | 'active'      // En progreso
  | 'completed'   // Completado
  | 'failed';     // Fallido

export type QuestPriority = 'main' | 'side' | 'hidden';

export type QuestObjectiveType = 'collect' | 'reach' | 'defeat' | 'talk' | 'discover' | 'custom';

// ============================================
// QUEST VALUE DETECTION SYSTEM
// ============================================

/**
 * Tipos de valor a detectar después de una key
 * - presence: Solo detecta si la key existe (comportamiento actual)
 * - number: Lee un valor numérico después de la key y compara
 * - text: Lee un valor de texto después de la key y compara
 */
export type QuestValueType = 'presence' | 'number' | 'text';

/**
 * Operadores para comparación de números
 */
export type QuestNumberOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Operadores para comparación de texto
 */
export type QuestTextOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'notEquals';

/**
 * Condición de valor para objetivos y completado
 * Permite detectar valores después de una key y compararlos
 */
export interface QuestValueCondition {
  // Tipo de valor a detectar
  valueType: QuestValueType;
  
  // Valor objetivo a comparar
  // Para number: el número objetivo
  // Para text: el texto objetivo
  // Para presence: se ignora
  targetValue?: number | string;
  
  // Operador de comparación
  // Para number: operadores numéricos
  // Para text: operadores de texto
  // Para presence: se ignora
  operator?: QuestNumberOperator | QuestTextOperator;
}

// ============================================
// QUEST CHARACTER FILTER
// ============================================

/**
 * Filtro de personajes para objetivos
 * Permite restringir qué personajes pueden ver/completar un objetivo
 */
export interface QuestCharacterFilter {
  enabled: boolean;
  mode: 'include' | 'exclude';  // include = solo estos, exclude = todos menos estos
  characterIds: string[];        // IDs de personajes
}

// ============================================
// QUEST OBJECTIVE TEMPLATE
// ============================================

export interface QuestObjectiveTemplate {
  id: string;
  description: string;
  type: QuestObjectiveType;

  // Keys para detectar completado (sistema unificado como HUD)
  completion: {
    key: string;              // Key principal: "resistencia", "HP", etc.
    keys?: string[];          // Keys alternativas: ["Resistance", "hp"]
    caseSensitive: boolean;

    // Condición de valor (opcional)
    // Si se especifica, detecta el valor DESPUÉS de la key
    // Formatos detectados: "key: valor", "key=valor", "key valor"
    valueCondition?: QuestValueCondition;
  };

  // Descripción de completado - instrucciones claras para el LLM
  // sobre cuándo considerar este objetivo como completado
  completionDescription?: string;

  // Objetivo (legacy - para conteo simple)
  target?: string;            // Qué buscar/contar
  targetCount: number;        // Cuántos necesita (default: 1)
  isOptional: boolean;        // Si es opcional, no impide completar la misión

  // Recompensas al completar este objetivo (se ejecutan para el personaje que responde)
  rewards?: QuestReward[];

  // Filtro de personajes (opcional)
  // Si se especifica, solo los personajes que coinciden ven este objetivo
  characterFilter?: QuestCharacterFilter;

  // Metadata opcional
  metadata?: Record<string, unknown>;
}

// ============================================
// QUEST REWARD - Sistema Simplificado (2 tipos)
// ============================================
//
// El sistema de recompensas ahora usa solo 2 tipos:
// - attribute: Modifica atributos del personaje en sessionStats
// - trigger: Activa triggers existentes (sprite, sound, background)
//
// Los triggers se ejecutan a través del UnifiedTriggerExecutor,
// que simula que el TokenDetector encontró la key.

export type QuestRewardType = 'attribute' | 'trigger' | 'objective';

// Target mode para grupos
export type TriggerTargetMode = 'self' | 'all' | 'target';

// Categorías de triggers disponibles
export type TriggerCategory = 'sprite' | 'sound' | 'background' | 'soundSequence';

// Acciones para atributos
export type AttributeAction = 'set' | 'add' | 'subtract' | 'multiply' | 'divide' | 'percent';

export interface QuestRewardCondition {
  type: 'attribute';
  key: string;                // "HP", "nivel", etc.
  operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
  value: number | string;
}

// Configuración de atributo para recompensa
export interface QuestRewardAttribute {
  key: string;                // "resistencia", "HP", "oro", "experiencia"
  value: number | string;     // Valor a aplicar
  action: AttributeAction;    // Tipo de operación
}

// Configuración de trigger para recompensa
export interface QuestRewardTrigger {
  category: TriggerCategory;  // 'sprite' | 'sound' | 'background'
  key: string;                // Keyword del trigger: "feliz", "victory", "forest"
  targetMode: TriggerTargetMode; // 'self' | 'all' | 'target' - quién recibe el trigger
  targetCharacterId?: string; // ID del personaje objetivo cuando targetMode es 'target'

  // Para sprites: tiempo antes de volver a idle (ms, 0 = no volver)
  returnToIdleMs?: number;

  // Para sonidos: volumen (0-1)
  volume?: number;

  // Para backgrounds: transición
  transitionDuration?: number;
}

// Configuración de objetivo para recompensa (completa un objetivo de misión)
export interface QuestRewardObjective {
  objectiveKey: string;       // Key del objetivo a completar: "troncos_abedul"
  questId?: string;          // ID de la misión (opcional, para validar)
}

export interface QuestReward {
  id: string;

  // Tipo de recompensa: attribute, trigger u objective
  type: QuestRewardType;

  // Para type: 'attribute' - modificación de atributos
  attribute?: QuestRewardAttribute;

  // Para type: 'trigger' - activación de triggers
  trigger?: QuestRewardTrigger;

  // Para type: 'objective' - completa un objetivo de misión
  objective?: QuestRewardObjective;

  // Condiciones opcionales para ejecutar el reward
  condition?: QuestRewardCondition;
  
  // ===== LEGACY: Compatibilidad con formato anterior =====
  // Estos campos se mantienen para migración gradual
  // Serán eliminados en futuras versiones
  /** @deprecated Usar attribute.key */
  key?: string;
  /** @deprecated Usar attribute.value */
  value?: string | number;
  /** @deprecated Usar attribute.action */
  action?: AttributeAction;
  /** @deprecated Usar trigger.returnToIdleMs */
  returnToIdleMs?: number;
}

// ============================================
// QUEST CHAIN CONFIGURATION
// ============================================

export type QuestChainType = 'none' | 'specific' | 'random';

export interface QuestChainConfig {
  type: QuestChainType;
  
  // Si es 'specific': ID del siguiente quest
  nextQuestId?: string;
  
  // Si es 'random': pool de IDs a elegir aleatoriamente
  randomPool?: string[];
  
  // Iniciar automáticamente al completar
  autoStart: boolean;
}

// ============================================
// QUEST ACTIVATION CONFIG
// ============================================

export type QuestActivationMethod = 'keyword' | 'turn' | 'manual' | 'chain';

export interface QuestActivationConfig {
  // Keys para detectar activación (sistema unificado como HUD)
  key: string;                    // "mision:rescate"
  keys?: string[];                // ["mission:rescue", "quest:rescate"]
  caseSensitive: boolean;
  
  // Método de activación
  method: QuestActivationMethod;
  
  // Para method: 'turn' - cada cuántos turnos
  turnInterval?: number;
}

// ============================================
// QUEST COMPLETION CONFIG
// ============================================

export interface QuestCompletionConfig {
  key: string;                    // "resistencia", "nivel", etc.
  keys?: string[];                // ["Resistance", "level"]
  caseSensitive: boolean;
  
  // Condición de valor (opcional)
  // Si se especifica, detecta el valor DESPUÉS de la key
  // Formatos detectados: "key: valor", "key=valor", "key valor"
  valueCondition?: QuestValueCondition;
}

// ============================================
// QUEST TEMPLATE (Archivo JSON individual)
// Guardado en: /data/quests/[quest-id].json
// ============================================

export interface QuestTemplate {
  id: string;
  name: string;
  description: string;
  
  // Configuración de activación
  activation: QuestActivationConfig;
  
  // Objetivos
  objectives: QuestObjectiveTemplate[];
  
  // Configuración de completado
  completion: QuestCompletionConfig;
  
  // Cadena de quests (qué sigue después)
  chain?: QuestChainConfig;
  
  // Recompensas (triggers unificados)
  rewards: QuestReward[];
  
  // Metadatos
  priority: QuestPriority;
  icon?: string;                  // Emoji o nombre de icono
  color?: string;                 // Color Tailwind para prioridad
  
  // Comportamiento
  isRepeatable: boolean;
  isHidden: boolean;              // No mostrar hasta activarse
  
  // Auto Quest Settings
  autoQuest?: {
    enabled: boolean;             // Si esta misión puede ser activada automáticamente
    weight: number;               // Peso para selección aleatoria (default: 1)
    order: number;                // Orden para selección por lista (default: 0)
  };
  
  // Prerrequisitos (IDs de otros templates)
  prerequisites?: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SESSION QUEST INSTANCE (En sesión JSON)
// ============================================

export interface SessionQuestObjective {
  templateId: string;             // Referencia al objetivo del template
  currentCount: number;
  isCompleted: boolean;
}

export interface SessionQuestInstance {
  // Referencia al template
  templateId: string;
  
  // Estado actual
  status: QuestStatus;
  
  // Objetivos con progreso
  objectives: SessionQuestObjective[];
  
  // Timestamps
  activatedAt?: string;           // Cuándo se activó
  completedAt?: string;           // Cuándo se completó
  
  // Turno de activación (para quests por turnos)
  activatedAtTurn?: number;
  
  // Progreso general (0-100)
  progress: number;
  
  // Personaje que completó (para grupos)
  completedBy?: string;
}

// ============================================
// QUEST SETTINGS
// ============================================

export interface QuestSettings {
  enabled: boolean;
  autoDetect: boolean;            // Auto-detect quest triggers in messages
  realtimeEnabled: boolean;       // Detect during streaming
  showNotifications: boolean;     // Show quest update notifications
  showCompletedInLog: boolean;    // Keep completed quests in log
  maxActiveQuests: number;        // Maximum active quests at once
  promptInclude: boolean;         // Include active quests in prompt
  promptTemplate: string;         // Template for quest prompt section
  // Auto Quest System
  autoQuestEnabled: boolean;      // Enable auto quest activation
  autoQuestInterval: number;      // Activate quest every X turns/messages
  autoQuestMode: 'random' | 'list'; // Selection mode: random or by list order
  
  // Key Prefixes System
  // Los prefijos se combinan con las keys para mayor flexibilidad
  // Ejemplo: prefix "Misión" + key "rescate" = detecta "Misión:rescate", "Misión: rescate", etc.
  // El sistema genera variantes automáticamente (con :, =, espacio, etc.)
  questActivationPrefix?: string;      // Prefijo para activar misiones (ej: "Misión")
  questCompletionPrefix?: string;      // Prefijo para completar misiones (ej: "Completado")
  objectiveCompletionPrefix?: string;  // Prefijo para completar objetivos (ej: "Objetivo")
}

export const DEFAULT_QUEST_SETTINGS: QuestSettings = {
  enabled: true,
  autoDetect: true,
  realtimeEnabled: true,
  showNotifications: true,
  showCompletedInLog: true,
  maxActiveQuests: 10,
  promptInclude: true,
  promptTemplate: `**Misiones Activas:**
{{activeQuests}}

Instrucciones: Usa la información de las misiones activas para contextualizar tus respuestas. Progresa en las misiones a través de la narrativa cuando sea apropiado.`,
  // Auto Quest defaults
  autoQuestEnabled: false,
  autoQuestInterval: 5,
  autoQuestMode: 'random',
  // Key Prefixes defaults (vacío = sin prefijo, comportamiento actual)
  questActivationPrefix: '',
  questCompletionPrefix: '',
  objectiveCompletionPrefix: '',
};

// ============================================
// QUEST TRIGGER HIT (Post-LLM Detection)
// ============================================

export interface QuestTriggerHit {
  questId: string;                // Template ID
  template?: QuestTemplate;
  objectiveId?: string;
  objective?: QuestObjectiveTemplate;
  action: 'activate' | 'progress' | 'complete' | 'fail';
  progress?: number;
  message: string;
  rewards?: QuestReward[];        // Quest completion rewards (when action='complete')
  objectiveRewards?: QuestReward[]; // Objective completion rewards (when progress completes objective)
  completesObjective?: boolean;   // True if this progress will complete the objective
}

// ============================================
// QUEST NOTIFICATION
// ============================================

export type QuestNotificationType = 
  | 'quest_activated' 
  | 'objective_complete' 
  | 'quest_complete' 
  | 'quest_failed'
  | 'reward_claimed';

export interface QuestNotification {
  id: string;
  questId: string;
  questName: string;
  type: QuestNotificationType;
  message: string;
  rewards?: QuestReward[];
  timestamp: string;
  read: boolean;
}

// ============================================
// LEGACY TYPES (Para compatibilidad)
// ============================================

// Mantener compatibilidad con código existente
export type Quest = QuestTemplate;
export type QuestObjective = QuestObjectiveTemplate;
export type QuestTrigger = QuestActivationConfig;

// ============ Dialogue System Types ============

// Speech bubble style
export type SpeechBubbleStyle = 
  | 'modern'      // Rounded, clean
  | 'classic'     // Comic book style
  | 'minimal'     // Simple border
  | 'neon'        // Glowing effect
  | 'elegant'     // Fancy, decorative
  | 'dark';       // Dark mode optimized

// Text segment type in a message
export type TextSegmentType = 
  | 'dialogue'     // "quoted speech"
  | 'action'       // *asterisk actions*
  | 'narration'    // Regular narration
  | 'thought'      // (parenthetical thoughts)
  | 'system'       // System messages
  | 'emphasis'     // **bold emphasis**
  | 'whisper'      // ~whispered text~
  | 'shout';       // ALL CAPS or !!!

// Parsed text segment
export interface TextSegment {
  id: string;
  type: TextSegmentType;
  content: string;
  startIndex: number;
  endIndex: number;
  metadata?: {
    emotion?: string;
    intensity?: number;
    speaker?: string;
  };
}

// Character dialogue style override
export interface CharacterDialogueStyle {
  characterId: string;
  bubbleColor?: string;         // Tailwind color class
  textColor?: string;           // Tailwind color class
  borderColor?: string;         // Tailwind color class
  fontStyle?: 'normal' | 'italic' | 'bold';
  fontSize?: 'sm' | 'base' | 'lg';
  customClass?: string;         // Custom CSS class
}

// Typography settings for dialogue display
export interface TypographySettings {
  // Font family
  fontFamily: 'system' | 'serif' | 'sans' | 'mono' | 'custom';
  customFontFamily?: string;   // Custom font family name

  // Font size
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  customFontSize?: number;     // Custom size in pixels

  // Font weight
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';

  // Line height
  lineHeight: 'tight' | 'normal' | 'relaxed' | 'loose';

  // Letter spacing
  letterSpacing: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider';
}

// Content style settings for different text types
export interface ContentStyleSettings {
  // Dialogue style (text in quotes)
  dialogue: {
    color: string;            // Text color (hex or Tailwind class)
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
  };

  // Action style (text in asterisks)
  action: {
    color: string;
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
  };

  // Thought style (text in parentheses)
  thought: {
    color: string;
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
  };

  // Whisper style (text in tildes)
  whisper: {
    color: string;
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
    fontStyle: 'normal' | 'italic';
    textDecoration: 'none' | 'underline';
    opacity: number;          // 0-100
  };

  // Emotion style (text in asterisks with emotion context)
  emotion: {
    showIndicator: boolean;   // Show emotion emoji/indicator
    highlightText: boolean;   // Highlight text with emotion color
  };

  // Narration style (plain text)
  narration: {
    color: string;
    fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
    fontStyle: 'normal' | 'italic';
  };
}

// Default typography settings
export const DEFAULT_TYPOGRAPHY_SETTINGS: TypographySettings = {
  fontFamily: 'system',
  fontSize: 'base',
  fontWeight: 'normal',
  lineHeight: 'normal',
  letterSpacing: 'normal',
};

// Default content style settings
export const DEFAULT_CONTENT_STYLE_SETTINGS: ContentStyleSettings = {
  dialogue: {
    color: 'text-foreground',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
  },
  action: {
    color: 'text-purple-600 dark:text-purple-400',
    fontWeight: 'normal',
    fontStyle: 'italic',
    textDecoration: 'none',
  },
  thought: {
    color: 'text-blue-600 dark:text-blue-400',
    fontWeight: 'normal',
    fontStyle: 'italic',
    textDecoration: 'none',
  },
  whisper: {
    color: 'text-muted-foreground',
    fontWeight: 'normal',
    fontStyle: 'italic',
    textDecoration: 'none',
    opacity: 80,
  },
  emotion: {
    showIndicator: true,
    highlightText: false,
  },
  narration: {
    color: 'text-muted-foreground',
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
};

// Typewriter effect settings
export interface TypewriterSettings {
  enabled: boolean;
  speed: number;               // Characters per second
  startDelay: number;          // ms before starting
  pauseOnPunctuation: boolean;
  punctuationPauseMs: number;  // Extra pause on .!?
  cursorChar: string;          // Cursor character
  showCursor: boolean;
  cursorBlinkMs: number;       // Cursor blink rate
}

// Dialogue format settings
export interface DialogueFormatSettings {
  // Dialogue detection
  dialogueMarkers: {
    open: string;              // Opening marker (default: ")
    close: string;             // Closing marker (default: ")
  };
  actionMarkers: {
    open: string;              // Opening marker (default: *)
    close: string;             // Closing marker (default: *)
  };
  thoughtMarkers: {
    open: string;              // Opening marker (default: ()
    close: string;             // Closing marker (default: ))
  };
  whisperMarkers: {
    open: string;              // Opening marker (default: ~)
    close: string;             // Closing marker (default: ~)
  };
}

// Dialogue display settings
export interface DialogueSettings {
  // Main settings
  enabled: boolean;

  // Bubble style
  bubbleStyle: SpeechBubbleStyle;
  showCharacterAvatar: boolean;
  avatarPosition: 'left' | 'right' | 'hidden';
  avatarSize: 'sm' | 'md' | 'lg';

  // Formatting
  formatting: DialogueFormatSettings;

  // Typewriter
  typewriter: TypewriterSettings;

  // Typography (font settings)
  typography: TypographySettings;

  // Content styles (colors for different content types)
  contentStyles: ContentStyleSettings;

  // Character overrides
  characterStyles: CharacterDialogueStyle[];

  // Colors
  userBubbleColor: string;
  assistantBubbleColor: string;
  systemBubbleColor: string;

  // Spacing
  messageSpacing: 'compact' | 'normal' | 'spacious';
  bubbleMaxWidth: number;      // Percentage (50-100)

  // Animation
  animateEntry: boolean;
  entryAnimation: 'fade' | 'slide' | 'scale' | 'none';
  animationDurationMs: number;

  // Advanced
  parseEmotions: boolean;
  highlightActions: boolean;
  separateDialogue: boolean;   // Show dialogue in separate bubble
}

// Default dialogue settings
export const DEFAULT_DIALOGUE_SETTINGS: DialogueSettings = {
  enabled: true,
  bubbleStyle: 'modern',
  showCharacterAvatar: true,
  avatarPosition: 'left',
  avatarSize: 'md',
  formatting: {
    dialogueMarkers: { open: '"', close: '"' },
    actionMarkers: { open: '*', close: '*' },
    thoughtMarkers: { open: '(', close: ')' },
    whisperMarkers: { open: '~', close: '~' },
  },
  typewriter: {
    enabled: true,
    speed: 50,
    startDelay: 0,
    pauseOnPunctuation: true,
    punctuationPauseMs: 100,
    cursorChar: '▋',
    showCursor: true,
    cursorBlinkMs: 530,
  },
  typography: {
    fontFamily: 'system',
    fontSize: 'base',
    fontWeight: 'normal',
    lineHeight: 'normal',
    letterSpacing: 'normal',
  },
  contentStyles: {
    dialogue: {
      color: 'text-foreground',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
    },
    action: {
      color: 'text-purple-600 dark:text-purple-400',
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
    },
    thought: {
      color: 'text-blue-600 dark:text-blue-400',
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
    },
    whisper: {
      color: 'text-muted-foreground',
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
      opacity: 80,
    },
    emotion: {
      showIndicator: true,
      highlightText: false,
    },
    narration: {
      color: 'text-muted-foreground',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
  },
  characterStyles: [],
  userBubbleColor: 'bg-blue-500/20',
  assistantBubbleColor: 'bg-purple-500/20',
  systemBubbleColor: 'bg-muted',
  messageSpacing: 'normal',
  bubbleMaxWidth: 85,
  animateEntry: true,
  entryAnimation: 'fade',
  animationDurationMs: 200,
  parseEmotions: true,
  highlightActions: true,
  separateDialogue: false,
};

// ============ Inventory & Items System Types ============

// Item category for organization
export type ItemCategory = 
  | 'weapon'       // Swords, bows, etc.
  | 'armor'        // Helmets, chestplates, etc.
  | 'accessory'    // Rings, amulets, etc.
  | 'consumable'   // Potions, food, etc.
  | 'material'     // Crafting materials
  | 'key'          // Key items, quest items
  | 'book'         // Books, scrolls, documents
  | 'tool'         // Tools, instruments
  | 'treasure'     // Valuables, gems, gold
  | 'clothing'     // Clothes, outfits
  | 'misc';        // Miscellaneous

// Item rarity
export type ItemRarity = 
  | 'common'       // Grey/white
  | 'uncommon'     // Green
  | 'rare'         // Blue
  | 'epic'         // Purple
  | 'legendary'    // Orange/gold
  | 'unique'       // Red/special
  | 'cursed';      // Dark purple/black

// Item slot for equipment
export type ItemSlot = 
  | 'main_hand'    // Primary weapon
  | 'off_hand'     // Shield, secondary weapon
  | 'head'         // Helmet, hat
  | 'chest'        // Armor, shirt
  | 'legs'         // Pants, leggings
  | 'feet'         // Boots, shoes
  | 'hands'        // Gloves, gauntlets
  | 'accessory1'   // Ring, amulet
  | 'accessory2'   // Second accessory
  | 'back'         // Cloak, cape
  | 'none';        // No slot (consumables, etc.)

// Item stat definition
export interface ItemStat {
  name: string;             // "Attack", "Defense", "Magic Power"
  value: number;            // Stat value
  isPercentage?: boolean;   // Whether this is a percentage bonus
}

// Item effect
export interface ItemEffect {
  type: 'buff' | 'debuff' | 'heal' | 'damage' | 'special';
  name: string;
  description?: string;
  value?: number;
  duration?: number;        // Duration in turns (for buffs/debuffs)
  trigger?: string;         // When effect activates (on_use, on_equip, passive)
}

// Item definition
export interface Item {
  id: string;
  name: string;
  description: string;
  
  // Classification
  category: ItemCategory;
  rarity: ItemRarity;
  slot?: ItemSlot;          // Equipment slot (if equippable)
  
  // Visual
  icon?: string;            // Emoji or icon name
  imageUrl?: string;        // Item image URL
  color?: string;           // Tailwind color class
  
  // Stats & Effects
  stats?: ItemStat[];
  effects?: ItemEffect[];
  
  // Properties
  stackable: boolean;       // Can stack in inventory
  maxStack: number;         // Maximum stack size (1 = unstackable)
  value?: number;           // Gold/value
  weight?: number;          // Weight for encumbrance
  
  // Usage
  usable?: boolean;         // Can be used from inventory
  useAction?: string;       // What happens when used
  consumable?: boolean;     // Consumed on use
  cooldown?: number;        // Cooldown in turns
  
  // Equipment
  equippable?: boolean;     // Can be equipped
  requiredLevel?: number;   // Level requirement
  requiredStats?: ItemStat[]; // Stat requirements
  
  // Triggers
  triggerKeywords?: string[]; // Keywords that detect this item in messages
  contextKeys?: string[];   // Additional context keys
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Inventory entry - item in inventory with quantity
export interface InventoryEntry {
  id: string;
  itemId: string;
  item?: Item;              // Resolved item reference
  
  // Quantity
  quantity: number;
  durability?: number;      // Current durability (if applicable)
  maxDurability?: number;   // Maximum durability
  
  // Equipment state
  equipped?: boolean;       // Is this item equipped?
  equippedTo?: string;      // Character ID who has it equipped
  slot?: ItemSlot;          // Which slot it's equipped to
  
  // Custom state
  customName?: string;      // Renamed item
  customDescription?: string; // Modified description
  notes?: string;           // User notes
  metadata?: Record<string, unknown>;
  
  // Timing
  obtainedAt: string;
  updatedAt: string;
}

// Container/Storage
export interface InventoryContainer {
  id: string;
  name: string;
  type: 'inventory' | 'storage' | 'shop' | 'chest' | 'custom';
  capacity: number;         // Max items (0 = unlimited)
  entries: InventoryEntry[];
  icon?: string;
  color?: string;
  isDefault?: boolean;      // Is this the default inventory
}

// Currency entry
export interface CurrencyEntry {
  id: string;
  name: string;             // "Gold", "Silver", "Gems"
  icon?: string;            // Emoji or icon
  amount: number;
  color?: string;
  isPrimary?: boolean;      // Primary currency
}

// Inventory settings
export interface InventorySettings {
  enabled: boolean;
  autoDetect: boolean;      // Auto-detect item additions in messages
  realtimeEnabled: boolean; // Detect during streaming
  showNotifications: boolean; // Show item pickup notifications
  
  // Display
  showRarityColors: boolean;
  showItemValue: boolean;
  showItemWeight: boolean;
  compactView: boolean;
  
  // Auto-sort
  autoSort: boolean;
  sortMode: 'name' | 'rarity' | 'category' | 'value' | 'recent';
  
  // Equipment
  enableEquipment: boolean; // Enable equipment slots
  showEquippedInInventory: boolean; // Show equipped items in list
  
  // Prompt integration
  promptInclude: boolean;   // Include inventory in prompt
  promptTemplate: string;   // Template for inventory prompt section
  
  // Limits
  maxInventorySize: number; // Max items in inventory (0 = unlimited)
  maxCurrencyTypes: number; // Max currency types
}

// Default inventory settings
export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  enabled: true,
  autoDetect: true,
  realtimeEnabled: true,
  showNotifications: true,
  showRarityColors: true,
  showItemValue: false,
  showItemWeight: false,
  compactView: false,
  autoSort: false,
  sortMode: 'recent',
  enableEquipment: true,
  showEquippedInInventory: true,
  promptInclude: true,
  promptTemplate: `**Inventario:**
{{inventory}}

**Divisa:**
{{currency}}`,
  maxInventorySize: 0,
  maxCurrencyTypes: 10,
};

// Inventory trigger hit result
export interface InventoryTriggerHit {
  type: 'add' | 'remove' | 'use' | 'equip' | 'unequip';
  itemId: string;
  item?: Item;
  quantity: number;
  containerId?: string;
  message: string;
}

// Inventory notification
export interface InventoryNotification {
  id: string;
  type: 'item_added' | 'item_removed' | 'item_used' | 'item_equipped' | 'currency_changed';
  itemId?: string;
  itemName: string;
  quantity?: number;
  message: string;
  timestamp: string;
  read: boolean;
}

// Equipment state for a character
export interface CharacterEquipment {
  characterId: string;
  slots: Record<ItemSlot, InventoryEntry | null>;
  stats: ItemStat[];        // Aggregated stats from equipment
}

// ============ Character Stats System Types ============

// Attribute type
export type AttributeType = 'number' | 'keyword' | 'text';

// Requirement operator for skill/intention/invitation conditions
export type RequirementOperator = '<' | '<=' | '>' | '>=' | '==' | '!=' | 'between';

// Cost operator for activation costs (how to modify attribute)
export type CostOperator = '+' | '-' | '*' | '/' | '=' | 'set_min' | 'set_max';

// Single requirement for skills/intentions/invitations
export interface StatRequirement {
  attributeKey: string;      // Key del atributo: "vida", "mana"
  operator: RequirementOperator;
  value: number | string;
  valueMax?: number;         // Para operador 'between'
}

// Activation cost - modifies attribute when skill is used
export interface ActivationCost {
  attributeKey: string;      // Key del atributo a modificar: "vida", "mana"
  operator: CostOperator;    // How to modify: '+' = add, '-' = subtract, etc.
  value: number;             // Value to apply
  description?: string;      // Optional description: "Cuesta 10 de maná"
}

// Attribute definition (stored in CharacterCard)
export interface AttributeDefinition {
  id: string;
  name: string;              // Display name: "Vida", "Maná", "Resistencia"
  key: string;               // Template key: "vida" → {{vida}} - Also used as primary detection key
  type: AttributeType;
  
  // Para tipo number
  defaultValue: number | string;
  min?: number;
  max?: number;
  
  // Threshold Effects - Efectos al alcanzar mínimo o máximo
  // Se ejecutan cuando el valor llega al límite después de clamping
  onMinReached?: {
    enabled: boolean;        // Activar efectos al llegar al mínimo
    rewards: QuestReward[];  // Recompensas a ejecutar (atributos, sprites, sonidos, backgrounds)
  };
  onMaxReached?: {
    enabled: boolean;        // Activar efectos al llegar al máximo
    rewards: QuestReward[];  // Recompensas a ejecutar (atributos, sprites, sonidos, backgrounds)
  };
  
  // Para detección Post-LLM (detección automática de cambios)
  // Sistema similar a HUD: key es la key principal, keys son alternativas
  keys?: string[];           // Alternative detection keys: ["HP:", "hp:", "❤️"] - key is always checked first
  caseSensitive?: boolean;   // Distinguir mayúsculas/minúsculas (default: false)
  
  // Legacy - mantener por compatibilidad
  detectionTags?: string;    // Tags simples separados por coma: "Vida:, vida:, HP:, ❤️" (convertido a keys[])
  
  // Formato de salida cuando se inyecta en el prompt
  outputFormat?: string;     // Formato: "Vida: {value}" → "Vida: 50"
  
  // Legacy (deprecated)
  keywordPattern?: string;   // Regex pattern: "Vida:\\s*(\\d+)"
  keywordFormat?: string;    // Output format: "Vida: {value}"
  
  // UI
  icon?: string;             // Emoji or icon name
  color?: string;            // Tailwind color for HUD
  
  // HUD Display Configuration
  showInHUD?: boolean;       // Show this attribute in the HUD overlay (default: true if color/icon set)
  hudStyle?: HUDFieldStyle;  // How to display in HUD: 'progress', 'badge', 'gauge', etc.
  hudUnit?: string;          // Unit to show after value: "%", "pts", etc.
}

// Skill/Action type - determines when the action can be used
export type ActionType = 'preparacion' | 'ejecucion';

// Skill definition (stored in CharacterCard) - also called "Acciones" in UI
export interface SkillDefinition {
  id: string;
  name: string;              // "Golpe furioso"
  description: string;       // "Golpe con gran velocidad..."
  key: string;               // Template key: "golpe_furioso" → {{golpe_furioso}}
  type?: ActionType;         // "preparacion" | "ejecucion" - determines action type
  requirements: StatRequirement[];
  category?: string;         // "combate", "magia", "social"

  // Activation costs - modify attributes when skill is used
  activationCosts?: ActivationCost[];

  // Activation rewards - triggers to execute when skill is activated
  // Only trigger type rewards are used (attributes are handled by activationCosts)
  activationRewards?: QuestReward[];

  // Activation key - detected by post-LLM system to trigger skill execution
  // When detected in LLM response, applies activationCosts automatically
  activationKey?: string;    // Primary activation key: "golpe", "hab1"
  activationKeys?: string[]; // Alternative keys: ["golpe_furioso", "gf", "golpe1"]
  activationKeyCaseSensitive?: boolean; // Default: false
  // Detection patterns (flexible matching):
  // - key:value  (golpe:uso, habilidad:1)
  // - key=value  (golpe=activo, hab=1)
  // - key_suffix (golpe_1, habilidad_x)
  // - |key|      (pipe delimiters)

  // Formato de inyección personalizado
  injectFormat?: string;     // Default: "- {name}: {description}"
}

// Intention definition (stored in CharacterCard)
export interface IntentionDefinition {
  id: string;
  name: string;              // "Atacar con furia"
  description: string;
  key: string;               // Template key
  requirements: StatRequirement[];
  examples?: string[];       // Examples of how to manifest this intention

  // Formato de inyección personalizado
  injectFormat?: string;     // Default: numbered format with name, description, and key
}

// SolicitudDefinition - Solicitudes que este personaje puede recibir (configurables)
// Se configuran en la pestaña Stats → Solicitudes
export interface SolicitudDefinition {
  id: string;
  name: string;                    // "Proporcionar madera"
  peticionKey: string;             // Key que activa esta solicitud (quien la solicita escribe esto)
  solicitudKey: string;            // Key para completar la solicitud (quien la recibe escribe esto)
  peticionDescription: string;     // Descripción que ve quien hace la petición
  solicitudDescription: string;    // Descripción que ve quien recibe la solicitud
  completionDescription?: string;  // Descripción que se guarda en ultima_solicitud_completada al completar
  requirements: StatRequirement[]; // Requisitos para que la solicitud esté disponible

  // Activation keys for Peticion (alternative keys for detection)
  peticionActivationKeys?: string[];     // Alternative keys that also trigger this peticion
  peticionKeyCaseSensitive?: boolean;    // Case sensitivity for peticion key detection

  // Activation keys for Solicitud (alternative keys for completion)
  solicitudActivationKeys?: string[];    // Alternative keys that also complete this solicitud
  solicitudKeyCaseSensitive?: boolean;   // Case sensitivity for solicitud key detection
}

// Invitation/Peticion definition (stored in CharacterCard)
// Renamed in UI to "Peticiones" - requests this character sends to others
// La key y descripción se obtienen de la SolicitudDefinition del objetivo
export interface InvitationDefinition {
  id: string;
  name: string;              // Nombre interno para identificar esta petición
  requirements: StatRequirement[];  // Requisitos para que esta petición esté disponible

  // Objetivo - which character to send the petition to
  objetivo?: {
    characterId: string;     // Target character ID
    solicitudId: string;     // ID de la SolicitudDefinition del personaje objetivo
  };

  // Formato de inyección personalizado
  injectFormat?: string;     // Default: numbered format with name, description, and key
}

// Solicitud definition - requests received from other characters
// Stored in session state, not in character config
export interface SolicitudInstance {
  id: string;                // Unique instance ID
  key: string;               // Solicitud key for completion (solicitudKey)
  peticionKey?: string;      // Petition key that activated this (for duplicate detection)
  fromCharacterId: string;   // Character who sent the petition
  fromCharacterName: string; // Display name of sender
  description: string;       // What is being requested
  completionDescription?: string;  // Description of completion (what happened)
  status: 'pending' | 'completed';  // Current status
  createdAt: number;         // Timestamp when created
  completedAt?: number;      // Timestamp when completed
}

// Session state for active solicitudes
export interface SessionSolicitudes {
  // Active solicitudes for each character (requests they received)
  characterSolicitudes: Record<string, SolicitudInstance[]>;
  lastModified: number;
}

// Block headers configuration (customizable headers for injected content)
export interface StatsBlockHeaders {
  skills: string;            // Default: "[ACCIONES DISPONIBLES]" - renamed from Habilidades
  intentions: string;        // Default: "Intenciones disponibles:"
  invitations: string;       // Default: "[PETICIONES DISPONIBLES]" - renamed from Invitaciones
  solicitudesRecibidas: string;  // Default: "[SOLICITUDES RECIBIDAS]" - solicitudes recibidas de otros
}

// Character stats configuration (stored in CharacterCard.statsConfig)
export interface CharacterStatsConfig {
  enabled: boolean;          // Stats system active for this character

  // Definitions
  attributes: AttributeDefinition[];
  skills: SkillDefinition[];
  intentions: IntentionDefinition[];
  invitations: InvitationDefinition[];  // Peticiones - requests this character sends
  solicitudDefinitions: SolicitudDefinition[];  // Solicitudes - requests this character can receive

  // Customizable block headers
  blockHeaders: StatsBlockHeaders;
}

// Stat change log entry (for history/debug)
export interface StatChangeLogEntry {
  attributeId: string;
  attributeKey: string;
  attributeName: string;
  oldValue: number | string;
  newValue: number | string;
  reason: 'llm_detection' | 'manual' | 'trigger' | 'initialization';
  timestamp: number;
}

// Character stats values (stored in SessionStats per character)
export interface CharacterSessionStats {
  // Current values for each attribute
  attributeValues: Record<string, number | string>;
  
  // Last update timestamp per attribute
  lastUpdated: Record<string, number>;
  
  // Change history (optional, for debug/undo)
  changeLog?: StatChangeLogEntry[];
}

// Session stats state (stored in ChatSession.sessionStats)
export interface SessionStats {
  // Stats per character (supports group chats)
  characterStats: Record<string, CharacterSessionStats>;

  // Active solicitudes (requests received from other characters)
  solicitudes: SessionSolicitudes;

  // Recent events (for {{eventos}} key)
  ultimo_objetivo_completado?: string;  // Description of the last completed objective
  ultima_solicitud_completada?: string; // Completion description of the last completed solicitud
  ultima_solicitud_realizada?: string;  // Description of the last peticion activated
  ultima_accion_realizada?: string;     // "personaje - descripcion de la accion"

  // Metadata
  initialized: boolean;      // Whether stats were initialized from defaults
  lastModified: number;      // Global timestamp of last change
}

// Stats trigger hit result (Post-LLM detection)
export interface StatsTriggerHit {
  characterId: string;
  attributeId: string;
  attributeKey: string;
  attributeName: string;
  oldValue: number | string;
  newValue: number | string;
  matchedPattern: string;    // The regex pattern that matched
  matchedText: string;       // The actual text matched
}

// Resolved stats for prompt injection
export interface ResolvedStats {
  // Resolved attribute values (key → formatted string)
  attributes: Record<string, string>;

  // Available items after requirement evaluation
  availableSkills: SkillDefinition[];
  availableIntentions: IntentionDefinition[];
  availableInvitations: InvitationDefinition[];  // Peticiones - outgoing requests (con datos de la solicitud del objetivo)
  availableSolicitudes: SolicitudInstance[];      // Solicitudes - incoming requests

  // Formatted block strings (empty string if no items available)
  skillsBlock: string;
  intentionsBlock: string;
  invitationsBlock: string;  // Peticiones block (PETICIONES POSIBLES)
  solicitudesBlock: string;  // Solicitudes block (SOLICITUDES RECIBIDAS)
}

// Default stats block headers
export const DEFAULT_STATS_BLOCK_HEADERS: StatsBlockHeaders = {
  skills: '[ACCIONES DISPONIBLES]',
  intentions: 'Intenciones disponibles:',
  invitations: '[PETICIONES POSIBLES]',
  solicitudesRecibidas: '[SOLICITUDES RECIBIDAS]',
};

// Default empty stats config
export const DEFAULT_STATS_CONFIG: CharacterStatsConfig = {
  enabled: false,
  attributes: [],
  skills: [],
  intentions: [],
  invitations: [],
  solicitudDefinitions: [],
  blockHeaders: DEFAULT_STATS_BLOCK_HEADERS,
};

// ============================================
// DEFAULT VALUES FOR NEW SPRITE SYSTEM V2
// ============================================

/**
 * Create default sprite pack entry
 */
export const createDefaultSpritePackEntryV2 = (overrides?: Partial<SpritePackEntryV2>): SpritePackEntryV2 => ({
  id: '',
  label: '',
  url: '',
  ...overrides,
});

/**
 * Create default sprite pack V2
 */
export const createDefaultSpritePackV2 = (overrides?: Partial<SpritePackV2>): SpritePackV2 => ({
  id: '',
  name: 'New Pack',
  sprites: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create default state collection V2
 */
export const createDefaultStateCollectionV2 = (
  state: SpriteState,
  overrides?: Partial<StateCollectionV2>
): StateCollectionV2 => ({
  state,
  packId: '',
  behavior: 'principal',
  currentIndex: 0,
  ...overrides,
});

/**
 * Create default sprite trigger config
 */
export const createDefaultSpriteTriggerConfig = (
  spriteId: string,
  overrides?: Partial<SpriteTriggerConfig>
): SpriteTriggerConfig => ({
  spriteId,
  key: '',
  keys: [],
  requirePipes: true,
  caseSensitive: false,
  fallbackMode: 'collection_default',
  enabled: true,
  ...overrides,
});

/**
 * Create default trigger collection
 */
export const createDefaultTriggerCollection = (overrides?: Partial<TriggerCollection>): TriggerCollection => ({
  id: '',
  name: 'New Trigger Collection',
  active: true,
  priority: 1,
  packId: '',
  collectionKey: '',
  collectionKeys: [],
  collectionKeyRequirePipes: true,
  collectionKeyCaseSensitive: false,
  collectionBehavior: 'principal',
  fallbackMode: 'idle_collection',
  fallbackDelayMs: 3000,
  cooldownMs: 500,
  spriteConfigs: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

/**
 * Create default sprite chain
 */
export const createDefaultSpriteChain = (): SpriteChain => ({
  enabled: false,
  steps: [],
  loop: false,
  interruptible: true,
});

/**
 * Create default sound chain
 */
export const createDefaultSoundChain = (): SoundChain => ({
  enabled: false,
  steps: [],
  stopOnInterrupt: true,
});

/**
 * Create default trigger queue state
 */
export const createDefaultTriggerQueueState = (): TriggerQueueState => ({
  queue: [],
  active: null,
  maxQueueSize: 5,
});

// ============================================
// SPRITE TIMELINE EDITOR SYSTEM (V3)
// ============================================

/**
 * Sprite Timeline Editor - A new system for creating animated sprites
 * with keyframe-based sound triggers and multiple tracks.
 * 
 * This is a standalone system that will eventually replace parts of
 * the character sprite system.
 */

// Supported sprite animation formats
export type SpriteAnimationFormat = 'webm' | 'mp4' | 'gif' | 'webp' | 'png' | 'jpg';

// Track type for timeline
export type TimelineTrackType = 'sprite' | 'sound' | 'effect';

// Keyframe interpolation type
export type KeyframeInterpolation = 'hold' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

// Playhead state
export type PlayheadState = 'stopped' | 'playing' | 'paused';

/**
 * Sprite Timeline Collection - A collection of animated sprites
 * Similar to a folder/pack concept
 */
export interface SpriteTimelineCollection {
  id: string;
  name: string;
  description?: string;
  sprites: TimelineSprite[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Timeline Sprite - Individual sprite with timeline data
 */
export interface TimelineSprite {
  id: string;
  label: string;
  url: string;
  thumbnail?: string;
  
  // Animation metadata (auto-detected or manual)
  format: SpriteAnimationFormat;
  duration: number;              // Duration in milliseconds (auto-detected for videos)
  width?: number;
  height?: number;
  fps?: number;                  // For video formats
  hasAudio?: boolean;            // If the video contains audio
  
  // Timeline data
  timeline: SpriteTimelineData;
  
  // Trigger configuration
  triggerKeys: string[];         // Keywords that activate this sprite
  triggerRequirePipes: boolean;
  triggerCaseSensitive: boolean;
  
  // Metadata
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Sprite Timeline Data - The actual timeline with tracks and keyframes
 */
export interface SpriteTimelineData {
  duration: number;              // Total duration in ms (usually matches sprite duration)
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  
  // Playback settings
  loop: boolean;
  autoPlaySounds: boolean;       // Automatically play sounds at keyframes
  globalVolume: number;          // 0-1, master volume for all sound tracks
}

/**
 * Timeline Track - A single track in the timeline (sprite, sound, or effect)
 */
export interface TimelineTrack {
  id: string;
  type: TimelineTrackType;
  name: string;
  keyframes: TimelineKeyframe[];
  
  // Track settings
  enabled: boolean;
  locked: boolean;
  muted: boolean;
  volume: number;                // 0-1, for sound tracks
  
  // Visual settings
  color?: string;                // Track color in timeline UI
  height?: number;               // Track height in pixels
}

/**
 * Timeline Keyframe - A single point in time on a track
 */
export interface TimelineKeyframe {
  id: string;
  time: number;                  // Position in milliseconds
  
  // Value depends on track type
  value: KeyframeValue;
  
  // Interpolation to next keyframe
  interpolation: KeyframeInterpolation;
  
  // Easing curve for custom interpolation (optional)
  easingCurve?: number[];        // Bezier curve control points [x1, y1, x2, y2]
  
  // Metadata
  label?: string;
  color?: string;
}

/**
 * Keyframe Value - The value at a keyframe, depends on track type
 */
export type KeyframeValue = 
  | SpriteKeyframeValue
  | SoundKeyframeValue
  | EffectKeyframeValue;

/**
 * Sprite Keyframe Value - For sprite tracks
 */
export interface SpriteKeyframeValue {
  type: 'sprite';
  opacity: number;               // 0-1
  scale: number;                 // 0.1-3
  rotation: number;              // -360 to 360 degrees
  x: number;                     // Position offset
  y: number;
}

/**
 * Sound Keyframe Value - For sound tracks
 */
export interface SoundKeyframeValue {
  type: 'sound';
  soundUrl?: string;             // Direct URL to sound file
  soundCollection?: string;      // Or reference to sound collection
  soundFile?: string;            // File name within collection
  volume: number;                // 0-1
  pan: number;                   // -1 (left) to 1 (right)
  play: boolean;                 // Whether to play the sound
  stop: boolean;                 // Whether to stop all sounds on this track
}

/**
 * Effect Keyframe Value - For effect tracks (future use)
 */
export interface EffectKeyframeValue {
  type: 'effect';
  effectType: 'shake' | 'flash' | 'blur' | 'color' | 'custom';
  intensity: number;             // 0-1
  duration: number;              // Effect duration in ms
  params?: Record<string, unknown>;
}

/**
 * Timeline Marker - A marker on the timeline for reference
 */
export interface TimelineMarker {
  id: string;
  time: number;                  // Position in milliseconds
  label: string;
  color?: string;
}

/**
 * Timeline Playback State - Current playback state
 */
export interface TimelinePlaybackState {
  playheadState: PlayheadState;
  currentTime: number;           // Current position in ms
  startTime: number;             // When playback started (for calculating position)
  playbackRate: number;          // 0.25-2, speed multiplier
  
  // Active sounds
  activeSounds: ActiveTimelineSound[];
}

/**
 * Active Timeline Sound - A sound currently playing from the timeline
 */
export interface ActiveTimelineSound {
  id: string;
  trackId: string;
  keyframeId: string;
  audioElement: HTMLAudioElement | null;
  startedAt: number;
}

/**
 * Timeline Editor State - State for the timeline editor UI
 */
export interface TimelineEditorState {
  // Current selection
  selectedCollectionId: string | null;
  selectedSpriteId: string | null;
  selectedTrackId: string | null;
  selectedKeyframeId: string | null;
  
  // Timeline view
  zoom: number;                  // 0.1-10, pixels per millisecond
  scrollX: number;               // Horizontal scroll position
  scrollY: number;               // Vertical scroll position
  
  // Playback
  playback: TimelinePlaybackState;
  
  // Snapping
  snapEnabled: boolean;
  snapInterval: number;          // Snap to every N ms (e.g., 100ms)
  
  // UI state
  showTimeline: boolean;
  showProperties: boolean;
  showSoundLibrary: boolean;
}

// ============================================
// DEFAULT VALUES FOR TIMELINE SYSTEM
// ============================================

export const DEFAULT_SPRITE_KEYFRAME_VALUE: SpriteKeyframeValue = {
  type: 'sprite',
  opacity: 1,
  scale: 1,
  rotation: 0,
  x: 0,
  y: 0,
};

export const DEFAULT_SOUND_KEYFRAME_VALUE: SoundKeyframeValue = {
  type: 'sound',
  volume: 1,
  pan: 0,
  play: true,
  stop: false,
};

export const DEFAULT_EFFECT_KEYFRAME_VALUE: EffectKeyframeValue = {
  type: 'effect',
  effectType: 'flash',
  intensity: 0.5,
  duration: 200,
};

export const createDefaultTimelineTrack = (type: TimelineTrackType, name: string): TimelineTrack => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `track_${Date.now()}`,
  type,
  name,
  keyframes: [],
  enabled: true,
  locked: false,
  muted: false,
  volume: 1,
});

export const createDefaultTimelineData = (): SpriteTimelineData => ({
  duration: 3000, // 3 seconds default
  tracks: [
    createDefaultTimelineTrack('sprite', 'Sprite'),
  ],
  markers: [],
  loop: false,
  autoPlaySounds: true,
  globalVolume: 1,
});

export const createDefaultTimelineSprite = (url: string, label: string): TimelineSprite => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `sprite_${Date.now()}`,
  label,
  url,
  format: 'png',
  duration: 3000,
  timeline: createDefaultTimelineData(),
  triggerKeys: [],
  triggerRequirePipes: false,
  triggerCaseSensitive: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const createDefaultTimelineCollection = (name: string): SpriteTimelineCollection => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `collection_${Date.now()}`,
  name,
  sprites: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const createDefaultTimelineEditorState = (): TimelineEditorState => ({
  selectedCollectionId: null,
  selectedSpriteId: null,
  selectedTrackId: null,
  selectedKeyframeId: null,
  zoom: 0.05, // 50 pixels per second
  scrollX: 0,
  scrollY: 0,
  playback: {
    playheadState: 'stopped',
    currentTime: 0,
    startTime: 0,
    playbackRate: 1,
    activeSounds: [],
  },
  snapEnabled: true,
  snapInterval: 100, // Snap to 100ms intervals
  showTimeline: true,
  showProperties: true,
  showSoundLibrary: true,
});
