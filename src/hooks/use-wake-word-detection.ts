'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWakeWordDetectionOptions {
  wakeWords?: string[];
  language?: string;
  silenceDurationMs?: number;
  cooldownMs?: number;
  /** When true and KWS is active, recognition is temporarily paused to prevent speaker echo interference */
  ttsPlaying?: boolean;
  onWakeWordDetected?: (word: string) => void;
  onMessageReady?: (message: string, detectedWakeWord: string | null) => void;
  onTranscriptUpdate?: (transcript: string, isCapturing: boolean) => void;
}

interface UseWakeWordDetectionReturn {
  /** Whether KWS is currently actively listening (false when paused by TTS) */
  isListening: boolean;
  /** Whether KWS is enabled/active (true even when temporarily paused by TTS) */
  isActive: boolean;
  isCapturing: boolean;
  transcript: string;
  capturedMessage: string;
  lastDetectedWord: string | null;
  error: string | null;
  /** Whether KWS is currently paused because TTS is playing */
  isPausedByTTS: boolean;
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'checking';
}

/**
 * Hook for Wake Word Detection - Alexa Style
 * 
 * Flow:
 * 1. Listen continuously
 * 2. Detect wake word (case-insensitive)
 * 3. Capture everything after the wake word
 * 4. On silence, send the message and restart recognition (clears buffer)
 * 5. Return to listening state
 */
export function useWakeWordDetection(options: UseWakeWordDetectionOptions = {}): UseWakeWordDetectionReturn {
  const {
    wakeWords = [],
    language = 'es-ES',
    silenceDurationMs = 1500,
    cooldownMs = 2000,
    ttsPlaying = false,
    onWakeWordDetected,
    onMessageReady,
    onTranscriptUpdate,
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [isPausedByTTS, setIsPausedByTTS] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [capturedMessage, setCapturedMessage] = useState('');
  const [lastDetectedWord, setLastDetectedWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');

  // Refs - avoid stale closures in recognition callbacks
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isCapturingRef = useRef(false);
  const isListeningRef = useRef(false);
  const wasListeningBeforeTTS = useRef(false); // Track if KWS was active before TTS started
  const messageBufferRef = useRef('');
  const lastDetectionTimeRef = useRef(0);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout to clear transcript if no wake word detected
  const wakeWordsRef = useRef(wakeWords);
  const currentWakeWordRef = useRef<string | null>(null); // Track current wake word for callback
  const onMessageReadyRef = useRef(onMessageReady);
  const onWakeWordDetectedRef = useRef(onWakeWordDetected);
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);

  // Keep refs updated
  useEffect(() => {
    wakeWordsRef.current = wakeWords;
  }, [wakeWords]);

  useEffect(() => {
    onMessageReadyRef.current = onMessageReady;
  }, [onMessageReady]);

  useEffect(() => {
    onWakeWordDetectedRef.current = onWakeWordDetected;
  }, [onWakeWordDetected]);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptUpdate]);

  // Check microphone permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          
          result.onchange = () => {
            setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          };
        }
      } catch {
        setPermissionStatus('prompt');
      }
    };
    checkPermission();
  }, []);

  // ============================================
  // TTS / KWS Coordination
  // When TTS starts playing, temporarily pause speech recognition
  // to prevent the mic from picking up speaker audio (echo interference).
  // When TTS stops, automatically resume recognition if it was active before.
  // ============================================
  useEffect(() => {
    if (ttsPlaying && isListeningRef.current && recognitionRef.current) {
      // TTS started playing while KWS is active — pause recognition
      console.log('[KWS] TTS started playing, pausing speech recognition to avoid echo');
      wasListeningBeforeTTS.current = true;
      isListeningRef.current = false; // Prevent onend auto-restart
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore — recognition may already be stopping
      }
      // Batch state updates via microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setIsListening(false);
        setIsPausedByTTS(true);
      });
    } else if (!ttsPlaying && wasListeningBeforeTTS.current) {
      // TTS stopped playing — resume recognition if it was active before
      console.log('[KWS] TTS stopped playing, resuming speech recognition');
      wasListeningBeforeTTS.current = false;
      queueMicrotask(() => {
        setIsPausedByTTS(false);
      });
      // Small delay to let the audio pipeline fully release
      setTimeout(() => {
        if (!isListeningRef.current && recognitionRef.current) {
          try {
            isListeningRef.current = true;
            recognitionRef.current.start();
            setIsListening(true);
            console.log('[KWS] Successfully resumed after TTS');
          } catch (e) {
            console.error('[KWS] Failed to resume after TTS:', e);
            isListeningRef.current = false;
          }
        }
      }, 300);
    } else if (!ttsPlaying && isPausedByTTS) {
      // TTS was already not playing and we were marked as paused — clear the flag
      queueMicrotask(() => {
        setIsPausedByTTS(false);
      });
    }
  }, [ttsPlaying, isPausedByTTS]);

  // Clear silence timeout
  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  // Clear transcript timeout (for when no wake word detected)
  const clearTranscriptTimeout = useCallback(() => {
    if (clearTranscriptTimeoutRef.current) {
      clearTimeout(clearTranscriptTimeoutRef.current);
      clearTranscriptTimeoutRef.current = null;
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[KWS] Stopping...');
    
    isListeningRef.current = false;
    clearSilenceTimeout();
    clearTranscriptTimeout();
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    isCapturingRef.current = false;
    setIsListening(false);
    setIsCapturing(false);
    setTranscript('');
    messageBufferRef.current = '';
  }, [clearSilenceTimeout, clearTranscriptTimeout]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  // Check if text contains wake word (case-insensitive)
  const findWakeWord = useCallback((text: string): string | null => {
    const lowerText = text.toLowerCase();
    
    for (const word of wakeWordsRef.current) {
      const lowerWord = word.toLowerCase().trim();
      if (lowerWord && lowerText.includes(lowerWord)) {
        return word; // Return original case
      }
    }
    
    return null;
  }, []);

  // Extract message after wake word
  const extractMessageAfterWakeWord = useCallback((text: string, wakeWord: string): string => {
    const lowerText = text.toLowerCase();
    const lowerWord = wakeWord.toLowerCase();
    const index = lowerText.indexOf(lowerWord);
    
    if (index === -1) return text;
    
    // Get everything after the wake word
    const after = text.substring(index + wakeWord.length).trim();
    // Remove leading punctuation
    return after.replace(/^[,.\s:!¿¡]+/, '').trim();
  }, []);

  // Start listening
  const startListening = useCallback(async (): Promise<boolean> => {
    if (isListeningRef.current) return true;
    
    setError(null);
    
    // Check for Speech Recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return false;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      setPermissionStatus('granted');
      
      // Create recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        console.log('[KWS] Started. Listening for:', wakeWordsRef.current);
        isListeningRef.current = true;
        setIsListening(true);
        isCapturingRef.current = false;
        setIsCapturing(false);
        setTranscript('');
        setLastDetectedWord(null);
        messageBufferRef.current = '';
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Build transcript from current segment only (use resultIndex, not from 0)
        // This prevents accumulation of old transcripts
        let currentSegment = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentSegment += event.results[i][0].transcript;
        }
        
        // Build full transcript for display (all results in this session)
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        
        console.log('[KWS] Current segment:', currentSegment, '| Full:', fullTranscript, '| Capturing:', isCapturingRef.current);
        
        setTranscript(fullTranscript);
        onTranscriptUpdateRef.current?.(fullTranscript, isCapturingRef.current);
        
        // Clear existing timeouts
        clearSilenceTimeout();
        clearTranscriptTimeout();
        
        // Check for wake word in current segment first, then full transcript
        const detectedWordInSegment = findWakeWord(currentSegment);
        const detectedWord = detectedWordInSegment || findWakeWord(fullTranscript);
        
        if (!isCapturingRef.current) {
          // Not capturing - look for wake word
          if (detectedWord) {
            const now = Date.now();
            if (now - lastDetectionTimeRef.current >= cooldownMs) {
              lastDetectionTimeRef.current = now;
              
              console.log('[KWS] Wake word detected:', detectedWord);
              setLastDetectedWord(detectedWord);
              currentWakeWordRef.current = detectedWord; // Store for callback
              isCapturingRef.current = true;
              setIsCapturing(true);
              
              onWakeWordDetectedRef.current?.(detectedWord);
              
              // Extract message after wake word
              const message = extractMessageAfterWakeWord(fullTranscript, detectedWord);
              if (message) {
                messageBufferRef.current = message;
                setCapturedMessage(message);
                console.log('[KWS] Initial message:', message);
              }
            }
          } else {
            // No wake word detected - set timeout to clear transcript after silence
            // This prevents old text from showing when user speaks but doesn't say the wake word
            clearTranscriptTimeoutRef.current = setTimeout(() => {
              console.log('[KWS] Silence without wake word - clearing transcript');
              setTranscript('');
              
              // Restart recognition to clear the internal buffer
              if (recognitionRef.current && isListeningRef.current) {
                try {
                  recognitionRef.current.stop();
                  // onend will auto-restart because isListeningRef.current is true
                } catch {}
              }
            }, silenceDurationMs);
          }
        } else {
          // Already capturing - append current segment to buffer
          // Only use currentSegment (new speech) to avoid duplication
          if (currentSegment.trim()) {
            // Check if wake word appears again (user restarting command)
            if (detectedWordInSegment) {
              // New wake word detected - restart capture from here
              const message = extractMessageAfterWakeWord(currentSegment, detectedWordInSegment);
              messageBufferRef.current = message;
              setCapturedMessage(message);
              console.log('[KWS] New wake word, restarted message:', message);
            } else {
              // Continue building message - append or update
              // The currentSegment might be a refinement of the last part
              // We store the accumulated message and add new content
              const existingMessage = messageBufferRef.current;
              
              // Only add if this segment contains new content
              if (!existingMessage.includes(currentSegment.trim())) {
                // This is new content, append it
                const newMessage = existingMessage ? `${existingMessage} ${currentSegment}`.trim() : currentSegment;
                messageBufferRef.current = newMessage;
                setCapturedMessage(newMessage);
                console.log('[KWS] Appended message:', newMessage);
              } else {
                // Content already in buffer, just update display
                setCapturedMessage(existingMessage);
              }
            }
          }
          
          // Set silence timeout to send message
          silenceTimeoutRef.current = setTimeout(() => {
            const finalMessage = messageBufferRef.current.trim();
            console.log('[KWS] Silence detected! Sending message:', finalMessage, 'wake word:', currentWakeWordRef.current);
            
            if (finalMessage) {
              // Pass both message and detected wake word
              onMessageReadyRef.current?.(finalMessage, currentWakeWordRef.current || undefined);
            }
            
            // Reset capture state
            isCapturingRef.current = false;
            setIsCapturing(false);
            messageBufferRef.current = '';
            setCapturedMessage('');
            setLastDetectedWord(null);
            currentWakeWordRef.current = null; // Reset wake word
            setTranscript('');
            
            // CRITICAL: Stop and restart recognition to clear the buffer
            // This prevents old transcripts from accumulating
            if (recognitionRef.current && isListeningRef.current) {
              try {
                recognitionRef.current.stop();
                // onend will auto-restart because isListeningRef.current is true
              } catch {}
            }
          }, silenceDurationMs);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // 'no-speech' and 'aborted' are normal events, not real errors
        // - no-speech: No voice detected for a period (normal while waiting)
        // - aborted: Recognition stopped (normal when we restart)
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.log('[KWS] Event:', event.error, '(normal, ignoring)');
          return;
        }
        
        console.error('[KWS] Error:', event.error);
        
        if (event.error === 'not-allowed') {
          setError('Permiso de micrófono denegado');
          setPermissionStatus('denied');
          isListeningRef.current = false;
          setIsListening(false);
        } else {
          setError(`Error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('[KWS] Recognition ended, isListening:', isListeningRef.current);
        
        // If we were capturing and have a message, send it
        if (isCapturingRef.current && messageBufferRef.current.trim()) {
          console.log('[KWS] Sending on end:', messageBufferRef.current.trim(), 'wake word:', currentWakeWordRef.current);
          onMessageReadyRef.current?.(messageBufferRef.current.trim(), currentWakeWordRef.current || undefined);
          isCapturingRef.current = false;
          setIsCapturing(false);
          messageBufferRef.current = '';
          currentWakeWordRef.current = null; // Reset wake word
        }
        
        // Auto-restart if supposed to be listening
        if (isListeningRef.current && recognitionRef.current === recognition) {
          console.log('[KWS] Auto-restarting...');
          try {
            recognition.start();
          } catch (e) {
            console.error('[KWS] Restart failed:', e);
            isListeningRef.current = false;
            setIsListening(false);
          }
        }
      };

      // Start
      recognition.start();
      recognitionRef.current = recognition;
      return true;
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start';
      console.error('[KWS] Start error:', msg);
      
      if (msg.includes('Permission') || msg.includes('denied')) {
        setPermissionStatus('denied');
        setError('Permiso de micrófono denegado');
      } else {
        setError(msg);
      }
      
      return false;
    }
  }, [language, cooldownMs, silenceDurationMs, findWakeWord, extractMessageAfterWakeWord, clearSilenceTimeout, clearTranscriptTimeout]);

  return {
    isListening,
    isActive: isPausedByTTS || isListening, // Active if listening or paused by TTS
    isCapturing,
    transcript,
    capturedMessage,
    lastDetectedWord,
    error,
    isPausedByTTS,
    startListening,
    stopListening,
    permissionStatus,
  };
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
