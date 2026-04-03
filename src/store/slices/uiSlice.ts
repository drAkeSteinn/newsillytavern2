// ============================================
// UI Slice - UI state management
// ============================================

export interface UISlice {
  // State
  sidebarOpen: boolean;
  settingsOpen: boolean;
  characterEditorOpen: boolean;
  groupEditorOpen: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setCharacterEditorOpen: (open: boolean) => void;
  setGroupEditorOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
}

export const createUISlice = (set: any, _get: any): UISlice => ({
  // Initial State
  sidebarOpen: true,
  settingsOpen: false,
  characterEditorOpen: false,
  groupEditorOpen: false,
  isLoading: false,
  isGenerating: false,
  error: null,

  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCharacterEditorOpen: (open) => set({ characterEditorOpen: open }),
  setGroupEditorOpen: (open) => set({ groupEditorOpen: open }),
  setLoading: (loading) => set({ isLoading: loading }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setError: (error) => set({ error }),
});
