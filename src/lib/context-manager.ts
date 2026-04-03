// ============================================
// Context Manager - Sliding window and message limits
// ============================================

import type { ChatMessage, CharacterCard, LLMConfig } from '@/types';

// ============================================
// Types
// ============================================

export interface ContextConfig {
  maxMessages: number;           // Maximum messages in context
  maxTokens: number;             // Maximum tokens (soft limit)
  keepFirstN: number;            // Always keep first N messages (greeting, etc.)
  keepLastN: number;             // Always keep last N messages
  summaryThreshold: number;      // When to trigger summarization (future)
}

export interface ContextWindow {
  messages: ChatMessage[];
  totalMessages: number;         // Original count before windowing
  excludedCount: number;         // How many messages were excluded
  estimatedTokens: number;
}

export interface SummaryMetadata {
  summarizedMessageCount: number;
  summarizedAt: string;
  summaryType: 'auto' | 'manual';
}

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxMessages: 50,               // Keep last 50 messages by default
  maxTokens: 4096,               // Token budget for context
  keepFirstN: 1,                 // Always keep the first greeting
  keepLastN: 20,                 // Always keep last 20 messages
  summaryThreshold: 40           // Consider summarizing at 40+ messages
};

// Provider-specific context limits
export const PROVIDER_CONTEXT_LIMITS: Record<string, number> = {
  'z-ai': 4096,
  'openai': 128000,              // GPT-4o has 128k context
  'anthropic': 200000,           // Claude has 200k context
  'ollama': 4096,                // Depends on model, conservative default
  'vllm': 8192,
  'koboldcpp': 4096,
  'text-generation-webui': 4096,
  'custom': 4096
};

// ============================================
// Token Estimation
// ============================================

/**
 * Estimates token count for text
 * Uses approximation: ~4 characters per token for English, ~2 for CJK
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Count CJK characters (roughly 2 chars per token)
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  
  // Count other characters (roughly 4 chars per token)
  const otherChars = text.length - cjkChars;
  
  return Math.ceil(cjkChars / 2 + otherChars / 4);
}

/**
 * Estimates tokens for a single message
 */
export function estimateMessageTokens(message: ChatMessage): number {
  const contentTokens = estimateTokens(message.content);
  const roleOverhead = 4; // Role markers, newlines, etc.
  return contentTokens + roleOverhead;
}

/**
 * Estimates total tokens for messages array
 */
export function estimateTotalTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

// ============================================
// Context Window Management
// ============================================

/**
 * Applies sliding window to messages
 * Keeps first N and last N messages, excludes middle if needed
 */
export function applySlidingWindow(
  messages: ChatMessage[],
  config: ContextConfig = DEFAULT_CONTEXT_CONFIG
): ContextWindow {
  const totalMessages = messages.length;
  
  // If under limit, return all
  if (totalMessages <= config.maxMessages) {
    return {
      messages,
      totalMessages,
      excludedCount: 0,
      estimatedTokens: estimateTotalTokens(messages)
    };
  }
  
  // Calculate how many to exclude
  const toExclude = totalMessages - config.maxMessages;
  
  // Keep first N messages (usually greeting)
  const firstPart = messages.slice(0, config.keepFirstN);
  
  // Keep last N messages
  const lastPart = messages.slice(-config.keepLastN);
  
  // Calculate middle section
  const middleStart = config.keepFirstN;
  const middleEnd = totalMessages - config.keepLastN;
  const middleMessages = messages.slice(middleStart, middleEnd);
  
  // How many middle messages we can include
  const middleBudget = config.maxMessages - config.keepFirstN - config.keepLastN;
  
  let includedMiddle: ChatMessage[] = [];
  let excludedCount = 0;
  
  if (middleBudget > 0 && middleMessages.length > 0) {
    // Include most recent middle messages
    includedMiddle = middleMessages.slice(-middleBudget);
    excludedCount = middleMessages.length - includedMiddle.length;
  } else {
    excludedCount = middleMessages.length;
  }
  
  const result = [...firstPart, ...includedMiddle, ...lastPart];
  
  return {
    messages: result,
    totalMessages,
    excludedCount,
    estimatedTokens: estimateTotalTokens(result)
  };
}

/**
 * Applies token-based context limit
 * More precise than message count but slower
 */
export function applyTokenLimit(
  messages: ChatMessage[],
  maxTokens: number,
  config: ContextConfig = DEFAULT_CONTEXT_CONFIG
): ContextWindow {
  const totalMessages = messages.length;
  const result: ChatMessage[] = [];
  let currentTokens = 0;
  let excludedCount = 0;
  
  // Always include first N messages
  const firstMessages = messages.slice(0, config.keepFirstN);
  const firstTokens = estimateTotalTokens(firstMessages);
  
  if (firstTokens > maxTokens) {
    // Even first messages exceed limit, include them anyway (truncation happens at LLM)
    result.push(...firstMessages);
    currentTokens = firstTokens;
  } else {
    result.push(...firstMessages);
    currentTokens = firstTokens;
  }
  
  // Add messages from newest to oldest until we hit limit
  const remainingMessages = messages.slice(config.keepFirstN);
  const tempBuffer: ChatMessage[] = [];
  let bufferTokens = 0;
  
  for (let i = remainingMessages.length - 1; i >= 0; i--) {
    const msg = remainingMessages[i];
    const msgTokens = estimateMessageTokens(msg);
    
    if (currentTokens + bufferTokens + msgTokens <= maxTokens) {
      tempBuffer.unshift(msg);
      bufferTokens += msgTokens;
    } else {
      excludedCount++;
    }
  }
  
  result.push(...tempBuffer);
  currentTokens += bufferTokens;
  
  return {
    messages: result,
    totalMessages,
    excludedCount,
    estimatedTokens: currentTokens
  };
}

/**
 * Smart context selection combining message count and token limits
 */
export function selectContextMessages(
  messages: ChatMessage[],
  llmConfig?: LLMConfig | null,
  customConfig?: Partial<ContextConfig>
): ContextWindow {
  // Build config
  const config: ContextConfig = {
    ...DEFAULT_CONTEXT_CONFIG,
    ...customConfig
  };
  
  // Get provider-specific token limit
  const provider = llmConfig?.provider || 'z-ai';
  const providerTokenLimit = PROVIDER_CONTEXT_LIMITS[provider] || 4096;
  
  // Use the lower of config.maxTokens and provider limit
  const effectiveMaxTokens = Math.min(config.maxTokens, providerTokenLimit);
  
  // Filter out deleted messages first
  const activeMessages = messages.filter(m => !m.isDeleted);
  
  // First apply message-based windowing (fast)
  const windowedResult = applySlidingWindow(activeMessages, config);
  
  // Then apply token limit if needed (more precise)
  if (windowedResult.estimatedTokens > effectiveMaxTokens) {
    return applyTokenLimit(activeMessages, effectiveMaxTokens, config);
  }
  
  return windowedResult;
}

// ============================================
// Summary Preparation (Future Feature)
// ============================================

/**
 * Identifies messages that should be summarized
 */
export function getSummarizableMessages(
  messages: ChatMessage[],
  config: ContextConfig = DEFAULT_CONTEXT_CONFIG
): { toSummarize: ChatMessage[]; toKeep: ChatMessage[] } {
  if (messages.length < config.summaryThreshold) {
    return { toSummarize: [], toKeep: messages };
  }
  
  // Keep first N and last N, summarize the middle
  const firstPart = messages.slice(0, config.keepFirstN);
  const lastPart = messages.slice(-config.keepLastN);
  
  const middleStart = config.keepFirstN;
  const middleEnd = messages.length - config.keepLastN;
  const middleMessages = messages.slice(middleStart, middleEnd);
  
  return {
    toSummarize: middleMessages,
    toKeep: [...firstPart, ...lastPart]
  };
}

/**
 * Creates a summary placeholder (to be replaced with actual summarization)
 */
export function createSummaryPlaceholder(
  summarizedCount: number,
  summary?: string
): ChatMessage {
  return {
    id: `summary_${Date.now()}`,
    characterId: 'system',
    role: 'system',
    content: summary || `[Resumen de ${summarizedCount} mensajes anteriores]`,
    timestamp: new Date().toISOString(),
    isDeleted: false,
    swipeId: 'summary',
    swipeIndex: 0,
    metadata: {
      isSummary: true,
      summarizedMessageCount: summarizedCount
    }
  };
}

// ============================================
// Context Statistics
// ============================================

export interface ContextStats {
  totalMessages: number;
  activeMessages: number;
  deletedMessages: number;
  estimatedTokens: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  averageMessageLength: number;
  oldestMessage?: string;
  newestMessage?: string;
}

export function getContextStats(messages: ChatMessage[]): ContextStats {
  const activeMessages = messages.filter(m => !m.isDeleted);
  
  const userMessages = activeMessages.filter(m => m.role === 'user').length;
  const assistantMessages = activeMessages.filter(m => m.role === 'assistant').length;
  const systemMessages = activeMessages.filter(m => m.role === 'system').length;
  
  const totalLength = activeMessages.reduce((sum, m) => sum + m.content.length, 0);
  
  return {
    totalMessages: messages.length,
    activeMessages: activeMessages.length,
    deletedMessages: messages.filter(m => m.isDeleted).length,
    estimatedTokens: estimateTotalTokens(activeMessages),
    userMessages,
    assistantMessages,
    systemMessages,
    averageMessageLength: activeMessages.length > 0 
      ? Math.round(totalLength / activeMessages.length) 
      : 0,
    oldestMessage: activeMessages[0]?.timestamp,
    newestMessage: activeMessages[activeMessages.length - 1]?.timestamp
  };
}

// ============================================
// Race Condition Prevention
// ============================================

/**
 * Generation state tracker
 * Prevents concurrent generation requests
 */
export class GenerationLock {
  private locked: boolean = false;
  private lockId: string | null = null;
  private lockedAt: number | null = null;
  private timeout: number;
  
  constructor(timeoutMs: number = 300000) { // 5 minute default timeout
    this.timeout = timeoutMs;
  }
  
  acquire(id: string): boolean {
    // Check if lock is stale
    if (this.locked && this.lockedAt) {
      if (Date.now() - this.lockedAt > this.timeout) {
        // Lock is stale, force release
        this.release();
      }
    }
    
    if (this.locked) {
      return false;
    }
    
    this.locked = true;
    this.lockId = id;
    this.lockedAt = Date.now();
    return true;
  }
  
  release(): void {
    this.locked = false;
    this.lockId = null;
    this.lockedAt = null;
  }
  
  isLocked(): boolean {
    return this.locked;
  }
  
  getLockInfo(): { locked: boolean; lockId: string | null; lockedAt: number | null } {
    return {
      locked: this.locked,
      lockId: this.lockId,
      lockedAt: this.lockedAt
    };
  }
}

// Global generation lock instance
export const globalGenerationLock = new GenerationLock();
