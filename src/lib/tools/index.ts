// ============================================
// Tools System - Main Export
// ============================================

export * from './types';
export {
  registerTool,
  getToolById,
  getToolByName,
  getAllToolDefinitions,
  getToolDefinitionsByIds,
  getToolsByCategory,
  toOpenAITools,
  executeTool,
} from './tool-registry';
export {
  getSessionReminders,
  mentionReminder,
  clearSessionReminders,
} from './tools/set-reminder';
// Native tool call parser (OpenAI, Ollama, Anthropic formats)
export {
  createToolCallAccumulator,
  hasToolCalls,
  processOpenAIDelta,
  finalizeToolCalls,
  buildToolMessagesForOpenAI,
  processOllamaToolDelta,
  buildToolMessagesForOllama,
  createAnthropicToolState,
  processAnthropicEvent,
  anthropicStateToToolCalls,
  buildToolMessagesForAnthropic,
} from './parsers/native-parser';
export type {
  NativeToolCall,
  ToolCallAccumulator,
  AnthropicToolState,
} from './parsers/native-parser';
// Prompt-based parser (for models that output tool calls as text)
export {
  parseToolCallFromText,
  mightContainToolCall,
  stripToolCallFromText,
  splitIntoChunks,
} from './parsers/prompt-parser';
