'use client';

import { useEffect, useState } from 'react';
import type { AtmosphereLayer } from '@/types';

// ============================================
// Overlay Atmosphere Layer
// Renders overlay effects like fog, night filter, light rays
// ============================================

interface OverlayAtmosphereLayerProps {
  layer: AtmosphereLayer;
  globalIntensity: number;
}

export function OverlayAtmosphereLayer({ layer, globalIntensity }: OverlayAtmosphereLayerProps) {
  const [flashOpacity, setFlashOpacity] = useState(0);
  
  // Handle lightning flash effect
  useEffect(() => {
    if (layer.id.includes('lightning') && layer.active) {
      // Random lightning flashes
      const flashInterval = setInterval(() => {
        if (Math.random() < 0.3) { // 30% chance every interval
          setFlashOpacity(1);
          setTimeout(() => setFlashOpacity(0.7), 50);
          setTimeout(() => setFlashOpacity(0.3), 100);
          setTimeout(() => setFlashOpacity(0), 200);
        }
      }, 2000 + Math.random() * 3000);
      
      return () => clearInterval(flashInterval);
    }
  }, [layer.id, layer.active]);
  
  // Get overlay styles based on layer type
  const getOverlayStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    };
    
    const opacity = layer.opacity * globalIntensity;
    
    switch (layer.id) {
      case 'fog-light':
      case 'fog-heavy':
        return {
          ...baseStyle,
          background: `radial-gradient(ellipse at center, transparent 0%, ${layer.color} 100%)`,
          opacity,
          animation: layer.speed > 0 ? `fog-drift ${20 / layer.speed}s ease-in-out infinite` : undefined,
        };
      
      case 'night-filter':
        return {
          ...baseStyle,
          background: layer.color,
          opacity,
          mixBlendMode: 'multiply',
        };
      
      case 'dust-overlay':
        return {
          ...baseStyle,
          background: layer.color,
          opacity,
        };
      
      case 'light-rays':
        return {
          ...baseStyle,
          background: `linear-gradient(135deg, transparent 0%, ${layer.color} 50%, transparent 100%)`,
          opacity,
          animation: 'light-rays-shimmer 8s ease-in-out infinite',
        };
      
      case 'lightning':
        return {
          ...baseStyle,
          background: layer.color,
          opacity: flashOpacity,
          transition: 'opacity 0.05s ease-out',
        };
      
      default:
        return {
          ...baseStyle,
          background: layer.color,
          opacity,
        };
    }
  };
  
  // Don't render if no color defined
  if (!layer.color) return null;
  
  return (
    <div
      className="atmosphere-overlay"
      style={getOverlayStyles()}
      aria-hidden="true"
    />
  );
}

export default OverlayAtmosphereLayer;
