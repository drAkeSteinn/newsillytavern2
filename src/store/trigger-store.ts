import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SFXTrigger,
  BackgroundTrigger,
  BackgroundPack,
  SpriteTrigger,
  SpritePack,
  EmotionTrigger,
  TriggerSystemSettings,
  BackgroundIndex,
  SpriteIndex,
  SoundPacksIndex,
} from '@/types/triggers';
import { DEFAULT_TRIGGER_SETTINGS } from '@/types/triggers';
import { v4 as uuidv4 } from 'uuid';

// ============ Store Interface ============

interface TriggerState {
  // Settings
  settings: TriggerSystemSettings;

  // Triggers
  sfxTriggers: SFXTrigger[];
  backgroundTriggers: BackgroundTrigger[];
  backgroundPacks: BackgroundPack[];
  spriteTriggers: SpriteTrigger[];
  spritePacks: SpritePack[];
  emotionTriggers: EmotionTrigger[];

  // Indexes
  backgroundIndex: BackgroundIndex;
  spriteIndex: SpriteIndex;
  soundPacksIndex: SoundPacksIndex;

  // Settings Actions
  updateSettings: (updates: Partial<TriggerSystemSettings>) => void;

  // SFX Trigger Actions
  addSFXTrigger: (trigger: Omit<SFXTrigger, 'id'>) => void;
  updateSFXTrigger: (id: string, updates: Partial<SFXTrigger>) => void;
  deleteSFXTrigger: (id: string) => void;

  // Background Trigger Actions
  addBackgroundTrigger: (trigger: Omit<BackgroundTrigger, 'id'>) => void;
  updateBackgroundTrigger: (id: string, updates: Partial<BackgroundTrigger>) => void;
  deleteBackgroundTrigger: (id: string) => void;

  // Background Pack Actions
  addBackgroundPack: (pack: Omit<BackgroundPack, 'id'>) => void;
  updateBackgroundPack: (id: string, updates: Partial<BackgroundPack>) => void;
  deleteBackgroundPack: (id: string) => void;

  // Sprite Trigger Actions
  addSpriteTrigger: (trigger: Omit<SpriteTrigger, 'id'>) => void;
  updateSpriteTrigger: (id: string, updates: Partial<SpriteTrigger>) => void;
  deleteSpriteTrigger: (id: string) => void;

  // Sprite Pack Actions
  addSpritePack: (pack: Omit<SpritePack, 'id'>) => void;
  updateSpritePack: (id: string, updates: Partial<SpritePack>) => void;
  deleteSpritePack: (id: string) => void;

  // Emotion Trigger Actions
  addEmotionTrigger: (trigger: Omit<EmotionTrigger, 'id'>) => void;
  updateEmotionTrigger: (id: string, updates: Partial<EmotionTrigger>) => void;
  deleteEmotionTrigger: (id: string) => void;

  // Index Actions
  updateBackgroundIndex: (index: BackgroundIndex) => void;
  updateSpriteIndex: (index: SpriteIndex) => void;
  updateSoundPacksIndex: (index: SoundPacksIndex) => void;
}

// ============ Default Triggers ============

const defaultSFXTriggers: SFXTrigger[] = [
  {
    id: 'impact',
    title: 'Impact Sound',
    active: true,
    keywords: ['golpe', 'impacto', 'puñetazo', 'punch', 'hit'],
    requirePipes: true,
    caseSensitive: false,
    src: '/sounds/impact_1.wav',
    volume: 1.0,
    cooldownMs: 800,
    repeatCount: 1,
    soundPack: 'impact',
  },
  {
    id: 'rain',
    title: 'Rain Sound',
    active: true,
    keywords: ['lluvia', 'llovizna', 'tormenta', 'rain', 'storm'],
    requirePipes: true,
    caseSensitive: false,
    src: '/sounds/rain_1.wav',
    volume: 0.8,
    cooldownMs: 1200,
    repeatCount: 1,
    soundPack: 'ambient',
  },
];

const defaultEmotionTriggers: EmotionTrigger[] = [
  {
    id: 'angry',
    title: 'Angry Emotion',
    active: true,
    keywords: ['enojado', 'furioso', 'angry', 'mad', 'enfadado'],
    requirePipes: false,
    src: '/sounds/pop/pop1.wav',
    volume: 0.8,
    cooldownMs: 1400,
    repeatCount: 1,
    soundPack: 'emotion',
  },
  {
    id: 'sad',
    title: 'Sad Emotion',
    active: true,
    keywords: ['triste', 'sad', 'crying', 'llorando', 'deprimido'],
    requirePipes: false,
    src: '/sounds/hmmm/hmmm1.wav',
    volume: 0.8,
    cooldownMs: 1400,
    repeatCount: 1,
    soundPack: 'emotion',
  },
];

// ============ Store Implementation ============

export const useTriggerStore = create<TriggerState>()(
  persist(
    (set, get) => ({
      // Initial Settings
      settings: DEFAULT_TRIGGER_SETTINGS,

      // Initial Triggers
      sfxTriggers: defaultSFXTriggers,
      backgroundTriggers: [],
      backgroundPacks: [],
      spriteTriggers: [],
      spritePacks: [],
      emotionTriggers: defaultEmotionTriggers,

      // Initial Indexes
      backgroundIndex: { backgrounds: [], lastUpdated: 0 },
      spriteIndex: { sprites: [], lastUpdated: 0, source: '' },
      soundPacksIndex: { packs: {}, lastUpdated: 0 },

      // Settings Actions
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      // SFX Trigger Actions
      addSFXTrigger: (trigger) => set((state) => ({
        sfxTriggers: [...state.sfxTriggers, { ...trigger, id: uuidv4() }]
      })),

      updateSFXTrigger: (id, updates) => set((state) => ({
        sfxTriggers: state.sfxTriggers.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      })),

      deleteSFXTrigger: (id) => set((state) => ({
        sfxTriggers: state.sfxTriggers.filter((t) => t.id !== id)
      })),

      // Background Trigger Actions
      addBackgroundTrigger: (trigger) => set((state) => ({
        backgroundTriggers: [...state.backgroundTriggers, { ...trigger, id: uuidv4() }]
      })),

      updateBackgroundTrigger: (id, updates) => set((state) => ({
        backgroundTriggers: state.backgroundTriggers.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      })),

      deleteBackgroundTrigger: (id) => set((state) => ({
        backgroundTriggers: state.backgroundTriggers.filter((t) => t.id !== id)
      })),

      // Background Pack Actions
      addBackgroundPack: (pack) => set((state) => ({
        backgroundPacks: [...state.backgroundPacks, { ...pack, id: uuidv4() }]
      })),

      updateBackgroundPack: (id, updates) => set((state) => ({
        backgroundPacks: state.backgroundPacks.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        )
      })),

      deleteBackgroundPack: (id) => set((state) => ({
        backgroundPacks: state.backgroundPacks.filter((p) => p.id !== id)
      })),

      // Sprite Trigger Actions
      addSpriteTrigger: (trigger) => set((state) => ({
        spriteTriggers: [...state.spriteTriggers, { ...trigger, id: uuidv4() }]
      })),

      updateSpriteTrigger: (id, updates) => set((state) => ({
        spriteTriggers: state.spriteTriggers.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      })),

      deleteSpriteTrigger: (id) => set((state) => ({
        spriteTriggers: state.spriteTriggers.filter((t) => t.id !== id)
      })),

      // Sprite Pack Actions
      addSpritePack: (pack) => set((state) => ({
        spritePacks: [...state.spritePacks, { ...pack, id: uuidv4() }]
      })),

      updateSpritePack: (id, updates) => set((state) => ({
        spritePacks: state.spritePacks.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        )
      })),

      deleteSpritePack: (id) => set((state) => ({
        spritePacks: state.spritePacks.filter((p) => p.id !== id)
      })),

      // Emotion Trigger Actions
      addEmotionTrigger: (trigger) => set((state) => ({
        emotionTriggers: [...state.emotionTriggers, { ...trigger, id: uuidv4() }]
      })),

      updateEmotionTrigger: (id, updates) => set((state) => ({
        emotionTriggers: state.emotionTriggers.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      })),

      deleteEmotionTrigger: (id) => set((state) => ({
        emotionTriggers: state.emotionTriggers.filter((t) => t.id !== id)
      })),

      // Index Actions
      updateBackgroundIndex: (index) => set({ backgroundIndex: index }),
      updateSpriteIndex: (index) => set({ spriteIndex: index }),
      updateSoundPacksIndex: (index) => set({ soundPacksIndex: index }),
    }),
    {
      name: 'tavernflow-triggers',
      partialize: (state) => ({
        settings: state.settings,
        sfxTriggers: state.sfxTriggers,
        backgroundTriggers: state.backgroundTriggers,
        backgroundPacks: state.backgroundPacks,
        spriteTriggers: state.spriteTriggers,
        spritePacks: state.spritePacks,
        emotionTriggers: state.emotionTriggers,
        backgroundIndex: state.backgroundIndex,
        spriteIndex: state.spriteIndex,
        soundPacksIndex: state.soundPacksIndex,
      })
    }
  )
);
