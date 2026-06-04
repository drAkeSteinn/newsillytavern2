// ============================================
// Comic Sound Overlay (v4) - Displays manga-style visual effects when sounds play
// ============================================
//
// v4: Effects now appear NEAR the character sprite that triggered them.
// - Uses data-character-id to locate sprite elements in the DOM
// - Falls back to the active sprite if no characterId is provided
// - Small random offset so effects don't stack exactly on top of each other
// - Effect appears at ~40% from the top of the sprite (head/upper body area)

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  event: ComicSoundEvent;
  templateType: ComicTemplateType;
  scale: number;
  /** Position as percentage of container (0-100), using top-based coordinates */
  x: number;
  y: number;
  /** Rotation in degrees */
  rotation: number;
  /** When the effect was created */
  createdAt: number;
}

// ============================================
// Sprite Position Helpers
// ============================================

/**
 * Find the position of a character's sprite element relative to the overlay container.
 * Returns the center of the sprite's upper body area (about 35-45% from top of sprite).
 *
 * The sprites use `bottom: Y%` and `left: X%` positioning with `transform: translate(-50%, 0)`.
 * The overlay uses `top: Y%` and `left: X%` positioning.
 * We use getBoundingClientRect() for accurate cross-system positioning.
 */
function getSpritePosition(
  characterId: string,
  overlayContainer: HTMLElement | null
): { x: number; y: number } | null {
  // Find the sprite element by its data-character-id attribute
  const spriteEl = document.querySelector(`[data-character-id="${characterId}"]`) as HTMLElement;
  if (!spriteEl || !overlayContainer) return null;

  const containerRect = overlayContainer.getBoundingClientRect();
  const spriteRect = spriteEl.getBoundingClientRect();

  // Calculate center of sprite relative to container (in percentages)
  const spriteCenterX = ((spriteRect.left + spriteRect.width / 2 - containerRect.left) / containerRect.width) * 100;
  
  // Position at ~40% from the top of the sprite (upper body / head area)
  const spriteTopY = ((spriteRect.top - containerRect.top) / containerRect.height) * 100;
  const spriteHeightPct = (spriteRect.height / containerRect.height) * 100;
  const spriteUpperBodyY = spriteTopY + spriteHeightPct * 0.38;

  return { x: spriteCenterX, y: spriteUpperBodyY };
}

/**
 * Find position for ANY visible sprite when no characterId is available.
 * Looks for the first sprite element with data-character-id.
 */
function getAnySpritePosition(
  overlayContainer: HTMLElement | null
): { x: number; y: number } | null {
  const spriteEl = document.querySelector('[data-character-id]') as HTMLElement;
  if (!spriteEl || !overlayContainer) return null;

  const containerRect = overlayContainer.getBoundingClientRect();
  const spriteRect = spriteEl.getBoundingClientRect();

  const spriteCenterX = ((spriteRect.left + spriteRect.width / 2 - containerRect.left) / containerRect.width) * 100;
  const spriteTopY = ((spriteRect.top - containerRect.top) / containerRect.height) * 100;
  const spriteHeightPct = (spriteRect.height / containerRect.height) * 100;
  const spriteUpperBodyY = spriteTopY + spriteHeightPct * 0.38;

  return { x: spriteCenterX, y: spriteUpperBodyY };
}

/**
 * Add a controlled random offset to a position.
 * The offset is small enough to keep the effect near the sprite,
 * but varied enough to prevent stacking in the exact same spot.
 *
 * @param base - Base position in percentage (0-100)
 * @param offsetX - Max horizontal offset in percentage (default: 8%)
 * @param offsetY - Max vertical offset in percentage (default: 6%)
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
  return -12 + Math.random() * 24; // -12 to +12 degrees (slightly tighter than before)
}

/**
 * Fallback position when no sprite is found at all.
 * Places effect in a reasonable area (center-ish, not at the edges).
 */
function getFallbackPosition(): { x: number; y: number } {
  const x = 35 + Math.random() * 30; // 35-65%
  const y = 30 + Math.random() * 25; // 30-55%
  return { x, y };
}

// ============================================
// Component
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

  const removeEffect = useCallback((id: string) => {
    setEffects(prev => prev.filter(e => e.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addEffect = useCallback((event: ComicSoundEvent) => {
    if (!comicSettings.enabled) return;

    const displayText = event.triggerName || event.keyword;
    // Auto-select the best preset, or use random from allowed list
    const templateType = allowedTemplates.length > 0
      ? getRandomTemplateType(allowedTemplates)
      : autoSelectPreset(displayText);

    // ========================================
    // POSITIONING: Near the character sprite
    // ========================================
    // Strategy:
    // 1. If event has characterId → find that sprite's position
    // 2. If no characterId → find any visible sprite (active character)
    // 3. If no sprite found at all → fallback to center-ish area
    // 4. Always add small random offset to prevent stacking
    let basePos: { x: number; y: number } | null = null;

    if (event.characterId) {
      basePos = getSpritePosition(event.characterId, containerRef.current);
    }
    
    if (!basePos) {
      basePos = getAnySpritePosition(containerRef.current);
    }

    let pos: { x: number; y: number };
    if (basePos) {
      // Add controlled randomness near the sprite position
      pos = clampPosition(addControlledRandomness(basePos));
    } else {
      // Fallback: no sprite found
      pos = getFallbackPosition();
    }

    const newEffect: ActiveSoundEffect = {
      id: event.id,
      event,
      templateType,
      scale: getRandomScale(minScale, maxScale),
      x: pos.x,
      y: pos.y,
      rotation: getRandomRotation(),
      createdAt: Date.now(),
    };

    setEffects(prev => {
      const current = [...prev];
      if (current.length >= maxEffects) {
        const oldest = current[0];
        if (oldest) {
          removeEffect(oldest.id);
        }
        current.shift();
      }
      return [...current, newEffect];
    });

    // Remove from DOM after the SVG animation completes (duration + small buffer)
    const removeTimer = setTimeout(() => {
      removeEffect(event.id);
    }, duration + 200);

    timersRef.current.set(event.id, removeTimer);

    console.log(`[ComicSoundOverlay] Effect: "${displayText}" (${templateType}) at (${pos.x.toFixed(0)}%, ${pos.y.toFixed(0)}%)${event.characterId ? ` near sprite "${event.characterId}"` : ' (any sprite)'}`);
  }, [removeEffect, comicSettings.enabled, maxEffects, duration, minScale, maxScale, allowedTemplates]);

  // Subscribe to comic sound events
  useEffect(() => {
    const unsubscribe = subscribeToComicSound(addEffect);
    return () => {
      unsubscribe();
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [addEffect]);

  // Periodic cleanup for stale effects
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const maxLifetime = duration + 500;

      setEffects(prev => prev.filter(e => {
        const age = now - e.createdAt;
        return age <= maxLifetime;
      }));
    }, 300);

    return () => clearInterval(interval);
  }, [duration]);

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
        <div
          key={effect.id}
          style={{
            position: 'absolute',
            left: `${effect.x}%`,
            top: `${effect.y}%`,
            transform: `translate(-50%, -50%) rotate(${effect.rotation}deg)`,
          }}
        >
          <ComicSoundTemplate
            text={effect.event.triggerName || effect.event.keyword}
            templateType={effect.templateType}
            scale={effect.scale}
            duration={duration}
          />
        </div>
      ))}
    </div>
  );
}
