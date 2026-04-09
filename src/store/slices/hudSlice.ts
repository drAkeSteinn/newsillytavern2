// ============================================
// HUD Slice - HUD templates and session state
// ============================================

import type { HUDTemplate, HUDField, HUDSessionState } from '@/types';
import { uuidv4 } from '@/lib/uuid';

// ============================================
// Types
// ============================================

export interface HUDSlice {
  // Persistent State (Templates)
  hudTemplates: HUDTemplate[];
  
  // Runtime State (Session - not persisted)
  hudSessionState: HUDSessionState;

  // Template Actions
  createHUDTemplate: (template: Omit<HUDTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateHUDTemplate: (id: string, updates: Partial<HUDTemplate>) => void;
  deleteHUDTemplate: (id: string) => void;
  duplicateHUDTemplate: (id: string) => void;
  
  // Field Actions
  addHUDField: (templateId: string, field: Omit<HUDField, 'id'>) => void;
  updateHUDField: (templateId: string, fieldId: string, updates: Partial<HUDField>) => void;
  deleteHUDField: (templateId: string, fieldId: string) => void;
  reorderHUDFields: (templateId: string, fieldIds: string[]) => void;

  // Session Actions (Runtime)
  setActiveHUD: (templateId: string | null) => void;
  updateHUDFieldValue: (fieldId: string, value: string | number | boolean) => void;
  resetHUDValues: () => void;
  clearHUDSession: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get default values from template fields
 */
function getDefaultValues(fields: HUDField[]): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    values[field.id] = field.defaultValue;
  }
  return values;
}

// ============================================
// Slice Factory
// ============================================

export const createHUDSlice = (set: any, get: any): HUDSlice => ({
  // Initial State
  hudTemplates: [],
  hudSessionState: {
    activeTemplateId: null,
    fieldValues: {},
    lastUpdated: 0,
  },

  // ============================================
  // Template Actions
  // ============================================

  createHUDTemplate: (template) => set((state: any) => {
    const now = new Date().toISOString();
    const newTemplate: HUDTemplate = {
      ...template,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    return {
      hudTemplates: [...state.hudTemplates, newTemplate],
    };
  }),

  updateHUDTemplate: (id, updates) => set((state: any) => ({
    hudTemplates: state.hudTemplates.map((t: HUDTemplate) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ),
  })),

  deleteHUDTemplate: (id) => set((state: any) => {
    // Also clear session if this template was active
    const sessionUpdate = state.hudSessionState.activeTemplateId === id
      ? { activeTemplateId: null, fieldValues: {}, lastUpdated: Date.now() }
      : state.hudSessionState;
    
    return {
      hudTemplates: state.hudTemplates.filter((t: HUDTemplate) => t.id !== id),
      hudSessionState: sessionUpdate,
    };
  }),

  duplicateHUDTemplate: (id) => set((state: any) => {
    const template = state.hudTemplates.find((t: HUDTemplate) => t.id === id);
    if (!template) return state;
    
    const now = new Date().toISOString();
    const newTemplate: HUDTemplate = {
      ...template,
      id: uuidv4(),
      name: `${template.name} (copy)`,
      fields: template.fields.map(f => ({ ...f, id: uuidv4() })),
      createdAt: now,
      updatedAt: now,
    };
    
    return {
      hudTemplates: [...state.hudTemplates, newTemplate],
    };
  }),

  // ============================================
  // Field Actions
  // ============================================

  addHUDField: (templateId, field) => set((state: any) => {
    const newField: HUDField = {
      ...field,
      id: uuidv4(),
    };
    
    return {
      hudTemplates: state.hudTemplates.map((t: HUDTemplate) =>
        t.id === templateId
          ? { ...t, fields: [...t.fields, newField], updatedAt: new Date().toISOString() }
          : t
      ),
    };
  }),

  updateHUDField: (templateId, fieldId, updates) => set((state: any) => ({
    hudTemplates: state.hudTemplates.map((t: HUDTemplate) =>
      t.id === templateId
        ? {
            ...t,
            fields: t.fields.map((f: HUDField) =>
              f.id === fieldId ? { ...f, ...updates } : f
            ),
            updatedAt: new Date().toISOString(),
          }
        : t
    ),
  })),

  deleteHUDField: (templateId, fieldId) => set((state: any) => ({
    hudTemplates: state.hudTemplates.map((t: HUDTemplate) =>
      t.id === templateId
        ? {
            ...t,
            fields: t.fields.filter((f: HUDField) => f.id !== fieldId),
            updatedAt: new Date().toISOString(),
          }
        : t
    ),
    // Also clear the field value from session
    hudSessionState: {
      ...state.hudSessionState,
      fieldValues: Object.fromEntries(
        Object.entries(state.hudSessionState.fieldValues).filter(([id]) => id !== fieldId)
      ),
    },
  })),

  reorderHUDFields: (templateId, fieldIds) => set((state: any) => {
    const template = state.hudTemplates.find((t: HUDTemplate) => t.id === templateId);
    if (!template) return state;
    
    // Reorder fields based on new order
    const reorderedFields = fieldIds
      .map(id => template.fields.find(f => f.id === id))
      .filter(Boolean) as HUDField[];
    
    // Add any fields not in the new order at the end
    const missingFields = template.fields.filter(f => !fieldIds.includes(f.id));
    const finalFields = [...reorderedFields, ...missingFields];
    
    return {
      hudTemplates: state.hudTemplates.map((t: HUDTemplate) =>
        t.id === templateId
          ? { ...t, fields: finalFields, updatedAt: new Date().toISOString() }
          : t
      ),
    };
  }),

  // ============================================
  // Session Actions
  // ============================================

  setActiveHUD: (templateId) => set((state: any) => {
    if (!templateId) {
      return {
        hudSessionState: {
          activeTemplateId: null,
          fieldValues: {},
          lastUpdated: Date.now(),
        },
      };
    }
    
    const template = state.hudTemplates.find((t: HUDTemplate) => t.id === templateId);
    if (!template) return state;
    
    return {
      hudSessionState: {
        activeTemplateId: templateId,
        fieldValues: getDefaultValues(template.fields),
        lastUpdated: Date.now(),
      },
    };
  }),

  updateHUDFieldValue: (fieldId, value) => set((state: any) => ({
    hudSessionState: {
      ...state.hudSessionState,
      fieldValues: {
        ...state.hudSessionState.fieldValues,
        [fieldId]: value,
      },
      lastUpdated: Date.now(),
    },
  })),

  resetHUDValues: () => set((state: any) => {
    const template = state.hudTemplates.find(
      (t: HUDTemplate) => t.id === state.hudSessionState.activeTemplateId
    );
    if (!template) return state;
    
    return {
      hudSessionState: {
        ...state.hudSessionState,
        fieldValues: getDefaultValues(template.fields),
        lastUpdated: Date.now(),
      },
    };
  }),

  clearHUDSession: () => set({
    hudSessionState: {
      activeTemplateId: null,
      fieldValues: {},
      lastUpdated: 0,
    },
  }),
});
