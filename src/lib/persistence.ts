import fs from 'fs';
import path from 'path';

// Data directory path
const DATA_DIR = path.join(process.cwd(), 'data');

// File paths for each data type
export const DATA_FILES = {
  // Core data
  characters: path.join(DATA_DIR, 'characters.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  groups: path.join(DATA_DIR, 'groups.json'),
  personas: path.join(DATA_DIR, 'personas.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  lorebooks: path.join(DATA_DIR, 'lorebooks.json'),
  // LLM & TTS
  llmConfigs: path.join(DATA_DIR, 'llm-configs.json'),
  ttsConfigs: path.join(DATA_DIR, 'tts-configs.json'),
  promptTemplates: path.join(DATA_DIR, 'prompt-templates.json'),
  // Sound system
  soundTriggers: path.join(DATA_DIR, 'sound-triggers.json'),
  soundCollections: path.join(DATA_DIR, 'sound-collections.json'),
  soundSequenceTriggers: path.join(DATA_DIR, 'sound-sequence-triggers.json'),
  // Visual systems
  backgrounds: path.join(DATA_DIR, 'backgrounds.json'),
  backgroundPacks: path.join(DATA_DIR, 'background-packs.json'),
  spritePacks: path.join(DATA_DIR, 'sprite-packs.json'),
  sprites: path.join(DATA_DIR, 'sprites.json'),
  hudTemplates: path.join(DATA_DIR, 'hud-templates.json'),
  // Advanced systems
  atmosphere: path.join(DATA_DIR, 'atmosphere.json'),
  memory: path.join(DATA_DIR, 'memory.json'),
  quests: path.join(DATA_DIR, 'quests.json'),
  dialogue: path.join(DATA_DIR, 'dialogue.json'),
  inventory: path.join(DATA_DIR, 'inventory.json'),
  // Active states (session restoration)
  activeStates: path.join(DATA_DIR, 'active-states.json'),
} as const;

// All valid data types
export const VALID_DATA_TYPES = [
  // Core data
  'characters', 'sessions', 'groups', 'personas', 'settings', 'lorebooks',
  // LLM & TTS
  'llmConfigs', 'ttsConfigs', 'promptTemplates',
  // Sound system
  'soundTriggers', 'soundCollections', 'soundSequenceTriggers',
  // Visual systems
  'backgrounds', 'backgroundPacks', 'spritePacks', 'sprites', 'hudTemplates',
  // Advanced systems
  'atmosphere', 'memory', 'quests', 'dialogue', 'inventory',
  // Active states
  'activeStates',
] as const;

export type DataType = typeof VALID_DATA_TYPES[number];

// Default LLM config
const defaultLLMConfig = {
  id: 'default',
  name: 'Z.ai Chat',
  provider: 'z-ai',
  endpoint: '',
  model: '',
  parameters: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 512,
    contextSize: 4096,
    repetitionPenalty: 1.1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopStrings: [],
    stream: true
  },
  isActive: true
};

// Default prompt template
const defaultPromptTemplate = {
  id: 'default',
  name: 'Default Template',
  description: 'Standard roleplay template',
  systemPrompt: `You are now in roleplay mode. You will act as {{char}}.
{{#if description}}
Character Description: {{description}}
{{/if}}
{{#if personality}}
Personality: {{personality}}
{{/if}}
{{#if scenario}}
Scenario: {{scenario}}
{{/if}}
Stay in character at all times. Write detailed, engaging responses that reflect {{char}}'s personality and emotions.`,
  userPrompt: '{{user}}',
  assistantPrompt: '{{char}}',
  contextTemplate: `{{#each messages}}
{{#if (eq role 'user')}}{{../userPrompt}}: {{content}}{{/if}}
{{#if (eq role 'assistant')}}{{../assistantPrompt}}: {{content}}{{/if}}
{{/each}}`,
  characterTemplate: `{{name}}'s Persona:
{{description}}

Personality traits: {{personality}}
{{#if scenario}}
Current scenario: {{scenario}}
{{/if}}`,
  groupTemplate: `Multiple characters are present in this conversation.
Characters: {{#each characters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}

{{#each characters}}
---
{{name}}:
{{description}}
Personality: {{personality}}
{{/each}}`,
  isDefault: true
};

// Default values for each data type
export const DEFAULT_DATA = {
  // Core data
  characters: [],
  sessions: [],
  groups: [],
  personas: [{
    id: 'default',
    name: 'User',
    description: '',
    avatar: '',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }],
  settings: {
    theme: 'dark',
    fontSize: 16,
    messageDisplay: 'bubble',
    showTimestamps: true,
    showTokens: true,
    autoScroll: true,
    autoSave: true,
    autoSaveInterval: 30000,
    confirmDelete: true,
    defaultBackground: '',
    backgroundFit: 'cover',
    swipeEnabled: true,
    quickReplies: [
    { label: 'Continue', response: 'Continue' },
    { label: '...', response: '...' },
    { label: 'Yes', response: 'Yes' },
    { label: 'No', response: 'No' },
  ],
    hotkeys: {
      send: 'Enter',
      newLine: 'Shift+Enter',
      regenerate: 'Ctrl+R',
      swipeLeft: 'ArrowLeft',
      swipeRight: 'ArrowRight'
    },
    sound: {
      enabled: true,
      globalVolume: 0.85,
      maxSoundsPerMessage: 3,
      globalCooldown: 150,
      realtimeEnabled: true
    },
    backgroundTriggers: {
      enabled: true,
      globalCooldown: 250,
      realtimeEnabled: true,
      transitionDuration: 500
    },
    chatLayout: {
      novelMode: true,
      chatWidth: 60,
      chatHeight: 70,
      chatX: 50,
      chatY: 50,
      chatOpacity: 0.95,
      blurBackground: true,
      showCharacterSprite: true
    },
    context: {
      maxMessages: 50,
      maxTokens: 4096,
      keepFirstN: 1,
      keepLastN: 20,
      enableSummaries: false,
      summaryThreshold: 40
    }
  },
  lorebooks: [],
  // LLM & TTS
  llmConfigs: [defaultLLMConfig],
  ttsConfigs: [],
  promptTemplates: [defaultPromptTemplate],
  // Sound system
  soundTriggers: [],
  soundCollections: [],
  soundSequenceTriggers: [],
  // Visual systems
  backgrounds: [],
  backgroundPacks: [],
  spritePacks: [],
  sprites: {
    spriteIndex: {},
    spriteLibraries: []
  },
  hudTemplates: [],
  // Advanced systems
  atmosphere: {
    activeAtmospherePresetId: null,
    atmosphereSettings: {
      enabled: false,
      intensity: 0.5,
      autoChange: false,
      weatherEffects: false
    }
  },
  memory: {
    summaries: [],
    summarySettings: {
      enabled: false,
      maxSummaries: 10,
      autoSummarize: false,
      threshold: 50
    },
    characterMemories: {},
    sessionTracking: {}
  },
  quests: {
    quests: [],
    questSettings: {
      enabled: false,
      autoTrack: true,
      showNotifications: true
    },
    questNotifications: []
  },
  dialogue: {
    dialogueSettings: {
      enabled: false,
      autoGenerate: false,
      style: 'default'
    }
  },
  inventory: {
    items: [],
    containers: [],
    currencies: [],
    inventorySettings: {
      enabled: false,
      maxItems: 100,
      autoAdd: false
    },
    inventoryNotifications: []
  },
  // Active states
  activeStates: {
    activeSessionId: null,
    activeCharacterId: null,
    activeGroupId: null,
    activeBackground: null,
    activeOverlayBack: null,
    activeOverlayFront: null,
    activePersonaId: 'default',
    activeLorebookIds: []
  },
};

// Ensure data directory exists
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Read JSON file with fallback to default
export function readDataFile<T>(filePath: string, defaultValue: T): T {
  try {
    ensureDataDir();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}

// Write JSON file
export function writeDataFile<T>(filePath: string, data: T): boolean {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Migrate settings from old formats to new formats
function migrateSettings(settings: any): any {
  if (!settings) return settings;
  
  // Migrate quickReplies from string[] to {label, response}[]
  if (Array.isArray(settings.quickReplies) && settings.quickReplies.length > 0) {
    const first = settings.quickReplies[0];
    if (typeof first === 'string') {
      settings.quickReplies = settings.quickReplies.map((text: string) => ({
        label: text,
        response: text,
      }));
    }
  }
  
  return settings;
}

// Read all persistent data
export function readAllPersistentData() {
  return {
    // Core data
    characters: readDataFile(DATA_FILES.characters, DEFAULT_DATA.characters),
    sessions: readDataFile(DATA_FILES.sessions, DEFAULT_DATA.sessions),
    groups: readDataFile(DATA_FILES.groups, DEFAULT_DATA.groups),
    personas: readDataFile(DATA_FILES.personas, DEFAULT_DATA.personas),
    settings: migrateSettings(readDataFile(DATA_FILES.settings, DEFAULT_DATA.settings)),
    lorebooks: readDataFile(DATA_FILES.lorebooks, DEFAULT_DATA.lorebooks),
    // LLM & TTS
    llmConfigs: readDataFile(DATA_FILES.llmConfigs, DEFAULT_DATA.llmConfigs),
    ttsConfigs: readDataFile(DATA_FILES.ttsConfigs, DEFAULT_DATA.ttsConfigs),
    promptTemplates: readDataFile(DATA_FILES.promptTemplates, DEFAULT_DATA.promptTemplates),
    // Sound system
    soundTriggers: readDataFile(DATA_FILES.soundTriggers, DEFAULT_DATA.soundTriggers),
    soundCollections: readDataFile(DATA_FILES.soundCollections, DEFAULT_DATA.soundCollections),
    soundSequenceTriggers: readDataFile(DATA_FILES.soundSequenceTriggers, DEFAULT_DATA.soundSequenceTriggers),
    // Visual systems
    backgrounds: readDataFile(DATA_FILES.backgrounds, DEFAULT_DATA.backgrounds),
    backgroundPacks: readDataFile(DATA_FILES.backgroundPacks, DEFAULT_DATA.backgroundPacks),
    spritePacks: readDataFile(DATA_FILES.spritePacks, DEFAULT_DATA.spritePacks),
    sprites: readDataFile(DATA_FILES.sprites, DEFAULT_DATA.sprites),
    hudTemplates: readDataFile(DATA_FILES.hudTemplates, DEFAULT_DATA.hudTemplates),
    // Advanced systems
    atmosphere: readDataFile(DATA_FILES.atmosphere, DEFAULT_DATA.atmosphere),
    memory: readDataFile(DATA_FILES.memory, DEFAULT_DATA.memory),
    quests: readDataFile(DATA_FILES.quests, DEFAULT_DATA.quests),
    dialogue: readDataFile(DATA_FILES.dialogue, DEFAULT_DATA.dialogue),
    inventory: readDataFile(DATA_FILES.inventory, DEFAULT_DATA.inventory),
    // Active states
    activeStates: readDataFile(DATA_FILES.activeStates, DEFAULT_DATA.activeStates),
  };
}

// Write specific data type
export function writePersistentData(dataType: DataType, data: unknown): boolean {
  const filePath = DATA_FILES[dataType];
  if (!filePath) return false;
  return writeDataFile(filePath, data);
}

// Initialize all data files with defaults if they don't exist
export function initializeDataFiles(): void {
  ensureDataDir();

  Object.entries(DATA_FILES).forEach(([key, filePath]) => {
    const dataType = key as keyof typeof DEFAULT_DATA;
    if (!fs.existsSync(filePath)) {
      writeDataFile(filePath, DEFAULT_DATA[dataType]);
      console.log(`Initialized ${filePath}`);
    }
  });
}
