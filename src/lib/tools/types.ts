// ============================================
// Tool System Types
// ============================================
//
// Defines all types for the tool/action system.
// Tools allow LLM characters to perform actions
// (roll dice, search memory, get weather, etc.)
// during chat responses.

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
}

/** Result from tool execution */
export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  result: unknown;
  displayMessage: string;
  duration?: number;
  error?: string;
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
