'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTavernStore } from '@/store/tavern-store';
import type { AtmosphereLayer } from '@/types';
import { CSSAtmosphereLayer } from './css-atmosphere-layer';
import { CanvasAtmosphereLayer } from './canvas-atmosphere-layer';
import { OverlayAtmosphereLayer } from './overlay-atmosphere-layer';

// ============================================
// Atmosphere Renderer Component
// ============================================

export function AtmosphereRenderer() {
  const {
    activeAtmosphereLayers,
    atmosphereSettings,
    atmosphereGlobalIntensity,
    atmosphereAudioEnabled,
  } = useTavernStore();
  
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  
  // Filter and sort layers by priority
  const sortedLayers = activeAtmosphereLayers
    .filter(layer => layer.active)
    .sort((a, b) => a.priority - b.priority);
  
  // Group layers by render type for efficient rendering
  const cssLayers = sortedLayers.filter(l => l.renderType === 'css');
  const canvasLayers = sortedLayers.filter(l => l.renderType === 'canvas');
  const overlayLayers = sortedLayers.filter(l => l.renderType === 'overlay');
  
  // Handle audio loops
  useEffect(() => {
    if (!atmosphereSettings.enabled || !atmosphereAudioEnabled) {
      // Stop all audio
      audioRefs.current.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      audioRefs.current.clear();
      return;
    }
    
    // Get layers with audio
    const layersWithAudio = sortedLayers.filter(l => l.audioLoopUrl);
    
    // Stop audio for inactive layers
    audioRefs.current.forEach((audio, layerId) => {
      if (!layersWithAudio.some(l => l.id === layerId)) {
        audio.pause();
        audioRefs.current.delete(layerId);
      }
    });
    
    // Start audio for active layers
    layersWithAudio.forEach(layer => {
      if (!audioRefs.current.has(layer.id)) {
        const audio = new Audio(layer.audioLoopUrl);
        audio.loop = true;
        audio.volume = (layer.audioVolume || 0.5) * atmosphereSettings.globalVolume * atmosphereGlobalIntensity;
        audio.play().catch(() => {
          // Autoplay blocked, will play on user interaction
        });
        audioRefs.current.set(layer.id, audio);
      } else {
        // Update volume
        const audio = audioRefs.current.get(layer.id)!;
        audio.volume = (layer.audioVolume || 0.5) * atmosphereSettings.globalVolume * atmosphereGlobalIntensity;
      }
    });
    
    return () => {
      audioRefs.current.forEach(audio => {
        audio.pause();
      });
    };
  }, [sortedLayers, atmosphereSettings.enabled, atmosphereAudioEnabled, atmosphereSettings.globalVolume, atmosphereGlobalIntensity]);
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRefs.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioRefs.current.clear();
    };
  }, []);
  
  if (!atmosphereSettings.enabled || sortedLayers.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="atmosphere-container fixed inset-0 pointer-events-none z-30 overflow-hidden"
      aria-hidden="true"
    >
      {/* CSS-based layers (rain, etc.) */}
      {cssLayers.map(layer => (
        <CSSAtmosphereLayer
          key={layer.id}
          layer={layer}
          globalIntensity={atmosphereGlobalIntensity}
        />
      ))}
      
      {/* Canvas-based layers (particles) */}
      {canvasLayers.map(layer => (
        <CanvasAtmosphereLayer
          key={layer.id}
          layer={layer}
          globalIntensity={atmosphereGlobalIntensity}
          performanceMode={atmosphereSettings.performanceMode}
        />
      ))}
      
      {/* Overlay layers (fog, filters) */}
      {overlayLayers.map(layer => (
        <OverlayAtmosphereLayer
          key={layer.id}
          layer={layer}
          globalIntensity={atmosphereGlobalIntensity}
        />
      ))}
    </div>
  );
}

export default AtmosphereRenderer;
