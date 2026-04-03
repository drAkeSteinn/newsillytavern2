// ============================================
// Character Slice - Character management state
// ============================================

import type { CharacterCard } from '@/types';
import { uuidv4 } from '@/lib/uuid';

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
  addCharacter: (character, preserveId = false) => set((state: any) => ({
    characters: [...state.characters, {
      ...character,
      id: (preserveId && character.id) ? character.id : uuidv4(),
      createdAt: character.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

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
