// ============================================
// Lorebook Slice - Lorebooks management
// ============================================

import type { Lorebook, LorebookEntry, SillyTavernLorebook } from '@/types';
import { uuidv4 } from '@/lib/uuid';
import { defaultLorebookSettings } from '../defaults';

export interface LorebookSlice {
  // State
  lorebooks: Lorebook[];
  activeLorebookIds: string[];

  // Actions
  addLorebook: (lorebook: Omit<Lorebook, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateLorebook: (id: string, updates: Partial<Lorebook>) => void;
  deleteLorebook: (id: string) => void;
  toggleLorebook: (id: string) => void;
  setActiveLorebooks: (ids: string[]) => void;

  // Entry Actions
  addLorebookEntry: (lorebookId: string, entry: Omit<LorebookEntry, 'uid'>) => void;
  updateLorebookEntry: (lorebookId: string, uid: number, updates: Partial<LorebookEntry>) => void;
  deleteLorebookEntry: (lorebookId: string, uid: number) => void;
  duplicateLorebookEntry: (lorebookId: string, uid: number) => void;

  // Import/Export
  importSillyTavernLorebook: (stLorebook: SillyTavernLorebook, name: string, description?: string) => Lorebook;
  exportSillyTavernLorebook: (id: string) => SillyTavernLorebook | null;

  // Utilities
  getActiveLorebooks: () => Lorebook[];
  getLorebookById: (id: string) => Lorebook | undefined;
}

export const createLorebookSlice = (set: any, get: any): LorebookSlice => ({
  // Initial State
  lorebooks: [],
  activeLorebookIds: [],

  // Actions
  addLorebook: (lorebook) => set((state: any) => ({
    lorebooks: [...state.lorebooks, {
      ...lorebook,
      id: uuidv4(),
      settings: lorebook.settings || defaultLorebookSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateLorebook: (id, updates) => set((state: any) => ({
    lorebooks: state.lorebooks.map((l: Lorebook) =>
      l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
    )
  })),

  deleteLorebook: (id) => set((state: any) => ({
    lorebooks: state.lorebooks.filter((l: Lorebook) => l.id !== id),
    activeLorebookIds: state.activeLorebookIds.filter((aid: string) => aid !== id)
  })),

  toggleLorebook: (id) => set((state: any) => {
    const isActive = state.activeLorebookIds.includes(id);
    return {
      activeLorebookIds: isActive
        ? state.activeLorebookIds.filter((aid: string) => aid !== id)
        : [...state.activeLorebookIds, id],
      lorebooks: state.lorebooks.map((l: Lorebook) =>
        l.id === id ? { ...l, active: !l.active, updatedAt: new Date().toISOString() } : l
      )
    };
  }),

  setActiveLorebooks: (ids) => set((state: any) => ({
    activeLorebookIds: ids,
    lorebooks: state.lorebooks.map((l: Lorebook) => ({
      ...l,
      active: ids.includes(l.id),
      updatedAt: new Date().toISOString()
    }))
  })),

  // Entry Actions
  addLorebookEntry: (lorebookId, entry) => set((state: any) => {
    const lorebook = state.lorebooks.find((l: Lorebook) => l.id === lorebookId);
    if (!lorebook) return state;

    const maxUid = lorebook.entries.reduce((max, e) => Math.max(max, e.uid), -1);
    const newEntry: LorebookEntry = {
      ...entry,
      uid: maxUid + 1,
      key: entry.key || [],
      keysecondary: entry.keysecondary || [],
      comment: entry.comment || '',
      content: entry.content || '',
      constant: entry.constant ?? false,
      selective: entry.selective ?? false,
      order: entry.order ?? 100,
      position: entry.position ?? 0,
      disable: entry.disable ?? false,
      excludeRecursion: entry.excludeRecursion ?? false,
      preventRecursion: entry.preventRecursion ?? false,
      delayUntilRecursion: entry.delayUntilRecursion ?? false,
      probability: entry.probability ?? 100,
      useProbability: entry.useProbability ?? false,
      depth: entry.depth ?? 4,
      selectLogic: entry.selectLogic ?? 0,
      group: entry.group ?? '',
      groupOverride: entry.groupOverride ?? false,
      groupWeight: entry.groupWeight ?? 100,
      scanDepth: entry.scanDepth ?? null,
      caseSensitive: entry.caseSensitive ?? null,
      matchWholeWords: entry.matchWholeWords ?? null,
      useGroupScoring: entry.useGroupScoring ?? null,
      automationId: entry.automationId ?? '',
      role: entry.role ?? null,
      vectorized: entry.vectorized ?? false,
      displayIndex: entry.displayIndex ?? lorebook.entries.length,
      extensions: entry.extensions ?? {}
    };

    return {
      lorebooks: state.lorebooks.map((l: Lorebook) =>
        l.id === lorebookId
          ? {
              ...l,
              entries: [...l.entries, newEntry],
              updatedAt: new Date().toISOString()
            }
          : l
      )
    };
  }),

  updateLorebookEntry: (lorebookId, uid, updates) => set((state: any) => ({
    lorebooks: state.lorebooks.map((l: Lorebook) =>
      l.id === lorebookId
        ? {
            ...l,
            entries: l.entries.map((e: LorebookEntry) =>
              e.uid === uid ? { ...e, ...updates } : e
            ),
            updatedAt: new Date().toISOString()
          }
        : l
    )
  })),

  deleteLorebookEntry: (lorebookId, uid) => set((state: any) => ({
    lorebooks: state.lorebooks.map((l: Lorebook) =>
      l.id === lorebookId
        ? {
            ...l,
            entries: l.entries.filter((e: LorebookEntry) => e.uid !== uid),
            updatedAt: new Date().toISOString()
          }
        : l
    )
  })),

  duplicateLorebookEntry: (lorebookId, uid) => set((state: any) => {
    const lorebook = state.lorebooks.find((l: Lorebook) => l.id === lorebookId);
    if (!lorebook) return state;

    const entry = lorebook.entries.find((e: LorebookEntry) => e.uid === uid);
    if (!entry) return state;

    const maxUid = lorebook.entries.reduce((max, e) => Math.max(max, e.uid), -1);
    const newEntry: LorebookEntry = {
      ...entry,
      uid: maxUid + 1,
      comment: `${entry.comment} (copy)`,
      displayIndex: lorebook.entries.length
    };

    return {
      lorebooks: state.lorebooks.map((l: Lorebook) =>
        l.id === lorebookId
          ? {
              ...l,
              entries: [...l.entries, newEntry],
              updatedAt: new Date().toISOString()
            }
          : l
      )
    };
  }),

  // Import/Export
  importSillyTavernLorebook: (stLorebook, name, description = '') => {
    const entries: LorebookEntry[] = Object.values(stLorebook.entries).map((entry, index) => ({
      uid: entry.uid ?? index,
      key: entry.key || [],
      keysecondary: entry.keysecondary || [],
      comment: entry.comment || '',
      content: entry.content || '',
      constant: entry.constant ?? false,
      selective: entry.selective ?? false,
      order: entry.order ?? 100,
      position: entry.position ?? 0,
      disable: entry.disable ?? false,
      excludeRecursion: entry.excludeRecursion ?? false,
      preventRecursion: entry.preventRecursion ?? false,
      delayUntilRecursion: entry.delayUntilRecursion ?? false,
      probability: entry.probability ?? 100,
      useProbability: entry.useProbability ?? false,
      depth: entry.depth ?? 4,
      selectLogic: entry.selectLogic ?? 0,
      group: entry.group ?? '',
      groupOverride: entry.groupOverride ?? false,
      groupWeight: entry.groupWeight ?? 100,
      scanDepth: entry.scanDepth ?? null,
      caseSensitive: entry.caseSensitive ?? null,
      matchWholeWords: entry.matchWholeWords ?? null,
      useGroupScoring: entry.useGroupScoring ?? null,
      automationId: entry.automationId ?? '',
      role: entry.role ?? null,
      vectorized: entry.vectorized ?? false,
      displayIndex: entry.displayIndex ?? index,
      extensions: entry.extensions ?? {}
    }));

    const lorebook: Lorebook = {
      id: uuidv4(),
      name,
      description,
      entries,
      settings: {
        ...defaultLorebookSettings,
        ...(stLorebook.settings || {})
      },
      tags: [],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    set((state: any) => ({
      lorebooks: [...state.lorebooks, lorebook],
      activeLorebookIds: [...state.activeLorebookIds, lorebook.id]
    }));

    return lorebook;
  },

  exportSillyTavernLorebook: (id) => {
    const lorebook = get().lorebooks.find((l: Lorebook) => l.id === id);
    if (!lorebook) return null;

    const entries: Record<string, LorebookEntry> = {};
    lorebook.entries.forEach((entry) => {
      entries[entry.uid.toString()] = entry;
    });

    return {
      entries,
      settings: lorebook.settings
    };
  },

  // Utilities
  getActiveLorebooks: () => {
    const state = get();
    return state.lorebooks.filter((l: Lorebook) => state.activeLorebookIds.includes(l.id));
  },

  getLorebookById: (id) => get().lorebooks.find((l: Lorebook) => l.id === id),
});
