'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { BackgroundFit } from '@/types';

interface BackgroundLayerProps {
  src: string | null;
  fit?: BackgroundFit;
  className?: string;
  overlay?: boolean;
  blur?: boolean;
  transitionDuration?: number;
}

export function BackgroundLayer({ 
  src, 
  fit = 'cover',
  className, 
  overlay = true, 
  blur = false,
  transitionDuration = 500
}: BackgroundLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if the source is a video
  const isVideo = src ? /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(src) : false;

  // Auto-play video when mounted
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's okay
      });
    }
  }, [isVideo, src]);

  if (!src) {
    return null;
  }

  // Get the object-fit class based on the fit mode
  const getObjectFitClass = () => {
    switch (fit) {
      case 'contain':
        return 'object-contain';
      case 'stretch':
        return 'object-fill';
      case 'cover':
      default:
        return 'object-cover';
    }
  };

  return (
    <div 
      className={cn("absolute inset-0 overflow-hidden bg-black z-0", className)}
      style={{ transition: `opacity ${transitionDuration}ms ease-in-out` }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={src}
          className={cn("absolute inset-0 w-full h-full", getObjectFitClass())}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          src={src}
          alt="Background"
          className={cn("absolute inset-0 w-full h-full", getObjectFitClass())}
        />
      )}

      {/* Overlay for readability */}
      {overlay && (
        <div className={cn(
          "absolute inset-0 bg-background/40",
          blur && "backdrop-blur-[2px]"
        )} />
      )}
    </div>
  );
}

// Overlay Layer component for back/front overlays
interface OverlayLayerProps {
  src: string | null;
  placement: 'back' | 'front';
  zIndex?: number;
  transitionDuration?: number;
}

export function OverlayLayer({ 
  src, 
  placement,
  zIndex,
  transitionDuration = 500
}: OverlayLayerProps) {
  if (!src) return null;
  
  // Default z-index based on placement
  const defaultZIndex = placement === 'back' ? 5 : 15;
  const actualZIndex = zIndex ?? defaultZIndex;
  
  const isVideo = /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(src);
  
  return (
    <div 
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ 
        zIndex: actualZIndex,
        transition: `opacity ${transitionDuration}ms ease-in-out`
      }}
    >
      {isVideo ? (
        <video
          src={src}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          src={src}
          alt={`${placement} overlay`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}

// Combined Background with Overlays
interface BackgroundWithOverlaysProps {
  background: string | null;
  overlayBack?: string | null;
  overlayFront?: string | null;
  fit?: BackgroundFit;
  overlay?: boolean;
  blur?: boolean;
  transitionDuration?: number;
}

export function BackgroundWithOverlays({
  background,
  overlayBack,
  overlayFront,
  fit = 'cover',
  overlay = true,
  blur = false,
  transitionDuration = 500
}: BackgroundWithOverlaysProps) {
  return (
    <>
      {/* Main background - z-index 0 */}
      <BackgroundLayer 
        src={background} 
        fit={fit} 
        overlay={false}
        transitionDuration={transitionDuration}
      />
      
      {/* Back overlay (behind sprites) - z-index 5 */}
      <OverlayLayer 
        src={overlayBack || null} 
        placement="back" 
        transitionDuration={transitionDuration}
      />
      
      {/* Front overlay (in front of sprites) - z-index 15 */}
      <OverlayLayer 
        src={overlayFront || null} 
        placement="front"
        transitionDuration={transitionDuration}
      />
      
      {/* UI overlay for readability */}
      {overlay && (
        <div 
          className={cn(
            "absolute inset-0 bg-background/40 z-20 pointer-events-none",
            blur && "backdrop-blur-[2px]"
          )}
          style={{ transition: `opacity ${transitionDuration}ms ease-in-out` }}
        />
      )}
    </>
  );
}

export default BackgroundLayer;
