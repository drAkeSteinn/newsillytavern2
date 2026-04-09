// ============================================
// Dialogue Slice - State management for dialogue display system
// ============================================

import type { StateCreator } from 'zustand';
import {
  DEFAULT_DIALOGUE_SETTINGS,
  DEFAULT_TYPOGRAPHY_SETTINGS,
  DEFAULT_CONTENT_STYLE_SETTINGS,
  type DialogueSettings,
  type CharacterDialogueStyle,
  type TypewriterSettings,
  type DialogueFormatSettings,
  type TypographySettings,
  type ContentStyleSettings,
} from '@/types';

// Re-export for convenience
export { DEFAULT_DIALOGUE_SETTINGS };

// ============================================
// Slice Type
// ============================================

export interface DialogueSlice {
  // Dialogue State
  dialogueSettings: DialogueSettings;

  // Settings Actions
  setDialogueSettings: (settings: Partial<DialogueSettings>) => void;
  resetDialogueSettings: () => void;

  // Typewriter Actions
  setTypewriterSettings: (settings: Partial<TypewriterSettings>) => void;

  // Formatting Actions
  setFormatSettings: (settings: Partial<DialogueFormatSettings>) => void;

  // Typography Actions
  setTypographySettings: (settings: Partial<TypographySettings>) => void;

  // Content Style Actions
  setContentStyles: (styles: Partial<ContentStyleSettings>) => void;
  setDialogueStyle: (style: Partial<ContentStyleSettings['dialogue']>) => void;
  setActionStyle: (style: Partial<ContentStyleSettings['action']>) => void;
  setThoughtStyle: (style: Partial<ContentStyleSettings['thought']>) => void;
  setWhisperStyle: (style: Partial<ContentStyleSettings['whisper']>) => void;
  setNarrationStyle: (style: Partial<ContentStyleSettings['narration']>) => void;
  setEmotionStyle: (style: Partial<ContentStyleSettings['emotion']>) => void;

  // Character Style Actions
  setCharacterStyle: (style: CharacterDialogueStyle) => void;
  removeCharacterStyle: (characterId: string) => void;
  getCharacterStyle: (characterId: string) => CharacterDialogueStyle | undefined;
}

// ============================================
// Slice Creator
// ============================================

export const createDialogueSlice: StateCreator<DialogueSlice, [], [], DialogueSlice> = (set, get) => ({
  // Initial State
  dialogueSettings: DEFAULT_DIALOGUE_SETTINGS,

  // Settings Actions
  setDialogueSettings: (settings) => set((state) => ({
    dialogueSettings: { ...state.dialogueSettings, ...settings }
  })),

  resetDialogueSettings: () => set({
    dialogueSettings: DEFAULT_DIALOGUE_SETTINGS
  }),

  // Typewriter Actions
  setTypewriterSettings: (settings) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      typewriter: { ...state.dialogueSettings.typewriter, ...settings }
    }
  })),

  // Formatting Actions
  setFormatSettings: (settings) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      formatting: { ...state.dialogueSettings.formatting, ...settings }
    }
  })),

  // Typography Actions
  setTypographySettings: (settings) => set((state) => {
    const currentTypography = state.dialogueSettings.typography ?? DEFAULT_TYPOGRAPHY_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        typography: { ...currentTypography, ...settings }
      }
    };
  }),

  // Content Style Actions
  setContentStyles: (styles) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: { ...currentStyles, ...styles }
      }
    };
  }),

  setDialogueStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          dialogue: { ...currentStyles.dialogue, ...style }
        }
      }
    };
  }),

  setActionStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          action: { ...currentStyles.action, ...style }
        }
      }
    };
  }),

  setThoughtStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          thought: { ...currentStyles.thought, ...style }
        }
      }
    };
  }),

  setWhisperStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          whisper: { ...currentStyles.whisper, ...style }
        }
      }
    };
  }),

  setNarrationStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          narration: { ...currentStyles.narration, ...style }
        }
      }
    };
  }),

  setEmotionStyle: (style) => set((state) => {
    const currentStyles = state.dialogueSettings.contentStyles ?? DEFAULT_CONTENT_STYLE_SETTINGS;
    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        contentStyles: {
          ...currentStyles,
          emotion: { ...currentStyles.emotion, ...style }
        }
      }
    };
  }),

  // Character Style Actions
  setCharacterStyle: (style) => set((state) => {
    const existing = state.dialogueSettings.characterStyles.findIndex(
      s => s.characterId === style.characterId
    );

    const newStyles = [...state.dialogueSettings.characterStyles];

    if (existing >= 0) {
      newStyles[existing] = style;
    } else {
      newStyles.push(style);
    }

    return {
      dialogueSettings: {
        ...state.dialogueSettings,
        characterStyles: newStyles
      }
    };
  }),

  removeCharacterStyle: (characterId) => set((state) => ({
    dialogueSettings: {
      ...state.dialogueSettings,
      characterStyles: state.dialogueSettings.characterStyles.filter(
        s => s.characterId !== characterId
      )
    }
  })),

  getCharacterStyle: (characterId) => {
    return get().dialogueSettings.characterStyles.find(
      s => s.characterId === characterId
    );
  },
});
