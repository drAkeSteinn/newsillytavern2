/**
 * Sprite System Migration Utilities — Comprehensive Legacy → V2
 * 
 * This module provides utilities to migrate ALL legacy sprite data to the V2 system:
 * 
 * - CharacterSprite[] → SpritePackV2 (via migrateLegacySprites)
 * - SpriteConfig.sprites → StateCollectionV2[] (via createStateCollectionsFromConfig)
 * - SpriteConfig.stateCollections → StateCollectionV2[] (via migrateLegacyStateCollections)
 * - CharacterSpriteTrigger[] → TriggerCollection[] (via migrateLegacySpriteTrigger)
 * - Full character migration with report (via migrateCharacterSprites)
 * 
 * Key principles:
 * - Idempotent: running twice produces the same result
 * - Preserves existing V2 data (never overwrites)
 * - Uses crypto.randomUUID() for IDs
 * - Returns detailed migration reports with warnings
 */

import type {
  CharacterCard,
  CharacterSprite,
  CharacterSpriteTrigger,
  SpriteConfig,
  StateSpriteCollection,
  StateCollectionEntry,
  SpriteState,
  CollectionBehavior,
  ReturnToMode,
  // V2 Types
  TriggerCollection,
  SpritePackV2,
  SpritePackEntryV2,
  StateCollectionV2,
  SpriteTriggerConfig,
  TriggerFallbackMode,
} from '@/types';
import { getLogger } from '@/lib/logger';
import { warnLegacyField, warnLegacyType } from './deprecation-warnings';

// UUID generator using crypto.randomUUID
const uuidv4 = () => crypto.randomUUID();

const logger = getLogger('sprite-migration');

// ============================================
// Migration Result Types
// ============================================

export interface MigrationResult {
  success: boolean;
  /** Migrated trigger collections (existing + new) */
  triggerCollections: TriggerCollection[];
  /** Migrated sprite packs V2 (existing + new) */
  spritePacksV2: SpritePackV2[];
  /** Migrated state collections V2 (existing + new) */
  stateCollectionsV2: StateCollectionV2[];
  /** Warnings generated during migration */
  warnings: string[];
  /** Errors that prevented migration */
  errors: string[];
  /** Detailed report of what was migrated */
  report: MigrationReport;
}

export interface MigrationReport {
  /** Number of CharacterSprite entries migrated */
  spritesMigrated: number;
  /** Number of CharacterSpriteTrigger entries migrated */
  triggersMigrated: number;
  /** Number of StateSpriteCollection entries migrated */
  stateCollectionsMigrated: number;
  /** Number of SpriteConfig URL entries migrated */
  configUrlsMigrated: number;
  /** Number of SpritePackV2 created */
  packsCreated: number;
  /** Number of TriggerCollection created */
  triggerCollectionsCreated: number;
  /** Number of StateCollectionV2 created */
  stateCollectionsCreated: number;
  /** Whether any legacy data was found */
  hasLegacyData: boolean;
  /** Whether any V2 data already existed */
  hasExistingV2Data: boolean;
}

export interface MigrationOptions {
  /** Create default state collections from spriteConfig (default: true) */
  createDefaultStateCollections?: boolean;
  /** Default pack name for new packs (default: "Migrated Sprites") */
  defaultPackName?: string;
  /** Whether to skip migration if V2 data already exists for a category (default: true) */
  skipIfV2Exists?: boolean;
}

// ============================================
// Individual Migration Functions
// ============================================

/**
 * Migrate CharacterSprite[] → SpritePackV2
 * Creates a single "Legacy Sprites" pack containing all CharacterSprite entries.
 * 
 * Mapping:
 *   CharacterSprite.imageUrl → SpritePackEntryV2.url
 *   CharacterSprite.name/expression → SpritePackEntryV2.label
 *   CharacterSprite.state → tag
 */
export function migrateLegacySprites(
  sprites: CharacterSprite[],
  packName?: string
): { pack: SpritePackV2; warnings: string[] } {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  warnLegacyType('CharacterSprite', 'SpritePackEntryV2');

  const packEntries: SpritePackEntryV2[] = sprites.map((sprite) => {
    if (!sprite.imageUrl) {
      warnings.push(`Sprite "${sprite.name || sprite.id}" has no imageUrl, skipping entry`);
    }

    const label = sprite.name || sprite.expression || `sprite_${sprite.id.slice(0, 8)}`;
    const tags: string[] = [];
    if (sprite.state) tags.push(sprite.state);
    if (sprite.expression && sprite.expression !== label) tags.push(sprite.expression);

    return {
      id: uuidv4(),
      label,
      url: sprite.imageUrl || '',
      tags: tags.length > 0 ? tags : undefined,
      isAnimated: sprite.animations && sprite.animations.length > 0 ? true : undefined,
    };
  }).filter(entry => entry.url !== ''); // Remove entries with no URL

  const pack: SpritePackV2 = {
    id: uuidv4(),
    name: packName || 'Migrated Sprites',
    description: 'Auto-migrated from legacy CharacterSprite[] data',
    sprites: packEntries,
    createdAt: now,
    updatedAt: now,
  };

  return { pack, warnings };
}

/**
 * Migrate a single CharacterSpriteTrigger → TriggerCollection
 * 
 * Mapping:
 *   trigger.key → collection.collectionKey
 *   trigger.keys → collection.collectionKeys
 *   trigger.requirePipes → collection.collectionKeyRequirePipes
 *   trigger.caseSensitive → collection.collectionKeyCaseSensitive
 *   trigger.returnToIdleMs → collection.fallbackDelayMs
 *   trigger.returnToMode → collection.fallbackMode
 *   trigger.returnToSpriteUrl → used to create fallback sprite
 *   trigger.cooldownMs → collection.cooldownMs
 *   trigger.priority → collection.priority
 *   trigger.spriteUrl → creates a SpritePackEntryV2 in the pack
 */
export function migrateLegacySpriteTrigger(
  trigger: CharacterSpriteTrigger,
  pack: SpritePackV2
): { collection: TriggerCollection; warnings: string[] } {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  warnLegacyType('CharacterSpriteTrigger', 'TriggerCollection');

  // Find or create a sprite entry in the pack for the trigger's spriteUrl
  let spriteEntry = pack.sprites.find(s => s.url === trigger.spriteUrl);
  if (!spriteEntry && trigger.spriteUrl) {
    spriteEntry = {
      id: uuidv4(),
      label: trigger.title || trigger.spriteState || `trigger_sprite_${trigger.id.slice(0, 8)}`,
      url: trigger.spriteUrl,
      tags: trigger.spriteState ? [trigger.spriteState] : undefined,
    };
    pack.sprites.push(spriteEntry);
  }

  // Handle fallback sprite (returnToSpriteUrl)
  let fallbackSpriteId: string | undefined;
  if (trigger.returnToSpriteUrl) {
    let fallbackEntry = pack.sprites.find(s => s.url === trigger.returnToSpriteUrl);
    if (!fallbackEntry) {
      fallbackEntry = {
        id: uuidv4(),
        label: `fallback_${trigger.id.slice(0, 8)}`,
        url: trigger.returnToSpriteUrl,
      };
      pack.sprites.push(fallbackEntry);
    }
    fallbackSpriteId = fallbackEntry.id;
  }

  // Map returnToMode to TriggerFallbackMode
  const fallbackMode = mapReturnToMode(trigger.returnToMode, warnings);

  // Build spriteConfigs - the primary sprite config
  const spriteConfigs: Record<string, SpriteTriggerConfig> = {};
  if (spriteEntry) {
    // Get all keys (main key + alternative keys + legacy keywords)
    const allKeys: string[] = [];
    if (trigger.key) allKeys.push(trigger.key);
    if (trigger.keys && trigger.keys.length > 0) allKeys.push(...trigger.keys);
    if (allKeys.length === 0 && trigger.keywords && trigger.keywords.length > 0) {
      allKeys.push(...trigger.keywords);
    }

    spriteConfigs[spriteEntry.id] = {
      spriteId: spriteEntry.id,
      key: allKeys[0] || '',
      keys: allKeys.length > 1 ? allKeys.slice(1) : undefined,
      requirePipes: trigger.requirePipes ?? true,
      caseSensitive: trigger.caseSensitive ?? false,
      fallbackMode,
      fallbackSpriteId,
      fallbackDelayMs: trigger.returnToIdleMs,
      useTimelineSounds: false,
      enabled: trigger.active !== false,
    };
  }

  // Get the main collection key
  const collectionKey = trigger.key || (trigger.keywords && trigger.keywords.length > 0 ? trigger.keywords[0] : '');
  const collectionKeys = trigger.keys || (trigger.keywords && trigger.keywords.length > 1 ? trigger.keywords.slice(1) : undefined);

  const collection: TriggerCollection = {
    id: uuidv4(),
    name: trigger.title || 'Migrated Trigger',
    active: trigger.active !== false,
    priority: trigger.priority ?? 1,
    packId: pack.id,
    collectionKey: collectionKey || '',
    collectionKeys,
    collectionKeyRequirePipes: trigger.requirePipes,
    collectionKeyCaseSensitive: trigger.caseSensitive,
    collectionBehavior: 'principal',
    principalSpriteId: spriteEntry?.id,
    fallbackMode,
    fallbackSpriteId,
    fallbackDelayMs: trigger.returnToIdleMs ?? 0,
    useTimelineSounds: false,
    cooldownMs: trigger.cooldownMs ?? 0,
    spriteConfigs,
    createdAt: now,
    updatedAt: now,
  };

  return { collection, warnings };
}

/**
 * Map legacy ReturnToMode to TriggerFallbackMode
 */
function mapReturnToMode(mode: ReturnToMode | undefined, warnings: string[]): TriggerFallbackMode {
  if (!mode) return 'idle_collection';
  
  switch (mode) {
    case 'idle_collection':
      return 'idle_collection';
    case 'custom_sprite':
      return 'custom_sprite';
    default:
      warnings.push(`Unknown ReturnToMode "${mode}", defaulting to 'idle_collection'`);
      return 'idle_collection';
  }
}

/**
 * Migrate SpriteConfig.stateCollections → StateCollectionV2[]
 * 
 * For each state in stateCollections:
 *   - Creates a SpritePackV2 with the entries as sprites
 *   - Creates a StateCollectionV2 referencing that pack
 *   - Maps behavior: 'principal' | 'random' | 'list' (same in V2)
 */
export function migrateLegacyStateCollections(
  stateCollections: { [key in SpriteState]?: StateSpriteCollection },
  characterName?: string
): { packs: SpritePackV2[]; stateCollectionsV2: StateCollectionV2[]; warnings: string[] } {
  const warnings: string[] = [];
  const packs: SpritePackV2[] = [];
  const stateCollectionsV2: StateCollectionV2[] = [];
  const now = new Date().toISOString();

  warnLegacyType('StateSpriteCollection', 'StateCollectionV2');

  const states: SpriteState[] = ['idle', 'talk', 'thinking'];

  for (const state of states) {
    const legacyCollection = stateCollections[state];
    if (!legacyCollection) continue;

    // Create pack entries from the legacy collection
    const packEntries: SpritePackEntryV2[] = legacyCollection.entries.map((entry) => ({
      id: uuidv4(),
      label: entry.spriteLabel || `sprite_${entry.id.slice(0, 8)}`,
      url: entry.spriteUrl,
      tags: [state, entry.role],
      isDefault: entry.role === 'principal',
    }));

    // Filter out entries with empty URLs
    const validEntries = packEntries.filter(e => e.url);
    if (validEntries.length === 0) {
      warnings.push(`State "${state}" collection has no valid sprite URLs, skipping`);
      continue;
    }

    const packName = characterName
      ? `${characterName} - ${state.charAt(0).toUpperCase() + state.slice(1)} Pack`
      : `${state.charAt(0).toUpperCase() + state.slice(1)} State Pack`;

    const pack: SpritePackV2 = {
      id: uuidv4(),
      name: packName,
      description: `Auto-migrated from legacy state collection for ${state}`,
      sprites: validEntries,
      createdAt: now,
      updatedAt: now,
    };
    packs.push(pack);

    // Find principal sprite (first principal role or first entry)
    const principalEntry = validEntries.find(e => e.isDefault) || validEntries[0];

    // Map behavior (same values in V2)
    const behavior = mapBehavior(legacyCollection.behavior, warnings);

    const stateCollection: StateCollectionV2 = {
      state,
      packId: pack.id,
      behavior,
      principalSpriteId: behavior === 'principal' ? principalEntry.id : undefined,
      spriteOrder: behavior === 'list' ? validEntries.map(e => e.id) : undefined,
      currentIndex: legacyCollection.currentIndex || 0,
    };
    stateCollectionsV2.push(stateCollection);
  }

  return { packs, stateCollectionsV2, warnings };
}

/**
 * Map legacy CollectionBehavior to V2 behavior
 */
function mapBehavior(behavior: CollectionBehavior, _warnings: string[]): 'principal' | 'random' | 'list' {
  // Same values in both systems
  return behavior;
}

/**
 * Create default State Collections V2 from SpriteConfig.sprites URL map
 * (existing functionality, preserved)
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
// Full Character Migration (Comprehensive)
// ============================================

/**
 * Migrate ALL legacy sprite data for a character to V2.
 * 
 * This function:
 * 1. Migrates CharacterSprite[] → SpritePackV2
 * 2. Migrates SpriteConfig.sprites → StateCollectionV2[]
 * 3. Migrates SpriteConfig.stateCollections → StateCollectionV2[] + SpritePackV2[]
 * 4. Migrates CharacterSpriteTrigger[] → TriggerCollection[] + SpritePackV2[]
 * 5. Preserves all existing V2 data
 * 6. Returns detailed migration report
 * 
 * The migration is idempotent — running it twice produces the same result.
 */
export function migrateCharacterSprites(
  character: CharacterCard,
  options: MigrationOptions = {}
): MigrationResult {
  const {
    createDefaultStateCollections = true,
    defaultPackName = 'Migrated Sprites',
    skipIfV2Exists = true,
  } = options;

  const result: MigrationResult = {
    success: true,
    triggerCollections: [...(character.triggerCollections || [])],
    spritePacksV2: [...(character.spritePacksV2 || [])],
    stateCollectionsV2: [...(character.stateCollectionsV2 || [])],
    warnings: [],
    errors: [],
    report: {
      spritesMigrated: 0,
      triggersMigrated: 0,
      stateCollectionsMigrated: 0,
      configUrlsMigrated: 0,
      packsCreated: 0,
      triggerCollectionsCreated: 0,
      stateCollectionsCreated: 0,
      hasLegacyData: false,
      hasExistingV2Data: false,
    },
  };

  try {
    const existingV2Packs = result.spritePacksV2.length;
    const existingV2Collections = result.triggerCollections.length;
    const existingV2StateCollections = result.stateCollectionsV2.length;
    result.report.hasExistingV2Data = existingV2Packs > 0 || existingV2Collections > 0 || existingV2StateCollections > 0;

    // ---- 1. Migrate CharacterSprite[] → SpritePackV2 ----
    const hasLegacySprites = character.sprites && character.sprites.length > 0;
    if (hasLegacySprites) {
      result.report.hasLegacyData = true;
      warnLegacyField('sprites', 'spritePacksV2');

      // Only migrate if no existing V2 packs or skipIfV2Exists is false
      if (!skipIfV2Exists || existingV2Packs === 0) {
        const { pack, warnings } = migrateLegacySprites(character.sprites, defaultPackName);
        result.warnings.push(...warnings);
        result.spritePacksV2.push(pack);
        result.report.spritesMigrated = character.sprites.length;
        result.report.packsCreated++;
      } else {
        result.warnings.push('Skipped CharacterSprite[] migration: V2 sprite packs already exist');
      }
    }

    // ---- 2. Migrate SpriteConfig.stateCollections → StateCollectionV2[] + SpritePackV2[] ----
    const hasLegacyStateCollections = character.spriteConfig?.stateCollections &&
      Object.keys(character.spriteConfig.stateCollections).length > 0;
    if (hasLegacyStateCollections) {
      result.report.hasLegacyData = true;
      warnLegacyField('spriteConfig.stateCollections', 'stateCollectionsV2');

      if (!skipIfV2Exists || existingV2StateCollections === 0) {
        const { packs, stateCollectionsV2, warnings } = migrateLegacyStateCollections(
          character.spriteConfig!.stateCollections!,
          character.name
        );
        result.warnings.push(...warnings);
        result.spritePacksV2.push(...packs);
        
        // Merge state collections (don't overwrite existing states)
        for (const sc of stateCollectionsV2) {
          const existingIdx = result.stateCollectionsV2.findIndex(c => c.state === sc.state);
          if (existingIdx < 0) {
            result.stateCollectionsV2.push(sc);
            result.report.stateCollectionsCreated++;
          }
        }

        result.report.stateCollectionsMigrated = stateCollectionsV2.length;
        result.report.packsCreated += packs.length;
      } else {
        result.warnings.push('Skipped stateCollections migration: V2 state collections already exist');
      }
    }

    // ---- 3. Migrate SpriteConfig.sprites URLs → StateCollectionV2[] ----
    if (createDefaultStateCollections && character.spriteConfig?.sprites) {
      const configUrls = Object.values(character.spriteConfig.sprites).filter(Boolean);
      if (configUrls.length > 0) {
        result.report.hasLegacyData = true;
        warnLegacyField('spriteConfig.sprites', 'stateCollectionsV2');

        const stateCollections = createStateCollectionsFromConfig(character, result.spritePacksV2);
        
        let urlsMigrated = 0;
        for (const sc of stateCollections) {
          const existingIdx = result.stateCollectionsV2.findIndex(c => c.state === sc.state);
          if (existingIdx < 0) {
            result.stateCollectionsV2.push(sc);
            result.report.stateCollectionsCreated++;
            urlsMigrated++;
          }
        }
        result.report.configUrlsMigrated = urlsMigrated;

        // Count new packs created by this step
        result.report.packsCreated = result.spritePacksV2.length - existingV2Packs;
      }
    }

    // ---- 4. Migrate CharacterSpriteTrigger[] → TriggerCollection[] ----
    const hasLegacyTriggers = character.spriteTriggers && character.spriteTriggers.length > 0;
    if (hasLegacyTriggers) {
      result.report.hasLegacyData = true;
      warnLegacyField('spriteTriggers', 'triggerCollections');

      if (!skipIfV2Exists || existingV2Collections === 0) {
        // Create a trigger migration pack if not already created from sprites
        let triggerPack = result.spritePacksV2.find(p => p.name === `${defaultPackName} - Triggers`);
        if (!triggerPack) {
          triggerPack = {
            id: uuidv4(),
            name: `${defaultPackName} - Triggers`,
            description: 'Auto-migrated from legacy CharacterSpriteTrigger[] data',
            sprites: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          result.spritePacksV2.push(triggerPack);
          result.report.packsCreated++;
        }

        for (const legacyTrigger of character.spriteTriggers!) {
          const { collection, warnings } = migrateLegacySpriteTrigger(legacyTrigger, triggerPack);
          result.warnings.push(...warnings);
          result.triggerCollections.push(collection);
          result.report.triggersMigrated++;
          result.report.triggerCollectionsCreated++;
        }
      } else {
        result.warnings.push('Skipped spriteTriggers migration: V2 trigger collections already exist');
      }
    }

    // ---- Check for legacy sprite packs ----
    const hasLegacyPacks = character.spritePacks && character.spritePacks.length > 0;
    if (hasLegacyPacks) {
      result.report.hasLegacyData = true;
      warnLegacyField('spritePacks', 'spritePacksV2');
      result.warnings.push(
        `Found ${character.spritePacks!.length} legacy SpritePack(s). ` +
        `These are used by the legacy trigger system and should be migrated manually ` +
        `by recreating them as SpritePackV2 in the sprite editor.`
      );
    }

    logger.info('Character sprite migration completed', {
      characterId: character.id,
      characterName: character.name,
      report: result.report,
      warningsCount: result.warnings.length,
    });

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during migration');
    logger.error('Character sprite migration failed', {
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
  /** Whether any legacy data exists on this character */
  hasLegacyData: boolean;
  /** Whether V2 data exists */
  hasV2Data: boolean;
  /** Number of legacy sprites */
  legacySprites: number;
  /** Number of legacy triggers */
  legacyTriggers: number;
  /** Number of legacy sprite packs */
  legacyPacks: number;
  /** Whether spriteConfig has URL map entries */
  hasConfigUrls: boolean;
  /** Whether spriteConfig has stateCollections */
  hasConfigStateCollections: boolean;
  /** Number of V2 trigger collections */
  v2Collections: number;
  /** Number of V2 packs */
  v2Packs: number;
  /** Number of V2 state collections */
  v2StateCollections: number;
  /** Whether migration is needed (has legacy data but incomplete V2 data) */
  needsMigration: boolean;
  /** Detailed breakdown of what needs migration */
  migrationItems: MigrationItem[];
}

export interface MigrationItem {
  type: 'sprites' | 'triggers' | 'stateCollections' | 'configUrls' | 'legacyPacks';
  label: string;
  count: number;
  description: string;
}

/**
 * Check migration status for a character
 */
export function getMigrationStatus(character: CharacterCard): MigrationStatus {
  const legacySprites = character.sprites?.length || 0;
  const legacyTriggers = character.spriteTriggers?.length || 0;
  const legacyPacks = character.spritePacks?.length || 0;
  const hasConfigUrls = !!(character.spriteConfig?.sprites &&
    Object.values(character.spriteConfig.sprites).some(Boolean));
  const hasConfigStateCollections = !!(character.spriteConfig?.stateCollections &&
    Object.keys(character.spriteConfig.stateCollections).length > 0);

  const v2Collections = character.triggerCollections?.length || 0;
  const v2Packs = character.spritePacksV2?.length || 0;
  const v2StateCollections = character.stateCollectionsV2?.length || 0;

  const hasLegacyData = legacySprites > 0 || legacyTriggers > 0 || legacyPacks > 0 || hasConfigUrls || hasConfigStateCollections;
  const hasV2Data = v2Collections > 0 || v2Packs > 0 || v2StateCollections > 0;

  // Build migration items list
  const migrationItems: MigrationItem[] = [];

  if (legacySprites > 0) {
    migrationItems.push({
      type: 'sprites',
      label: 'Sprites Legacy',
      count: legacySprites,
      description: `${legacySprites} sprite(s) en formato legacy → SpritePackV2`,
    });
  }

  if (legacyTriggers > 0) {
    migrationItems.push({
      type: 'triggers',
      label: 'Triggers Legacy',
      count: legacyTriggers,
      description: `${legacyTriggers} trigger(s) legacy → TriggerCollection`,
    });
  }

  if (hasConfigStateCollections) {
    const count = Object.keys(character.spriteConfig!.stateCollections!).filter(
      k => character.spriteConfig!.stateCollections![k as SpriteState]
    ).length;
    migrationItems.push({
      type: 'stateCollections',
      label: 'Colecciones de Estado',
      count,
      description: `${count} colección(es) de estado → StateCollectionV2`,
    });
  }

  if (hasConfigUrls) {
    const count = Object.values(character.spriteConfig!.sprites).filter(Boolean).length;
    migrationItems.push({
      type: 'configUrls',
      label: 'URLs de SpriteConfig',
      count,
      description: `${count} URL(s) de sprite → StateCollectionV2`,
    });
  }

  if (legacyPacks > 0) {
    migrationItems.push({
      type: 'legacyPacks',
      label: 'Sprite Packs Legacy',
      count: legacyPacks,
      description: `${legacyPacks} pack(s) legacy (migración manual recomendada)`,
    });
  }

  return {
    hasLegacyData,
    hasV2Data,
    legacySprites,
    legacyTriggers,
    legacyPacks,
    hasConfigUrls,
    hasConfigStateCollections,
    v2Collections,
    v2Packs,
    v2StateCollections,
    needsMigration: hasLegacyData,
    migrationItems,
  };
}

/**
 * Check if a character needs migration (has legacy data)
 */
export function needsMigration(character: CharacterCard): boolean {
  return getMigrationStatus(character).needsMigration;
}

/**
 * Apply migration result to a character card, returning updated partial character
 */
export function applyMigrationResult(
  character: CharacterCard,
  result: MigrationResult
): Partial<CharacterCard> {
  return {
    spritePacksV2: result.spritePacksV2,
    stateCollectionsV2: result.stateCollectionsV2,
    triggerCollections: result.triggerCollections,
  };
}

// ============================================
// Export utilities
// ============================================

export const migration = {
  migrateCharacterSprites,
  migrateLegacySprites,
  migrateLegacySpriteTrigger,
  migrateLegacyStateCollections,
  createStateCollectionsFromConfig,
  getMigrationStatus,
  needsMigration,
  applyMigrationResult,
};
