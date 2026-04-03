'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { AtmosphereLayer } from '@/types';

// ============================================
// Canvas Atmosphere Layer
// Renders particle effects like snow, fireflies, leaves
// ============================================

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation?: number;
  rotationSpeed?: number;
  color?: string;
  phase?: number; // For firefly glow
}

interface CanvasAtmosphereLayerProps {
  layer: AtmosphereLayer;
  globalIntensity: number;
  performanceMode: 'quality' | 'balanced' | 'performance';
}

// Create a single particle (moved outside component to avoid hoisting issues)
function createParticle(width: number, height: number, layer: AtmosphereLayer): Particle {
  const baseSpeed = layer.speed || 0.5;
  const sizeMin = layer.sizeMin || 2;
  const sizeMax = layer.sizeMax || 6;
  const windSpeed = layer.windSpeed || 0;
  
  // Different particle behaviors based on category
  switch (layer.category) {
    case 'precipitation': // Snow
      return {
        x: Math.random() * width,
        y: Math.random() * height - height,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        speedX: (Math.random() - 0.5) * windSpeed,
        speedY: baseSpeed + Math.random() * baseSpeed,
        opacity: 0.5 + Math.random() * 0.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2,
      };
    
    case 'particles': // Fireflies, leaves, embers
      if (layer.id.includes('firefly')) {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: (Math.random() - 0.5) * baseSpeed,
          opacity: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
        };
      } else if (layer.id.includes('leaf') || layer.id.includes('leaves')) {
        return {
          x: Math.random() * width,
          y: Math.random() * height - height,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          speedX: windSpeed + (Math.random() - 0.5) * baseSpeed,
          speedY: baseSpeed * 0.5 + Math.random() * baseSpeed,
          opacity: 0.7 + Math.random() * 0.3,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 5,
        };
      } else if (layer.id.includes('ember')) {
        return {
          x: Math.random() * width,
          y: height + Math.random() * 50,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: -baseSpeed * (1 + Math.random()),
          opacity: 0.5 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        };
      }
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        speedX: (Math.random() - 0.5) * baseSpeed,
        speedY: baseSpeed + Math.random() * baseSpeed,
        opacity: 0.5 + Math.random() * 0.5,
      };
    
    default:
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        speedX: (Math.random() - 0.5) * baseSpeed,
        speedY: baseSpeed + Math.random() * baseSpeed,
        opacity: 0.5 + Math.random() * 0.5,
      };
  }
}

// Update particle position
function updateParticlePosition(particle: Particle, width: number, height: number, deltaTime: number, layer: AtmosphereLayer) {
  const windSpeed = layer.windSpeed || 0;
  
  particle.x += particle.speedX * deltaTime * 60;
  particle.y += particle.speedY * deltaTime * 60;
  
  if (particle.rotation !== undefined && particle.rotationSpeed !== undefined) {
    particle.rotation += particle.rotationSpeed * deltaTime * 60;
  }
  
  // Update phase for glowing particles
  if (particle.phase !== undefined) {
    particle.phase += deltaTime * 2;
  }
  
  // Wrap around screen
  if (particle.y > height + 20) {
    particle.y = -20;
    particle.x = Math.random() * width;
  }
  if (particle.y < -20 && layer.id.includes('ember')) {
    particle.y = height + 20;
    particle.x = Math.random() * width;
  }
  if (particle.x > width + 20) {
    particle.x = -20;
  }
  if (particle.x < -20) {
    particle.x = width + 20;
  }
  
  // Fireflies drift
  if (layer.id.includes('firefly')) {
    particle.speedX += (Math.random() - 0.5) * 0.1;
    particle.speedY += (Math.random() - 0.5) * 0.1;
    particle.speedX = Math.max(-1, Math.min(1, particle.speedX));
    particle.speedY = Math.max(-1, Math.min(1, particle.speedY));
  }
}

// Draw particle
function drawParticleOnCanvas(ctx: CanvasRenderingContext2D, particle: Particle, layer: AtmosphereLayer) {
  ctx.save();
  
  const color = layer.color || '#ffffff';
  
  if (layer.id.includes('firefly')) {
    // Glowing firefly
    const glow = Math.sin(particle.phase || 0) * 0.5 + 0.5;
    const gradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size * 3
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, color.replace(')', `, ${glow * particle.opacity})`).replace('rgb', 'rgba'));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (layer.id.includes('leaf') || layer.id.includes('leaves')) {
    // Falling leaf
    ctx.translate(particle.x, particle.y);
    ctx.rotate(((particle.rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = color;
    ctx.globalAlpha = particle.opacity * layer.opacity;
    ctx.beginPath();
    ctx.ellipse(0, 0, particle.size, particle.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (layer.id.includes('ember')) {
    // Glowing ember
    const flicker = 0.7 + Math.random() * 0.3;
    const gradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size * 2
    );
    gradient.addColorStop(0, layer.colorSecondary || '#ff8c00');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = particle.opacity * flicker * layer.opacity;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (layer.id.includes('snow')) {
    // Snowflake
    ctx.fillStyle = color;
    ctx.globalAlpha = particle.opacity * layer.opacity;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle glow
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;
    ctx.fill();
  } else {
    // Default circle
    ctx.fillStyle = color;
    ctx.globalAlpha = particle.opacity * layer.opacity;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

export function CanvasAtmosphereLayer({ layer, globalIntensity, performanceMode }: CanvasAtmosphereLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);
  const layerRef = useRef(layer);
  
  // Keep layer ref updated
  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);
  
  const intensity = layer.intensity * globalIntensity;
  
  // Get particle count based on performance mode
  const getParticleCount = useCallback(() => {
    const baseCount = (layer.density || 50) * intensity;
    switch (performanceMode) {
      case 'quality':
        return Math.floor(baseCount);
      case 'balanced':
        return Math.floor(baseCount * 0.7);
      case 'performance':
        return Math.floor(baseCount * 0.4);
      default:
        return Math.floor(baseCount);
    }
  }, [layer.density, intensity, performanceMode]);
  
  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const count = getParticleCount();
    const currentLayer = layerRef.current;
    particlesRef.current = [];
    
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(width, height, currentLayer));
    }
  }, [getParticleCount]);
  
  // Setup canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const currentLayer = layerRef.current;
    
    // Animation loop
    const animate = (timestamp: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const deltaTime = (timestamp - timeRef.current) / 1000;
      timeRef.current = timestamp;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particlesRef.current.forEach(particle => {
        updateParticlePosition(particle, canvas.width, canvas.height, Math.min(deltaTime, 0.1), currentLayer);
        drawParticleOnCanvas(ctx, particle, currentLayer);
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles(canvas.width, canvas.height);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Start animation
    timeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initParticles]);
  
  // Re-initialize when intensity changes significantly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Adjust particle count dynamically
      const targetCount = getParticleCount();
      const currentCount = particlesRef.current.length;
      
      if (Math.abs(targetCount - currentCount) > 5) {
        initParticles(canvas.width, canvas.height);
      }
    }
  }, [intensity, getParticleCount, initParticles]);
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{
        opacity: layer.opacity * globalIntensity,
      }}
    />
  );
}

export default CanvasAtmosphereLayer;
