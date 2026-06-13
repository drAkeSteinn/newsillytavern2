'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { SpriteTransitionConfig, SpriteTransitionDirection } from '@/types';

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

interface SpriteTransitionWrapperProps {
  src: string;
  alt: string;
  transition?: SpriteTransitionConfig;
  className?: string;
  videoClassName?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
}

// Preload helper - returns a promise that resolves when the asset is loaded
function preloadAsset(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (isVideoUrl(url)) {
      const video = document.createElement('video');
      video.src = url;
      video.oncanplay = () => resolve();
      video.onerror = () => resolve();
      video.load();
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });
}

/**
 * SpriteTransitionWrapper - Smooth CSS transitions between sprite changes
 * 
 * Uses a dual-layer approach:
 * - Two sprite layers stacked on top of each other
 * - When src changes:
 *   1. Preload the new sprite
 *   2. On preload complete, animate old sprite out and new sprite in
 *   3. After transition completes, clean up old layer
 * 
 * Supports: fade, slide, zoom, bounce, none
 */
export function SpriteTransitionWrapper({
  src,
  alt,
  transition,
  className,
  videoClassName,
  objectFit = 'contain',
}: SpriteTransitionWrapperProps) {
  // The "old" sprite that's being animated out during a transition
  const [outgoingSrc, setOutgoingSrc] = useState<string | null>(null);
  // The "new" sprite that's being animated in during a transition
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  // Whether incoming layer is visible (controls animation start)
  const [incomingVisible, setIncomingVisible] = useState(false);
  // Whether outgoing layer is fading out
  const [outgoingFading, setOutgoingFading] = useState(false);
  // Track which src we're currently transitioning to (to avoid race conditions)
  const pendingSrcRef = useRef<string | null>(null);
  // Timeout ref for cleanup
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last src we displayed (for the outgoing layer)
  const lastDisplayedRef = useRef(src);

  const type = transition?.type ?? 'none';
  const duration = transition?.duration ?? 300;
  const easing = transition?.easing ?? 'ease-in-out';
  const direction = transition?.direction ?? 'left';

  // Effect: When src changes and we have a transition, start the preload
  // All setState calls happen in async callbacks (preload promise, rAF, timeout)
  useEffect(() => {
    // Skip if no change or no transition
    if (src === lastDisplayedRef.current) return;
    if (type === 'none' || !transition) {
      // Just update the ref so next transition knows the current src
      lastDisplayedRef.current = src;
      return;
    }

    const oldSrc = lastDisplayedRef.current;
    const newSrc = src;
    pendingSrcRef.current = newSrc;

    // Clear any pending cleanup
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    let cancelled = false;

    // Start preload - all state updates happen in the async callback
    preloadAsset(newSrc).then(() => {
      if (cancelled || pendingSrcRef.current !== newSrc) return;

      // Set up the dual-layer transition
      setOutgoingSrc(oldSrc);
      setIncomingSrc(newSrc);
      setIncomingVisible(false);
      setOutgoingFading(false);
      lastDisplayedRef.current = newSrc;

      // Trigger animation after DOM has updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || pendingSrcRef.current !== newSrc) return;
          setIncomingVisible(true);
          setOutgoingFading(true);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [src, type, transition, duration, easing, direction]);

  // Effect: Clean up after transition completes
  // setState is in a setTimeout callback (async), which is allowed
  useEffect(() => {
    if (!outgoingFading) return;

    const timer = setTimeout(() => {
      setOutgoingSrc(null);
      setIncomingSrc(null);
      setIncomingVisible(false);
      setOutgoingFading(false);
      pendingSrcRef.current = null;
    }, duration + 50);

    cleanupTimerRef.current = timer;

    return () => {
      clearTimeout(timer);
      cleanupTimerRef.current = null;
    };
  }, [outgoingFading, duration]);

  // Build inline styles for transitions
  const transitionStyle: React.CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: easing,
  };

  const getSlideTranslate = (dir: SpriteTransitionDirection, value: string = '100%'): string => {
    switch (dir) {
      case 'left': return `translateX(-${value})`;
      case 'right': return `translateX(${value})`;
      case 'up': return `translateY(-${value})`;
      case 'down': return `translateY(${value})`;
    }
  };

  const getSlideOppositeTranslate = (dir: SpriteTransitionDirection, value: string = '100%'): string => {
    switch (dir) {
      case 'left': return `translateX(${value})`;
      case 'right': return `translateX(-${value})`;
      case 'up': return `translateY(${value})`;
      case 'down': return `translateY(-${value})`;
    }
  };

  const getOutgoingStyle = (): React.CSSProperties => {
    if (!outgoingFading) return {};

    switch (type) {
      case 'fade':
        return { ...transitionStyle, opacity: 0 };
      case 'slide':
        return { ...transitionStyle, transform: getSlideTranslate(direction) };
      case 'zoom':
        return { ...transitionStyle, opacity: 0, transform: 'scale(1.2)' };
      case 'bounce':
        return { ...transitionStyle, opacity: 0 };
      default:
        return {};
    }
  };

  const getIncomingStyle = (): React.CSSProperties => {
    if (!incomingVisible) {
      switch (type) {
        case 'fade':
          return { opacity: 0 };
        case 'slide':
          return { transform: getSlideOppositeTranslate(direction) };
        case 'zoom':
          return { opacity: 0, transform: 'scale(0.8)' };
        case 'bounce':
          return { opacity: 0, transform: 'scale(0.5)' };
        default:
          return {};
      }
    }

    switch (type) {
      case 'fade':
        return { ...transitionStyle, opacity: 1 };
      case 'slide':
        return { ...transitionStyle, transform: 'translate(0, 0)' };
      case 'zoom':
        return { ...transitionStyle, opacity: 1, transform: 'scale(1)' };
      case 'bounce':
        return { ...transitionStyle, opacity: 1, transform: 'scale(1)', animation: `sprite-bounce-in ${duration}ms ${easing}` };
      default:
        return {};
    }
  };

  const objectFitClass = {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill',
  }[objectFit];

  const renderSprite = (spriteSrc: string, style: React.CSSProperties) => {
    if (isVideoUrl(spriteSrc)) {
      return (
        <video
          src={spriteSrc}
          className={cn(objectFitClass, 'object-bottom', className, videoClassName)}
          style={style}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          controls={false}
        />
      );
    }
    return (
      <img
        src={spriteSrc}
        alt={alt}
        className={cn(objectFitClass, 'object-bottom', className)}
        style={style}
        draggable={false}
      />
    );
  };

  // If no transition or type is 'none', just render directly from props
  if (type === 'none' || !transition) {
    if (!src) return null;
    return renderSprite(src, {});
  }

  if (!src) return null;

  // Check if a transition is in progress
  const isTransitioning = outgoingSrc !== null || incomingSrc !== null;

  if (!isTransitioning) {
    return renderSprite(src, {});
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {outgoingSrc && (
        <div className="absolute inset-0" style={getOutgoingStyle()}>
          {renderSprite(outgoingSrc, {})}
        </div>
      )}
      {incomingSrc && (
        <div className="absolute inset-0" style={getIncomingStyle()}>
          {renderSprite(incomingSrc, {})}
        </div>
      )}
    </div>
  );
}
