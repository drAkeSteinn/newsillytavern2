// ============================================
// Sound Slice - Sound triggers, sequences and collections
// ============================================

import type { SoundTrigger, SoundCollection, SoundSequenceTrigger } from '@/types';
import { uuidv4 } from '@/lib/uuid';

export interface SoundSlice {
  // State
  soundTriggers: SoundTrigger[];
  soundCollections: SoundCollection[];
  soundSequenceTriggers: SoundSequenceTrigger[];

  // Actions - Sound Triggers
  addSoundTrigger: (trigger: Omit<SoundTrigger, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateSoundTrigger: (id: string, updates: Partial<SoundTrigger>) => void;
  deleteSoundTrigger: (id: string) => void;
  cloneSoundTrigger: (id: string) => void;
  toggleSoundTrigger: (id: string) => void;
  toggleSoundKeyword: (triggerId: string, keyword: string) => void;
  setSoundCollections: (collections: SoundCollection[]) => void;
  updateSoundTriggerIndex: (id: string, index: number) => void;

  // Actions - Sound Sequence Triggers
  addSoundSequenceTrigger: (trigger: Omit<SoundSequenceTrigger, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSoundSequenceTrigger: (id: string, updates: Partial<SoundSequenceTrigger>) => void;
  deleteSoundSequenceTrigger: (id: string) => void;
  cloneSoundSequenceTrigger: (id: string) => void;
  toggleSoundSequenceTrigger: (id: string) => void;
}

export const createSoundSlice = (set: any, _get: any): SoundSlice => ({
  // Initial State
  soundTriggers: [],
  soundCollections: [],
  soundSequenceTriggers: [],

  // Actions - Sound Triggers
  addSoundTrigger: (trigger) => set((state: any) => {
    const keywordsEnabled: Record<string, boolean> = {};
    trigger.keywords.forEach(kw => {
      keywordsEnabled[kw] = true;
    });
    return {
      soundTriggers: [...state.soundTriggers, {
        ...trigger,
        id: uuidv4(),
        currentIndex: 0,
        keywordsEnabled,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  updateSoundTrigger: (id, updates) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    )
  })),

  deleteSoundTrigger: (id) => set((state: any) => ({
    soundTriggers: state.soundTriggers.filter((t: SoundTrigger) => t.id !== id)
  })),

  cloneSoundTrigger: (id) => set((state: any) => {
    const trigger = state.soundTriggers.find((t: SoundTrigger) => t.id === id);
    if (!trigger) return state;
    return {
      soundTriggers: [...state.soundTriggers, {
        ...trigger,
        id: uuidv4(),
        name: `${trigger.name} (copy)`,
        currentIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  toggleSoundTrigger: (id) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t
    )
  })),

  toggleSoundKeyword: (triggerId, keyword) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) => {
      if (t.id !== triggerId) return t;
      return {
        ...t,
        keywordsEnabled: {
          ...t.keywordsEnabled,
          [keyword]: !t.keywordsEnabled[keyword]
        },
        updatedAt: new Date().toISOString()
      };
    })
  })),

  setSoundCollections: (collections) => set({ soundCollections: collections }),

  updateSoundTriggerIndex: (id, index) => set((state: any) => ({
    soundTriggers: state.soundTriggers.map((t: SoundTrigger) =>
      t.id === id ? { ...t, currentIndex: index, updatedAt: new Date().toISOString() } : t
    )
  })),

  // Actions - Sound Sequence Triggers
  addSoundSequenceTrigger: (trigger) => set((state: any) => ({
    soundSequenceTriggers: [...state.soundSequenceTriggers, {
      ...trigger,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateSoundSequenceTrigger: (id, updates) => set((state: any) => ({
    soundSequenceTriggers: state.soundSequenceTriggers.map((t: SoundSequenceTrigger) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    )
  })),

  deleteSoundSequenceTrigger: (id) => set((state: any) => ({
    soundSequenceTriggers: state.soundSequenceTriggers.filter((t: SoundSequenceTrigger) => t.id !== id)
  })),

  cloneSoundSequenceTrigger: (id) => set((state: any) => {
    const trigger = state.soundSequenceTriggers.find((t: SoundSequenceTrigger) => t.id === id);
    if (!trigger) return state;
    return {
      soundSequenceTriggers: [...state.soundSequenceTriggers, {
        ...trigger,
        id: uuidv4(),
        name: `${trigger.name} (copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  toggleSoundSequenceTrigger: (id) => set((state: any) => ({
    soundSequenceTriggers: state.soundSequenceTriggers.map((t: SoundSequenceTrigger) =>
      t.id === id ? { ...t, active: !t.active, updatedAt: new Date().toISOString() } : t
    )
  })),
});
