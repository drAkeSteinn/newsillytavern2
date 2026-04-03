// ============================================
// TTS Service - Text-to-Speech generation and playback
// Handles TTS-WebUI integration with queue management
// ============================================

import type { 
  CharacterVoiceConfig, 
  TTSQueueItem, 
  VoiceInfo,
  TTSWebUIConfig,
  TextSegment,
} from './types';
import { DEFAULT_VOICE_CONFIG, DEFAULT_TTS_WEBUI_CONFIG } from './types';
import { parseTextSegments, filterSegments, cleanTextForTTS } from './text-parser';

// ============================================
// Audio Unlock Utility
// Handles browser autoplay policy by unlocking
// AudioContext on first user gesture
// ============================================

let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;
let pendingPlayCallbacks: Array<() => void> = [];

/**
 * Unlock audio by creating/resuming an AudioContext.
 * Must be called from a user gesture (click/tap/keydown).
 */
function unlockAudio(): Promise<boolean> {
  if (isAudioUnlocked) return Promise.resolve(true);

  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    if (audioContext.state === 'suspended') {
      return audioContext.resume().then(() => {
        isAudioUnlocked = true;
        flushPendingPlay();
        return true;
      });
    }

    isAudioUnlocked = true;
    flushPendingPlay();
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Check if audio is currently unlocked for autoplay.
 */
function isAudioReady(): boolean {
  return isAudioUnlocked;
}

/**
 * Add a callback to run once audio is unlocked.
 */
function onAudioUnlocked(cb: () => void): void {
  if (isAudioUnlocked) {
    cb();
  } else {
    pendingPlayCallbacks.push(cb);
  }
}

/**
 * Run all pending play callbacks after audio is unlocked.
 */
function flushPendingPlay(): void {
  const callbacks = [...pendingPlayCallbacks];
  pendingPlayCallbacks = [];
  for (const cb of callbacks) {
    try { cb(); } catch { /* ignore */ }
  }
}

// Register global click/keydown listeners to unlock audio
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    unlockAudio();
  };
  document.addEventListener('click', unlockHandler, { once: false, passive: true });
  document.addEventListener('keydown', unlockHandler, { once: false, passive: true });
  document.addEventListener('touchstart', unlockHandler, { once: false, passive: true });
}

// ============================================
// TTS Service Class
// ============================================

class TTSService {
  private config: TTSWebUIConfig = { ...DEFAULT_TTS_WEBUI_CONFIG };
  private queue: TTSQueueItem[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private voicesCache: VoiceInfo[] = [];
  private lastVoicesFetch: number = 0;
  private voicesCacheTTL: number = 5 * 60 * 1000; // 5 minutes

  // Connection status cache — avoids spamming connection checks when server is offline
  private connectionStatus: 'online' | 'offline' | 'unknown' = 'unknown';
  private lastConnectionCheck: number = 0;
  private connectionCheckCooldownOnline: number = 30 * 1000;  // 30s when online
  private connectionCheckCooldownOffline: number = 120 * 1000; // 2min when offline
  private connectionCheckCooldownUnknown: number = 5 * 1000;   // 5s initial

  // Autoplay blocked state
  private autoplayBlocked: boolean = false;

  // Event callbacks
  private onPlaybackStart?: (item: TTSQueueItem) => void;
  private onPlaybackEnd?: (item: TTSQueueItem) => void;
  private onPlaybackError?: (item: TTSQueueItem, error: string) => void;
  private onQueueUpdate?: (queue: TTSQueueItem[]) => void;
  private onAutoplayBlocked?: () => void;

  // ============================================
  // Configuration
  // ============================================

  setConfig(config: Partial<TTSWebUIConfig>) {
    const prevUrl = this.config.baseUrl;
    this.config = { ...this.config, ...config };
    // Reset connection cache if endpoint changed
    if (config.baseUrl && config.baseUrl !== prevUrl) {
      this.resetConnectionStatus();
    }
  }

  getConfig(): TTSWebUIConfig {
    return { ...this.config };
  }

  setCallbacks(callbacks: {
    onPlaybackStart?: (item: TTSQueueItem) => void;
    onPlaybackEnd?: (item: TTSQueueItem) => void;
    onPlaybackError?: (item: TTSQueueItem, error: string) => void;
    onQueueUpdate?: (queue: TTSQueueItem[]) => void;
    onAutoplayBlocked?: () => void;
  }) {
    this.onPlaybackStart = callbacks.onPlaybackStart;
    this.onPlaybackEnd = callbacks.onPlaybackEnd;
    this.onPlaybackError = callbacks.onPlaybackError;
    this.onQueueUpdate = callbacks.onQueueUpdate;
    this.onAutoplayBlocked = callbacks.onAutoplayBlocked;
  }

  /**
   * Get whether audio is unlocked for autoplay.
   */
  get isAudioUnlocked(): boolean {
    return isAudioReady();
  }

  /**
   * Get whether the last playback was blocked by autoplay policy.
   */
  get wasAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  /**
   * Try to unlock audio. Call from a user gesture handler.
   */
  async unlockAudio(): Promise<boolean> {
    const success = await unlockAudio();
    if (success && this.autoplayBlocked) {
      this.autoplayBlocked = false;
      // Retry any items that were blocked
      this.retryBlockedItems();
    }
    return success;
  }

  /**
   * Reset autoplay blocked flag and retry blocked queue items.
   */
  private retryBlockedItems() {
    const blockedItems = this.queue.filter(
      item => item.status === 'autoplay_blocked'
    );
    if (blockedItems.length > 0) {
      console.log(`[TTS] Retrying ${blockedItems.length} blocked items after audio unlock`);
      for (const item of blockedItems) {
        item.status = 'pending';
      }
      this.onQueueUpdate?.(this.queue);
      if (!this.isPlaying) {
        this.processQueue();
      }
    }
  }

  // ============================================
  // Voice Management
  // ============================================

  async fetchVoices(forceRefresh: boolean = false): Promise<VoiceInfo[]> {
    const now = Date.now();
    
    // Use cache if valid
    if (!forceRefresh && this.voicesCache.length > 0 && (now - this.lastVoicesFetch) < this.voicesCacheTTL) {
      return this.voicesCache;
    }

    try {
      const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/audio/voices`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      
      let voices: VoiceInfo[] = [];
      if (data.voices && Array.isArray(data.voices)) {
        voices = data.voices.map((voice: { id: string; name?: string }) => ({
          id: voice.id,
          name: voice.name || voice.id.split('/').pop() || voice.id,
          path: voice.id,
          language: extractLanguage(voice.id),
        }));
      }

      this.voicesCache = voices;
      this.lastVoicesFetch = now;
      
      return voices;
    } catch (error) {
      console.error('[TTS] Failed to fetch voices:', error);
      return this.voicesCache; // Return cached voices on error
    }
  }

  getCachedVoices(): VoiceInfo[] {
    return [...this.voicesCache];
  }

  // ============================================
  // Audio Generation
  // ============================================

  async generateSpeech(
    text: string,
    voiceConfig: CharacterVoiceConfig,
    options?: {
      model?: string;
      language?: string;
      responseFormat?: 'mp3' | 'wav' | 'ogg' | 'flac';
    }
  ): Promise<{ audioBlob: Blob; format: string }> {
    const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
    
    // Build request body
    const requestBody: Record<string, unknown> = {
      input: text,
      model: 'chatterbox',
      response_format: options?.responseFormat || this.config.responseFormat,
    };

    // Set voice - only if we have a valid voice ID
    const model = options?.model || this.config.model;
    
    if (voiceConfig.voiceId && 
        voiceConfig.voiceId !== 'default' && 
        voiceConfig.voiceId !== 'none') {
      requestBody.voice = voiceConfig.voiceId;
    } else if (this.config.defaultVoice && 
               this.config.defaultVoice !== 'default' && 
               this.config.defaultVoice !== 'none') {
      requestBody.voice = this.config.defaultVoice;
    }

    // Build params object
    const params: Record<string, unknown> = {
      device: 'auto',
      dtype: 'bfloat16',
    };

    // Set model type (multilingual or standard)
    if (model === 'multilingual') {
      params.model_name = 'multilingual';
      params.language_id = voiceConfig.language || options?.language || this.config.language || 'es';
    }

    // Set voice parameters
    params.exaggeration = voiceConfig.exaggeration ?? this.config.exaggeration;
    params.cfg_weight = voiceConfig.cfgWeight ?? this.config.cfgWeight;
    params.temperature = voiceConfig.temperature ?? this.config.temperature;

    requestBody.params = params;

    console.log('[TTS] Generating speech for:', text.substring(0, 50) + '...');
    console.log('[TTS] Voice config:', {
      voiceId: requestBody.voice || '(none — synthetic)',
      model: model,
      language: params.language_id || params.language || '(default)',
      exaggeration: params.exaggeration,
      cfg_weight: params.cfg_weight,
      temperature: params.temperature,
    });

    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS generation failed: ${response.status} - ${errorText}`);
    }

    // Validate content type — reject non-audio responses (e.g. JSON error bodies)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // Server returned JSON instead of audio — something went wrong
      const jsonBody = await response.json().catch(() => null);
      const errorMsg = jsonBody?.error || jsonBody?.detail || 'Server returned JSON instead of audio';
      throw new Error(`TTS generation failed: ${errorMsg}`);
    }

    const audioBlob = await response.blob();

    // Validate blob has actual content
    if (audioBlob.size === 0) {
      throw new Error('TTS generation failed: received empty audio');
    }

    console.log(`[TTS] Audio received: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

    return { 
      audioBlob, 
      format: options?.responseFormat || this.config.responseFormat 
    };
  }

  // ============================================
  // Text Processing
  // ============================================

  processTextForDualVoice(
    text: string,
    options: {
      dialogueVoice: CharacterVoiceConfig;
      narratorVoice: CharacterVoiceConfig;
      generateDialogues?: boolean;
      generateNarrations?: boolean;
      generatePlainText?: boolean;
    }
  ): Array<{ text: string; voiceConfig: CharacterVoiceConfig }> {
    const segments = parseTextSegments(text);
    const filtered = filterSegments(segments, {
      generateDialogues: options.generateDialogues,
      generateNarrations: options.generateNarrations,
      generatePlainText: options.generatePlainText,
    });

    return filtered
      .filter(segment => segment.text.trim().length > 0)
      .map(segment => {
        const cleanedText = cleanTextForTTS(segment.text);
        
        let voiceConfig: CharacterVoiceConfig;
        switch (segment.type) {
          case 'dialogue':
            voiceConfig = options.dialogueVoice;
            break;
          case 'narrator':
            voiceConfig = options.narratorVoice;
            break;
          case 'plain':
          default:
            voiceConfig = options.dialogueVoice;
        }

        return {
          text: cleanedText,
          voiceConfig: { ...DEFAULT_VOICE_CONFIG, ...voiceConfig },
        };
      })
      .filter(item => item.text.length > 0);
  }

  // ============================================
  // Queue Management
  // ============================================

  addToQueue(
    text: string,
    voiceConfig: CharacterVoiceConfig,
    options?: {
      characterId?: string;
      priority?: number;
    }
  ): string | null {
    // Skip empty or very short text — TTS servers may return empty audio for these
    if (!text || text.trim().length < 2) {
      console.log('[TTS] Skipping queue item — text too short:', text?.substring(0, 30));
      return null;
    }

    const id = `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const item: TTSQueueItem = {
      id,
      text,
      voiceConfig: { ...DEFAULT_VOICE_CONFIG, ...voiceConfig },
      characterId: options?.characterId,
      priority: options?.priority || 0,
      status: 'pending',
    };

    // Insert sorted by priority
    const insertIndex = this.queue.findIndex(i => i.priority < item.priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.onQueueUpdate?.(this.queue);
    
    // Start processing if not playing
    if (!this.isPlaying) {
      this.processQueue();
    }

    return id;
  }

  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly MIN_AUDIO_SIZE = 1024; // 1KB minimum - anything less is likely empty/invalid

  private async processQueue() {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    const item = this.queue[0];
    if (item.status !== 'pending') {
      return;
    }

    this.isPlaying = true;
    item.status = 'generating';
    this.onQueueUpdate?.(this.queue);

    let lastError: string | undefined;

    // Retry loop for transient TTS failures
    for (let attempt = 0; attempt <= TTSService.MAX_RETRIES; attempt++) {
      try {
        const { audioBlob } = await this.generateSpeech(item.text, item.voiceConfig);
        
        // Validate audio size — skip if too small (likely empty or corrupt)
        if (audioBlob.size < TTSService.MIN_AUDIO_SIZE) {
          console.warn(`[TTS] Audio too small (${audioBlob.size} bytes), attempt ${attempt + 1}/${TTSService.MAX_RETRIES + 1}`);
          lastError = `Audio response too small (${audioBlob.size} bytes)`;
          
          if (attempt < TTSService.MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, TTSService.RETRY_DELAY_MS * (attempt + 1)));
            continue;
          }
          throw new Error(lastError);
        }

        item.status = 'ready';
        item.audioUrl = URL.createObjectURL(audioBlob);
        item.audioBlob = audioBlob;
        this.onQueueUpdate?.(this.queue);

        // Play audio
        await this.playItem(item);
        return; // Success — exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        const isRetryable = lastError.includes('empty audio') || 
                           lastError.includes('too small') ||
                           lastError.includes('fetch failed') ||
                           lastError.includes('NetworkError') ||
                           lastError.includes('ECONNREFUSED');
        
        console.warn(`[TTS] Generation attempt ${attempt + 1}/${TTSService.MAX_RETRIES + 1} failed:`, lastError);
        
        if (attempt < TTSService.MAX_RETRIES && isRetryable) {
          const delay = TTSService.RETRY_DELAY_MS * (attempt + 1);
          console.log(`[TTS] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Non-retryable error or max retries exceeded
        item.status = 'error';
        item.error = lastError;
        this.onPlaybackError?.(item, lastError);
        this.onQueueUpdate?.(this.queue);
        return;
      }
    }
  }

  private async playItem(item: TTSQueueItem) {
    if (!item.audioUrl) {
      return;
    }

    item.status = 'playing';
    this.onPlaybackStart?.(item);
    this.onQueueUpdate?.(this.queue);

    this.currentAudio = new Audio(item.audioUrl);
    
    return new Promise<void>((resolve) => {
      if (!this.currentAudio) {
        resolve();
        return;
      }

      // Store resolve so it can be called exactly once
      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // Track whether play() already handled an error.
      // The HTMLAudioElement onerror fires as a side-effect when play() rejects,
      // so we must suppress it to avoid double error reporting.
      let playErrorHandled = false;

      this.currentAudio.onended = () => {
        item.status = 'completed';
        this.onPlaybackEnd?.(item);
        this.cleanupCurrentItem();
        this.playNext();
        safeResolve();
      };

      // onerror fires on media decode/network errors DURING playback.
      // We suppress it when play() already handled the error (autoplay or other).
      this.currentAudio.onerror = () => {
        if (playErrorHandled) {
          // Error was already handled by the play() catch block — skip
          return;
        }
        console.warn('[TTS] Media error during playback for item:', item.id);
        item.status = 'error';
        item.error = 'Audio decode error';
        this.onPlaybackError?.(item, item.error);
        this.cleanupCurrentItem();
        this.playNext();
        safeResolve();
      };

      // Try to play — handle autoplay policy gracefully
      const doPlay = () => {
        if (!this.currentAudio) {
          safeResolve();
          return;
        }
        this.currentAudio.play().then(() => {
          this.autoplayBlocked = false;
        }).catch((error) => {
          // Mark error as handled so onerror doesn't double-report
          playErrorHandled = true;

          // Check if it's an autoplay policy error
          const errorMsg = error?.message || String(error);
          if (errorMsg.includes("user didn't interact") || 
              errorMsg.includes('NotAllowedError') ||
              errorMsg.includes('play() failed')) {
            console.warn('[TTS] Autoplay blocked by browser policy. Audio will play after user interaction.');
            this.autoplayBlocked = true;
            item.status = 'autoplay_blocked';
            this.onAutoplayBlocked?.();
            this.onQueueUpdate?.(this.queue);

            // Set up a one-time listener for the next user interaction to retry
            const retryHandler = () => {
              cleanup();
              unlockAudio().then((success) => {
                if (success && item.status === 'autoplay_blocked') {
                  item.status = 'ready';
                  this.isPlaying = false;
                  this.processQueue();
                }
              });
            };
            const cleanup = () => {
              document.removeEventListener('click', retryHandler);
              document.removeEventListener('keydown', retryHandler);
              document.removeEventListener('touchstart', retryHandler);
            };
            document.addEventListener('click', retryHandler, { once: true });
            document.addEventListener('keydown', retryHandler, { once: true });
            document.addEventListener('touchstart', retryHandler, { once: true });

            // Don't call playNext — we want to keep the item in queue
            // so it can retry after user interaction
            this.isPlaying = false;
            safeResolve();
          } else {
            // Different error — not autoplay related
            console.error('[TTS] Play error:', errorMsg);
            item.status = 'error';
            item.error = errorMsg;
            this.onPlaybackError?.(item, item.error);
            this.cleanupCurrentItem();
            this.playNext();
            safeResolve();
          }
        });
      };

      // If audio is already unlocked, play immediately
      if (isAudioReady()) {
        doPlay();
      } else {
        // Try play first — might work if there was a prior gesture
        doPlay();
      }
    });
  }

  private playNext() {
    // Remove completed item from queue
    if (this.queue.length > 0 && this.queue[0].status === 'completed') {
      this.queue.shift();
    }

    this.isPlaying = false;
    this.onQueueUpdate?.(this.queue);

    // Process next item
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private cleanupCurrentItem() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  // ============================================
  // Playback Controls
  // ============================================

  stop() {
    this.cleanupCurrentItem();
    
    // Clean up all queued items
    for (const item of this.queue) {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
    }
    
    this.queue = [];
    this.isPlaying = false;
    this.autoplayBlocked = false;
    this.onQueueUpdate?.(this.queue);
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play().catch((error) => {
        // If resume also blocked, try unlocking first
        if (error?.message?.includes('user didn\'t interact') || 
            error?.message?.includes('NotAllowedError')) {
          unlockAudio().then((success) => {
            if (success && this.currentAudio) {
              this.currentAudio.play().catch(() => {});
            }
          });
        }
      });
    }
  }

  getQueue(): TTSQueueItem[] {
    return [...this.queue];
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  removeFromQueue(itemId: string) {
    const index = this.queue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const item = this.queue[index];
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
      this.queue.splice(index, 1);
      this.onQueueUpdate?.(this.queue);
    }
  }

  clearQueue() {
    for (const item of this.queue) {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
    }
    this.queue = [];
    this.onQueueUpdate?.(this.queue);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get current connection status without making a network request.
   * Returns cached status from the last check.
   */
  getCachedConnectionStatus(): 'online' | 'offline' | 'unknown' {
    return this.connectionStatus;
  }

  /**
   * Check if enough time has passed since last connection check.
   */
  private shouldCheckConnection(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastConnectionCheck;
    const cooldown = this.connectionStatus === 'online'
      ? this.connectionCheckCooldownOnline
      : this.connectionStatus === 'offline'
        ? this.connectionCheckCooldownOffline
        : this.connectionCheckCooldownUnknown;
    return elapsed >= cooldown;
  }

  /**
   * Reset connection status to unknown — forces a fresh check next time.
   * Call when the TTS config (baseUrl) changes.
   */
  resetConnectionStatus(): void {
    this.connectionStatus = 'unknown';
    this.lastConnectionCheck = 0;
  }

  async testConnection(forceCheck = false): Promise<{ status: 'online' | 'offline'; error?: string }> {
    // Return cached status if within cooldown period (unless forced)
    if (!forceCheck && !this.shouldCheckConnection()) {
      return {
        status: this.connectionStatus === 'unknown' ? 'offline' : this.connectionStatus,
        error: this.connectionStatus === 'offline' ? 'Server offline (cached)' : undefined,
      };
    }

    try {
      const baseUrl = this.config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/audio/voices`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout to avoid hanging
      });

      this.lastConnectionCheck = Date.now();

      if (response.ok) {
        this.connectionStatus = 'online';
        return { status: 'online' };
      } else {
        this.connectionStatus = 'offline';
        return { status: 'offline', error: `Server returned ${response.status}` };
      }
    } catch (error) {
      this.lastConnectionCheck = Date.now();
      this.connectionStatus = 'offline';
      // Log as warn, not error — connection refused is expected when TTS server is not running
      console.warn('[TTS] Connection check failed:', error instanceof Error ? error.message : 'Unknown error');
      return { 
        status: 'offline', 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}

// ============================================
// Helper Functions
// ============================================

function extractLanguage(voiceId: string): string | undefined {
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}

// ============================================
// Export Singleton
// ============================================

export const ttsService = new TTSService();
export { TTSService };
export { unlockAudio, isAudioReady, onAudioUnlocked };
