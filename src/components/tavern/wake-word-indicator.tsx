/**
 * Wake Word Status Indicator
 * Shows when wake word detection is active and listening
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Ear, Mic, MicOff, Loader2 } from 'lucide-react';
import { useWakeWordDetection } from '@/hooks/use-wake-word-detection';
import type { CharacterWakeWords } from '@/lib/wake-word-detector';

interface WakeWordIndicatorProps {
  /** Characters with their wake words configured */
  characters: CharacterWakeWords[];
  /** Callback when wake word triggers recording */
  onWakeWordTrigger: (characterId: string) => void;
  /** Callback to start recording */
  onStartRecording: () => void;
  /** Callback to stop recording */
  onStopRecording: () => void;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether audio level is high (speech detected) */
  audioLevel?: number;
  /** Language for speech recognition */
  language?: string;
  /** Whether to auto-start detection */
  autoStart?: boolean;
}

export function WakeWordIndicator({
  characters,
  onWakeWordTrigger,
  onStartRecording,
  onStopRecording,
  isRecording,
  audioLevel = 0,
  language = 'es-ES',
  autoStart = false,
}: WakeWordIndicatorProps) {
  // Check if any character has wake words enabled
  const hasWakeWords = characters.some(c => c.wakeWords.length > 0);

  const {
    isListening,
    isActive,
    isSupported,
    currentTranscript,
    lastDetection,
    error,
    permissionGranted,
    startDetection,
    stopDetection,
    requestPermission,
  } = useWakeWordDetection({
    characters,
    language,
    autoStart: autoStart && hasWakeWords,
    onWakeWordDetected: (result) => {
      console.log('[WakeWordIndicator] Wake word detected:', result);
      onWakeWordTrigger(result.characterId);
      onStartRecording();
    },
    onStartRecording: () => {
      console.log('[WakeWordIndicator] Starting recording from wake word');
    },
    onStopRecording: () => {
      console.log('[WakeWordIndicator] Stopping recording from VAD');
      onStopRecording();
    },
    onError: (err) => {
      console.error('[WakeWordIndicator] Error:', err);
    },
  });

  // Auto-start if has wake words and not already active
  useEffect(() => {
    if (hasWakeWords && !isActive && autoStart && isSupported && permissionGranted !== false) {
      startDetection();
    }
  }, [hasWakeWords, isActive, autoStart, isSupported, permissionGranted, startDetection]);

  // Handle permission request
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      startDetection();
    }
  };

  // Don't render if no wake words configured
  if (!hasWakeWords || !isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Main Status Indicator */}
      <Button
        type="button"
        size="sm"
        variant={isActive ? "default" : "outline"}
        className={cn(
          "h-7 px-2 text-xs gap-1.5 transition-all",
          isActive && isListening && "bg-green-600 hover:bg-green-700",
          isActive && !isListening && "bg-amber-600 hover:bg-amber-700",
          isRecording && "animate-pulse"
        )}
        onClick={isActive ? stopDetection : startDetection}
        title={
          isActive 
            ? isListening 
              ? 'Escuchando palabras de activación...' 
              : 'Detector activo, esperando...'
            : 'Activar detección de palabra clave'
        }
      >
        <Ear className={cn(
          "w-3.5 h-3.5",
          isActive && isListening && "animate-pulse"
        )} />
        <span className="hidden sm:inline">
          {isActive ? (isListening ? 'Escuchando...' : 'Activo') : 'KWS'}
        </span>
      </Button>

      {/* Audio Level Indicator */}
      {isActive && (
        <div className="flex items-center gap-1">
          <div 
            className={cn(
              "w-1 bg-green-500 rounded-full transition-all",
              audioLevel > 50 ? "h-4" : audioLevel > 20 ? "h-2" : "h-1"
            )}
          />
          <div 
            className={cn(
              "w-1 bg-green-500 rounded-full transition-all",
              audioLevel > 60 ? "h-4" : audioLevel > 30 ? "h-2" : "h-1"
            )}
          />
          <div 
            className={cn(
              "w-1 bg-green-500 rounded-full transition-all",
              audioLevel > 70 ? "h-4" : audioLevel > 40 ? "h-2" : "h-1"
            )}
          />
        </div>
      )}

      {/* Last Detection Badge */}
      {lastDetection && (
        <Badge 
          variant="outline" 
          className="text-[10px] bg-green-500/10 border-green-500/30 text-green-400"
        >
          "{lastDetection.wakeWord}" detectado
        </Badge>
      )}

      {/* Permission Request */}
      {permissionGranted === false && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-amber-500"
          onClick={handleRequestPermission}
        >
          <MicOff className="w-3 h-3 mr-1" />
          Permitir micrófono
        </Button>
      )}

      {/* Error Display */}
      {error && (
        <span className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Simplified hook to check wake word status for a character
 */
export function useCharacterWakeWords(characterId: string | undefined) {
  // This would connect to your character store
  // For now, returns empty wake words
  return {
    wakeWords: [] as string[],
    enabled: false,
  };
}
