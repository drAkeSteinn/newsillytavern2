// ============================================
// Store Defaults - Default values for the store
// ============================================

import type { LLMConfig, AppSettings, PromptTemplate, Persona, LorebookSettings, ContextSettings } from '@/types';
import { DEFAULT_CHATBOX_APPEARANCE } from '@/types';

export const defaultLLMConfig: LLMConfig = {
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

// Context settings must be defined before defaultSettings
export const defaultContextSettings: ContextSettings = {
  maxMessages: 50,           // Maximum messages in context window
  maxTokens: 4096,           // Token budget for context
  keepFirstN: 1,             // Always keep the greeting
  keepLastN: 20,             // Always keep last 20 messages
  enableSummaries: false,    // Future feature
  summaryThreshold: 40       // When to trigger summarization
};

export const defaultSettings: AppSettings = {
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
    maxSoundsPerMessage: 10,
    globalCooldown: 0, // 0 = no cooldown, allows all sounds in same message to play
    realtimeEnabled: true,
    globalMute: false
  },
  backgroundTriggers: {
    enabled: true,
    globalCooldown: 250,
    realtimeEnabled: true,
    transitionDuration: 500,
    defaultTransitionType: 'fade',
    returnToDefaultEnabled: false,
    returnToDefaultAfter: 300000,
    defaultBackgroundUrl: '',
    globalOverlays: []
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
  context: defaultContextSettings,
  chatboxAppearance: DEFAULT_CHATBOX_APPEARANCE,
  embeddingsChat: {
    enabled: false,
    maxTokenBudget: 1024,
    namespaceStrategy: 'character',
    showInPromptViewer: true,
    // Memory extraction settings
    memoryExtractionEnabled: false,
    memoryExtractionFrequency: 5,
    memoryExtractionMinImportance: 2,
    // Memory consolidation settings
    memoryConsolidationEnabled: false,
    memoryConsolidationThreshold: 50,
    memoryConsolidationKeepRecent: 10,
    memoryConsolidationKeepHighImportance: 4,
    // Custom memory extraction prompt
    memoryExtractionPrompt: `Eres un analista de memoria para un personaje de rol. Tu ÚNICA tarea es extraer hechos memorables del mensaje de un personaje.\n\nReglas estrictas:\n- Solo extrae información NUEVA y RELEVANTE sobre el jugador, relaciones, eventos importantes, secretos o preferencias\n- Ignora saludos, descripciones genéricas, acciones rutinarias y narrativa decorativa\n- Ignora información que ya es conocimiento general del personaje\n- Cada hecho debe ser una FRASE concisa (máximo 50 palabras) en tercera persona\n- Si NO hay nada memorable, responde EXACTAMENTE: []\n\nResponde SOLO con un JSON array, sin explicaciones, sin markdown, sin texto adicional.\n\nEjemplos:\n\nMensaje del personaje:\n"*mira con recelo* No confío en ti desde que robaste las gemas del templo. Y sé que le debes dinero a Claudec."\n\nRespuesta correcta:\n[{"contenido":"El personaje no confía en el jugador desde que robó las gemas del templo","tipo":"relacion","importancia":4},{"contenido":"El jugador le debe dinero a Claudec","tipo":"hecho","importancia":3}]\n\nMensaje del personaje:\n"¡Buenos días! ¿En qué puedo ayudarte hoy?"\n\nRespuesta correcta:\n[]\n\nAhora analiza este mensaje:\n\nNombre del personaje: {characterName}\n{lastMessage}`,
    // Context depth for memory extraction (0 = only last response, N = include N recent messages)
    memoryExtractionContextDepth: 2,
    // Context depth for embedding search query (0 = only user message, N = include N recent messages)
    searchContextDepth: 1,
    // Group dynamics extraction (extracts inter-character relationships in group chats)
    groupDynamicsExtraction: false,
  }
};

export const defaultPromptTemplate: PromptTemplate = {
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

export const defaultPersona: Persona = {
  id: 'default',
  name: 'User',
  description: '',
  avatar: '',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const defaultLorebookSettings: LorebookSettings = {
  scanDepth: 5,
  caseSensitive: false,
  matchWholeWords: false,
  useGroupScoring: false,
  automationId: '',
  tokenBudget: 2048,
  recursionLimit: 3
};
