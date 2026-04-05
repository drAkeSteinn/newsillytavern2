// ============================================
// Tool Calling Types
// ============================================

// Tool definition in OpenAI format (used by most providers)
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// Parsed tool call from LLM response
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Result of executing a tool call
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result: string;
  error?: string;
}

// Settings for the tool calling system
export interface ToolsSettings {
  enabled: boolean;
  // Which tools are available
  enabledTools: string[]; // Tool names that are enabled
  // Max tool calls per message (loop prevention)
  maxToolCallsPerTurn: number;
  // Max total rounds of tool calling (prevent infinite loops)
  maxToolRounds: number;
}

export const DEFAULT_TOOLS_SETTINGS: ToolsSettings = {
  enabled: false,
  enabledTools: ['search_web'],
  maxToolCallsPerTurn: 5,
  maxToolRounds: 3,
};

// Provider compatibility for native tool calling
export type ToolCallSupport = 'full' | 'partial' | 'none';

export const PROVIDER_TOOL_SUPPORT: Record<string, { support: ToolCallSupport; notes: string }> = {
  'openai': { support: 'full', notes: 'OpenAI API soporta tool calling nativo completo' },
  'anthropic': { support: 'full', notes: 'Anthropic Claude soporta tool calling nativo (tool_use)' },
  'ollama': { support: 'full', notes: 'Ollama /api/chat soporta tools (modelos compatibles: llama3.1+, mistral, etc.)' },
  'vllm': { support: 'full', notes: 'vLLM soporta tool calling nativo (OpenAI-compatible)' },
  'lm-studio': { support: 'full', notes: 'LM Studio v0.3+ soporta tool calling nativo' },
  'custom': { support: 'partial', notes: 'Depende del endpoint. Si es compatible con OpenAI, debería funcionar' },
  'z-ai': { support: 'none', notes: 'Z.ai SDK no soporta tool calling nativo' },
  'text-generation-webui': { support: 'none', notes: 'No soporta tool calling nativo. Usar como custom con OpenAI extension' },
  'koboldcpp': { support: 'none', notes: 'No soporta tool calling nativo' },
  'test-mock': { support: 'none', notes: 'Provider de testing, no soporta tool calling' },
};

// ChatApiMessage extended with tool role
export interface ToolChatMessage {
  role: 'system' | 'assistant' | 'user' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// Stream event from a tool-capable provider
export interface ToolStreamEvent {
  type: 'content' | 'tool_call_delta' | 'tool_call_start' | 'done' | 'error';
  content?: string;
  toolCallId?: string;
  toolCallName?: string;
  toolCallArguments?: string;
  toolCallIndex?: number;
  error?: string;
}
