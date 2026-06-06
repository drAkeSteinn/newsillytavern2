// ============================================
// Comic Sound Overlay (v6) - Displays manga-style visual effects when sounds play
// ============================================
//
// v6: Fixed animation flickering caused by React re-rendering existing effects
// when new ones are added. The root cause was that setEffects() triggered a
// re-render of ALL effect items, and dangerouslySetInnerHTML would re-apply
// innerHTML, destroying running CSS animations.
//
// Fixes applied:
// - Bug #1 (v5): Double-removal race condition in addEffect → single atomic update
// - Bug #2 (v4): SVG filter ID collisions → instance-unique IDs
// - Bug #3 (v5): Re-subscription instability → ref pattern
// - Bug #4 (v6): Animation restart on re-render → React.memo + ref-based innerHTML
// - Bug #5 (v6): Duration from parent state → stored in effect object at creation
// - Bug #6 (v6): Inline style objects recreated each render → memoized per effect

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import {
  subscribeToComicSound,
  type ComicSoundEvent,
} from '@/lib/comic-sound-bus';
import {
  ComicSoundTemplate,
  getRandomTemplateType,
  getRandomScale,
  autoSelectPreset,
} from './comic-sound-templates';
import { DEFAULT_COMIC_SOUND_SETTINGS } from '@/types';
import type { ComicTemplateType } from '@/types';

// ============================================
// Active Sound Effect State
// ============================================

interface ActiveSoundEffect {
  id: string;
  /** Display text for the sound effect */
  displayText: string;
  templateType: ComicTemplateType;
  scale: number;
  /** Position as percentage of container (0-100), using top-based coordinates */
  x: number;
  y: number;
  /** Rotation in degrees */
  rotation: number;
  /** Duration captured at effect creation time (from settings) */
  duration: number;
  /** When the effect was created */
  createdAt: number;
}

// ============================================
// Sprite Position Helpers
// ============================================

/**
 * Cache sprite positions to avoid calling getBoundingClientRect()
 * during animation frames, which forces synchronous layout reflow
 * and can interrupt running CSS animations.
 */
const spritePositionCache = new Map<string, { x: number; y: number; timestamp: number }>();
const SPRITE_CACHE_TTL = 500; // ms — cache for half a second

function getSpritePositionCached(
  characterId: string,
  overlayContainer: HTMLElement | null
): { x: number; y: number } | null {
  if (!overlayContainer) return null;

  const cacheKey = characterId || '__any__';
  const cached = spritePositionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SPRITE_CACHE_TTL) {
    return cached;
  }

  // Find the sprite element
  const spriteEl = characterId
    ? document.querySelector(`[data-character-id="${characterId}"]`) as HTMLElement
    : document.querySelector('[data-character-id]') as HTMLElement;

  if (!spriteEl) return cached || null; // Return stale cache if sprite gone

  const containerRect = overlayContainer.getBoundingClientRect();
  const spriteRect = spriteEl.getBoundingClientRect();

  const spriteCenterX = ((spriteRect.left + spriteRect.width / 2 - containerRect.left) / containerRect.width) * 100;
  const spriteTopY = ((spriteRect.top - containerRect.top) / containerRect.height) * 100;
  const spriteHeightPct = (spriteRect.height / containerRect.height) * 100;
  const spriteUpperBodyY = spriteTopY + spriteHeightPct * 0.38;

  const pos = { x: spriteCenterX, y: spriteUpperBodyY, timestamp: Date.now() };
  spritePositionCache.set(cacheKey, pos);
  return pos;
}

/**
 * Add a controlled random offset to a position.
 */
function addControlledRandomness(
  base: { x: number; y: number },
  offsetX: number = 8,
  offsetY: number = 6
): { x: number; y: number } {
  return {
    x: base.x + (Math.random() - 0.5) * 2 * offsetX,
    y: base.y + (Math.random() - 0.5) * 2 * offsetY,
  };
}

/**
 * Clamp a position to stay within the visible container area.
 */
function clampPosition(pos: { x: number; y: number }, margin: number = 10): { x: number; y: number } {
  return {
    x: Math.max(margin, Math.min(100 - margin, pos.x)),
    y: Math.max(margin, Math.min(100 - margin, pos.y)),
  };
}

function getRandomRotation(): number {
  return -12 + Math.random() * 24;
}

function getFallbackPosition(): { x: number; y: number } {
  return {
    x: 35 + Math.random() * 30,
    y: 30 + Math.random() * 25,
  };
}

// ============================================
// Memoized Effect Item Component
// ============================================

/**
 * Individual effect item wrapped in React.memo.
 * Since all props are primitive values (strings, numbers) that don't change
 * after creation, this component will NEVER re-render after initial mount.
 * Combined with ComicSoundTemplate's ref-based innerHTML, this ensures
 * CSS animations run uninterrupted even when new effects are added.
 */
const ComicEffectItem = React.memo(function ComicEffectItem({
  displayText,
  templateType,
  scale,
  x,
  y,
  rotation,
  duration,
  instanceId,
}: {
  displayText: string;
  templateType: ComicTemplateType;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  duration: number;
  instanceId: string;
}) {
  // Memoize the positioning style — it never changes after creation
  const positionStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    // Isolate this element's layout from siblings
    contain: 'layout style',
  }), [x, y, rotation]);

  return (
    <div style={positionStyle}>
      <ComicSoundTemplate
        text={displayText}
        templateType={templateType}
        scale={scale}
        duration={duration}
        instanceId={instanceId}
      />
    </div>
  );
});

// ============================================
// Main Overlay Component
// ============================================

export function ComicSoundOverlay() {
  const [effects, setEffects] = useState<ActiveSoundEffect[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const comicSettings = useTavernStore(state => state.settings.comicSound) ?? DEFAULT_COMIC_SOUND_SETTINGS;

  const duration = comicSettings.duration;
  const maxEffects = comicSettings.maxEffects;
  const minScale = comicSettings.minScale;
  const maxScale = comicSettings.maxScale;
  const allowedTemplates = comicSettings.allowedTemplates;

  // Clean effect removal
  const removeEffect = useCallback((id: string) => {
    setEffects(prev => prev.filter(e => e.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Add effect with single atomic state update
  const addEffect = useCallback((event: ComicSoundEvent) => {
    if (!comicSettings.enabled) return;

    const displayText = event.triggerName || event.keyword;
    const templateType = allowedTemplates.length > 0
      ? getRandomTemplateType(allowedTemplates)
      : autoSelectPreset(displayText);

    // Use cached sprite position to avoid getBoundingClientRect during animations
    let basePos = getSpritePositionCached(event.characterId || '', containerRef.current);

    // If no characterId-specific position, try any sprite
    if (!basePos && event.characterId) {
      basePos = getSpritePositionCached('', containerRef.current);
    }

    let pos: { x: number; y: number };
    if (basePos) {
      pos = clampPosition(addControlledRandomness(basePos));
    } else {
      pos = getFallbackPosition();
    }

    const newEffect: ActiveSoundEffect = {
      id: event.id,
      displayText,
      templateType,
      scale: getRandomScale(minScale, maxScale),
      x: pos.x,
      y: pos.y,
      rotation: getRandomRotation(),
      duration, // Capture duration at creation time
      createdAt: Date.now(),
    };

    // Single atomic state update
    setEffects(prev => {
      let current = [...prev];

      // If at max capacity, remove the oldest in this same update
      if (current.length >= maxEffects) {
        const removed = current.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
      }

      return [...current, newEffect];
    });

    // Remove from DOM after the SVG animation completes
    const removeTimer = setTimeout(() => {
      removeEffect(event.id);
    }, duration + 200);

    timersRef.current.set(event.id, removeTimer);
  }, [comicSettings.enabled, maxEffects, duration, minScale, maxScale, allowedTemplates, removeEffect]);

  // Stable subscription via ref pattern
  const addEffectRef = useRef(addEffect);
  useEffect(() => {
    addEffectRef.current = addEffect;
  }, [addEffect]);

  useEffect(() => {
    const unsubscribe = subscribeToComicSound((event) => addEffectRef.current(event));
    return () => {
      unsubscribe();
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  // Periodic cleanup for stale effects (safety net)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setEffects(prev => {
        // Use each effect's own duration for lifetime calculation
        const cleaned = prev.filter(e => {
          const maxLifetime = e.duration + 500;
          const age = now - e.createdAt;
          return age <= maxLifetime;
        });
        if (cleaned.length === prev.length) return prev;

        // Clean up timers for removed effects
        const removedIds = new Set(prev.map(e => e.id).filter(id => !cleaned.some(c => c.id === id)));
        removedIds.forEach(id => {
          const timer = timersRef.current.get(id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
          }
        });

        return cleaned;
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Don't render if disabled
  if (!comicSettings.enabled) return null;
  if (effects.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 12 }}
    >
      {effects.map((effect) => (
        <ComicEffectItem
          key={effect.id}
          displayText={effect.displayText}
          templateType={effect.templateType}
          scale={effect.scale}
          x={effect.x}
          y={effect.y}
          rotation={effect.rotation}
          duration={effect.duration}
          instanceId={effect.id}
        />
      ))}
    </div>
  );
}
