// ============================================
// Settings Slice - Application settings
// ============================================

import type { AppSettings, ChatboxAppearanceSettings, ChatboxBackgroundSettings, ChatboxFontSettings, ChatboxTextFormatting, ChatboxTextColors, MessageBubbleSettings, ChatboxAvatarSettings, ChatboxStreamingSettings, ChatboxInputSettings, HandySettings } from '@/types';
import { DEFAULT_HANDY_SETTINGS } from '@/types';
import { defaultSettings } from '../defaults';

export interface SettingsSlice {
  // State
  settings: AppSettings;

  // Actions
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // Chatbox Appearance Actions
  updateChatboxAppearance: (updates: Partial<ChatboxAppearanceSettings>) => void;
  updateChatboxBackground: (updates: Partial<ChatboxBackgroundSettings>) => void;
  updateChatboxFont: (updates: Partial<ChatboxFontSettings>) => void;
  updateChatboxTextFormatting: (updates: Partial<ChatboxTextFormatting>) => void;
  updateChatboxTextColors: (updates: Partial<ChatboxTextColors>) => void;
  updateMessageBubbles: (updates: Partial<MessageBubbleSettings>) => void;
  updateChatboxAvatars: (updates: Partial<ChatboxAvatarSettings>) => void;
  updateChatboxStreaming: (updates: Partial<ChatboxStreamingSettings>) => void;
  updateChatboxInput: (updates: Partial<ChatboxInputSettings>) => void;
  resetChatboxAppearance: () => void;

  // Handy / Haptic Settings Actions
  updateHandySettings: (updates: Partial<HandySettings>) => void;
}

export const createSettingsSlice = (set: any, _get: any): SettingsSlice => ({
  // Initial State
  settings: defaultSettings,

  // Actions
  updateSettings: (updates) => set((state: any) => ({
    settings: { ...state.settings, ...updates }
  })),
  
  // Chatbox Appearance Actions
  updateChatboxAppearance: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: { ...state.settings.chatboxAppearance, ...updates }
    }
  })),
  
  updateChatboxBackground: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        background: { ...state.settings.chatboxAppearance.background, ...updates }
      }
    }
  })),
  
  updateChatboxFont: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        font: { ...state.settings.chatboxAppearance.font, ...updates }
      }
    }
  })),
  
  updateChatboxTextFormatting: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        textFormatting: { ...state.settings.chatboxAppearance.textFormatting, ...updates }
      }
    }
  })),
  
  updateChatboxTextColors: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        textColors: { ...state.settings.chatboxAppearance.textColors, ...updates }
      }
    }
  })),
  
  updateMessageBubbles: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        bubbles: { ...state.settings.chatboxAppearance.bubbles, ...updates }
      }
    }
  })),
  
  updateChatboxAvatars: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        avatars: { ...state.settings.chatboxAppearance.avatars, ...updates }
      }
    }
  })),
  
  updateChatboxStreaming: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        streaming: { ...state.settings.chatboxAppearance.streaming, ...updates }
      }
    }
  })),
  
  updateChatboxInput: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: {
        ...state.settings.chatboxAppearance,
        input: { ...state.settings.chatboxAppearance.input, ...updates }
      }
    }
  })),
  
  resetChatboxAppearance: () => set((state: any) => ({
    settings: {
      ...state.settings,
      chatboxAppearance: defaultSettings.chatboxAppearance
    }
  })),

  // Handy / Haptic Settings Actions
  updateHandySettings: (updates) => set((state: any) => ({
    settings: {
      ...state.settings,
      handy: {
        ...(state.settings.handy || DEFAULT_HANDY_SETTINGS),
        ...updates
      }
    }
  })),
});
