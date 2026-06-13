# Task 6 - FASE 6: Migración Completa del Sistema Legacy de Triggers

## Agent: Main Agent

## Summary
Implemented comprehensive legacy → V2 sprite system migration for TavernFlow. This includes adding missing type definitions, deprecation annotations, runtime warnings, a migration module with full conversion logic, a migration UI panel, and auto-migration integration.

## Files Modified
1. **`src/types/index.ts`** - Added missing legacy types (CharacterSpriteTrigger, ReturnToMode, SpritePack, SpritePackItem, SpriteLibraryEntry) with @deprecated annotations; deprecated existing legacy types (CharacterSprite, SpriteConfig, StateCollectionEntry, StateSpriteCollection); deprecated CharacterCard fields (sprites, spriteConfig, spriteTriggers, spritePacks)
2. **`src/types/triggers.ts`** - Added missing SpriteTrigger, SpritePack, SpritePackItem types with @deprecated
3. **`src/lib/migration/deprecation-warnings.ts`** (NEW) - Runtime console warnings for legacy field/type usage (once per session)
4. **`src/lib/migration/sprite-migration.ts`** - Enhanced with 6 migration functions: migrateLegacySprites, migrateLegacySpriteTrigger, migrateLegacyStateCollections, migrateCharacterSprites (full), getMigrationStatus, needsMigration, applyMigrationResult
5. **`src/components/tavern/legacy-migration-panel.tsx`** (NEW) - Migration UI panel with status cards, item list, preview, migration button, progress bar
6. **`src/components/tavern/character-editor.tsx`** - Added "Migración" tab with Database icon + LegacyMigrationPanel integration
7. **`src/lib/character-card.ts`** - Added auto-migration on import via autoMigrateOnImport(); deprecated legacy field comments
8. **`src/store/slices/characterSlice.ts`** - Added autoMigrateCharacter() function; addCharacter now auto-migrates legacy data

## Key Design Decisions
- Migration is **idempotent** — running twice produces same result
- **Preserves all existing V2 data** — never overwrites
- Uses **crypto.randomUUID()** for new IDs (no uuid package dependency)
- Auto-migration runs on character import and character add to store
- Runtime warnings only fire **once per session** to avoid console spam
- Legacy data is NOT deleted automatically — user must manually remove after verifying migration

## Migration Mapping
| Legacy Type | V2 Type | Migration Function |
|---|---|---|
| CharacterSprite[] | SpritePackV2 | migrateLegacySprites() |
| CharacterSpriteTrigger | TriggerCollection | migrateLegacySpriteTrigger() |
| SpriteConfig.stateCollections | StateCollectionV2[] + SpritePackV2[] | migrateLegacyStateCollections() |
| SpriteConfig.sprites URLs | StateCollectionV2[] | createStateCollectionsFromConfig() |
| spriteTriggers[] | TriggerCollection[] | migrateCharacterSprites() step 4 |
| spritePacks[] | Manual migration recommended | Warning issued |

## Lint & Dev Server
- ✅ ESLint passes with no errors
- ✅ Dev server compiles without errors
