// ============================================
// LLM Types - Shared types for LLM operations
// ============================================

import type { ChatMessage, CharacterCard, LLMConfig, Persona, PromptSection, CharacterGroup } from '@/types';

// Message format for chat APIs
export interface ChatApiMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}

// Request types
export interface StreamRequest {
  message: string;
  sessionId: string;
  characterId: string;
  character?: CharacterCard;
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
}

export interface GenerateRequest {
  message: string;
  sessionId: string;
  characterId: string;
  character?: CharacterCard;
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
}

export interface GroupStreamRequest {
  message: string;
  sessionId: string;
  groupId: string;
  group: CharacterGroup;
  characters: CharacterCard[];
  messages?: ChatMessage[];
  llmConfig?: LLMConfig;
  userName?: string;
  persona?: Persona;
  lastResponderId?: string;
}

// Response types
export interface GenerateResponse {
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

// Prompt building types
export interface PromptBuildConfig {
  character: CharacterCard;
  userName: string;
  persona?: Persona;
  messages: ChatMessage[];
  postHistoryInstructions?: string;
  authorNote?: string;
  includeSections?: boolean;
}

export interface GroupPromptBuildConfig {
  character: CharacterCard;
  allCharacters: CharacterCard[];
  group: CharacterGroup;
  userName: string;
  persona?: Persona;
  messages: ChatMessage[];
  previousResponses?: Array<{ characterName: string; content: string }>;
}

export interface PromptBuildResult {
  systemPrompt: string;
  sections: PromptSection[];
  chatMessages: ChatApiMessage[];
}

export interface GroupPromptBuildResult {
  systemPrompt: string;
  sections: PromptSection[];
  chatMessages: ChatApiMessage[];
  chatHistorySection?: PromptSection;
}

// Completion prompt type for APIs that use raw prompts
export interface CompletionPromptConfig {
  systemPrompt: string;
  messages: ChatMessage[];
  character: CharacterCard;
  userName: string;
  postHistoryInstructions?: string;
  authorNote?: string;
  embeddingsContext?: string;
}

// Prompt build result for group chats
export interface GroupPromptBuildResult {
  systemPrompt: string;
  sections: PromptSection[];
  chatMessages: ChatApiMessage[];
  chatHistorySection?: PromptSection;
}

// Provider capabilities
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsChatFormat: boolean;
  requiresApiKey: boolean;
  requiresEndpoint: boolean;
  maxContextTokens?: number;
}

// Provider info
export interface ProviderInfo {
  name: string;
  id: string;
  capabilities: ProviderCapabilities;
}

// All supported providers
export const SUPPORTED_PROVIDERS = [
  'z-ai',
  'openai',
  'anthropic',
  'ollama',
  'vllm',
  'lm-studio',
  'koboldcpp',
  'text-generation-webui',
  'custom'
] as const;

export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

// Default character for when none is provided
export const DEFAULT_CHARACTER: CharacterCard = {
  id: 'default',
  name: 'Assistant',
  description: '',
  personality: '',
  scenario: '',
  firstMes: 'Hello! How can I help you today?',
  mesExample: '',
  creatorNotes: '',
  characterNote: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  authorNote: '',
  alternateGreetings: [],
  tags: [],
  avatar: '',
  sprites: [],
  voice: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Default LLM parameters
export const DEFAULT_LLM_PARAMETERS = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 2048,
  contextSize: 4096,
  repetitionPenalty: 1.1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopStrings: [],
  stream: true
};
