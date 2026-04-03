'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
  maxDuration?: number; // Max recording duration in ms
  onStop?: (audioBlob: Blob, duration: number) => void;
  onError?: (error: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  audioBlob: Blob | null;
  audioBase64: string | null;
  reset: () => void;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'checking';
  requestPermission: () => Promise<boolean>;
  resetError: () => void;
}

/**
 * Hook for recording audio from the microphone
 * Returns audio as Blob and Base64 encoded string
 */
export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { maxDuration = 60000, onStop, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check microphone permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Try to get permission status
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
          
          // Listen for permission changes
          result.onchange = () => {
            setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
            // Clear error when permission changes
            if (result.state === 'granted') {
              setError(null);
            }
          };
        } else {
          // Fallback: assume prompt needed
          setPermissionStatus('prompt');
        }
      } catch {
        // Permissions API not supported, assume prompt
        setPermissionStatus('prompt');
      }
    };
    
    checkPermission();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Convert blob to base64
  const blobToBase64 = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  // Reset error state
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  // Request permission explicitly (separate from recording)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
        video: false,
      });
      
      // Permission granted - stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      console.log('[AudioRecorder] Permission granted');
      return true;
    } catch (permError) {
      console.error('[AudioRecorder] Permission denied:', permError);
      setPermissionStatus('denied');
      
      const errorMsg = permError instanceof Error ? permError.name : 'Permission denied';
      if (errorMsg === 'NotAllowedError' || errorMsg === 'PermissionDeniedError') {
        setError('Permiso de micrófono denegado. Haz clic en el icono de micrófono en la barra de direcciones del navegador para permitir el acceso.');
      } else if (errorMsg === 'NotFoundError') {
        setError('No se encontró ningún micrófono. Por favor, conecta un micrófono.');
      } else {
        setError(`Error de micrófono: ${errorMsg}`);
      }
      
      return false;
    }
  }, []);

  // Stop recording - using ref to avoid stale closure
  const stopRecording = useCallback(() => {
    console.log('[AudioRecorder] stopRecording called');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('[AudioRecorder] MediaRecorder stopped');
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    console.log('[AudioRecorder] startRecording called');
    
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access with specific constraints
      console.log('[AudioRecorder] Requesting microphone access...');
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000, // Whisper optimal sample rate
            channelCount: 1,
          },
          video: false,
        });
        setPermissionStatus('granted');
        console.log('[AudioRecorder] Microphone access granted');
      } catch (permError) {
        console.error('[AudioRecorder] Microphone permission denied:', permError);
        setPermissionStatus('denied');
        const errorMsg = permError instanceof Error ? permError.name : 'Permission denied';
        
        if (errorMsg === 'NotAllowedError' || errorMsg === 'PermissionDeniedError') {
          setError('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en la configuración del navegador.');
        } else if (errorMsg === 'NotFoundError') {
          setError('No se encontró ningún micrófono. Por favor, conecta un micrófono.');
        } else {
          setError(`Error de micrófono: ${errorMsg}`);
        }
        
        onError?.(error || 'Permission denied');
        return false;
      }

      // Store stream reference for cleanup
      mediaStreamRef.current = stream;

      // Get supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('[AudioRecorder] Using MIME type:', type);
          break;
        }
      }

      if (!mimeType) {
        // Fallback - let browser choose
        mimeType = 'audio/webm';
        console.log('[AudioRecorder] No preferred MIME type, using fallback:', mimeType);
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        console.log('[AudioRecorder] Data available, size:', event.data.size);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log('[AudioRecorder] onstop event, chunks:', chunksRef.current.length);
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const finalDuration = Date.now() - startTimeRef.current;
        
        console.log('[AudioRecorder] Blob created, size:', blob.size, 'duration:', finalDuration);
        
        setAudioBlob(blob);
        setIsRecording(false);
        setDuration(finalDuration);

        // Convert to base64
        try {
          const base64 = await blobToBase64(blob);
          console.log('[AudioRecorder] Base64 conversion success, length:', base64.length);
          setAudioBase64(base64);
          onStop?.(blob, finalDuration);
        } catch (err) {
          console.error('[AudioRecorder] Base64 conversion error:', err);
          setError('Error al convertir audio');
          onError?.('Failed to convert audio to base64');
        }

        // Stop all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] MediaRecorder error:', event);
        setError('Error durante la grabación');
        setIsRecording(false);
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          console.log('[AudioRecorder] Max duration reached, stopping...');
          stopRecording();
        }
      }, 100);

      console.log('[AudioRecorder] Recording started successfully');
      return true;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      console.error('[AudioRecorder] Start error:', errorMessage);
      setError(errorMessage);
      setIsRecording(false);
      onError?.(errorMessage);
      return false;
    }
  }, [maxDuration, onStop, onError, blobToBase64, stopRecording, error]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      console.log('[AudioRecorder] Paused recording');
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
      
      console.log('[AudioRecorder] Resumed recording');
    }
  }, [maxDuration, stopRecording]);

  // Reset state
  const reset = useCallback(() => {
    setAudioBlob(null);
    setAudioBase64(null);
    setDuration(0);
    setError(null);
    setIsPaused(false);
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    audioBlob,
    audioBase64,
    reset,
    error,
    permissionStatus,
    requestPermission,
    resetError,
  };
}

/**
 * Hook for audio transcription using the API
 */
export function useAudioTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  const transcribe = useCallback(async (
    audioBase64: string,
    options?: {
      model?: string;
      language?: string;
      endpoint?: string;
    }
  ): Promise<{ text: string } | null> => {
    setIsTranscribing(true);
    setTranscriptionError(null);

    // Use correct model format: openai/whisper-small
    const model = options?.model || 'openai/whisper-small';
    
    console.log('[Transcription] Starting with model:', model);

    try {
      const response = await fetch('/api/tts/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: audioBase64,
          model: model,
          language: options?.language || 'es',
          provider: 'tts-webui',
          endpoint: options?.endpoint,
          response_format: 'json',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      console.log('[Transcription] Success:', data.text?.substring(0, 50) + '...');
      return { text: data.text };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      console.error('[Transcription] Error:', errorMessage);
      setTranscriptionError(errorMessage);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  return {
    transcribe,
    isTranscribing,
    transcriptionError,
  };
}
