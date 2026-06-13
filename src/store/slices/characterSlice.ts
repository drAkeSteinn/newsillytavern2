// ============================================
// Character Slice - Character management state
// ============================================

import type { CharacterCard } from '@/types';
import { uuidv4 } from '@/lib/uuid';
import { needsMigration, migrateCharacterSprites, applyMigrationResult } from '@/lib/migration/sprite-migration';

/**
 * Auto-migrate legacy sprite data to V2 for a character.
 * Only runs if legacy data exists and V2 data is missing.
 * Returns the character with migrated data, or the original if no migration needed.
 * 
 * @deprecated Auto-migration is temporary during the deprecation period.
 */
function autoMigrateCharacter(character: Partial<CharacterCard> & { name: string }): Partial<CharacterCard> {
  const fullChar = character as CharacterCard;
  
  if (!needsMigration(fullChar)) {
    return character;
  }

  try {
    const result = migrateCharacterSprites(fullChar, {
      defaultPackName: `${character.name || 'Character'} - Migrated`,
      createDefaultStateCollections: true,
      skipIfV2Exists: true,
    });

    if (result.success && (result.report.packsCreated > 0 || result.report.triggerCollectionsCreated > 0 || result.report.stateCollectionsCreated > 0)) {
      const migrationUpdates = applyMigrationResult(fullChar, result);
      return {
        ...character,
        ...migrationUpdates,
      };
    }
  } catch {
    // Silently fail - auto-migration is best-effort
  }

  return character;
}

export interface CharacterSlice {
  // State
  characters: CharacterCard[];
  activeCharacterId: string | null;

  // Actions
  addCharacter: (character: Partial<CharacterCard> & { name: string }, preserveId?: boolean) => void;
  updateCharacter: (id: string, updates: Partial<CharacterCard>) => void;
  deleteCharacter: (id: string) => void;
  setActiveCharacter: (id: string | null) => void;

  // Utilities
  getActiveCharacter: () => CharacterCard | undefined;
  getCharacterById: (id: string) => CharacterCard | undefined;
}

export const createCharacterSlice = (set: any, get: any): CharacterSlice => ({
  // Initial State
  characters: [],
  activeCharacterId: null,

  // Actions
  addCharacter: (character, preserveId = false) => set((state: any) => {
    // Auto-migrate legacy sprite data on character add
    const migrated = autoMigrateCharacter(character);
    
    return {
      characters: [...state.characters, {
        ...migrated,
        id: (preserveId && character.id) ? character.id : uuidv4(),
        createdAt: character.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  updateCharacter: (id, updates) => set((state: any) => ({
    characters: state.characters.map((c: CharacterCard) =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    )
  })),

  deleteCharacter: (id) => set((state: any) => ({
    characters: state.characters.filter((c: CharacterCard) => c.id !== id),
    sessions: state.sessions.filter((s: any) => s.characterId !== id),
    activeCharacterId: state.activeCharacterId === id ? null : state.activeCharacterId
  })),

  setActiveCharacter: (id) => set({ activeCharacterId: id }),

  // Utilities
  getActiveCharacter: () => {
    const state = get();
    return state.characters.find((c: CharacterCard) => c.id === state.activeCharacterId);
  },

  getCharacterById: (id) => get().characters.find((c: CharacterCard) => c.id === id),
});
