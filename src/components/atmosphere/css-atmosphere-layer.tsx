'use client';

import { useEffect, useRef } from 'react';
import type { AtmosphereLayer } from '@/types';

// ============================================
// CSS Atmosphere Layer
// Renders CSS-based effects like rain
// ============================================

interface CSSAtmosphereLayerProps {
  layer: AtmosphereLayer;
  globalIntensity: number;
}

export function CSSAtmosphereLayer({ layer, globalIntensity }: CSSAtmosphereLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const intensity = layer.intensity * globalIntensity;
  const dropCount = Math.floor((layer.density || 100) * intensity);
  
  // Create rain drops
  useEffect(() => {
    if (!containerRef.current || layer.cssClass?.includes('rain')) {
      // Rain drops are created dynamically
    }
  }, [layer]);
  
  // Determine CSS class based on layer type
  const getEffectClass = () => {
    const classes = ['atmosphere-layer', 'absolute', 'inset-0'];
    
    if (layer.cssClass) {
      classes.push(layer.cssClass);
    }
    
    return classes.join(' ');
  };
  
  // Generate rain drops
  const renderRainDrops = () => {
    if (!layer.cssClass?.includes('rain')) return null;
    
    const drops = [];
    for (let i = 0; i < dropCount; i++) {
      const left = Math.random() * 100;
      const delay = Math.random() * 2;
      const duration = 0.5 + Math.random() * 0.5;
      const opacity = 0.3 + Math.random() * 0.7;
      
      drops.push(
        <div
          key={i}
          className="rain-drop"
          style={{
            left: `${left}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration / layer.speed}s`,
            opacity: opacity * layer.opacity,
            height: `${15 + Math.random() * 20}px`,
            background: layer.color || 'rgba(174, 194, 224, 0.6)',
          }}
        />
      );
    }
    return drops;
  };
  
  return (
    <div
      ref={containerRef}
      className={getEffectClass()}
      style={{
        opacity: layer.opacity * globalIntensity,
      }}
    >
      {renderRainDrops()}
    </div>
  );
}

export default CSSAtmosphereLayer;
