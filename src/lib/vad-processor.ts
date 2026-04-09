/**
 * VAD (Voice Activity Detection) Processor
 * Detects silence in audio stream to auto-stop recording
 * 
 * Uses Web Audio API to analyze audio levels in real-time
 */

import type { VADConfig, DEFAULT_VAD_CONFIG } from '@/types';

export type VADState = 'silence' | 'speech' | 'unknown';

export interface VADCallbacks {
  onSilenceDetected: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (error: string) => void;
}

export class VADProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  
  private config: VADConfig;
  private callbacks: VADCallbacks;
  
  private silenceStartTime: number = 0;
  private isSpeaking: boolean = false;
  private recordingStartTime: number = 0;
  private isActive: boolean = false;
  
  constructor(config: VADConfig, callbacks: VADCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }
  
  /**
   * Start VAD processing on a media stream
   */
  async start(mediaStream: MediaStream): Promise<boolean> {
    if (this.isActive) {
      console.warn('[VAD] Already active, stopping previous instance');
      this.stop();
    }
    
    try {
      // Create audio context
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect media stream
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(mediaStream);
      this.mediaStreamSource.connect(this.analyser);
      
      // Reset state
      this.silenceStartTime = 0;
      this.isSpeaking = false;
      this.recordingStartTime = Date.now();
      this.isActive = true;
      
      console.log('[VAD] Started monitoring audio stream');
      
      // Start monitoring loop
      this.monitorAudio();
      
      return true;
    } catch (error) {
      console.error('[VAD] Failed to start:', error);
      this.callbacks.onError?.('Failed to initialize VAD');
      return false;
    }
  }
  
  /**
   * Stop VAD processing
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.isActive = false;
    this.isSpeaking = false;
    this.silenceStartTime = 0;
    
    console.log('[VAD] Stopped');
  }
  
  /**
   * Update VAD configuration
   */
  updateConfig(newConfig: Partial<VADConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[VAD] Config updated:', this.config);
  }
  
  /**
   * Get current VAD state
   */
  getState(): VADState {
    if (!this.isActive) return 'unknown';
    return this.isSpeaking ? 'speech' : 'silence';
  }
  
  /**
   * Main monitoring loop
   */
  private monitorAudio(): void {
    if (!this.analyser || !this.isActive) return;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const checkAudio = () => {
      if (!this.analyser || !this.isActive) return;
      
      // Get frequency data
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume (0-100)
      const sum = dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / dataArray.length;
      
      // Notify volume change
      this.callbacks.onVolumeChange?.(average);
      
      // Check for speech/silence
      const now = Date.now();
      const recordingDuration = now - this.recordingStartTime;
      
      // Only process VAD after minimum recording time
      if (recordingDuration < this.config.minRecordingMs) {
        this.animationFrameId = requestAnimationFrame(checkAudio);
        return;
      }
      
      // Determine if speech or silence
      const isCurrentlySpeaking = average >= this.config.silenceThreshold;
      
      // Handle speech start
      if (isCurrentlySpeaking && !this.isSpeaking) {
        this.isSpeaking = true;
        this.silenceStartTime = 0;
        this.callbacks.onSpeechStart?.();
        console.log('[VAD] Speech started, volume:', average.toFixed(1));
      }
      
      // Handle speech end / silence detection
      if (!isCurrentlySpeaking) {
        if (this.isSpeaking) {
          // User was speaking, now silent
          if (this.silenceStartTime === 0) {
            this.silenceStartTime = now;
            console.log('[VAD] Silence started, volume:', average.toFixed(1));
          }
          
          // Check if silence duration exceeded threshold
          const silenceDuration = now - this.silenceStartTime;
          
          if (silenceDuration >= this.config.silenceDurationMs) {
            console.log('[VAD] Silence threshold reached, triggering stop');
            this.isSpeaking = false;
            this.callbacks.onSpeechEnd?.();
            this.callbacks.onSilenceDetected();
            return; // Stop monitoring after trigger
          }
        } else {
          // Reset silence timer if not previously speaking
          this.silenceStartTime = 0;
        }
      } else {
        // Reset silence timer when speaking
        this.silenceStartTime = 0;
      }
      
      // Check max duration
      if (recordingDuration >= this.config.maxRecordingMs) {
        console.log('[VAD] Max recording duration reached');
        this.callbacks.onSilenceDetected();
        return;
      }
      
      // Continue monitoring
      this.animationFrameId = requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  }
  
  /**
   * Calculate volume level from audio stream
   */
  static async getVolumeLevel(mediaStream: MediaStream): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        analyser.fftSize = 512;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / dataArray.length;
        
        audioContext.close();
        resolve(average);
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Create a VAD processor with default configuration
 */
export function createVADProcessor(
  config: Partial<VADConfig>,
  callbacks: VADCallbacks
): VADProcessor {
  const defaultConfig: VADConfig = {
    enabled: true,
    silenceThreshold: 30,
    silenceDurationMs: 1500,
    minRecordingMs: 500,
    maxRecordingMs: 30000,
    ...config,
  };
  
  return new VADProcessor(defaultConfig, callbacks);
}
