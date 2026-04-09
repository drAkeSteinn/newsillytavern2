// ============================================
// LLM Slice - LLM and TTS configurations
// ============================================

import type { LLMConfig, TTSConfig, PromptTemplate } from '@/types';
import { uuidv4 } from '@/lib/uuid';
import { defaultLLMConfig, defaultPromptTemplate } from '../defaults';

export interface LLMSlice {
  // State
  llmConfigs: LLMConfig[];
  ttsConfigs: TTSConfig[];
  promptTemplates: PromptTemplate[];

  // LLM Actions
  addLLMConfig: (config: Omit<LLMConfig, 'id'>) => void;
  updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setActiveLLMConfig: (id: string) => void;
  getActiveLLMConfig: () => LLMConfig | undefined;

  // TTS Actions
  addTTSConfig: (config: Omit<TTSConfig, 'id'>) => void;
  updateTTSConfig: (id: string, updates: Partial<TTSConfig>) => void;
  deleteTTSConfig: (id: string) => void;

  // Prompt Template Actions
  addPromptTemplate: (template: Omit<PromptTemplate, 'id'>) => void;
  updatePromptTemplate: (id: string, updates: Partial<PromptTemplate>) => void;
  deletePromptTemplate: (id: string) => void;
}

export const createLLMSlice = (set: any, get: any): LLMSlice => ({
  // Initial State
  llmConfigs: [defaultLLMConfig],
  ttsConfigs: [],
  promptTemplates: [defaultPromptTemplate],

  // LLM Actions
  addLLMConfig: (config) => set((state: any) => ({
    llmConfigs: [...state.llmConfigs, { ...config, id: uuidv4() }]
  })),

  updateLLMConfig: (id, updates) => set((state: any) => ({
    llmConfigs: state.llmConfigs.map((c: LLMConfig) =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),

  deleteLLMConfig: (id) => set((state: any) => ({
    llmConfigs: state.llmConfigs.filter((c: LLMConfig) => c.id !== id)
  })),

  setActiveLLMConfig: (id) => set((state: any) => ({
    llmConfigs: state.llmConfigs.map((c: LLMConfig) => ({
      ...c,
      isActive: c.id === id
    }))
  })),

  getActiveLLMConfig: () => get().llmConfigs.find((c: LLMConfig) => c.isActive),

  // TTS Actions
  addTTSConfig: (config) => set((state: any) => ({
    ttsConfigs: [...state.ttsConfigs, { ...config, id: uuidv4() }]
  })),

  updateTTSConfig: (id, updates) => set((state: any) => ({
    ttsConfigs: state.ttsConfigs.map((c: TTSConfig) =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),

  deleteTTSConfig: (id) => set((state: any) => ({
    ttsConfigs: state.ttsConfigs.filter((c: TTSConfig) => c.id !== id)
  })),

  // Prompt Template Actions
  addPromptTemplate: (template) => set((state: any) => ({
    promptTemplates: [...state.promptTemplates, { ...template, id: uuidv4() }]
  })),

  updatePromptTemplate: (id, updates) => set((state: any) => ({
    promptTemplates: state.promptTemplates.map((t: PromptTemplate) =>
      t.id === id ? { ...t, ...updates } : t
    )
  })),

  deletePromptTemplate: (id) => set((state: any) => ({
    promptTemplates: state.promptTemplates.filter((t: PromptTemplate) => t.id !== id)
  })),
});
