// ============================================
// Quest Template Slice - Global Quest Templates
// ============================================
//
// This slice manages quest templates (loaded from JSON files)
// These are the "blueprints" for quests that can be instantiated in sessions
//
// NOTE: All storage operations use the API route to avoid fs module in client bundle

import type { StateCreator } from 'zustand';
import {
  QuestTemplate,
  SessionQuestInstance,
  QuestSettings,
  QuestNotification,
  DEFAULT_QUEST_SETTINGS,
} from '@/types';

// ============================================
// Re-exports
// ============================================

export { DEFAULT_QUEST_SETTINGS };

// ============================================
// Types
// ============================================

export interface QuestTemplateSlice {
  // Templates (global)
  questTemplates: QuestTemplate[];
  isLoading: boolean;
  lastLoaded: number | null;
  
  // Settings
  questSettings: QuestSettings;
  
  // Notifications
  questNotifications: QuestNotification[];
  
  // Template CRUD
  loadTemplates: () => Promise<void>;
  saveTemplate: (template: QuestTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  duplicateTemplate: (id: string, newId: string) => Promise<QuestTemplate | null>;
  
  // Template Getters
  getTemplateById: (id: string) => QuestTemplate | undefined;
  getTemplatesByIds: (ids: string[]) => QuestTemplate[];
  getTemplatesByPriority: (priority: 'main' | 'side' | 'hidden') => QuestTemplate[];
  
  // Settings
  setQuestSettings: (settings: Partial<QuestSettings>) => void;
  
  // Notifications
  addQuestNotification: (notification: Omit<QuestNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearQuestNotifications: () => void;
  getUnreadNotifications: () => QuestNotification[];
  
  // Session Quest Instance Helpers
  createQuestInstance: (templateId: string) => SessionQuestInstance;
  
  // Utility
  getAvailableTemplatesForCharacter: (questTemplateIds: string[]) => QuestTemplate[];
  getAvailableTemplatesForGroup: (questTemplateIds: string[]) => QuestTemplate[];
}

// ============================================
// API Helper Functions
// ============================================

async function fetchTemplates(): Promise<QuestTemplate[]> {
  const response = await fetch('/api/quest-templates');
  if (!response.ok) {
    throw new Error('Failed to load quest templates');
  }
  const data = await response.json();
  return data.templates || [];
}

async function saveTemplateAPI(template: QuestTemplate): Promise<QuestTemplate> {
  const response = await fetch('/api/quest-templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save template');
  }
  const data = await response.json();
  return data.template;
}

async function createTemplateAPI(template: QuestTemplate): Promise<QuestTemplate> {
  const response = await fetch('/api/quest-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  const data = await response.json();
  return data.template;
}

async function deleteTemplateAPI(id: string): Promise<void> {
  const response = await fetch(`/api/quest-templates?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete template');
  }
}

async function duplicateTemplateAPI(sourceId: string, newId: string): Promise<QuestTemplate> {
  const response = await fetch('/api/quest-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'duplicate', sourceId, newId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to duplicate template');
  }
  const data = await response.json();
  return data.template;
}

// ============================================
// Slice Factory
// ============================================

export const createQuestTemplateSlice: StateCreator<QuestTemplateSlice, [], [], QuestTemplateSlice> = (set, get) => ({
  // Initial State
  questTemplates: [],
  isLoading: false,
  lastLoaded: null,
  questSettings: DEFAULT_QUEST_SETTINGS,
  questNotifications: [],

  // ============================================
  // Template CRUD
  // ============================================

  loadTemplates: async () => {
    set({ isLoading: true });
    
    try {
      const templates = await fetchTemplates();
      set({
        questTemplates: templates,
        isLoading: false,
        lastLoaded: Date.now(),
      });
    } catch (error) {
      console.error('[QuestTemplateSlice] Error loading templates:', error);
      set({ isLoading: false });
    }
  },

  saveTemplate: async (template: QuestTemplate) => {
    const isExisting = get().questTemplates.some(t => t.id === template.id);
    
    // Save to disk via API
    const savedTemplate = isExisting 
      ? await saveTemplateAPI(template)
      : await createTemplateAPI(template);
    
    // Update state
    set((state) => ({
      questTemplates: isExisting
        ? state.questTemplates.map(t => t.id === template.id ? savedTemplate : t)
        : [...state.questTemplates, savedTemplate],
      lastLoaded: Date.now(),
    }));
  },

  deleteTemplate: async (id: string) => {
    // Delete from disk via API
    await deleteTemplateAPI(id);
    
    // Update state
    set((state) => ({
      questTemplates: state.questTemplates.filter(t => t.id !== id),
      lastLoaded: Date.now(),
    }));
  },

  duplicateTemplate: async (id: string, newId: string): Promise<QuestTemplate | null> => {
    try {
      const duplicated = await duplicateTemplateAPI(id, newId);
      
      // Update state
      set((state) => ({
        questTemplates: [...state.questTemplates, duplicated],
      }));
      
      return duplicated;
    } catch (error) {
      console.error('[QuestTemplateSlice] Error duplicating template:', error);
      return null;
    }
  },

  // ============================================
  // Template Getters
  // ============================================

  getTemplateById: (id: string) => {
    return get().questTemplates.find(t => t.id === id);
  },

  getTemplatesByIds: (ids: string[]) => {
    return get().questTemplates.filter(t => ids.includes(t.id));
  },

  getTemplatesByPriority: (priority: 'main' | 'side' | 'hidden') => {
    return get().questTemplates.filter(t => t.priority === priority);
  },

  // ============================================
  // Settings
  // ============================================

  setQuestSettings: (settings) => set((state) => ({
    questSettings: { ...state.questSettings, ...settings },
  })),

  // ============================================
  // Notifications
  // ============================================

  addQuestNotification: (notification) => set((state) => ({
    questNotifications: [
      {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...state.questNotifications,
    ].slice(0, 50), // Keep last 50
  })),

  markNotificationRead: (id: string) => set((state) => ({
    questNotifications: state.questNotifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),

  clearQuestNotifications: () => set({ questNotifications: [] }),

  getUnreadNotifications: () => {
    return get().questNotifications.filter(n => !n.read);
  },

  // ============================================
  // Session Quest Instance Helpers
  // ============================================

  createQuestInstance: (templateId: string) => {
    const template = get().getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    return {
      templateId,
      status: 'available' as const,
      objectives: template.objectives.map(obj => ({
        templateId: obj.id,
        currentCount: 0,
        isCompleted: false,
      })),
      progress: 0,
      activatedAt: undefined,
      completedAt: undefined,
      activatedAtTurn: undefined,
    };
  },

  // ============================================
  // Utility
  // ============================================

  getAvailableTemplatesForCharacter: (questTemplateIds: string[]) => {
    if (!questTemplateIds || questTemplateIds.length === 0) {
      return [];
    }
    return get().questTemplates.filter(t => questTemplateIds.includes(t.id));
  },

  getAvailableTemplatesForGroup: (questTemplateIds: string[]) => {
    if (!questTemplateIds || questTemplateIds.length === 0) {
      return [];
    }
    return get().questTemplates.filter(t => questTemplateIds.includes(t.id));
  },
});
