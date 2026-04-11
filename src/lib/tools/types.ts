// ============================================
// Tool System Types
// ============================================
//
// Defines all types for the tool/action system.
// Tools allow LLM characters to perform actions
// (roll dice, search memory, get weather, etc.)
// during chat responses.

import type { SessionQuestInstance, QuestTemplate, CharacterStatsConfig, SessionStats, ActivationCost, QuestReward, SkillDefinition, CharacterCard, SolicitudInstance } from '@/types';

// ============================================
// Tool Definition
// ============================================

/** Parameter definition using a simplified JSON Schema */
export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  enum?: string[];
  default?: unknown;
  required: boolean;
}

/** Schema for tool parameters (OpenAI-compatible JSON Schema subset) */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameterDef>;
  required: string[];
}

/** Tool category */
export type ToolCategory = 'in_character' | 'cognitive' | 'real_world' | 'system';

/** Permission mode for tool execution */
export type ToolPermissionMode = 'auto' | 'ask';

/** Full definition of a tool (what the LLM sees) */
export interface ToolDefinition {
  id: string;
  name: string;
  label: string;
  icon: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameterSchema;
  permissionMode: ToolPermissionMode;
}

// ============================================
// Tool Execution
// ============================================

/** Context provided to tool executors */
export interface ToolContext {
  characterId: string;
  characterName: string;
  sessionId: string;
  groupId?: string;
  userName: string;
  /** Quest data for quest-related tools */
  sessionQuests?: SessionQuestInstance[];
  questTemplates?: QuestTemplate[];
  /** Stats data for action/skill-related tools */
  statsConfig?: CharacterStatsConfig;
  sessionStats?: SessionStats;
  /** All characters for resolving invitations/solicitudes across characters */
  allCharacters?: CharacterCard[];
}

/** Result from tool execution */
export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  result: unknown;
  displayMessage: string;
  duration?: number;
  error?: string;
  /** Special result for quest-related tools */
  questActivation?: {
    /** Type of quest activation */
    type: 'activate_quest' | 'complete_objective' | 'progress_objective';
    /** The key/target for the activation (quest name, objective key, etc.) */
    key: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
  };
  /** Special result for action/skill activation tools */
  actionActivation?: {
    skillId: string;
    skillName: string;
    skillDescription?: string;
    activationCosts: ActivationCost[];
    activationRewards: QuestReward[];
    characterId: string;
  };
  /** Special result for solicitud activation/completion tools */
  solicitudActivation?: {
    type: 'create_solicitud' | 'complete_solicitud';
    solicitudKey: string;
    targetCharacterId?: string;
    targetCharacterName?: string;
    fromCharacterId: string;
    fromCharacterName: string;
    description?: string;
    completionDescription?: string;
    peticionKey?: string;
  };
}

/** Parsed tool call from LLM output */
export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
  raw: string;
}

// ============================================
// Tool Settings (persisted in store)
// ============================================

/** Settings for a single tool */
export interface ToolSetting {
  toolId: string;
  enabled: boolean;
}

/** Per-character tool configuration */
export interface CharacterToolConfig {
  characterId: string;
  enabledTools: string[];  // Tool IDs that are enabled for this character
}

/** Global tools settings */
export interface ToolsSettings {
  /** Master switch for the entire tool system */
  enabled: boolean;
  /** Maximum tool calls per turn (default: 2) */
  maxToolCallsPerTurn: number;
  /** Per-character tool configs */
  characterConfigs: CharacterToolConfig[];
}

export const DEFAULT_TOOLS_SETTINGS: ToolsSettings = {
  enabled: true,
  maxToolCallsPerTurn: 2,
  characterConfigs: [],
};

// ============================================
// SSE Event Types (sent to client)
// ============================================

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolName: string;
  toolLabel: string;
  toolIcon: string;
  params: Record<string, unknown>;
}

export interface ToolCallResultEvent {
  type: 'tool_call_result';
  toolName: string;
  success: boolean;
  displayMessage: string;
  duration: number;
}

export interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolName: string;
  error: string;
}
