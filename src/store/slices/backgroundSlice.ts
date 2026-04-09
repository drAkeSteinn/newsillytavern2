// ============================================
// Background Slice - Backgrounds and overlays
// ============================================

import type { 
  Background, 
  BackgroundPack, 
  BackgroundIndex, 
  BackgroundTriggerHit,
  BackgroundTriggerPack,
  BackgroundCollection,
  BackgroundOverlay,
} from '@/types';
import { uuidv4 } from '@/lib/uuid';

export interface BackgroundSlice {
  // State - Legacy System
  backgrounds: Background[];
  backgroundPacks: BackgroundPack[];
  backgroundIndex: BackgroundIndex;
  activeBackground: string;
  activeOverlayBack: string;
  activeOverlayFront: string;

  // State - New Unified Trigger System
  backgroundTriggerPacks: BackgroundTriggerPack[];
  backgroundCollections: BackgroundCollection[];
  
  // State - Overlays (Phase 3)
  activeOverlays: BackgroundOverlay[];

  // Background Actions
  addBackground: (background: Omit<Background, 'id'>) => void;
  setBackground: (url: string, transition?: { type: string; duration: number }) => void;
  setActiveBackground: (url: string) => void;
  setActiveOverlay: (backUrl: string, frontUrl: string) => void;
  applyBackgroundHit: (hit: BackgroundTriggerHit) => void;
  
  // Overlay Actions (Phase 3)
  setActiveOverlays: (overlays: BackgroundOverlay[]) => void;
  addActiveOverlay: (overlay: BackgroundOverlay) => void;
  removeActiveOverlay: (overlayId: string) => void;
  clearActiveOverlays: () => void;

  // Background Pack Actions (Legacy)
  addBackgroundPack: (pack: Omit<BackgroundPack, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>) => void;
  updateBackgroundPack: (id: string, updates: Partial<BackgroundPack>) => void;
  deleteBackgroundPack: (id: string) => void;
  cloneBackgroundPack: (id: string) => void;
  toggleBackgroundPack: (id: string) => void;
  setBackgroundIndex: (index: BackgroundIndex) => void;
  updateBackgroundPackIndex: (id: string, index: number) => void;

  // Background Trigger Pack Actions (New Unified System)
  setBackgroundCollections: (collections: BackgroundCollection[]) => void;
  addBackgroundTriggerPack: (pack: Omit<BackgroundTriggerPack, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateBackgroundTriggerPack: (id: string, updates: Partial<BackgroundTriggerPack>) => void;
  deleteBackgroundTriggerPack: (id: string) => void;
  toggleBackgroundTriggerPack: (id: string) => void;
  
  // Background Trigger Item Actions
  addBackgroundTriggerItem: (packId: string, item: Omit<import('@/types').BackgroundTriggerItem, 'id'>) => void;
  updateBackgroundTriggerItem: (packId: string, itemId: string, updates: Partial<import('@/types').BackgroundTriggerItem>) => void;
  deleteBackgroundTriggerItem: (packId: string, itemId: string) => void;
  reorderBackgroundTriggerItems: (packId: string, itemIds: string[]) => void;
}

export const createBackgroundSlice = (set: any, get: any): BackgroundSlice => ({
  // Initial State - Legacy
  backgrounds: [],
  backgroundPacks: [],
  backgroundIndex: { backgrounds: [], lastUpdated: 0, source: '' },
  activeBackground: '',
  activeOverlayBack: '',
  activeOverlayFront: '',

  // Initial State - New Unified System
  backgroundTriggerPacks: [],
  backgroundCollections: [],
  
  // Initial State - Overlays (Phase 3)
  activeOverlays: [],

  // Background Actions
  addBackground: (background) => set((state: any) => ({
    backgrounds: [...state.backgrounds, { ...background, id: uuidv4() }]
  })),

  setBackground: (url, transition) => {
    console.log(`[BackgroundSlice] Setting background: ${url}`, transition);
    set({ activeBackground: url });
  },

  setActiveBackground: (url) => set({ activeBackground: url }),

  setActiveOverlay: (backUrl, frontUrl) => set({
    activeOverlayBack: backUrl,
    activeOverlayFront: frontUrl
  }),

  applyBackgroundHit: (hit) => {
    const updates: Partial<BackgroundSlice> = {
      activeBackground: hit.backgroundUrl || '',
    };
    
    // Apply overlays if present
    if (hit.overlays) {
      updates.activeOverlays = hit.overlays;
    }

    set(updates);
  },
  
  // Overlay Actions (Phase 3)
  setActiveOverlays: (overlays) => set({ activeOverlays: overlays }),
  
  addActiveOverlay: (overlay) => set((state: any) => ({
    activeOverlays: [...state.activeOverlays, overlay]
  })),
  
  removeActiveOverlay: (overlayId) => set((state: any) => ({
    activeOverlays: state.activeOverlays.filter((o: BackgroundOverlay) => o.id !== overlayId)
  })),
  
  clearActiveOverlays: () => set({ activeOverlays: [] }),

  // Background Pack Actions (Legacy)
  addBackgroundPack: (pack) => set((state: any) => ({
    backgroundPacks: [...state.backgroundPacks, {
      ...pack,
      id: uuidv4(),
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateBackgroundPack: (id, updates) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    )
  })),

  deleteBackgroundPack: (id) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.filter((p: BackgroundPack) => p.id !== id)
  })),

  cloneBackgroundPack: (id) => set((state: any) => {
    const pack = state.backgroundPacks.find((p: BackgroundPack) => p.id === id);
    if (!pack) return state;
    return {
      backgroundPacks: [...state.backgroundPacks, {
        ...pack,
        id: uuidv4(),
        title: `${pack.title} (copy)`,
        currentIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    };
  }),

  toggleBackgroundPack: (id) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    )
  })),

  setBackgroundIndex: (index) => set({ backgroundIndex: index }),

  updateBackgroundPackIndex: (id, index) => set((state: any) => ({
    backgroundPacks: state.backgroundPacks.map((p: BackgroundPack) =>
      p.id === id ? { ...p, currentIndex: index, updatedAt: new Date().toISOString() } : p
    )
  })),

  // Background Trigger Pack Actions (New Unified System)
  setBackgroundCollections: (collections) => set({ backgroundCollections: collections }),

  addBackgroundTriggerPack: (pack) => set((state: any) => ({
    backgroundTriggerPacks: [...state.backgroundTriggerPacks, {
      ...pack,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  })),

  updateBackgroundTriggerPack: (id, updates) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) =>
      p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    )
  })),

  deleteBackgroundTriggerPack: (id) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.filter((p: BackgroundTriggerPack) => p.id !== id)
  })),

  toggleBackgroundTriggerPack: (id) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) =>
      p.id === id ? { ...p, active: !p.active, updatedAt: new Date().toISOString() } : p
    )
  })),

  // Background Trigger Item Actions
  addBackgroundTriggerItem: (packId, item) => set((state: any) => {
    const pack = state.backgroundTriggerPacks.find((p: BackgroundTriggerPack) => p.id === packId);
    if (!pack) return state;
    
    return {
      backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) =>
        p.id === packId 
          ? { 
              ...p, 
              items: [...p.items, { ...item, id: uuidv4() }],
              updatedAt: new Date().toISOString() 
            } 
          : p
      )
    };
  }),

  updateBackgroundTriggerItem: (packId, itemId, updates) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) =>
      p.id === packId 
        ? { 
            ...p, 
            items: p.items.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            ),
            updatedAt: new Date().toISOString() 
          } 
        : p
    )
  })),

  deleteBackgroundTriggerItem: (packId, itemId) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) =>
      p.id === packId 
        ? { 
            ...p, 
            items: p.items.filter(item => item.id !== itemId),
            updatedAt: new Date().toISOString() 
          } 
        : p
    )
  })),

  reorderBackgroundTriggerItems: (packId, itemIds) => set((state: any) => ({
    backgroundTriggerPacks: state.backgroundTriggerPacks.map((p: BackgroundTriggerPack) => {
      if (p.id !== packId) return p;
      
      const itemMap = new Map(p.items.map(item => [item.id, item]));
      const reorderedItems = itemIds
        .map(id => itemMap.get(id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);
      
      return {
        ...p,
        items: reorderedItems,
        updatedAt: new Date().toISOString()
      };
    })
  })),
});
