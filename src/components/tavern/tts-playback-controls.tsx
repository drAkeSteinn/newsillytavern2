// ============================================
// TTS Playback Controls - Visual indicator and controls for TTS
// ============================================

'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  Square,
  Loader2,
  ListMusic,
  MousePointerClick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTTS } from '@/hooks/use-tts';

interface TTSPlaybackControlsProps {
  className?: string;
  compact?: boolean;
}

export function TTSPlaybackControls({ className, compact = false }: TTSPlaybackControlsProps) {
  const {
    isPlaying,
    isPaused,
    currentQueue,
    ttsConfig,
    autoplayBlocked,
    stop,
    pause,
    resume,
  } = useTTS();

  // Find current item
  const currentItem = useMemo(() => 
    currentQueue.find(item => item.status === 'playing') || 
    currentQueue.find(item => item.status === 'generating') ||
    currentQueue.find(item => item.status === 'autoplay_blocked'),
    [currentQueue]
  );

  // Find queued count
  const queuedCount = useMemo(() =>
    currentQueue.filter(
      item => item.status === 'pending' || item.status === 'ready'
    ).length,
    [currentQueue]
  );

  // Don't render if TTS is disabled or nothing is playing/generating/blocked
  if (!ttsConfig?.enabled || (!isPlaying && currentQueue.length === 0 && !currentItem && !autoplayBlocked)) {
    return null;
  }

  // Compact mode - minimal indicator
  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        autoplayBlocked
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-primary/10 text-primary',
        className
      )}>
        {autoplayBlocked ? (
          <>
            <VolumeX className="w-3 h-3" />
            <span>Haz clic para activar audio</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={resume}
            >
              <Play className="w-2.5 h-2.5" />
            </Button>
          </>
        ) : isPlaying ? (
          <>
            <Volume2 className="w-3 h-3 animate-pulse" />
            <span>{isPaused ? 'Pausado' : 'Reproduciendo'}</span>
            {queuedCount > 0 && (
              <span className="ml-1 text-muted-foreground">(+{queuedCount})</span>
            )}
            <div className="flex gap-0.5 ml-1">
              {isPaused ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={resume}
                >
                  <Play className="w-2.5 h-2.5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={pause}
                >
                  <Pause className="w-2.5 h-2.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={stop}
              >
                <Square className="w-2.5 h-2.5" />
              </Button>
            </div>
          </>
        ) : currentItem?.status === 'generating' ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generando audio...</span>
          </>
        ) : null}
      </div>
    );
  }

  // Full mode - expanded controls
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2 rounded-lg border shadow-sm',
      autoplayBlocked ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-card',
      className
    )}>
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {autoplayBlocked ? (
          <VolumeX className="w-5 h-5 text-amber-500" />
        ) : currentItem?.status === 'generating' ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : isPlaying ? (
          <Volume2 className={cn(
            'w-5 h-5 text-primary',
            !isPaused && 'animate-pulse'
          )} />
        ) : (
          <Volume2 className="w-5 h-5 text-muted-foreground" />
        )}
        
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {autoplayBlocked
              ? 'Audio bloqueado por el navegador'
              : currentItem?.status === 'generating'
                ? 'Generando audio...'
                : isPlaying 
                  ? (isPaused ? 'Pausado' : 'Reproduciendo TTS')
                  : 'TTS Listo'}
          </span>
          {autoplayBlocked ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Haz clic en Reproducir para activar el audio
            </span>
          ) : currentItem ? (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              "{currentItem.text.substring(0, 50)}..."
            </span>
          ) : null}
        </div>
      </div>

      {/* Queue indicator */}
      {queuedCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ListMusic className="w-3.5 h-3.5" />
          <span>{queuedCount} en cola</span>
        </div>
      )}

      {/* Playback controls */}
      <div className="flex items-center gap-1 ml-auto">
        {autoplayBlocked ? (
          <Button
            variant="outline"
            size="sm"
            onClick={resume}
            className="gap-1"
          >
            <MousePointerClick className="w-4 h-4" />
            Activar Audio
          </Button>
        ) : isPlaying ? (
          <>
            {isPaused ? (
              <Button
                variant="outline"
                size="sm"
                onClick={resume}
                className="gap-1"
              >
                <Play className="w-4 h-4" />
                Continuar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={pause}
                className="gap-1"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </Button>
            )}
          </>
        ) : null}
        
        {(isPlaying || currentItem || autoplayBlocked) && (
          <Button
            variant="outline"
            size="sm"
            onClick={stop}
            className="gap-1 text-destructive hover:text-destructive"
          >
            <Square className="w-4 h-4" />
            Detener
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// TTS Floating Indicator - Shows at bottom of screen when TTS is active
// ============================================

interface TTSFloatingIndicatorProps {
  className?: string;
}

export function TTSFloatingIndicator({ className }: TTSFloatingIndicatorProps) {
  const { isPlaying, isPaused, currentQueue, ttsConfig, autoplayBlocked, stop, pause, resume } = useTTS();

  // Find current item and counts
  const currentItem = useMemo(() => 
    currentQueue.find(item => 
      item.status === 'playing' || item.status === 'generating' || item.status === 'autoplay_blocked'
    ),
    [currentQueue]
  );

  const queuedCount = useMemo(() =>
    currentQueue.filter(
      item => item.status === 'pending' || item.status === 'ready'
    ).length,
    [currentQueue]
  );

  const hasActivePlayback = useMemo(() =>
    isPlaying || autoplayBlocked || currentQueue.some(
      item => item.status === 'playing' || item.status === 'generating' || item.status === 'autoplay_blocked'
    ),
    [isPlaying, autoplayBlocked, currentQueue]
  );

  // Don't render if TTS is disabled or nothing is active
  if (!ttsConfig?.enabled) {
    return null;
  }

  if (!hasActivePlayback && currentQueue.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg',
      'bg-background/95 backdrop-blur border shadow-lg',
      'animate-in slide-in-from-bottom-2 fade-in-0 duration-200',
      autoplayBlocked && 'border-amber-300 dark:border-amber-700',
      className
    )}>
      {/* Status icon */}
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full',
        autoplayBlocked ? 'bg-amber-500/10' : 'bg-primary/10'
      )}>
        {autoplayBlocked ? (
          <VolumeX className="w-4 h-4 text-amber-500" />
        ) : currentItem?.status === 'generating' ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <Volume2 className={cn(
            'w-4 h-4 text-primary',
            isPlaying && !isPaused && 'animate-pulse'
          )} />
        )}
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {autoplayBlocked
            ? 'Audio bloqueado'
            : currentItem?.status === 'generating' 
              ? 'Generando...' 
              : isPaused 
                ? 'Pausado' 
                : 'Reproduciendo'}
        </span>
        {autoplayBlocked ? (
          <span className="text-xs text-amber-500">Clic para activar</span>
        ) : queuedCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            {queuedCount} más en cola
          </span>
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 ml-2">
        {isPlaying && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={isPaused ? resume : pause}
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={stop}
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
