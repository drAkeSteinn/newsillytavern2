/**
 * Wake Word Detector
 * 
 * Uses Web Speech API for continuous speech recognition
 * Detects configured wake words (e.g., "hey luna", "jarvis")
 * 
 * This runs 100% in the browser - no server calls for detection
 */

import type { WakeWordConfig, WakeWordDetectionResult } from '@/types';

export interface WakeWordDetectorCallbacks {
  onWakeWordDetected: (result: WakeWordDetectionResult) => void;
  onListeningChange?: (isListening: boolean) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onPermissionChange?: (granted: boolean) => void;
}

export interface CharacterWakeWords {
  characterId: string;
  characterName: string;
  wakeWords: string[];
}

export class WakeWordDetector {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private isActive: boolean = false;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 5;
  private restartDelay: number = 100;
  
  private characters: Map<string, CharacterWakeWords> = new Map();
  private wakeWordPattern: RegExp | null = null;
  private lastDetectionTime: number = 0;
  private cooldownMs: number = 3000;
  
  private language: string = 'es-ES';
  private callbacks: WakeWordDetectorCallbacks;
  
  constructor(callbacks: WakeWordDetectorCallbacks) {
    this.callbacks = callbacks;
    this.initRecognition();
  }
  
  /**
   * Initialize Speech Recognition API
   */
  private initRecognition(): void {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[WakeWord] Speech Recognition API not supported');
      this.callbacks.onError?.('Speech Recognition not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;
    this.recognition.maxAlternatives = 3;
    
    // Handle results
    this.recognition.onresult = (event) => {
      this.handleResult(event);
    };
    
    // Handle errors
    this.recognition.onerror = (event) => {
      this.handleError(event);
    };
    
    // Handle end (auto-restart)
    this.recognition.onend = () => {
      this.handleEnd();
    };
    
    // Handle start
    this.recognition.onstart = () => {
      console.log('[WakeWord] Recognition started');
      this.isListening = true;
      this.callbacks.onListeningChange?.(true);
    };
    
    console.log('[WakeWord] Recognition initialized');
  }
  
  /**
   * Add or update character wake words
   */
  addCharacter(config: CharacterWakeWords): void {
    this.characters.set(config.characterId, config);
    this.rebuildPattern();
    console.log(`[WakeWord] Added character "${config.characterName}" with words:`, config.wakeWords);
  }
  
  /**
   * Remove character wake words
   */
  removeCharacter(characterId: string): void {
    this.characters.delete(characterId);
    this.rebuildPattern();
    console.log(`[WakeWord] Removed character: ${characterId}`);
  }
  
  /**
   * Update multiple characters at once
   */
  setCharacters(characters: CharacterWakeWords[]): void {
    this.characters.clear();
    characters.forEach(c => this.characters.set(c.characterId, c));
    this.rebuildPattern();
    console.log(`[WakeWord] Set ${characters.length} characters`);
  }
  
  /**
   * Rebuild the regex pattern for wake word matching
   */
  private rebuildPattern(): void {
    const allWords: string[] = [];
    
    this.characters.forEach((config) => {
      config.wakeWords.forEach(word => {
        // Normalize wake word for matching
        const normalized = word.toLowerCase().trim();
        if (normalized && !allWords.includes(normalized)) {
          allWords.push(normalized);
        }
      });
    });
    
    if (allWords.length === 0) {
      this.wakeWordPattern = null;
      console.log('[WakeWord] No wake words configured');
      return;
    }
    
    // Create regex pattern that matches any wake word
    // Escape special regex characters
    const escapedWords = allWords.map(w => 
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    this.wakeWordPattern = new RegExp(
      `(${escapedWords.join('|')})`,
      'gi'
    );
    
    console.log('[WakeWord] Pattern rebuilt for words:', allWords);
  }
  
  /**
   * Set language for speech recognition
   */
  setLanguage(language: string): void {
    this.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
    console.log(`[WakeWord] Language set to: ${language}`);
  }
  
  /**
   * Set cooldown between detections
   */
  setCooldown(cooldownMs: number): void {
    this.cooldownMs = cooldownMs;
  }
  
  /**
   * Start continuous listening
   */
  async start(): Promise<boolean> {
    if (!this.recognition) {
      this.callbacks.onError?.('Speech Recognition not initialized');
      return false;
    }
    
    if (this.isActive) {
      console.log('[WakeWord] Already active');
      return true;
    }
    
    // Check if we have wake words configured
    if (!this.wakeWordPattern) {
      console.log('[WakeWord] No wake words configured, not starting');
      return false;
    }
    
    try {
      this.isActive = true;
      this.restartAttempts = 0;
      await this.recognition.start();
      console.log('[WakeWord] Started listening');
      return true;
    } catch (error: any) {
      console.error('[WakeWord] Failed to start:', error);
      
      if (error.name === 'NotAllowedError') {
        this.callbacks.onPermissionChange?.(false);
        this.callbacks.onError?.('Microphone permission denied');
      } else {
        this.callbacks.onError?.(error.message || 'Failed to start speech recognition');
      }
      
      this.isActive = false;
      return false;
    }
  }
  
  /**
   * Stop listening
   */
  stop(): void {
    this.isActive = false;
    this.isListening = false;
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    this.callbacks.onListeningChange?.(false);
    console.log('[WakeWord] Stopped listening');
  }
  
  /**
   * Handle speech recognition result
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    const results = event.results;
    
    for (let i = event.resultIndex; i < results.length; i++) {
      const result = results[i];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      
      // Notify transcript
      this.callbacks.onTranscript?.(transcript, isFinal);
      
      // Check for wake word in transcript
      const detection = this.detectWakeWord(transcript);
      
      if (detection) {
        // Check cooldown
        const now = Date.now();
        if (now - this.lastDetectionTime < this.cooldownMs) {
          console.log('[WakeWord] Detection ignored due to cooldown');
          continue;
        }
        
        this.lastDetectionTime = now;
        this.callbacks.onWakeWordDetected(detection);
        return;
      }
    }
  }
  
  /**
   * Detect wake word in transcript
   */
  private detectWakeWord(transcript: string): WakeWordDetectionResult | null {
    if (!this.wakeWordPattern) return null;
    
    const matches = transcript.toLowerCase().match(this.wakeWordPattern);
    
    if (!matches) return null;
    
    const detectedWord = matches[0].toLowerCase();
    
    // Find which character this wake word belongs to
    for (const [characterId, config] of this.characters) {
      const found = config.wakeWords.some(
        w => w.toLowerCase().trim() === detectedWord
      );
      
      if (found) {
        console.log(`[WakeWord] Detected "${detectedWord}" for character "${config.characterName}"`);
        
        return {
          characterId,
          wakeWord: detectedWord,
          confidence: 0.9, // Web Speech API doesn't provide confidence for keyword detection
          timestamp: Date.now(),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Handle speech recognition error
   */
  private handleError(event: SpeechRecognitionErrorEvent): void {
    const error = event.error;
    
    // Ignore "no-speech" errors (normal when silent)
    if (error === 'no-speech') {
      return;
    }
    
    console.error('[WakeWord] Recognition error:', error);
    
    if (error === 'not-allowed') {
      this.callbacks.onPermissionChange?.(false);
      this.callbacks.onError?.('Microphone permission denied');
      this.isActive = false;
    } else if (error === 'aborted') {
      // Recognition was aborted, will try to restart
    } else if (error === 'network') {
      this.callbacks.onError?.('Network error occurred');
    } else {
      this.callbacks.onError?.(`Recognition error: ${error}`);
    }
  }
  
  /**
   * Handle recognition end (auto-restart if active)
   */
  private handleEnd(): void {
    this.isListening = false;
    this.callbacks.onListeningChange?.(false);
    
    if (this.isActive && this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      console.log(`[WakeWord] Restarting... (attempt ${this.restartAttempts})`);
      
      setTimeout(() => {
        if (this.isActive && this.recognition) {
          this.recognition.start().catch(e => {
            console.error('[WakeWord] Restart failed:', e);
          });
        }
      }, this.restartDelay);
    } else if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('[WakeWord] Max restart attempts reached');
      this.callbacks.onError?.('Speech recognition stopped unexpectedly');
      this.isActive = false;
    }
  }
  
  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }
  
  /**
   * Check if detector is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Check if Speech Recognition is supported
   */
  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.recognition = null;
    this.characters.clear();
    this.wakeWordPattern = null;
    console.log('[WakeWord] Destroyed');
  }
}

// Singleton instance
let wakeWordDetectorInstance: WakeWordDetector | null = null;

/**
 * Get or create singleton Wake Word Detector
 */
export function getWakeWordDetector(callbacks: WakeWordDetectorCallbacks): WakeWordDetector {
  if (!wakeWordDetectorInstance) {
    wakeWordDetectorInstance = new WakeWordDetector(callbacks);
  }
  return wakeWordDetectorInstance;
}

/**
 * Reset singleton instance
 */
export function resetWakeWordDetector(): void {
  if (wakeWordDetectorInstance) {
    wakeWordDetectorInstance.destroy();
    wakeWordDetectorInstance = null;
  }
}
