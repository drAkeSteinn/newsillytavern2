// ============================================
// Memory & Summary Slice - State management for conversation memory
// ============================================

import type { StateCreator } from 'zustand';
import { 
  DEFAULT_SUMMARY_SETTINGS,
  type SummaryData, 
  type SummarySettings, 
  type CharacterMemory, 
  type MemoryEvent,
  type RelationshipMemory 
} from '@/types';

// Re-export for convenience
export { DEFAULT_SUMMARY_SETTINGS };

// ============================================
// Helper Functions
// ============================================

function createDefaultMemory(characterId: string): CharacterMemory {
  return {
    id: `memory-${characterId}`,
    characterId,
    events: [],
    relationships: [],
    notes: '',
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// Session Summary Tracking (per session)
// ============================================

export interface SessionSummaryTracking {
  sessionId: string;
  messagesSinceLastSummary: number;
  lastSummaryMessageIndex: number;
  isGroupChat: boolean;
}

// ============================================
// Slice Type
// ============================================

export interface MemorySlice {
  // Summary State
  summaries: SummaryData[];
  summarySettings: SummarySettings;
  isGeneratingSummary: boolean;
  lastSummaryError: string | null;
  
  // Session tracking for summaries
  sessionTracking: Record<string, SessionSummaryTracking>;
  
  // Character Memory State
  characterMemories: CharacterMemory[];
  
  // Summary Actions
  addSummary: (summary: SummaryData) => void;
  updateSummary: (id: string, updates: Partial<SummaryData>) => void;
  deleteSummary: (id: string) => void;
  clearSummaries: () => void;
  getSessionSummaries: (sessionId: string) => SummaryData[];
  
  // Summary Settings Actions
  setSummarySettings: (settings: Partial<SummarySettings>) => void;
  setGeneratingSummary: (generating: boolean) => void;
  setSummaryError: (error: string | null) => void;
  
  // Session Tracking Actions
  incrementMessageCount: (sessionId: string, isGroupChat: boolean) => void;
  resetMessageCount: (sessionId: string) => void;
  shouldGenerateSummary: (sessionId: string) => boolean;
  getSessionTracking: (sessionId: string) => SessionSummaryTracking | undefined;
  initSessionTracking: (sessionId: string, isGroupChat: boolean) => void;
  
  // Character Memory Actions
  getCharacterMemory: (characterId: string) => CharacterMemory | undefined;
  addMemoryEvent: (characterId: string, event: MemoryEvent) => void;
  updateMemoryEvent: (characterId: string, eventId: string, updates: Partial<MemoryEvent>) => void;
  removeMemoryEvent: (characterId: string, eventId: string) => void;
  
  // Relationship Actions
  updateRelationship: (characterId: string, relationship: RelationshipMemory) => void;
  removeRelationship: (characterId: string, targetId: string) => void;
  
  // Notes Actions
  setCharacterNotes: (characterId: string, notes: string) => void;
  
  // Memory CRUD
  setCharacterMemory: (memory: CharacterMemory) => void;
  clearCharacterMemory: (characterId: string) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createMemorySlice: StateCreator<MemorySlice, [], [], MemorySlice> = (set, get) => ({
  // Initial State
  summaries: [],
  summarySettings: DEFAULT_SUMMARY_SETTINGS,
  isGeneratingSummary: false,
  lastSummaryError: null,
  sessionTracking: {},
  characterMemories: [],
  
  // Summary Actions
  addSummary: (summary) => set((state) => ({
    summaries: [...state.summaries, summary]
  })),
  
  updateSummary: (id, updates) => set((state) => ({
    summaries: state.summaries.map(s => 
      s.id === id ? { ...s, ...updates } : s
    )
  })),
  
  deleteSummary: (id) => set((state) => ({
    summaries: state.summaries.filter(s => s.id !== id)
  })),
  
  clearSummaries: () => set({ summaries: [] }),
  
  getSessionSummaries: (sessionId) => {
    return get().summaries.filter(s => s.sessionId === sessionId);
  },
  
  // Summary Settings Actions
  setSummarySettings: (settings) => set((state) => ({
    summarySettings: { ...state.summarySettings, ...settings }
  })),
  
  setGeneratingSummary: (generating) => set({ isGeneratingSummary: generating }),
  
  setSummaryError: (error) => set({ lastSummaryError: error }),
  
  // Session Tracking Actions
  initSessionTracking: (sessionId, isGroupChat) => set((state) => {
    if (state.sessionTracking[sessionId]) return state;
    return {
      sessionTracking: {
        ...state.sessionTracking,
        [sessionId]: {
          sessionId,
          messagesSinceLastSummary: 0,
          lastSummaryMessageIndex: 0,
          isGroupChat,
        }
      }
    };
  }),
  
  incrementMessageCount: (sessionId, isGroupChat) => set((state) => {
    const tracking = state.sessionTracking[sessionId];
    if (!tracking) {
      // Initialize if not exists
      return {
        sessionTracking: {
          ...state.sessionTracking,
          [sessionId]: {
            sessionId,
            messagesSinceLastSummary: 1,
            lastSummaryMessageIndex: 0,
            isGroupChat,
          }
        }
      };
    }
    
    return {
      sessionTracking: {
        ...state.sessionTracking,
        [sessionId]: {
          ...tracking,
          messagesSinceLastSummary: tracking.messagesSinceLastSummary + 1,
          isGroupChat,
        }
      }
    };
  }),
  
  resetMessageCount: (sessionId) => set((state) => {
    const tracking = state.sessionTracking[sessionId];
    if (!tracking) return state;
    
    return {
      sessionTracking: {
        ...state.sessionTracking,
        [sessionId]: {
          ...tracking,
          messagesSinceLastSummary: 0,
        }
      }
    };
  }),
  
  shouldGenerateSummary: (sessionId) => {
    const state = get();
    const tracking = state.sessionTracking[sessionId];
    const settings = state.summarySettings;
    
    if (!settings.enabled || !settings.autoSummarize) return false;
    if (!tracking) return false;
    
    const threshold = tracking.isGroupChat 
      ? settings.groupChatInterval 
      : settings.normalChatInterval;
    
    return tracking.messagesSinceLastSummary >= threshold;
  },
  
  getSessionTracking: (sessionId) => {
    return get().sessionTracking[sessionId];
  },
  
  // Character Memory Actions
  getCharacterMemory: (characterId) => {
    return get().characterMemories.find(m => m.characterId === characterId);
  },
  
  addMemoryEvent: (characterId, event) => set((state) => {
    const existingIndex = state.characterMemories.findIndex(m => m.characterId === characterId);
    
    if (existingIndex >= 0) {
      // Add to existing memory
      const memories = [...state.characterMemories];
      memories[existingIndex] = {
        ...memories[existingIndex],
        events: [...memories[existingIndex].events, event],
        lastUpdated: new Date().toISOString(),
      };
      return { characterMemories: memories };
    } else {
      // Create new memory with event
      const newMemory = createDefaultMemory(characterId);
      newMemory.events = [event];
      return { 
        characterMemories: [...state.characterMemories, newMemory] 
      };
    }
  }),
  
  updateMemoryEvent: (characterId, eventId, updates) => set((state) => {
    const memories = [...state.characterMemories];
    const memoryIndex = memories.findIndex(m => m.characterId === characterId);
    
    if (memoryIndex >= 0) {
      memories[memoryIndex] = {
        ...memories[memoryIndex],
        events: memories[memoryIndex].events.map(e =>
          e.id === eventId ? { ...e, ...updates } : e
        ),
        lastUpdated: new Date().toISOString(),
      };
    }
    
    return { characterMemories: memories };
  }),
  
  removeMemoryEvent: (characterId, eventId) => set((state) => {
    const memories = [...state.characterMemories];
    const memoryIndex = memories.findIndex(m => m.characterId === characterId);
    
    if (memoryIndex >= 0) {
      memories[memoryIndex] = {
        ...memories[memoryIndex],
        events: memories[memoryIndex].events.filter(e => e.id !== eventId),
        lastUpdated: new Date().toISOString(),
      };
    }
    
    return { characterMemories: memories };
  }),
  
  // Relationship Actions
  updateRelationship: (characterId, relationship) => set((state) => {
    const memories = [...state.characterMemories];
    const memoryIndex = memories.findIndex(m => m.characterId === characterId);
    
    if (memoryIndex >= 0) {
      const existing = memories[memoryIndex];
      const existingRelIndex = existing.relationships.findIndex(r => r.targetId === relationship.targetId);
      
      if (existingRelIndex >= 0) {
        // Update existing relationship
        existing.relationships[existingRelIndex] = {
          ...existing.relationships[existingRelIndex],
          ...relationship,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        // Add new relationship
        existing.relationships.push({
          ...relationship,
          lastUpdated: new Date().toISOString(),
        });
      }
      
      memories[memoryIndex] = {
        ...existing,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      // Create new memory with relationship
      const newMemory = createDefaultMemory(characterId);
      newMemory.relationships = [{
        ...relationship,
        lastUpdated: new Date().toISOString(),
      }];
      memories.push(newMemory);
    }
    
    return { characterMemories: memories };
  }),
  
  removeRelationship: (characterId, targetId) => set((state) => {
    const memories = [...state.characterMemories];
    const memoryIndex = memories.findIndex(m => m.characterId === characterId);
    
    if (memoryIndex >= 0) {
      memories[memoryIndex] = {
        ...memories[memoryIndex],
        relationships: memories[memoryIndex].relationships.filter(r => r.targetId !== targetId),
        lastUpdated: new Date().toISOString(),
      };
    }
    
    return { characterMemories: memories };
  }),
  
  // Notes Actions
  setCharacterNotes: (characterId, notes) => set((state) => {
    const memories = [...state.characterMemories];
    const memoryIndex = memories.findIndex(m => m.characterId === characterId);
    
    if (memoryIndex >= 0) {
      memories[memoryIndex] = {
        ...memories[memoryIndex],
        notes,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      const newMemory = createDefaultMemory(characterId);
      newMemory.notes = notes;
      memories.push(newMemory);
    }
    
    return { characterMemories: memories };
  }),
  
  // Memory CRUD
  setCharacterMemory: (memory) => set((state) => {
    const existingIndex = state.characterMemories.findIndex(m => m.characterId === memory.characterId);
    
    if (existingIndex >= 0) {
      const memories = [...state.characterMemories];
      memories[existingIndex] = memory;
      return { characterMemories: memories };
    }
    
    return { characterMemories: [...state.characterMemories, memory] };
  }),
  
  clearCharacterMemory: (characterId) => set((state) => ({
    characterMemories: state.characterMemories.filter(m => m.characterId !== characterId)
  })),
});
