/**
 * Sprite System Migration Utilities
 * 
 * This module provides utilities to check migration status and create
 * default state collections for characters using the V2 sprite system.
 * 
 * Legacy types have been removed - this module now only handles V2 data.
 */

import type {
  CharacterCard,
  TriggerCollection,
  SpritePackV2,
  StateCollectionV2,
  SpriteState,
} from '@/types';
import { getLogger } from '@/lib/logger';

// UUID generator using crypto.randomUUID (available in Node.js 19+ and modern browsers)
const uuidv4 = () => crypto.randomUUID();

const logger = getLogger('sprite-migration');

// ============================================
// Migration Result Types
// ============================================

export interface MigrationResult {
  success: boolean;
  triggerCollections: TriggerCollection[];
  spritePacksV2: SpritePackV2[];
  stateCollectionsV2: StateCollectionV2[];
  warnings: string[];
  errors: string[];
}

export interface MigrationOptions {
  /** Create default state collections from spriteConfig */
  createDefaultStateCollections?: boolean;
  /** Default pack name for new packs */
  defaultPackName?: string;
}

// ============================================
// State Collection Creation
// ============================================

/**
 * Create default State Collections V2 from existing sprite configuration
 */
export function createStateCollectionsFromConfig(
  character: CharacterCard,
  packsV2: SpritePackV2[]
): StateCollectionV2[] {
  const stateCollections: StateCollectionV2[] = [];
  const states: SpriteState[] = ['idle', 'talk', 'thinking'];

  for (const state of states) {
    // Check if state collection already exists
    const existing = character.stateCollectionsV2?.find(c => c.state === state);
    if (existing) {
      stateCollections.push(existing);
      continue;
    }

    // Try to create from sprite config
    const legacyUrl = character.spriteConfig?.sprites?.[state];
    if (!legacyUrl) continue;

    // Find or create a pack for this sprite
    let pack = packsV2.find(p => p.sprites.some(s => s.url === legacyUrl));
    
    if (!pack) {
      // Create a new pack for this state
      const now = new Date().toISOString();
      pack = {
        id: uuidv4(),
        name: `${state.charAt(0).toUpperCase() + state.slice(1)} Sprites`,
        description: `Auto-created for ${state} state`,
        sprites: [{
          id: uuidv4(),
          label: `${state}_default`,
          url: legacyUrl,
          tags: [state],
        }],
        createdAt: now,
        updatedAt: now,
      };
      packsV2.push(pack);
    }

    // Find the sprite in the pack
    const sprite = pack.sprites.find(s => s.url === legacyUrl);

    stateCollections.push({
      state,
      packId: pack.id,
      behavior: 'principal',
      principalSpriteId: sprite?.id,
    });
  }

  return stateCollections;
}

// ============================================
// Full Character Migration (V2 Only)
// ============================================

/**
 * Ensure character has proper V2 sprite data structure
 */
export function migrateCharacterSprites(
  character: CharacterCard,
  options: MigrationOptions = {}
): MigrationResult {
  const result: MigrationResult = {
    success: true,
    triggerCollections: character.triggerCollections || [],
    spritePacksV2: character.spritePacksV2 || [],
    stateCollectionsV2: character.stateCollectionsV2 || [],
    warnings: [],
    errors: [],
  };

  try {
    // Create state collections if needed
    if (options.createDefaultStateCollections !== false) {
      const stateCollections = createStateCollectionsFromConfig(
        character,
        result.spritePacksV2
      );
      
      // Merge with existing state collections
      for (const sc of stateCollections) {
        const existingIdx = result.stateCollectionsV2.findIndex(c => c.state === sc.state);
        if (existingIdx < 0) {
          result.stateCollectionsV2.push(sc);
        }
      }
    }

    logger.info('Character sprite check completed', {
      characterId: character.id,
      characterName: character.name,
      triggerCollections: result.triggerCollections.length,
      spritePacksV2: result.spritePacksV2.length,
      stateCollectionsV2: result.stateCollectionsV2.length,
    });

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during migration');
    logger.error('Character sprite check failed', {
      characterId: character.id,
      error,
    });
  }

  return result;
}

// ============================================
// Migration Status Check
// ============================================

export interface MigrationStatus {
  hasV2Data: boolean;
  v2Collections: number;
  v2Packs: number;
  v2StateCollections: number;
}

/**
 * Check migration status for a character
 */
export function getMigrationStatus(character: CharacterCard): MigrationStatus {
  const v2Collections = character.triggerCollections?.length || 0;
  const v2Packs = character.spritePacksV2?.length || 0;
  const v2StateCollections = character.stateCollectionsV2?.length || 0;

  return {
    hasV2Data: v2Collections > 0 || v2Packs > 0 || v2StateCollections > 0,
    v2Collections,
    v2Packs,
    v2StateCollections,
  };
}

// ============================================
// Export utilities
// ============================================

export const migration = {
  migrateCharacterSprites,
  createStateCollectionsFromConfig,
  getMigrationStatus,
};
