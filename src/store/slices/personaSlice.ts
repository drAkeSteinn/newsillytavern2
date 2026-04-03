// ============================================
// Persona Slice - User personas management
// ============================================

import type { Persona } from '@/types';
import { uuidv4 } from '@/lib/uuid';
import { defaultPersona } from '../defaults';

export interface PersonaSlice {
  // State
  personas: Persona[];
  activePersonaId: string | null;

  // Actions
  addPersona: (persona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePersona: (id: string, updates: Partial<Persona>) => void;
  deletePersona: (id: string) => void;
  setActivePersona: (id: string) => void;

  // Utilities
  getActivePersona: () => Persona | undefined;
}

export const createPersonaSlice = (set: any, get: any): PersonaSlice => ({
  // Initial State
  personas: [defaultPersona],
  activePersonaId: 'default',

  // Actions
  addPersona: (persona) => set((state: any) => ({
    personas: [...state.personas, {
      ...persona,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updatePersona: (id, updates) => set((state: any) => ({
    personas: state.personas.map((p: Persona) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    )
  })),

  deletePersona: (id) => set((state: any) => {
    // Don't allow deleting the default persona
    if (id === 'default') return state;
    return {
      personas: state.personas.filter((p: Persona) => p.id !== id),
      activePersonaId: state.activePersonaId === id ? 'default' : state.activePersonaId
    };
  }),

  setActivePersona: (id) => set((state: any) => ({
    personas: state.personas.map((p: Persona) => ({
      ...p,
      isActive: p.id === id
    })),
    activePersonaId: id
  })),

  // Utilities
  getActivePersona: () => {
    const state = get();
    return state.personas.find((p: Persona) => p.id === state.activePersonaId);
  },
});
