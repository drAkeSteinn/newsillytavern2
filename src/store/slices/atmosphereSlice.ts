// ============================================
// Atmosphere Slice - State management for atmosphere effects
// ============================================

import type { StateCreator } from 'zustand';
import type { AtmosphereLayer, AtmospherePreset, AtmosphereSettings, AtmosphereState } from '@/types';

// ============================================
// Default Atmosphere Layers
// ============================================

export const DEFAULT_ATMOSPHERE_LAYERS: AtmosphereLayer[] = [
  // Rain
  {
    id: 'rain-light',
    name: 'Lluvia Ligera',
    category: 'precipitation',
    renderType: 'css',
    intensity: 0.3,
    speed: 1,
    opacity: 0.7,
    color: 'rgba(174, 194, 224, 0.6)',
    density: 100,
    direction: 0,
    cssClass: 'rain-light',
    triggerKeys: ['llovizna', 'lluvia ligera', 'light rain', 'drizzle'],
    active: false,
    priority: 10,
    audioLoopUrl: '/sounds/rain_1.wav',
    audioVolume: 0.3,
    loop: true,
  },
  {
    id: 'rain-heavy',
    name: 'Lluvia Intensa',
    category: 'precipitation',
    renderType: 'css',
    intensity: 0.8,
    speed: 1.5,
    opacity: 0.85,
    color: 'rgba(100, 149, 237, 0.8)',
    density: 200,
    direction: 5,
    cssClass: 'rain-heavy',
    triggerKeys: ['tormenta', 'lluvia intensa', 'heavy rain', 'storm', 'diluvio', 'aguacero'],
    active: false,
    priority: 11,
    audioLoopUrl: '/sounds/rain_2.wav',
    audioVolume: 0.5,
    loop: true,
  },
  // Snow
  {
    id: 'snow-light',
    name: 'Nevada Ligera',
    category: 'precipitation',
    renderType: 'canvas',
    intensity: 0.4,
    speed: 0.5,
    opacity: 0.9,
    color: '#ffffff',
    density: 50,
    sizeMin: 2,
    sizeMax: 5,
    direction: 0,
    windSpeed: 0.5,
    triggerKeys: ['nevada', 'nevar', 'copos de nieve', 'snow', 'snowing', 'snowflakes'],
    active: false,
    priority: 12,
    loop: true,
  },
  {
    id: 'snow-heavy',
    name: 'Tormenta de Nieve',
    category: 'precipitation',
    renderType: 'canvas',
    intensity: 0.9,
    speed: 0.8,
    opacity: 1,
    color: '#ffffff',
    density: 150,
    sizeMin: 3,
    sizeMax: 8,
    direction: 0,
    windSpeed: 1.5,
    triggerKeys: ['blizzard', 'tormenta de nieve', 'snowstorm', 'ventisca'],
    active: false,
    priority: 13,
    loop: true,
  },
  // Fog
  {
    id: 'fog-light',
    name: 'Niebla Ligera',
    category: 'fog',
    renderType: 'overlay',
    intensity: 0.3,
    speed: 0.1,
    opacity: 0.4,
    color: 'rgba(200, 200, 200, 0.3)',
    cssClass: 'fog-light',
    triggerKeys: ['niebla', 'neblina', 'fog', 'mist', 'bruma'],
    active: false,
    priority: 5,
    loop: true,
  },
  {
    id: 'fog-heavy',
    name: 'Niebla Densa',
    category: 'fog',
    renderType: 'overlay',
    intensity: 0.7,
    speed: 0.05,
    opacity: 0.7,
    color: 'rgba(150, 150, 150, 0.6)',
    cssClass: 'fog-heavy',
    triggerKeys: ['niebla densa', 'dense fog', 'espesa niebla', 'thick fog'],
    active: false,
    priority: 6,
    loop: true,
  },
  // Particles
  {
    id: 'fireflies',
    name: 'Luciernagas',
    category: 'particles',
    renderType: 'canvas',
    intensity: 0.6,
    speed: 0.3,
    opacity: 0.9,
    color: '#ffff88',
    colorSecondary: '#ffcc00',
    density: 30,
    sizeMin: 2,
    sizeMax: 4,
    triggerKeys: ['luciernagas', 'fireflies', 'noche de verano', 'summer night'],
    active: false,
    priority: 20,
    loop: true,
  },
  {
    id: 'falling-leaves',
    name: 'Hojas Cayendo',
    category: 'particles',
    renderType: 'canvas',
    intensity: 0.5,
    speed: 0.8,
    opacity: 0.9,
    color: '#d4a056',
    density: 40,
    sizeMin: 5,
    sizeMax: 12,
    direction: 0,
    windSpeed: 1,
    triggerKeys: ['hojas', 'otonio', 'leaves falling', 'autumn', 'falling leaves'],
    active: false,
    priority: 15,
    loop: true,
  },
  {
    id: 'embers',
    name: 'Ascuas',
    category: 'particles',
    renderType: 'canvas',
    intensity: 0.5,
    speed: 0.6,
    opacity: 1,
    color: '#ff4500',
    colorSecondary: '#ff8c00',
    density: 25,
    sizeMin: 2,
    sizeMax: 5,
    direction: -90, // Upward
    triggerKeys: ['fogata', 'campfire', 'ascuas', 'embers', 'brasas', 'fuego'],
    active: false,
    priority: 18,
    loop: true,
  },
  // Light effects
  {
    id: 'light-rays',
    name: 'Rayos de Luz',
    category: 'light',
    renderType: 'overlay',
    intensity: 0.5,
    speed: 0.2,
    opacity: 0.3,
    color: 'rgba(255, 255, 200, 0.4)',
    cssClass: 'light-rays',
    triggerKeys: ['rayos de sol', 'sun rays', 'luz del sol', 'sunlight', 'sunbeam'],
    active: false,
    priority: 8,
    loop: true,
  },
  {
    id: 'lightning',
    name: 'Relampagos',
    category: 'light',
    renderType: 'overlay',
    intensity: 1,
    speed: 1,
    opacity: 1,
    color: '#ffffff',
    cssClass: 'lightning',
    triggerKeys: ['relampago', 'rayo', 'lightning', 'thunder'],
    active: false,
    priority: 100,
    loop: false,
    duration: 200,
  },
  // Overlays
  {
    id: 'dust-overlay',
    name: 'Polvo',
    category: 'overlay',
    renderType: 'overlay',
    intensity: 0.3,
    speed: 0.1,
    opacity: 0.2,
    color: 'rgba(210, 180, 140, 0.3)',
    cssClass: 'dust-overlay',
    triggerKeys: ['polvo', 'dust', 'polvoriento', 'dusty'],
    active: false,
    priority: 3,
    loop: true,
  },
  {
    id: 'night-filter',
    name: 'Filtro Nocturno',
    category: 'overlay',
    renderType: 'overlay',
    intensity: 0.5,
    speed: 0,
    opacity: 0.4,
    color: 'rgba(25, 25, 112, 0.3)',
    cssClass: 'night-filter',
    triggerKeys: ['noche', 'night', 'medianoche', 'midnight', 'oscuridad'],
    active: false,
    priority: 1,
    loop: true,
  },
];

// ============================================
// Default Atmosphere Presets
// ============================================

export const DEFAULT_ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  {
    id: 'clear',
    name: 'Despejado',
    description: 'Sin efectos atmosfericos',
    icon: '☀️',
    layers: [],
    transitionDuration: 1000,
  },
  {
    id: 'rainy-day',
    name: 'Dia Lluvioso',
    description: 'Lluvia ligera con niebla',
    icon: '🌧️',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'rain-light')!, active: true },
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'fog-light')!, active: true, intensity: 0.2 },
    ],
    transitionDuration: 2000,
  },
  {
    id: 'stormy-night',
    name: 'Noche de Tormenta',
    description: 'Lluvia intensa, relampagos y niebla',
    icon: '⛈️',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'night-filter')!, active: true },
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'rain-heavy')!, active: true },
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'lightning')!, active: true },
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'fog-heavy')!, active: true, intensity: 0.3 },
    ],
    transitionDuration: 1500,
  },
  {
    id: 'snowy-wonderland',
    name: 'Paisaje Invernal',
    description: 'Nevada suave',
    icon: '❄️',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'snow-light')!, active: true },
    ],
    transitionDuration: 2000,
  },
  {
    id: 'summer-night',
    name: 'Noche de Verano',
    description: 'Luciernagas y ambiente nocturno',
    icon: '🌙',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'night-filter')!, active: true, intensity: 0.3 },
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'fireflies')!, active: true },
    ],
    transitionDuration: 2000,
  },
  {
    id: 'autumn-day',
    name: 'Dia de Otonio',
    description: 'Hojas cayendo suavemente',
    icon: '🍂',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'falling-leaves')!, active: true },
    ],
    transitionDuration: 2000,
  },
  {
    id: 'cozy-fire',
    name: 'Fogata Acogedora',
    description: 'Ascuas y ambiente calido',
    icon: '🔥',
    layers: [
      { ...DEFAULT_ATMOSPHERE_LAYERS.find(l => l.id === 'embers')!, active: true },
    ],
    transitionDuration: 1000,
  },
];

// ============================================
// Default Settings
// ============================================

export const DEFAULT_ATMOSPHERE_SETTINGS: AtmosphereSettings = {
  enabled: true,
  autoDetect: true,
  realtimeEnabled: true,
  globalIntensity: 1,
  globalVolume: 0.5,
  transitionDuration: 1500,
  showPreview: true,
  performanceMode: 'balanced',
};

// ============================================
// Slice Type
// ============================================

export interface AtmosphereSlice {
  // State
  atmosphereLayers: AtmosphereLayer[];
  atmospherePresets: AtmospherePreset[];
  atmosphereSettings: AtmosphereSettings;
  activeAtmosphereLayers: AtmosphereLayer[];
  activeAtmospherePresetId: string | null;
  atmosphereAudioEnabled: boolean;
  atmosphereGlobalIntensity: number;
  
  // Layer Actions
  setAtmosphereLayers: (layers: AtmosphereLayer[]) => void;
  addAtmosphereLayer: (layer: AtmosphereLayer) => void;
  updateAtmosphereLayer: (id: string, updates: Partial<AtmosphereLayer>) => void;
  removeAtmosphereLayer: (id: string) => void;
  
  // Preset Actions
  setAtmospherePresets: (presets: AtmospherePreset[]) => void;
  addAtmospherePreset: (preset: AtmospherePreset) => void;
  updateAtmospherePreset: (id: string, updates: Partial<AtmospherePreset>) => void;
  removeAtmospherePreset: (id: string) => void;
  
  // Activation Actions
  activateAtmosphereLayer: (layerId: string) => void;
  deactivateAtmosphereLayer: (layerId: string) => void;
  toggleAtmosphereLayer: (layerId: string) => void;
  activateAtmospherePreset: (presetId: string) => void;
  clearAtmosphereLayers: () => void;
  
  // Settings Actions
  setAtmosphereSettings: (settings: Partial<AtmosphereSettings>) => void;
  setAtmosphereAudioEnabled: (enabled: boolean) => void;
  setAtmosphereGlobalIntensity: (intensity: number) => void;
}

// ============================================
// Slice Creator
// ============================================

export const createAtmosphereSlice: StateCreator<AtmosphereSlice, [], [], AtmosphereSlice> = (set, get) => ({
  // Initial State
  atmosphereLayers: DEFAULT_ATMOSPHERE_LAYERS,
  atmospherePresets: DEFAULT_ATMOSPHERE_PRESETS,
  atmosphereSettings: DEFAULT_ATMOSPHERE_SETTINGS,
  activeAtmosphereLayers: [],
  activeAtmospherePresetId: null,
  atmosphereAudioEnabled: true,
  atmosphereGlobalIntensity: 1,
  
  // Layer Actions
  setAtmosphereLayers: (layers) => set({ atmosphereLayers: layers }),
  
  addAtmosphereLayer: (layer) => set((state) => ({
    atmosphereLayers: [...state.atmosphereLayers, layer]
  })),
  
  updateAtmosphereLayer: (id, updates) => set((state) => ({
    atmosphereLayers: state.atmosphereLayers.map(layer =>
      layer.id === id ? { ...layer, ...updates } : layer
    ),
    // Also update active layers if this one is active
    activeAtmosphereLayers: state.activeAtmosphereLayers.map(layer =>
      layer.id === id ? { ...layer, ...updates } : layer
    )
  })),
  
  removeAtmosphereLayer: (id) => set((state) => ({
    atmosphereLayers: state.atmosphereLayers.filter(layer => layer.id !== id),
    activeAtmosphereLayers: state.activeAtmosphereLayers.filter(layer => layer.id !== id)
  })),
  
  // Preset Actions
  setAtmospherePresets: (presets) => set({ atmospherePresets: presets }),
  
  addAtmospherePreset: (preset) => set((state) => ({
    atmospherePresets: [...state.atmospherePresets, preset]
  })),
  
  updateAtmospherePreset: (id, updates) => set((state) => ({
    atmospherePresets: state.atmospherePresets.map(preset =>
      preset.id === id ? { ...preset, ...updates } : preset
    )
  })),
  
  removeAtmospherePreset: (id) => set((state) => ({
    atmospherePresets: state.atmospherePresets.filter(preset => preset.id !== id),
    activeAtmospherePresetId: state.activeAtmospherePresetId === id ? null : state.activeAtmospherePresetId
  })),
  
  // Activation Actions
  activateAtmosphereLayer: (layerId) => set((state) => {
    const layer = state.atmosphereLayers.find(l => l.id === layerId);
    if (!layer) return state;
    
    // Check if already active
    if (state.activeAtmosphereLayers.some(l => l.id === layerId)) {
      return state;
    }
    
    return {
      activeAtmosphereLayers: [...state.activeAtmosphereLayers, { ...layer, active: true }]
        .sort((a, b) => a.priority - b.priority)
    };
  }),
  
  deactivateAtmosphereLayer: (layerId) => set((state) => ({
    activeAtmosphereLayers: state.activeAtmosphereLayers.filter(l => l.id !== layerId)
  })),
  
  toggleAtmosphereLayer: (layerId) => set((state) => {
    const isActive = state.activeAtmosphereLayers.some(l => l.id === layerId);
    if (isActive) {
      return {
        activeAtmosphereLayers: state.activeAtmosphereLayers.filter(l => l.id !== layerId)
      };
    } else {
      const layer = state.atmosphereLayers.find(l => l.id === layerId);
      if (!layer) return state;
      return {
        activeAtmosphereLayers: [...state.activeAtmosphereLayers, { ...layer, active: true }]
          .sort((a, b) => a.priority - b.priority)
      };
    }
  }),
  
  activateAtmospherePreset: (presetId) => set((state) => {
    if (presetId === 'clear') {
      return {
        activeAtmosphereLayers: [],
        activeAtmospherePresetId: presetId
      };
    }
    
    const preset = state.atmospherePresets.find(p => p.id === presetId);
    if (!preset) return state;
    
    return {
      activeAtmosphereLayers: preset.layers
        .map(layer => ({ ...layer, active: true }))
        .sort((a, b) => a.priority - b.priority),
      activeAtmospherePresetId: presetId
    };
  }),
  
  clearAtmosphereLayers: () => set({
    activeAtmosphereLayers: [],
    activeAtmospherePresetId: null
  }),
  
  // Settings Actions
  setAtmosphereSettings: (settings) => set((state) => ({
    atmosphereSettings: { ...state.atmosphereSettings, ...settings }
  })),
  
  setAtmosphereAudioEnabled: (enabled) => set({ atmosphereAudioEnabled: enabled }),
  
  setAtmosphereGlobalIntensity: (intensity) => set({ atmosphereGlobalIntensity: intensity }),
});
