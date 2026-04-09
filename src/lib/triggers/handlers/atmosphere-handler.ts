// ============================================
// Atmosphere Trigger Handler
// Detects and triggers atmosphere effects from message content
// ============================================

import type { TriggerHandler, TriggerMatch, TriggerMatchResult } from './types';
import type { DetectedToken } from '../token-detector';
import type { TriggerContext } from '../trigger-bus';
import type { AtmosphereLayer, AtmospherePreset, AtmosphereTriggerHit } from '@/types';
import { DEFAULT_ATMOSPHERE_LAYERS, DEFAULT_ATMOSPHERE_PRESETS } from '@/store/slices/atmosphereSlice';

// ============================================
// Atmosphere Handler Class
// ============================================

export class AtmosphereTriggerHandler implements TriggerHandler {
  id = 'atmosphere-handler';
  type = 'atmosphere';
  priority = 50; // Medium priority
  
  private layers: AtmosphereLayer[];
  private presets: AtmospherePreset[];
  private lastTriggerTime: Map<string, number> = new Map();
  private globalCooldown: number;
  
  constructor(
    layers: AtmosphereLayer[] = DEFAULT_ATMOSPHERE_LAYERS,
    presets: AtmospherePreset[] = DEFAULT_ATMOSPHERE_PRESETS,
    globalCooldown: number = 2000
  ) {
    this.layers = layers;
    this.presets = presets;
    this.globalCooldown = globalCooldown;
  }
  
  /**
   * Update layers configuration
   */
  setLayers(layers: AtmosphereLayer[]): void {
    this.layers = layers;
  }
  
  /**
   * Update presets configuration
   */
  setPresets(presets: AtmospherePreset[]): void {
    this.presets = presets;
  }
  
  /**
   * Check if any atmosphere triggers match the tokens
   */
  checkTrigger(
    tokens: DetectedToken[],
    context: TriggerContext,
    alreadyTriggered: Set<string>
  ): TriggerMatchResult | null {
    const now = Date.now();
    
    // Check global cooldown
    const lastGlobal = this.lastTriggerTime.get('global') || 0;
    if (now - lastGlobal < this.globalCooldown) {
      return null;
    }
    
    // Get text content to search
    const text = tokens.map(t => t.value).join(' ').toLowerCase();
    
    // First, check for preset matches (higher priority)
    for (const preset of this.presets) {
      if (!preset.layers.length) continue; // Skip empty presets like 'clear'
      
      const matchedKeywords: string[] = [];
      
      // Check if any layer's trigger keys match
      for (const layer of preset.layers) {
        for (const keyword of layer.triggerKeys) {
          if (text.includes(keyword.toLowerCase()) && !alreadyTriggered.has(`preset-${preset.id}-${keyword}`)) {
            matchedKeywords.push(keyword);
          }
        }
      }
      
      if (matchedKeywords.length > 0) {
        // Check per-preset cooldown
        const lastPresetTrigger = this.lastTriggerTime.get(`preset-${preset.id}`) || 0;
        if (now - lastPresetTrigger < 5000) continue; // 5 second cooldown per preset
        
        this.lastTriggerTime.set(`preset-${preset.id}`, now);
        this.lastTriggerTime.set('global', now);
        
        return {
          matched: true,
          trigger: {
            triggerId: `preset-${preset.id}`,
            triggerType: 'effect',
            keyword: matchedKeywords[0],
            data: {
              type: 'preset',
              presetId: preset.id,
              preset,
              matchedKeywords,
            },
          },
          tokens: tokens.filter(t => 
            matchedKeywords.some(k => t.value.toLowerCase().includes(k.toLowerCase()))
          ),
        };
      }
    }
    
    // Then check individual layers
    for (const layer of this.layers) {
      if (!layer.active && !layer.triggerKeys.length) continue;
      
      for (const keyword of layer.triggerKeys) {
        const keywordLower = keyword.toLowerCase();
        
        // Check if keyword is in text
        if (text.includes(keywordLower) && !alreadyTriggered.has(`layer-${layer.id}-${keyword}`)) {
          // Check per-layer cooldown
          const lastLayerTrigger = this.lastTriggerTime.get(`layer-${layer.id}`) || 0;
          if (now - lastLayerTrigger < (layer.duration || 3000)) continue;
          
          // Check context keys if present
          if (layer.contextKeys && layer.contextKeys.length > 0) {
            const contextMatch = layer.contextKeys.some(ck => text.includes(ck.toLowerCase()));
            if (!contextMatch) continue;
          }
          
          this.lastTriggerTime.set(`layer-${layer.id}`, now);
          this.lastTriggerTime.set('global', now);
          
          return {
            matched: true,
            trigger: {
              triggerId: `layer-${layer.id}`,
              triggerType: 'effect',
              keyword,
              data: {
                type: 'layer',
                layerId: layer.id,
                layer,
              },
            },
            tokens: tokens.filter(t => t.value.toLowerCase().includes(keywordLower)),
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Execute the trigger action
   */
  executeTrigger(match: TriggerMatch, context: TriggerContext): void {
    // The actual execution is handled by the store
    // This method is called by the trigger bus to notify listeners
    if (context.onAtmosphereTrigger) {
      const hit: AtmosphereTriggerHit = {
        layerId: match.data.layerId as string,
        layer: match.data.layer as AtmosphereLayer,
        presetId: match.data.presetId as string,
        preset: match.data.preset as AtmospherePreset,
        intensity: 1,
      };
      context.onAtmosphereTrigger(hit);
    }
  }
  
  /**
   * Reset state for new message
   */
  reset(messageKey: string): void {
    // Clear cooldowns for new message
    // We keep global cooldown but reset per-trigger cooldowns
  }
  
  /**
   * Cleanup when handler is removed
   */
  cleanup(): void {
    this.lastTriggerTime.clear();
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create atmosphere handler with store integration
 */
export function createAtmosphereHandler(
  getLayers: () => AtmosphereLayer[],
  getPresets: () => AtmospherePreset[],
  globalCooldown: number = 2000
): AtmosphereTriggerHandler {
  const handler = new AtmosphereTriggerHandler([], [], globalCooldown);
  
  // Update layers/presets from getter functions
  const updateConfig = () => {
    handler.setLayers(getLayers());
    handler.setPresets(getPresets());
  };
  
  // Initial update
  updateConfig();
  
  return handler;
}

// ============================================
// Atmosphere Detection Function
// ============================================

/**
 * Detect atmosphere triggers in text
 */
export function detectAtmosphereTriggers(
  text: string,
  layers: AtmosphereLayer[] = DEFAULT_ATMOSPHERE_LAYERS,
  presets: AtmospherePreset[] = DEFAULT_ATMOSPHERE_PRESETS
): AtmosphereTriggerHit[] {
  const hits: AtmosphereTriggerHit[] = [];
  const textLower = text.toLowerCase();
  
  // Check presets first
  for (const preset of presets) {
    if (!preset.layers.length) continue;
    
    for (const layer of preset.layers) {
      for (const keyword of layer.triggerKeys) {
        if (textLower.includes(keyword.toLowerCase())) {
          hits.push({
            presetId: preset.id,
            preset,
            layerId: layer.id,
            layer,
            intensity: 1,
          });
          break; // Only one hit per preset
        }
      }
    }
  }
  
  // Check individual layers
  for (const layer of layers) {
    for (const keyword of layer.triggerKeys) {
      if (textLower.includes(keyword.toLowerCase())) {
        // Check context keys if present
        if (layer.contextKeys && layer.contextKeys.length > 0) {
          const contextMatch = layer.contextKeys.some(ck => textLower.includes(ck.toLowerCase()));
          if (!contextMatch) continue;
        }
        
        hits.push({
          layerId: layer.id,
          layer,
          intensity: 1,
        });
        break; // Only one hit per layer
      }
    }
  }
  
  return hits;
}

// Export singleton instance
export const atmosphereHandler = new AtmosphereTriggerHandler();
