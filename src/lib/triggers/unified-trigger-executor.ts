// ============================================
// Unified Trigger Executor - Execute Triggers as Rewards
// ============================================
//
// Este módulo ejecuta triggers directamente, sin pasar por el TokenDetector.
// Se usa principalmente para ejecutar recompensas de quests.
//
// Flujo:
// 1. Recibe categoría (sprite/sound/background) y key
// 2. Crea un "trigger match" sintético
// 3. Llama directamente a las funciones de ejecución de los handlers
//
// Ventajas:
// - Reutiliza toda la infraestructura existente
// - No duplica lógica de ejecución
// - Soporta targetMode para grupos

import type { CharacterCard, SoundCollection, SoundTrigger, BackgroundTriggerPack, BackgroundOverlay, BackgroundTransitionType, SoundSequenceTrigger } from '@/types';
import type { TriggerContext } from './trigger-bus';
import type { TriggerMatch } from './types';
import {
  executeSoundTrigger,
} from './handlers/sound-handler';
import {
  executeSpriteTrigger,
} from './handlers/sprite-handler';
import {
  executeBackgroundTrigger,
} from './handlers/background-handler';

// ============================================
// Types
// ============================================

export type TriggerCategory = 'sprite' | 'sound' | 'background' | 'soundSequence';
export type TriggerTargetMode = 'self' | 'all' | 'target';

/**
 * Contexto para ejecución de triggers como recompensa
 */
export interface TriggerExecutionContext {
  sessionId: string;
  characterId: string;              // Quién completó el objetivo/misión
  character: CharacterCard;         // Personaje que recibe el trigger
  allCharacters?: CharacterCard[];  // Para grupos - todos los personajes
  targetCharacterId?: string;       // ID del personaje objetivo cuando targetMode es 'target'
  source: 'objective' | 'quest_completion' | 'manual';
  timestamp: number;
  
  // Store access
  storeActions: TriggerStoreActions;
  
  // Sound resources (for lookup)
  soundCollections?: SoundCollection[];
  soundTriggers?: SoundTrigger[];
  soundSequenceTriggers?: SoundSequenceTrigger[];
  
  // Background resources (for lookup)
  backgroundPacks?: BackgroundTriggerPack[];
  
  // Settings
  soundSettings?: {
    enabled: boolean;
    globalVolume: number;
  };
  backgroundSettings?: {
    transitionDuration: number;
    defaultTransitionType: BackgroundTransitionType;
  };
}

/**
 * SpriteTriggerHit type for applyTriggerForCharacter
 */
export interface SpriteTriggerHit {
  spriteUrl: string;
  spriteLabel?: string | null;
  returnToIdleMs?: number;
}

/**
 * Acciones del store necesarias para ejecutar triggers
 */
export interface TriggerStoreActions {
  // Sprite
  applyTriggerForCharacter: (
    characterId: string,
    hit: SpriteTriggerHit
  ) => void;
  scheduleReturnToIdleForCharacter: (
    characterId: string,
    triggerSpriteUrl: string,
    returnToMode: 'idle' | 'talk' | 'thinking' | 'clear',
    returnSpriteUrl: string,
    returnSpriteLabel: string | null,
    returnToIdleMs: number
  ) => void;
  isSpriteLocked?: () => boolean;
  
  // Sound
  playSound?: (collection: string, filename: string, volume?: number) => void;
  
  // Background
  setBackground?: (url: string) => void;
  setActiveOverlays?: (overlays: BackgroundOverlay[]) => void;
}

/**
 * Resultado de ejecutar un trigger
 */
export interface TriggerExecutionResult {
  success: boolean;
  category: TriggerCategory;
  key: string;
  targetCharacterId: string;
  message?: string;
  error?: string;
}

/**
 * Resultado de ejecutar múltiples triggers
 */
export interface TriggerBatchResult {
  results: TriggerExecutionResult[];
  successCount: number;
  failureCount: number;
}

// ============================================
// Sprite Trigger Execution
// ============================================

/**
 * Check if a key is a direct URL (can be used directly without lookup)
 */
function isDirectUrl(key: string): boolean {
  return key.startsWith('http://') || 
         key.startsWith('https://') || 
         key.startsWith('/') || 
         key.startsWith('data:');
}

/**
 * Ejecuta un trigger de sprite para un personaje
 * Ahora maneja correctamente el fallback según la configuración del sprite
 */
function executeSpriteTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  character: CharacterCard,
  returnToIdleMs: number = 0
): TriggerExecutionResult {
  const { storeActions } = context;
  
  try {
    // Check if sprite is locked
    if (storeActions.isSpriteLocked?.()) {
      return {
        success: false,
        category: 'sprite',
        key,
        targetCharacterId: character.id,
        error: 'Sprite is locked',
      };
    }
    
    // Determine sprite URL - either direct URL or keyword lookup
    let spriteUrl: string;
    let spriteLabel: string | undefined;
    let fallbackMode: 'idle_collection' | 'custom_sprite' | 'collection_default' | undefined;
    let fallbackDelayMs: number | undefined;
    let fallbackSpriteId: string | undefined;
    let packId: string | undefined;
    let principalSpriteId: string | undefined;
    
    if (isDirectUrl(key)) {
      // Use key directly as URL
      spriteUrl = key;
      spriteLabel = key.split('/').pop()?.split('?')[0] || key;
      // Use provided returnToIdleMs for direct URLs
      fallbackDelayMs = returnToIdleMs > 0 ? returnToIdleMs : undefined;
      console.log(`[UnifiedTriggerExecutor] Using direct URL for sprite: ${key}`);
    } else {
      // Find matching sprite in character's sprite packs or triggers
      const spriteMatch = findSpriteMatch(key, character);
      
      if (!spriteMatch) {
        console.log(`[UnifiedTriggerExecutor] No sprite found for key "${key}" in character "${character.name}"`);
        return {
          success: false,
          category: 'sprite',
          key,
          targetCharacterId: character.id,
          error: `No sprite found for key "${key}"`,
        };
      }
      
      spriteUrl = spriteMatch.url;
      spriteLabel = spriteMatch.label;
      // Get fallback config from sprite match
      fallbackMode = spriteMatch.fallbackMode;
      // Use sprite's fallbackDelayMs if defined, otherwise use provided returnToIdleMs
      fallbackDelayMs = spriteMatch.fallbackDelayMs ?? (returnToIdleMs > 0 ? returnToIdleMs : undefined);
      fallbackSpriteId = spriteMatch.fallbackSpriteId;
      packId = spriteMatch.packId;
      principalSpriteId = spriteMatch.principalSpriteId;
    }
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-sprite-${Date.now()}`,
      triggerType: 'sprite',
      keyword: key,
      data: {
        spriteUrl,
        spriteLabel,
        returnToIdleMs: fallbackDelayMs ?? 0,
        characterId: character.id,
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character,
      fullText: `[REWARD:sprite:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Get idle sprite URL helper
    const getIdleSpriteUrl = (): string | null => {
      // Try V2 state collections first
      const idleCollectionV2 = character.stateCollectionsV2?.find(c => c.state === 'idle');
      if (idleCollectionV2) {
        const pack = character.spritePacksV2?.find(p => p.id === idleCollectionV2.packId);
        if (pack && idleCollectionV2.principalSpriteId) {
          const sprite = pack.sprites.find(s => s.id === idleCollectionV2.principalSpriteId);
          if (sprite) return sprite.url;
        }
        if (pack && pack.sprites.length > 0) {
          return pack.sprites[0].url;
        }
      }
      
      // Fall back to legacy state collections
      const idleCollection = character.spriteConfig?.stateCollections?.['idle'];
      if (idleCollection?.entries.length) {
        const entry = idleCollection.entries.find(e => e.role === 'principal') || idleCollection.entries[0];
        if (entry?.spriteUrl) return entry.spriteUrl;
      }
      if (character.spriteConfig?.sprites?.['idle']) {
        return character.spriteConfig.sprites['idle'];
      }
      if (character.avatar) {
        return character.avatar;
      }
      return null;
    };
    
    // Execute sprite trigger - apply the sprite
    executeSpriteTrigger(match, triggerContext, {
      applyTriggerForCharacter: storeActions.applyTriggerForCharacter,
      scheduleReturnToIdleForCharacter: storeActions.scheduleReturnToIdleForCharacter,
    }, getIdleSpriteUrl);
    
    // Handle fallback scheduling if fallbackDelayMs > 0
    if (fallbackDelayMs && fallbackDelayMs > 0) {
      let returnSpriteUrl: string | null = null;
      let returnSpriteLabel: string | null = null;
      let returnToMode: 'idle' | 'talk' | 'thinking' | 'clear' = 'idle';

      if (fallbackMode === 'custom_sprite' && fallbackSpriteId && packId) {
        // Find fallback sprite in pack
        const pack = character.spritePacksV2?.find(p => p.id === packId);
        const fallbackSprite = pack?.sprites.find(s => s.id === fallbackSpriteId);
        if (fallbackSprite) {
          returnSpriteUrl = fallbackSprite.url;
          returnSpriteLabel = fallbackSprite.label;
          returnToMode = 'idle'; // Apply the custom sprite
        }
      } else if (fallbackMode === 'idle_collection') {
        // For 'idle_collection', use 'clear' mode to let the normal state logic
        // (idle state from State Collections V2) determine what to show
        returnToMode = 'clear';
        returnSpriteUrl = ''; // Empty is fine for 'clear' mode
        returnSpriteLabel = null;
      } else if (fallbackMode === 'collection_default' && packId) {
        // Use collection's principal sprite or first sprite
        const pack = character.spritePacksV2?.find(p => p.id === packId);
        if (pack && pack.sprites.length > 0) {
          const principalSprite = principalSpriteId
            ? pack.sprites.find(s => s.id === principalSpriteId)
            : pack.sprites[0];
          if (principalSprite) {
            returnSpriteUrl = principalSprite.url;
            returnSpriteLabel = principalSprite.label;
            returnToMode = 'idle'; // Apply the collection default sprite
          }
        }
        if (!returnSpriteUrl) {
          // Fallback to 'clear' mode if no sprite found
          returnToMode = 'clear';
          returnSpriteUrl = '';
          returnSpriteLabel = null;
        }
      } else {
        // Default fallback: use 'clear' mode
        returnToMode = 'clear';
        returnSpriteUrl = '';
        returnSpriteLabel = null;
      }

      console.log(`[UnifiedTriggerExecutor] Scheduling fallback for sprite:`, {
        characterId: character.id,
        fallbackMode,
        fallbackDelayMs,
        returnToMode,
        returnSpriteUrl: returnSpriteUrl || '(clear mode)',
        returnSpriteLabel,
      });

      // Always schedule fallback when delay > 0
      storeActions.scheduleReturnToIdleForCharacter(
        character.id,
        spriteUrl,
        returnToMode,
        returnSpriteUrl || '',
        returnSpriteLabel,
        fallbackDelayMs
      );
    }
    
    return {
      success: true,
      category: 'sprite',
      key,
      targetCharacterId: character.id,
      message: `Sprite "${spriteLabel || spriteUrl}" applied to ${character.name}${fallbackDelayMs ? ` (fallback in ${fallbackDelayMs}ms)` : ''}`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'sprite',
      key,
      targetCharacterId: character.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Resultado de búsqueda de sprite
 */
interface SpriteMatchResult {
  url: string;
  label?: string;
  // Fallback configuration
  fallbackMode?: 'idle_collection' | 'custom_sprite' | 'collection_default';
  fallbackDelayMs?: number;
  fallbackSpriteId?: string;
  // For finding fallback sprite
  packId?: string;
  collectionId?: string;
  principalSpriteId?: string;
}

/**
 * Busca un sprite que coincida con la key en el personaje
 * Soporta tanto el sistema legacy como V2 (spritePacksV2, triggerCollections)
 * Ahora devuelve también la configuración de fallback
 */
function findSpriteMatch(
  key: string,
  character: CharacterCard
): SpriteMatchResult | null {
  const normalizedKey = key.toLowerCase();
  
  // 0. Si es una URL directa, usarla
  if (isDirectUrl(key)) {
    return { url: key, label: key.split('/').pop()?.split('?')[0] || key };
  }
  
  // 1. Search in V2 Trigger Collections (highest priority)
  if (character.triggerCollections && character.triggerCollections.length > 0) {
    // Sort by priority (higher first)
    const sortedCollections = [...character.triggerCollections]
      .filter(c => c.active)
      .sort((a, b) => b.priority - a.priority);
    
    for (const collection of sortedCollections) {
      // Check collection key
      if (collection.collectionKey && collection.collectionKey.toLowerCase() === normalizedKey) {
        // Find the sprite pack
        const pack = character.spritePacksV2?.find(p => p.id === collection.packId);
        if (pack && pack.sprites.length > 0) {
          // Get principal sprite or first one
          const sprite = collection.principalSpriteId
            ? pack.sprites.find(s => s.id === collection.principalSpriteId)
            : pack.sprites[0];
          if (sprite) {
            console.log(`[UnifiedTriggerExecutor] Found sprite in V2 collection "${collection.name}": ${sprite.url}`);
            return { 
              url: sprite.url, 
              label: sprite.label,
              fallbackMode: collection.fallbackMode,
              fallbackDelayMs: collection.fallbackDelayMs,
              fallbackSpriteId: collection.fallbackSpriteId,
              packId: collection.packId,
              collectionId: collection.id,
              principalSpriteId: collection.principalSpriteId,
            };
          }
        }
      }
      
      // Check individual sprite configs
      for (const [spriteId, config] of Object.entries(collection.spriteConfigs)) {
        if (!config.enabled) continue;
        
        // Check main key
        if (config.key && config.key.toLowerCase() === normalizedKey) {
          const pack = character.spritePacksV2?.find(p => p.id === collection.packId);
          const sprite = pack?.sprites.find(s => s.id === spriteId);
          if (sprite) {
            console.log(`[UnifiedTriggerExecutor] Found sprite via V2 config key "${config.key}": ${sprite.url}`);
            return { 
              url: sprite.url, 
              label: sprite.label,
              fallbackMode: config.fallbackMode ?? collection.fallbackMode,
              fallbackDelayMs: config.fallbackDelayMs ?? collection.fallbackDelayMs,
              fallbackSpriteId: config.fallbackSpriteId ?? collection.fallbackSpriteId,
              packId: collection.packId,
              collectionId: collection.id,
              principalSpriteId: collection.principalSpriteId,
            };
          }
        }
        
        // Check alternative keys
        if (config.keys && config.keys.some(k => k.toLowerCase() === normalizedKey)) {
          const pack = character.spritePacksV2?.find(p => p.id === collection.packId);
          const sprite = pack?.sprites.find(s => s.id === spriteId);
          if (sprite) {
            console.log(`[UnifiedTriggerExecutor] Found sprite via V2 config alt key: ${sprite.url}`);
            return { 
              url: sprite.url, 
              label: sprite.label,
              fallbackMode: config.fallbackMode ?? collection.fallbackMode,
              fallbackDelayMs: config.fallbackDelayMs ?? collection.fallbackDelayMs,
              fallbackSpriteId: config.fallbackSpriteId ?? collection.fallbackSpriteId,
              packId: collection.packId,
              collectionId: collection.id,
              principalSpriteId: collection.principalSpriteId,
            };
          }
        }
      }
    }
  }
  
  // 2. Search in V2 Sprite Packs directly
  if (character.spritePacksV2 && character.spritePacksV2.length > 0) {
    for (const pack of character.spritePacksV2) {
      // Check if pack name matches
      if (pack.name.toLowerCase() === normalizedKey && pack.sprites.length > 0) {
        const sprite = pack.sprites[0];
        console.log(`[UnifiedTriggerExecutor] Found sprite in V2 pack "${pack.name}": ${sprite.url}`);
        return { url: sprite.url, label: sprite.label, packId: pack.id };
      }
      
      // Check sprite labels
      const spriteByLabel = pack.sprites.find(s => s.label?.toLowerCase() === normalizedKey);
      if (spriteByLabel) {
        console.log(`[UnifiedTriggerExecutor] Found sprite by label "${spriteByLabel.label}": ${spriteByLabel.url}`);
        return { url: spriteByLabel.url, label: spriteByLabel.label, packId: pack.id };
      }
    }
  }
  
  // 3. Search in legacy sprite packs
  if (character.spritePacks) {
    for (const pack of character.spritePacks) {
      if (!pack.active) continue;
      
      // Check pack keywords
      const packMatches = pack.keywords.some(kw => kw.toLowerCase() === normalizedKey);
      
      if (packMatches && pack.items && pack.items.length > 0) {
        // Find an item that matches
        const item = pack.items.find(i => i.enabled !== false);
        if (item?.spriteUrl) {
          console.log(`[UnifiedTriggerExecutor] Found sprite in legacy pack "${pack.name}": ${item.spriteUrl}`);
          return { 
            url: item.spriteUrl, 
            label: item.spriteLabel,
            fallbackDelayMs: item.returnToIdleMs,
          };
        }
      }
    }
  }
  
  // 4. Search in simple sprite triggers
  if (character.spriteTriggers) {
    const trigger = character.spriteTriggers.find(t => 
      t.active && t.keywords.some(kw => kw.toLowerCase() === normalizedKey)
    );
    
    if (trigger?.spriteUrl) {
      console.log(`[UnifiedTriggerExecutor] Found sprite in legacy trigger "${trigger.name}": ${trigger.spriteUrl}`);
      return { 
        url: trigger.spriteUrl, 
        label: trigger.spriteState,
        fallbackDelayMs: trigger.returnToIdleMs,
      };
    }
  }
  
  // 5. Search in sprite config state collections
  if (character.spriteConfig?.stateCollections) {
    // Check if key matches a state name
    for (const [stateName, collection] of Object.entries(character.spriteConfig.stateCollections)) {
      if (stateName.toLowerCase() === normalizedKey && collection.entries.length > 0) {
        const entry = collection.entries.find(e => e.role === 'principal') || collection.entries[0];
        if (entry?.spriteUrl) {
          console.log(`[UnifiedTriggerExecutor] Found sprite in state collection "${stateName}": ${entry.spriteUrl}`);
          return { url: entry.spriteUrl, label: entry.spriteLabel };
        }
      }
    }
  }
  
  console.log(`[UnifiedTriggerExecutor] No sprite found for key "${key}" in character "${character.name}"`);
  return null;
}

// ============================================
// Sound Trigger Execution
// ============================================

/**
 * Busca un sonido que coincida con la key en las colecciones y triggers
 * 
 * IMPORTANTE: Los archivos en collection.files ya contienen URLs completas
 * (ej: "/sounds/glohg/glohg46.wav"), por lo que NO se debe añadir el path.
 */
function findSoundMatch(
  key: string,
  context: TriggerExecutionContext
): { url: string; name: string } | null {
  const { soundCollections, soundTriggers } = context;
  const normalizedKey = key.toLowerCase();
  
  // 1. Si la key es una URL directa, usarla
  if (isDirectUrl(key)) {
    return { url: key, name: key.split('/').pop() || key };
  }
  
  // 2. Buscar en sound triggers (por keywords o nombre)
  if (soundTriggers && soundTriggers.length > 0) {
    for (const trigger of soundTriggers) {
      if (!trigger.active) continue;
      
      // Buscar por keywords
      const keywordMatch = trigger.keywords.some(kw => kw.toLowerCase() === normalizedKey);
      // O por nombre del trigger
      const nameMatch = trigger.name.toLowerCase() === normalizedKey;
      
      if (keywordMatch || nameMatch) {
        // Encontrar la colección
        const collection = soundCollections?.find(c => c.name === trigger.collection);
        if (collection && collection.files.length > 0) {
          // Seleccionar archivo (random o cycle)
          let fileIndex = 0;
          if (trigger.playMode === 'random') {
            fileIndex = Math.floor(Math.random() * collection.files.length);
          }
          // Los archivos ya contienen la URL completa
          const file = collection.files[fileIndex];
          // Si el archivo ya es una URL completa, usarla directamente
          const url = file.startsWith('/') ? file : `${collection.path}/${file}`;
          console.log(`[UnifiedTriggerExecutor] Found sound match: trigger "${trigger.name}" -> ${url}`);
          return { url, name: trigger.name };
        }
      }
    }
  }
  
  // 3. Formato "collection/filename"
  if (key.includes('/')) {
    const [collectionName, filename] = key.split('/');
    const collection = soundCollections?.find(c => c.name.toLowerCase() === collectionName.toLowerCase());
    if (collection) {
      // Buscar el archivo en la colección
      const file = collection.files.find(f => f.toLowerCase().includes(filename.toLowerCase()));
      if (file) {
        // Los archivos ya contienen la URL completa
        const url = file.startsWith('/') ? file : `${collection.path}/${file}`;
        return { url, name: `${collectionName}/${file}` };
      }
      // Si no encuentra el archivo específico, usar el primero
      if (collection.files.length > 0) {
        const firstFile = collection.files[0];
        const url = firstFile.startsWith('/') ? firstFile : `${collection.path}/${firstFile}`;
        return { url, name: `${collectionName}/${firstFile}` };
      }
    }
  }
  
  // 4. Buscar por nombre de colección
  if (soundCollections && soundCollections.length > 0) {
    for (const collection of soundCollections) {
      if (collection.name.toLowerCase() === normalizedKey && collection.files.length > 0) {
        // Usar un archivo random de la colección
        const fileIndex = Math.floor(Math.random() * collection.files.length);
        const file = collection.files[fileIndex];
        // Los archivos ya contienen la URL completa
        const url = file.startsWith('/') ? file : `${collection.path}/${file}`;
        return { url, name: `${collection.name}/${file}` };
      }
    }
  }
  
  return null;
}

/**
 * Ejecuta un trigger de sonido
 */
function executeSoundTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  _character: CharacterCard,
  volume: number = 0.8
): TriggerExecutionResult {
  const { storeActions, soundSettings } = context;
  
  try {
    // Determine sound URL
    let soundUrl: string;
    let soundName: string;
    
    // Buscar el sonido en las colecciones y triggers
    const soundMatch = findSoundMatch(key, context);
    
    if (soundMatch) {
      soundUrl = soundMatch.url;
      soundName = soundMatch.name;
      console.log(`[UnifiedTriggerExecutor] Found sound match: ${soundName} -> ${soundUrl}`);
    } else if (isDirectUrl(key)) {
      // Use key directly as URL
      soundUrl = key;
      soundName = key.split('/').pop() || key;
      console.log(`[UnifiedTriggerExecutor] Using direct URL for sound: ${key}`);
    } else {
      // No se encontró el sonido
      console.log(`[UnifiedTriggerExecutor] No sound found for key "${key}"`);
      return {
        success: false,
        category: 'sound',
        key,
        targetCharacterId: context.characterId,
        error: `No sound found for key "${key}"`,
      };
    }
    
    const finalVolume = volume * (soundSettings?.globalVolume ?? 1);
    
    console.log(`[UnifiedTriggerExecutor] Executing sound trigger: ${soundUrl} at volume ${finalVolume}`);
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-sound-${Date.now()}`,
      triggerType: 'sound',
      keyword: key,
      data: {
        soundUrl,
        volume: finalVolume,
        triggerName: `Reward: ${soundName}`,
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character: context.character,
      fullText: `[REWARD:sound:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Execute sound trigger (this adds to audio queue)
    executeSoundTrigger(match, triggerContext);
    
    return {
      success: true,
      category: 'sound',
      key,
      targetCharacterId: context.characterId,
      message: `Sound "${soundName}" queued for playback`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'sound',
      key,
      targetCharacterId: context.characterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Background Trigger Execution
// ============================================

/**
 * Busca un fondo que coincida con la key en los background packs
 */
function findBackgroundMatch(
  key: string,
  context: TriggerExecutionContext
): { url: string; name: string; overlays?: BackgroundOverlay[] } | null {
  const { backgroundPacks } = context;
  const normalizedKey = key.toLowerCase();
  
  // 1. Si la key es una URL directa, usarla
  if (isDirectUrl(key)) {
    return { url: key, name: key.split('/').pop() || key };
  }
  
  // 2. Buscar en background packs
  if (backgroundPacks && backgroundPacks.length > 0) {
    // Ordenar por prioridad (mayor primero)
    const sortedPacks = [...backgroundPacks]
      .filter(p => p.active)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    for (const pack of sortedPacks) {
      // Buscar en los items del pack
      for (const item of pack.items) {
        if (!item.enabled) continue;
        
        // Buscar por triggerKeys
        const keyMatch = item.triggerKeys.some(tk => tk.toLowerCase() === normalizedKey);
        // Buscar por backgroundName
        const nameMatch = item.backgroundName.toLowerCase() === normalizedKey;
        
        if (keyMatch || nameMatch) {
          console.log(`[UnifiedTriggerExecutor] Found background match: "${item.backgroundName}" in pack "${pack.name}"`);
          return {
            url: item.backgroundUrl,
            name: item.backgroundName,
            overlays: item.overlays ?? pack.defaultOverlays ?? [],
          };
        }
      }
      
      // También buscar por nombre del pack
      if (pack.name.toLowerCase() === normalizedKey) {
        // Usar el defaultBackground del pack o el primer item
        if (pack.defaultBackground) {
          return {
            url: pack.defaultBackground,
            name: pack.name,
            overlays: pack.defaultOverlays ?? [],
          };
        }
        if (pack.items.length > 0) {
          const firstItem = pack.items.find(i => i.enabled);
          if (firstItem) {
            return {
              url: firstItem.backgroundUrl,
              name: firstItem.backgroundName,
              overlays: firstItem.overlays ?? pack.defaultOverlays ?? [],
            };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Ejecuta un trigger de fondo
 */
function executeBackgroundTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  _character: CharacterCard,
  transitionDuration?: number
): TriggerExecutionResult {
  const { storeActions, backgroundSettings } = context;
  
  try {
    if (!storeActions.setBackground) {
      return {
        success: false,
        category: 'background',
        key,
        targetCharacterId: context.characterId,
        error: 'Background change not available',
      };
    }
    
    // Buscar el fondo en los background packs
    let backgroundUrl: string;
    let backgroundName: string;
    let overlays: BackgroundOverlay[] = [];
    
    const bgMatch = findBackgroundMatch(key, context);
    
    if (bgMatch) {
      backgroundUrl = bgMatch.url;
      backgroundName = bgMatch.name;
      overlays = bgMatch.overlays ?? [];
      console.log(`[UnifiedTriggerExecutor] Found background match: ${backgroundName} -> ${backgroundUrl}`);
    } else if (isDirectUrl(key)) {
      // Direct URL
      backgroundUrl = key;
      backgroundName = key.split('/').pop() || key;
    } else {
      // No se encontró el fondo
      console.log(`[UnifiedTriggerExecutor] No background found for key "${key}"`);
      return {
        success: false,
        category: 'background',
        key,
        targetCharacterId: context.characterId,
        error: `No background found for key "${key}"`,
      };
    }
    
    // Create synthetic trigger match
    const match: TriggerMatch = {
      triggerId: `reward-background-${Date.now()}`,
      triggerType: 'background',
      keyword: key,
      data: {
        backgroundUrl,
        backgroundName,
        transitionDuration: transitionDuration ?? backgroundSettings?.transitionDuration ?? 500,
        transitionType: backgroundSettings?.defaultTransitionType ?? 'fade',
        overlays,
      },
    };
    
    // Create trigger context
    const triggerContext: TriggerContext = {
      character: context.character,
      fullText: `[REWARD:background:${key}]`,
      messageKey: `reward-${Date.now()}`,
      isStreaming: false,
      timestamp: Date.now(),
    };
    
    // Execute background trigger
    executeBackgroundTrigger(match, triggerContext, {
      setBackground: storeActions.setBackground,
      setOverlays: storeActions.setActiveOverlays,
    });
    
    return {
      success: true,
      category: 'background',
      key,
      targetCharacterId: context.characterId,
      message: `Background changed to "${backgroundName}"`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'background',
      key,
      targetCharacterId: context.characterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Sound Sequence Trigger Execution
// ============================================

/**
 * Ejecuta un trigger de secuencia de sonido
 * Busca la secuencia por su key (activationKey o nombre) y reproduce todos los sonidos en orden
 */
function executeSoundSequenceTriggerForCharacter(
  key: string,
  context: TriggerExecutionContext,
  _character: CharacterCard,
  volume: number = 0.8
): TriggerExecutionResult {
  const { soundSequenceTriggers, soundTriggers, soundCollections, soundSettings } = context;

  try {
    // Check if we have the required resources
    if (!soundSequenceTriggers || soundSequenceTriggers.length === 0) {
      return {
        success: false,
        category: 'soundSequence',
        key,
        targetCharacterId: context.characterId,
        error: 'No sound sequence triggers configured',
      };
    }

    const normalizedKey = key.toLowerCase();

    // Find the sequence by activationKey or name
    const sequence = soundSequenceTriggers.find(s =>
      s.active && (
        (s.activationKey && s.activationKey.toLowerCase() === normalizedKey) ||
        s.name.toLowerCase() === normalizedKey
      )
    );

    if (!sequence) {
      return {
        success: false,
        category: 'soundSequence',
        key,
        targetCharacterId: context.characterId,
        error: `No sound sequence found for key "${key}"`,
      };
    }

    console.log(`[UnifiedTriggerExecutor] Executing sound sequence "${sequence.name}" with ${sequence.sequence.length} sounds`);

    // Track cyclic indexes per trigger
    const cycleIndexes = new Map<string, number>();
    const globalVolume = soundSettings?.globalVolume ?? 1;
    const sequenceVolume = sequence.volume ?? 1;

    // Process each sound in the sequence
    for (const keyword of sequence.sequence) {
      // Find the sound trigger for this keyword
      const trigger = soundTriggers?.find(t =>
        t.active && t.keywords.includes(keyword) && t.keywordsEnabled?.[keyword] !== false
      );

      if (!trigger) {
        console.warn(`[UnifiedTriggerExecutor] Sound sequence: No trigger found for keyword "${keyword}"`);
        continue;
      }

      // Find the collection
      const collection = soundCollections?.find(c => c.name === trigger.collection);
      if (!collection || collection.files.length === 0) {
        console.warn(`[UnifiedTriggerExecutor] Sound sequence: No collection "${trigger.collection}" for trigger "${trigger.name}"`);
        continue;
      }

      // Get sound file based on trigger's play mode
      let soundFile: string;
      if (trigger.playMode === 'random') {
        const randomIndex = Math.floor(Math.random() * collection.files.length);
        soundFile = collection.files[randomIndex];
      } else {
        // Cyclic mode - track index per trigger
        const currentIdx = cycleIndexes.get(trigger.id) ?? trigger.currentIndex ?? 0;
        soundFile = collection.files[currentIdx];
        cycleIndexes.set(trigger.id, (currentIdx + 1) % collection.files.length);
      }

      if (!soundFile) continue;

      // Calculate volume: sequence volume * trigger volume * reward volume * global volume
      const triggerVolume = trigger.volume ?? 1;
      const finalVolume = sequenceVolume * triggerVolume * volume * globalVolume;

      // Build sound URL
      const soundUrl = soundFile.startsWith('/') ? soundFile : `${collection.path}/${soundFile}`;

      // Create synthetic trigger match for each sound in sequence
      const match: TriggerMatch = {
        triggerId: `reward-sound-sequence-${Date.now()}-${keyword}`,
        triggerType: 'sound',
        keyword: keyword,
        data: {
          soundUrl,
          volume: Math.min(1, Math.max(0, finalVolume)),
          triggerName: `${sequence.name} → ${trigger.name}`,
        },
      };

      // Create trigger context
      const triggerContext: TriggerContext = {
        character: context.character,
        fullText: `[REWARD:soundSequence:${key}:${keyword}]`,
        messageKey: `reward-${Date.now()}`,
        isStreaming: false,
        timestamp: Date.now(),
      };

      // Execute sound trigger (adds to audio queue)
      executeSoundTrigger(match, triggerContext);

      console.log(`[UnifiedTriggerExecutor] Sound sequence: Queued "${trigger.name}" (${keyword})`);
    }

    return {
      success: true,
      category: 'soundSequence',
      key,
      targetCharacterId: context.characterId,
      message: `Sound sequence "${sequence.name}" queued (${sequence.sequence.length} sounds)`,
    };
  } catch (error) {
    return {
      success: false,
      category: 'soundSequence',
      key,
      targetCharacterId: context.characterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Main Execution Functions
// ============================================

/**
 * Ejecuta un trigger de recompensa para un personaje específico
 */
export function executeTriggerForCharacter(
  category: TriggerCategory,
  key: string,
  character: CharacterCard,
  context: TriggerExecutionContext,
  options?: {
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }
): TriggerExecutionResult {
  switch (category) {
    case 'sprite':
      return executeSpriteTriggerForCharacter(key, context, character, options?.returnToIdleMs ?? 0);
    case 'sound':
      return executeSoundTriggerForCharacter(key, context, character, options?.volume ?? 0.8);
    case 'background':
      return executeBackgroundTriggerForCharacter(key, context, character, options?.transitionDuration);
    case 'soundSequence':
      return executeSoundSequenceTriggerForCharacter(key, context, character, options?.volume ?? 0.8);
    default:
      return {
        success: false,
        category: category as TriggerCategory,
        key,
        targetCharacterId: character.id,
        error: `Unknown trigger category: ${category}`,
      };
  }
}

/**
 * Ejecuta un trigger de recompensa con soporte para targetMode
 * 
 * @param category - Categoría del trigger (sprite, sound, background)
 * @param key - Key del trigger
 * @param context - Contexto de ejecución
 * @param targetMode - Quién recibe el trigger
 * @param options - Opciones específicas por categoría
 */
export function executeTriggerReward(
  category: TriggerCategory,
  key: string,
  context: TriggerExecutionContext,
  targetMode: TriggerTargetMode = 'self',
  options?: {
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }
): TriggerExecutionResult[] {
  // Determine target characters based on targetMode
  const targetCharacters = getTargetCharacters(targetMode, context);
  
  if (targetCharacters.length === 0) {
    return [{
      success: false,
      category,
      key,
      targetCharacterId: context.characterId,
      error: 'No target characters found',
    }];
  }
  
  // Execute trigger for each target
  const results: TriggerExecutionResult[] = [];
  
  for (const targetChar of targetCharacters) {
    const result = executeTriggerForCharacter(category, key, targetChar, context, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Ejecuta múltiples triggers de recompensa
 */
export function executeTriggerRewards(
  triggers: Array<{
    category: TriggerCategory;
    key: string;
    targetMode: TriggerTargetMode;
    returnToIdleMs?: number;
    volume?: number;
    transitionDuration?: number;
  }>,
  context: TriggerExecutionContext
): TriggerBatchResult {
  const results: TriggerExecutionResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (const trigger of triggers) {
    const triggerResults = executeTriggerReward(
      trigger.category,
      trigger.key,
      context,
      trigger.targetMode,
      {
        returnToIdleMs: trigger.returnToIdleMs,
        volume: trigger.volume,
        transitionDuration: trigger.transitionDuration,
      }
    );
    
    for (const result of triggerResults) {
      results.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Determina los personajes objetivo según targetMode
 */
function getTargetCharacters(
  targetMode: TriggerTargetMode,
  context: TriggerExecutionContext
): CharacterCard[] {
  switch (targetMode) {
    case 'self':
      return context.character ? [context.character] : [];
      
    case 'all':
      // For group chats, return all characters
      if (context.allCharacters && context.allCharacters.length > 0) {
        return context.allCharacters;
      }
      // Fallback to self if no group
      return context.character ? [context.character] : [];
      
    case 'target':
      // Specific target character
      if (context.targetCharacterId && context.allCharacters) {
        const targetChar = context.allCharacters.find(
          (c: CharacterCard) => c.id === context.targetCharacterId
        );
        if (targetChar) {
          return [targetChar];
        }
      }
      // Fallback to self if target not found
      return context.character ? [context.character] : [];
      
    default:
      return context.character ? [context.character] : [];
  }
}

// ============================================
// Export Index
// ============================================

export type {
  TriggerExecutionContext,
  TriggerStoreActions,
  TriggerExecutionResult,
  TriggerBatchResult,
};
