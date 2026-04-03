// ============================================
// Validations - Simple validation for API requests
// NO ZOD - Direct validation for robustness
// Focus on validating ONLY what's strictly necessary
// ============================================

// ============================================
// Types for validated requests
// ============================================

export interface ValidatedStreamRequest {
  message: string;
  sessionId: string;
  characterId?: string;
  character?: unknown;
  messages?: unknown[];
  llmConfig: Record<string, unknown>;
  userName?: string;
  persona?: unknown;
  contextConfig?: unknown;
  sessionStats?: unknown;  // Session stats for attribute values
  hudContext?: unknown;     // HUD context for prompt injection
  allCharacters?: unknown[]; // All characters for peticiones/solicitudes resolution
}

export interface ValidatedGroupStreamRequest {
  message: string;
  sessionId: string;
  groupId: string;
  group: unknown;
  characters: unknown[];
  messages?: unknown[];
  llmConfig: Record<string, unknown>;
  userName?: string;
  persona?: unknown;
  lastResponderId?: string;
  contextConfig?: unknown;
  sessionStats?: unknown;  // Session stats for attribute values
  hudContext?: unknown;     // HUD context for prompt injection
}

export interface ValidatedGenerateRequest {
  message: string;
  sessionId: string;
  characterId?: string;
  character?: unknown;
  messages?: unknown[];
  llmConfig: Record<string, unknown>;
  userName?: string;
  persona?: unknown;
  contextConfig?: unknown;
  sessionStats?: unknown;  // Session stats for attribute values
  hudContext?: unknown;     // HUD context for prompt injection
}

// ============================================
// Validation Result Type
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// Helper Functions
// ============================================

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================
// Stream Request Validation (Single Character)
// ============================================

export function validateStreamRequest(data: unknown): ValidationResult<ValidatedStreamRequest> {
  try {
    if (!isObject(data)) {
      return { success: false, error: 'Request body must be an object' };
    }

    // Message is required
    if (!isString(data.message) || data.message.trim().length === 0) {
      return { success: false, error: 'message is required and cannot be empty' };
    }
    if (data.message.length > 50000) {
      return { success: false, error: 'message exceeds maximum length (50000 characters)' };
    }

    // sessionId is required
    if (!isString(data.sessionId) || data.sessionId.length === 0) {
      return { success: false, error: 'sessionId is required' };
    }

    // llmConfig is required and must be an object
    if (!isObject(data.llmConfig)) {
      return { success: false, error: 'llmConfig is required' };
    }

    // Build result
    const result: ValidatedStreamRequest = {
      message: data.message.trim(),
      sessionId: data.sessionId,
      llmConfig: data.llmConfig,
    };

    // Optional fields
    if (isString(data.characterId)) result.characterId = data.characterId;
    if (data.character) result.character = data.character;
    if (isArray(data.messages)) result.messages = data.messages;
    if (isString(data.userName)) result.userName = data.userName;
    if (data.persona) result.persona = data.persona;
    if (data.contextConfig) result.contextConfig = data.contextConfig;
    if (data.sessionStats) result.sessionStats = data.sessionStats;
    if (data.hudContext) result.hudContext = data.hudContext;
    if (isArray(data.allCharacters)) result.allCharacters = data.allCharacters;

    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

// ============================================
// Group Stream Request Validation
// ============================================

export function validateGroupStreamRequest(data: unknown): ValidationResult<ValidatedGroupStreamRequest> {
  try {
    if (!isObject(data)) {
      return { success: false, error: 'Request body must be an object' };
    }

    // Message is required
    if (!isString(data.message) || data.message.trim().length === 0) {
      return { success: false, error: 'message is required and cannot be empty' };
    }
    if (data.message.length > 50000) {
      return { success: false, error: 'message exceeds maximum length (50000 characters)' };
    }

    // sessionId is required
    if (!isString(data.sessionId) || data.sessionId.length === 0) {
      return { success: false, error: 'sessionId is required' };
    }

    // groupId is required
    if (!isString(data.groupId) || data.groupId.length === 0) {
      return { success: false, error: 'groupId is required' };
    }

    // group is required (just check it exists, don't validate structure)
    if (!data.group) {
      return { success: false, error: 'group is required' };
    }

    // characters is required and must be an array
    if (!isArray(data.characters) || data.characters.length === 0) {
      return { success: false, error: 'characters is required and must be a non-empty array' };
    }

    // llmConfig is required
    if (!isObject(data.llmConfig)) {
      return { success: false, error: 'llmConfig is required' };
    }

    // Build result
    const result: ValidatedGroupStreamRequest = {
      message: data.message.trim(),
      sessionId: data.sessionId,
      groupId: data.groupId,
      group: data.group,
      characters: data.characters,
      llmConfig: data.llmConfig,
    };

    // Optional fields
    if (isArray(data.messages)) result.messages = data.messages;
    if (isString(data.userName)) result.userName = data.userName;
    if (data.persona) result.persona = data.persona;
    if (isString(data.lastResponderId)) result.lastResponderId = data.lastResponderId;
    if (data.contextConfig) result.contextConfig = data.contextConfig;
    if (data.sessionStats) result.sessionStats = data.sessionStats;
    if (data.hudContext) result.hudContext = data.hudContext;

    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

// ============================================
// Generate Request Validation (Non-streaming)
// ============================================

export function validateGenerateRequest(data: unknown): ValidationResult<ValidatedGenerateRequest> {
  // Same as stream request
  const result = validateStreamRequest(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return result;
}

// ============================================
// Legacy exports for backward compatibility
// ============================================

// These are kept for type exports but are not used for actual validation
export const streamRequestSchema = null as unknown;
export const generateRequestSchema = null as unknown;
export const groupStreamRequestSchema = null as unknown;

// Generic validateRequest function that routes to the correct validator
export function validateRequest<T>(
  _schema: unknown,
  data: unknown
): ValidationResult<T> {
  // Route to the correct validator based on the presence of group-related fields
  if (isObject(data)) {
    // Check if it's a group request
    if ('groupId' in data && 'group' in data && 'characters' in data) {
      return validateGroupStreamRequest(data) as ValidationResult<T>;
    }
    // Otherwise, it's a single character request
    return validateStreamRequest(data) as ValidationResult<T>;
  }
  
  return { success: false, error: 'Invalid request format' };
}

// ============================================
// Sanitization helpers
// ============================================

export function sanitizeInput(input: string): string {
  // Remove control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sanitizeHtml(input: string): string {
  // Basic HTML escaping for user content
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Quick validation for single fields
export function validateMessage(message: unknown): string | null {
  if (typeof message !== 'string') {
    return 'El mensaje debe ser texto';
  }
  if (message.trim().length === 0) {
    return 'El mensaje no puede estar vacío';
  }
  if (message.length > 50000) {
    return 'El mensaje excede el límite de caracteres';
  }
  return null;
}

export function validateSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return 'ID de sesión inválido';
  }
  return null;
}
