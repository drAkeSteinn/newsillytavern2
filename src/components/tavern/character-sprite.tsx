'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Maximize2, 
  RotateCcw,
  Settings,
  Lock,
  LockOpen,
  Timer,
  X,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SpriteState, CharacterCard, SpritePackV2, StateCollectionV2 } from '@/types';
import { SpritePreview } from './sprite-preview';
import { useTavernStore } from '@/store';
import { createDefaultCharacterState } from '@/store/slices/spriteSlice';

interface SpriteSettings {
  x: number;        // percentage (0-100) - horizontal position
  y: number;        // percentage (0-100) - vertical position from bottom (0 = bottom)
  width: number;    // percentage (10-80)
  height: number;   // percentage (10-90)
  opacity: number;  // 0-1
}

interface CharacterSpriteProps {
  characterId: string;
  characterName: string;
  avatarUrl: string;
  character?: CharacterCard;    // Full character data for V2 system
  isStreaming?: boolean;         // Is the character currently generating?
  hasContent?: boolean;          // Is there streaming content? (for thinking vs talk)
  isTTSPlaying?: boolean;        // Is TTS currently playing for this character?
  onSettingsChange?: (settings: SpriteSettings) => void;
}

const DEFAULT_SPRITE_SETTINGS: SpriteSettings = {
  x: 50,           // center horizontally
  y: 0,            // at bottom (0 = bottom, higher values = higher up)
  width: 35,       // 35% of screen width
  height: 70,      // 70% of screen height
  opacity: 0.9
};

// ============================================
// Sprite List Rotation Tracker
// Tracks rotation indices per character per state
// Avoids modifying character data (no persistence noise)
// ============================================
const _spriteRotationIndex = new Map<string, Map<SpriteState, number>>();

function getRotationIndex(characterId: string, state: SpriteState): number {
  let charMap = _spriteRotationIndex.get(characterId);
  if (!charMap) {
    charMap = new Map<SpriteState, number>();
    _spriteRotationIndex.set(characterId, charMap);
  }
  return charMap.get(state) ?? 0;
}

function advanceRotationIndex(characterId: string, state: SpriteState): number {
  let charMap = _spriteRotationIndex.get(characterId);
  if (!charMap) {
    charMap = new Map<SpriteState, number>();
    _spriteRotationIndex.set(characterId, charMap);
  }
  const current = charMap.get(state) ?? 0;
  const next = current + 1;
  charMap.set(state, next);
  return next;
}

// Get sprite from State Collection V2 (uses sprite packs)
function getSpriteFromStateCollectionV2(
  state: SpriteState,
  stateCollectionsV2: StateCollectionV2[],
  spritePacksV2: SpritePackV2[],
  characterId: string
): { url: string | null; label: string | null } {
  const stateCollection = stateCollectionsV2.find(c => c.state === state);
  if (!stateCollection) return { url: null, label: null };
  
  const pack = spritePacksV2.find(p => p.id === stateCollection.packId);
  if (!pack || pack.sprites.length === 0) return { url: null, label: null };
  
  switch (stateCollection.behavior) {
    case 'principal':
      // Use principal sprite if specified, otherwise first sprite
      if (stateCollection.principalSpriteId) {
        const principal = pack.sprites.find(s => s.id === stateCollection.principalSpriteId);
        if (principal) return { url: principal.url, label: principal.label };
      }
      return { url: pack.sprites[0].url, label: pack.sprites[0].label };
    
    case 'random':
      // Random selection
      const randomIndex = Math.floor(Math.random() * pack.sprites.length);
      const randomSprite = pack.sprites[randomIndex];
      return { url: randomSprite.url, label: randomSprite.label };
    
    case 'list': {
      // Rotate through sprites using the rotation tracker
      const index = getRotationIndex(characterId, state);
      const safeIndex = index % pack.sprites.length;
      const listSprite = pack.sprites[safeIndex];
      return { url: listSprite.url, label: listSprite.label };
    }
    
    default:
      return { url: pack.sprites[0].url, label: pack.sprites[0].label };
  }
}

// Get the appropriate sprite URL based on state and config
// Priority: V2 State Collections > Avatar (legacy system removed)
function getSpriteUrl(
  state: SpriteState,
  avatarUrl?: string,
  character?: CharacterCard,
  characterId?: string
): { url: string; label: string | null } {
  const charId = characterId || '';
  // Try V2 state collections (new system)
  // Check for non-empty arrays (empty arrays should not be considered as "configured")
  const hasV2Collections = character?.stateCollectionsV2 && character.stateCollectionsV2.length > 0;
  const hasV2Packs = character?.spritePacksV2 && character.spritePacksV2.length > 0;
  
  if (hasV2Collections && hasV2Packs) {
    const v2Result = getSpriteFromStateCollectionV2(
      state,
      character.stateCollectionsV2,
      character.spritePacksV2,
      charId
    );
    if (v2Result.url) {
      return v2Result;
    }
  }

  // Additional fallback for talk and thinking states - try V2 idle collection
  if (state === 'talk' || state === 'thinking') {
    if (hasV2Collections && hasV2Packs) {
      const v2IdleResult = getSpriteFromStateCollectionV2(
        'idle',
        character!.stateCollectionsV2,
        character!.spritePacksV2,
        charId
      );
      if (v2IdleResult.url) {
        return v2IdleResult;
      }
    }
  }

  // Final fallback to avatar
  if (avatarUrl) {
    return { url: avatarUrl, label: 'avatar' };
  }

  return { url: '', label: null };
}

// Format milliseconds to readable time
function formatTime(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function CharacterSprite({ 
  characterId, 
  characterName, 
  avatarUrl,
  character,
  isStreaming = false,
  hasContent = false,
  isTTSPlaying = false,
  onSettingsChange 
}: CharacterSpriteProps) {
  const [settings, setSettings] = useState<SpriteSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`sprite-${characterId}`);
      if (saved) {
        try {
          return { ...DEFAULT_SPRITE_SETTINGS, ...JSON.parse(saved) };
        } catch {
          return DEFAULT_SPRITE_SETTINGS;
        }
      }
    }
    return DEFAULT_SPRITE_SETTINGS;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  
  const spriteRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, settingsX: 0, settingsY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // ============================================
  // UNIFIED SYSTEM: Get sprite state from store
  // ============================================
  // 
  // ⚠️ SPRITE PRIORITY SYSTEM - DO NOT MODIFY ⚠️
  // 
  // The sprite system follows a STRICT priority order:
  // 
  // 1. TRIGGER SPRITE (HIGHEST PRIORITY)
  //    - Activated by sprite triggers from AI response
  //    - Once active, CANNOT be overridden by talk/thinking/idle
  //    - Only changes when:
  //      a) Timer expires (returnToIdleMs > 0)
  //      b) Another trigger replaces it
  //      c) User manually clears it
  //
  // 2. STATE COLLECTION V2 SPRITES
  //    - Talk sprite (streaming with content)
  //    - Thinking sprite (generating without content)
  //    - Idle sprite (default state)
  //    - Only shown when NO trigger sprite is active
  //
  // 3. AVATAR (lowest priority)
  //    - Character avatar as final fallback
  //
  // See: /docs/SPRITE_PRIORITY_SYSTEM.md
  //
  // Use proper Zustand selectors to ensure reactivity
  const characterSpriteStates = useTavernStore((state) => state.characterSpriteStates);
  const isLocked = useTavernStore((state) => state.spriteLock.active);
  const lockState = useTavernStore((state) => state.spriteLock);
  const getReturnToIdleCountdownForCharacter = useTavernStore((state) => state.getReturnToIdleCountdownForCharacter);
  const cancelReturnToIdleForCharacter = useTavernStore((state) => state.cancelReturnToIdleForCharacter);
  const executeReturnToIdleForCharacter = useTavernStore((state) => state.executeReturnToIdleForCharacter);
  const clearSpriteLock = useTavernStore((state) => state.clearSpriteLock);
  const setSpriteStateForCharacter = useTavernStore((state) => state.setSpriteStateForCharacter);
  const setDisplaySpriteUrl = useTavernStore((state) => state.setDisplaySpriteUrl);
  
  // Get per-character sprite state from the unified store
  // This is now reactive because characterSpriteStates is a proper selector
  const charSpriteState = characterSpriteStates[characterId] || createDefaultCharacterState();
  
  // Debug logging for trigger sprite state
  useEffect(() => {
    if (charSpriteState.triggerSpriteUrl) {
      console.log('[CharacterSprite] Trigger sprite active:', {
        characterId,
        triggerSpriteUrl: charSpriteState.triggerSpriteUrl,
        triggerSpriteLabel: charSpriteState.triggerSpriteLabel,
        isStreaming,
        hasContent,
      });
    }
  }, [charSpriteState.triggerSpriteUrl, charSpriteState.triggerSpriteLabel, characterId, isStreaming, hasContent]);
  
  // Check if sprite is locked (global state)
  const spriteLockActive = isLocked && lockState.until === 0 ? true : (isLocked && Date.now() < lockState.until);
  
  // Get return to idle state for this character
  const isReturnToIdleScheduled = charSpriteState.returnToIdle.active;
  
  // Determine the effective sprite state:
  // Priority: Trigger sprite > TTS Talk > Streaming Thinking > Store State
  // 
  // When TTS is active:
  //   - During streaming → 'thinking' (not talk, since the character is "thinking" while generating)
  //   - During TTS playback → 'talk' (the character is "speaking")
  //   - After TTS ends → 'idle'
  // 
  // If a trigger sprite is active, it always takes absolute priority.
  const effectiveSpriteState = charSpriteState.triggerSpriteUrl
    ? 'idle' // Trigger active, use trigger sprite (handled below)
    : isTTSPlaying
      ? 'talk'                    // TTS is playing → character is speaking
      : isStreaming
        ? 'thinking'               // Generating → thinking (not talk, even with content)
        : charSpriteState.spriteState;

  // ============================================
  // LIST MODE ROTATION: Advance index on state transition
  // When effectiveSpriteState transitions to 'talk' or 'thinking',
  // advance the rotation index so the NEXT sprite in the list is shown.
  // ============================================
  const prevEffectiveStateRef = useRef<SpriteState>(effectiveSpriteState);
  useEffect(() => {
    const prev = prevEffectiveStateRef.current;
    prevEffectiveStateRef.current = effectiveSpriteState;

    // Only advance when transitioning INTO talk or thinking (not from one to the other)
    if (prev !== 'talk' && prev !== 'thinking' && 
        (effectiveSpriteState === 'talk' || effectiveSpriteState === 'thinking')) {
      // Check if the target state collection uses 'list' behavior
      const stateCollections = character?.stateCollectionsV2;
      const collection = stateCollections?.find(c => c.state === effectiveSpriteState);
      if (collection?.behavior === 'list') {
        advanceRotationIndex(characterId, effectiveSpriteState);
      }
    }
  }, [effectiveSpriteState, character?.stateCollectionsV2, characterId]);

  // ============================================
  // TTS ↔ SPRITE STATE SYNC
  // When TTS playback ends, return the sprite to idle state
  // (only if no trigger is active and not currently streaming)
  // ============================================
  const prevTTSToStateRef = useRef(isTTSPlaying);
  useEffect(() => {
    const wasPlaying = prevTTSToStateRef.current;
    prevTTSToStateRef.current = isTTSPlaying;

    // TTS just stopped playing → return to idle
    if (wasPlaying && !isTTSPlaying && !isStreaming) {
      const currentState = characterSpriteStates[characterId];
      // Only update if no trigger is active (trigger has absolute priority)
      if (currentState && !currentState.triggerSpriteUrl) {
        setSpriteStateForCharacter(characterId, 'idle');
      }
    }
  }, [isTTSPlaying, isStreaming, characterId, characterSpriteStates, setSpriteStateForCharacter]);

  // Update countdown for return to idle
  useEffect(() => {
    if (!isReturnToIdleScheduled) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = getReturnToIdleCountdownForCharacter(characterId);
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [isReturnToIdleScheduled, getReturnToIdleCountdownForCharacter, characterId]);

  // Determine the current sprite URL
  // PRIORITY:
  // 1. Trigger sprite from store (highest priority)
  // 2. State collection V2 (if available)
  // 3. Avatar (lowest priority)
  const spriteResult = charSpriteState.triggerSpriteUrl 
    ? { url: charSpriteState.triggerSpriteUrl, label: charSpriteState.triggerSpriteLabel }
    : getSpriteUrl(
        effectiveSpriteState,
        avatarUrl,
        character,
        characterId
      );
  const currentSpriteUrl = spriteResult.url;
  const currentSpriteLabel = spriteResult.label;

  // Report actual displayed sprite URL to store (for useTimelineSpriteSounds hook)
  useEffect(() => {
    setDisplaySpriteUrl(characterId, currentSpriteUrl || null);
  }, [characterId, currentSpriteUrl, setDisplaySpriteUrl]);

  // Debug: Log when sprite data changes
  useEffect(() => {
    console.log('[CharacterSprite] Sprite data:', {
      characterId,
      hasCharacter: !!character,
      spritePacksV2Count: character?.spritePacksV2?.length ?? 'undefined',
      stateCollectionsV2Count: character?.stateCollectionsV2?.length ?? 'undefined',
      currentSpriteUrl: currentSpriteUrl?.substring(0, 50),
      avatarUrl: avatarUrl?.substring(0, 50),
    });
  }, [characterId, character?.spritePacksV2, character?.stateCollectionsV2, currentSpriteUrl, avatarUrl]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(`sprite-${characterId}`, JSON.stringify(settings));
    onSettingsChange?.(settings);
  }, [settings, characterId, onSettingsChange]);

  // Drag handlers - click anywhere on sprite to drag
  const handleDragStart = (e: React.MouseEvent) => {
    // Don't start drag if clicking on controls
    if ((e.target as HTMLElement).closest('.sprite-controls')) return;
    if (isResizing) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      settingsX: settings.x,
      settingsY: settings.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      const container = spriteRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      // Calculate new position
      let newX = dragStartRef.current.settingsX + deltaX;
      // Invert deltaY because we use 'bottom' positioning
      // Dragging up (negative deltaY) should increase Y (move sprite up)
      let newY = dragStartRef.current.settingsY - deltaY;

      // Constrain X: sprite center must stay within screen
      const halfWidth = settings.width / 2;
      newX = Math.max(halfWidth, Math.min(100 - halfWidth, newX));

      // Constrain Y: sprite bottom must stay within screen
      // y = 0 means at bottom, higher values move it up
      // Maximum Y should not exceed (100 - height) to keep sprite visible
      const maxY = 100 - settings.height;
      newY = Math.max(0, Math.min(maxY, newY));

      setSettings(prev => ({ ...prev, x: newX, y: newY }));
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
  }, [isDragging, settings.width, settings.height]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: settings.width,
      height: settings.height
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      const container = spriteRef.current?.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;

      // Handle is in top-left corner, so:
      // - Dragging left (negative deltaX) increases width
      // - Dragging up (negative deltaY) increases height
      let newWidth = Math.max(10, Math.min(80, resizeStartRef.current.width - deltaX * 2));
      let newHeight = Math.max(10, Math.min(90, resizeStartRef.current.height - deltaY * 2));

      setSettings(prev => ({ 
        ...prev, 
        width: newWidth, 
        height: newHeight 
      }));
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
  }, [isResizing]);

  const updateSetting = (key: keyof SpriteSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SPRITE_SETTINGS);
  };

  // Sprite lock/unlock handlers
  const handleUnlockSprite = () => {
    clearSpriteLock();
  };

  const handleCancelReturnToIdle = () => {
    cancelReturnToIdleForCharacter(characterId);
  };

  const handleForceReturnToIdle = () => {
    executeReturnToIdleForCharacter(characterId);
  };

  // Calculate max Y based on height
  const maxY = Math.max(0, 100 - settings.height);

  return (
    <div
      ref={spriteRef}
      className={cn(
        "absolute select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: `${settings.x}%`,
        bottom: `${settings.y}%`,  // y=0 at bottom
        transform: 'translate(-50%, 0)',
        width: `${settings.width}%`,
        height: `${settings.height}%`,
        opacity: settings.opacity,
        zIndex: 5
      }}
      onMouseDown={handleDragStart}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isDragging && setShowControls(false)}
    >
      {/* The actual sprite image/video */}
      {currentSpriteUrl ? (
        <SpritePreview
          src={currentSpriteUrl}
          alt={characterName}
          className="w-full h-full drop-shadow-2xl select-none pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex items-end justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">
              {characterName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        </div>
      )}

      {/* Lock indicator badge */}
      {spriteLockActive && (
        <div className="sprite-controls absolute top-2 left-1/2 -translate-x-1/2 z-50">
          <Badge 
            variant="secondary" 
            className="bg-amber-500/90 text-white border-amber-400 gap-1.5 px-3 py-1 shadow-lg"
          >
            <Lock className="h-3 w-3" />
            <span className="text-xs font-medium">Locked</span>
            {lockState.until > 0 && (
              <span className="text-xs opacity-80">
                ({formatTime(lockState.until - Date.now())})
              </span>
            )}
          </Badge>
        </div>
      )}

      {/* Return to idle countdown badge */}
      {isReturnToIdleScheduled && countdown > 0 && (
        <div className={cn(
          "sprite-controls absolute top-2 left-1/2 -translate-x-1/2 z-50",
          spriteLockActive && "top-10" // Offset if lock badge is shown
        )}>
          <Badge 
            variant="secondary" 
            className="bg-blue-500/90 text-white border-blue-400 gap-1.5 px-3 py-1 shadow-lg"
          >
            <Timer className="h-3 w-3" />
            <span className="text-xs font-medium">→ Idle: {formatTime(countdown)}</span>
          </Badge>
        </div>
      )}

      {/* Controls overlay - only show on hover */}
      {showControls && !isDragging && (
        <div className="sprite-controls absolute top-2 right-2 z-50 flex flex-col gap-1"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          {/* Lock/Unlock button */}
          {spriteLockActive ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 bg-amber-500/80 hover:bg-amber-500 text-white"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={handleUnlockSprite}
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">Unlock Sprite</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}

          {/* Return to idle controls */}
          {isReturnToIdleScheduled && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 bg-red-500/80 hover:bg-red-500 text-white"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={handleCancelReturnToIdle}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">Cancel Return to Idle</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 bg-blue-500/80 hover:bg-blue-500 text-white"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={handleForceReturnToIdle}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">Return to Idle Now</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          {/* Settings button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Sprite Settings</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={resetSettings}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>

                {/* Lock status */}
                {spriteLockActive && (
                  <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Sprite Locked</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleUnlockSprite}
                      >
                        <LockOpen className="h-3 w-3 mr-1" />
                        Unlock
                      </Button>
                    </div>
                    {lockState.until > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires in {formatTime(lockState.until - Date.now())}
                      </p>
                    )}
                  </div>
                )}

                {/* Return to idle status */}
                {isReturnToIdleScheduled && (
                  <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Return to Idle</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleForceReturnToIdle}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleCancelReturnToIdle}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Returns in {formatTime(countdown)}
                    </p>
                  </div>
                )}

                {/* Size sliders */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Width</span>
                      <span className="text-muted-foreground">{Math.round(settings.width)}%</span>
                    </div>
                    <Slider
                      value={[settings.width]}
                      min={10}
                      max={80}
                      step={1}
                      onValueChange={([v]) => updateSetting('width', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Height</span>
                      <span className="text-muted-foreground">{Math.round(settings.height)}%</span>
                    </div>
                    <Slider
                      value={[settings.height]}
                      min={10}
                      max={90}
                      step={1}
                      onValueChange={([v]) => updateSetting('height', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Opacity</span>
                      <span className="text-muted-foreground">{Math.round(settings.opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[settings.opacity * 100]}
                      min={20}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateSetting('opacity', v / 100)}
                    />
                  </div>
                </div>

                {/* Position controls */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>X Position (Horizontal)</span>
                      <span className="text-muted-foreground">{Math.round(settings.x)}%</span>
                    </div>
                    <Slider
                      value={[settings.x]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateSetting('x', v)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Y Position (Vertical from bottom)</span>
                      <span className="text-muted-foreground">{Math.round(settings.y)}%</span>
                    </div>
                    <Slider
                      value={[settings.y]}
                      min={0}
                      max={maxY}
                      step={1}
                      onValueChange={([v]) => updateSetting('y', v)}
                    />
                  </div>
                </div>

                {/* Quick position buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 20 }))}
                  >
                    Left
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 50 }))}
                  >
                    Center
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSettings(prev => ({ ...prev, x: 80 }))}
                  >
                    Right
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  💡 Click and drag the sprite to move it anywhere.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Resize handle - top left corner */}
      {showControls && !isDragging && (
        <div
          className="sprite-controls absolute top-2 left-2 w-6 h-6 cursor-nwse-resize bg-background/80 backdrop-blur-sm rounded flex items-center justify-center hover:bg-background/90"
          onMouseDown={handleResizeStart}
          onMouseEnter={(e) => e.stopPropagation()}
        >
          <div className="w-3 h-3 border-l-2 border-t-2 border-muted-foreground" />
        </div>
      )}

      {/* Drag indicator border when hovering */}
      {showControls && !isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}
