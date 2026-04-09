// ============================================
// Solicitud Executor - Peticiones/Solicitudes Activation & Completion
// ============================================
//
// This module handles:
// 1. Activation: When a peticion's key is detected in LLM response,
//    create a solicitud for the target character
// 2. Completion: When a solicitud's key is detected, mark it as completed
//
// NEW FLOW:
// - Character A has an Invitation (Peticion) pointing to Character B's SolicitudDefinition
// - The activation key comes from SolicitudDefinition.peticionKey (on Character B)
// - When LLM writes that key in Character A's response, a SolicitudInstance is created
// - Character B sees the solicitud with SolicitudDefinition.solicitudKey
// - LLM writes the solicitudKey in Character B's response to complete it

import type {
  CharacterStatsConfig,
  InvitationDefinition,
  SolicitudDefinition,
  SolicitudInstance,
  SessionStats,
  CharacterCard,
  StatRequirement,
  Persona,
} from '@/types';

// Special ID for the user
export const USER_CHARACTER_ID = '__user__';

// ============================================
// Types
// ============================================

export interface SolicitudActivationContext {
  sessionId: string;
  characterId: string;           // Character who sent the peticion
  characterName: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  allCharacters: CharacterCard[]; // To look up target characters and their solicitudes
  activePersona?: Persona;        // For when target is the user
}

export interface SolicitudCompletionContext {
  sessionId: string;
  characterId: string;           // Character who received the solicitud
  sessionStats: SessionStats | undefined;
}

export interface SolicitudStoreActions {
  createSolicitud: (
    sessionId: string,
    targetCharacterId: string,
    solicitud: Omit<SolicitudInstance, 'id' | 'createdAt' | 'status'>
  ) => SolicitudInstance | null;
  
  completeSolicitud: (
    sessionId: string,
    characterId: string,
    solicitudKey: string
  ) => SolicitudInstance | null;
  
  // Getter for current session stats (to check for duplicates with fresh data)
  getSessionStats?: (sessionId: string) => SessionStats | null;
}

export interface ResolvedPeticion {
  invitation: InvitationDefinition;
  peticionKey: string;
  peticionActivationKeys?: string[];    // Alternative keys for peticion
  peticionKeyCaseSensitive?: boolean;
  peticionDescription: string;
  solicitudKey: string;
  solicitudActivationKeys?: string[];   // Alternative keys for solicitud
  solicitudKeyCaseSensitive?: boolean;
  solicitudDescription: string;
  completionDescription?: string;      // Description for ultima_solicitud_completada event
  targetCharacterId: string;
  targetCharacterName: string;
  solicitudId: string;
}

export interface SolicitudActivationResult {
  activated: boolean;
  peticionKey: string;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  solicitud: SolicitudInstance | null;
}

export interface SolicitudCompletionResult {
  completed: boolean;
  solicitudKey: string;
  fromCharacterName: string | null;
  solicitud: SolicitudInstance | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Resolve solicitud-specific template keys in text
 * 
 * Keys:
 * - {{solicitante}} - Who makes the request (the asker)
 * - {{solicitado}} - Who receives the request (the asked)
 * - {{user}} - The user's name
 * - {{char}} - The current character's name
 */
function resolveSolicitudKeys(
  text: string,
  solicitanteName: string,
  solicitadoName: string,
  userName?: string,
  characterName?: string
): string {
  if (!text) return text;
  let result = text;
  
  // Resolve solicitud-specific keys
  result = result.replace(/\{\{solicitante\}\}/gi, solicitanteName);
  result = result.replace(/\{\{solicitado\}\}/gi, solicitadoName);
  
  // Resolve standard keys
  if (userName) {
    result = result.replace(/\{\{user\}\}/gi, userName);
  }
  if (characterName) {
    result = result.replace(/\{\{char\}\}/gi, characterName);
  }
  
  return result;
}

/**
 * Evaluate requirements against attribute values
 */
function evaluateRequirements(
  requirements: StatRequirement[],
  attributeValues: Record<string, number | string>
): boolean {
  if (!requirements || requirements.length === 0) {
    return true;
  }
  
  return requirements.every(req => {
    const currentValue = attributeValues[req.attributeKey];
    if (currentValue === undefined) return false;
    
    const currentNum = typeof currentValue === 'number' 
      ? currentValue 
      : parseFloat(String(currentValue));
    const reqNum = typeof req.value === 'number' 
      ? req.value 
      : parseFloat(String(req.value));
    
    if (isNaN(currentNum) || isNaN(reqNum)) {
      return String(currentValue) === String(req.value);
    }
    
    switch (req.operator) {
      case '<': return currentNum < reqNum;
      case '<=': return currentNum <= reqNum;
      case '>': return currentNum > reqNum;
      case '>=': return currentNum >= reqNum;
      case '==': return currentNum === reqNum;
      case '!=': return currentNum !== reqNum;
      case 'between':
        const maxNum = typeof req.valueMax === 'number' 
          ? req.valueMax 
          : parseFloat(String(req.valueMax || 0));
        return currentNum >= reqNum && currentNum <= maxNum;
      default: return false;
    }
  });
}

/**
 * Get resolved peticiones for a character
 * Returns invitations with their actual activation keys from target's solicitudes
 * 
 * Supports special target '__user__' for user-directed peticiones
 */
export function getResolvedPeticiones(
  statsConfig: CharacterStatsConfig | undefined,
  attributeValues: Record<string, number | string>,
  allCharacters: CharacterCard[],
  sessionStats: SessionStats | undefined,
  activePersona?: Persona
): ResolvedPeticion[] {
  console.log(`[getResolvedPeticiones] Called with`, {
    statsEnabled: statsConfig?.enabled,
    hasInvitations: !!statsConfig?.invitations,
    invitationsCount: statsConfig?.invitations?.length,
    allCharactersCount: allCharacters?.length,
    allCharactersIds: allCharacters?.map(c => c.id),
    hasActivePersona: !!activePersona,
    activePersonaId: activePersona?.id,
    activePersonaName: activePersona?.name,
    activePersonaStatsEnabled: activePersona?.statsConfig?.enabled,
  });

  if (!statsConfig?.enabled || !statsConfig.invitations) {
    console.log(`[getResolvedPeticiones] Early return - stats not enabled or no invitations`);
    return [];
  }
  
  const resolved: ResolvedPeticion[] = [];
  
  for (const invitation of statsConfig.invitations) {
    console.log(`[getResolvedPeticiones] Processing invitation`, {
      peticionKey: invitation.peticionKey,
      objetivoCharacterId: invitation.objetivo?.characterId,
      objetivoSolicitudId: invitation.objetivo?.solicitudId,
      hasRequirements: invitation.requirements?.length,
    });

    // Skip if no target configured
    if (!invitation.objetivo?.characterId || !invitation.objetivo?.solicitudId) {
      console.log(`[getResolvedPeticiones] Skipping - no target configured`);
      continue;
    }
    
    // Check invitation requirements (the sender must meet these)
    if (!evaluateRequirements(invitation.requirements, attributeValues)) {
      console.log(`[getResolvedPeticiones] Skipping - requirements not met`);
      continue;
    }
    
    // Special case: target is the user
    if (invitation.objetivo.characterId === USER_CHARACTER_ID) {
      console.log(`[getResolvedPeticiones] Target is USER_CHARACTER_ID, looking for persona solicitud`);
      // Find the solicitud on the user's persona
      const solicitud = activePersona?.statsConfig?.solicitudDefinitions?.find(
        s => s.id === invitation.objetivo!.solicitudId
      );
      
      console.log(`[getResolvedPeticiones] Persona solicitud found`, {
        found: !!solicitud,
        solicitudId: solicitud?.id,
        peticionKey: solicitud?.peticionKey,
      });
      
      if (!solicitud) {
        continue;
      }
      
      // For user, we don't check requirements (user can always receive)
      // Or we could check user attributes if they had any
      
      resolved.push({
        invitation,
        peticionKey: solicitud.peticionKey,
        peticionActivationKeys: solicitud.peticionActivationKeys,
        peticionKeyCaseSensitive: solicitud.peticionKeyCaseSensitive,
        peticionDescription: solicitud.peticionDescription,
        solicitudKey: solicitud.solicitudKey,
        solicitudActivationKeys: solicitud.solicitudActivationKeys,
        solicitudKeyCaseSensitive: solicitud.solicitudKeyCaseSensitive,
        solicitudDescription: solicitud.solicitudDescription,
        completionDescription: solicitud.completionDescription,
        targetCharacterId: USER_CHARACTER_ID,
        targetCharacterName: activePersona?.name || 'Usuario',
        solicitudId: solicitud.id,
      });
      continue;
    }
    
    // Normal case: find target character
    const targetCharacter = allCharacters.find(c => c.id === invitation.objetivo!.characterId);
    if (!targetCharacter) {
      continue;
    }
    
    // Find the solicitud on the target
    const solicitud = targetCharacter.statsConfig?.solicitudDefinitions?.find(
      s => s.id === invitation.objetivo!.solicitudId
    );
    if (!solicitud) {
      continue;
    }
    
    // Check if target meets the solicitud's requirements
    const targetAttributeValues = sessionStats?.characterStats?.[targetCharacter.id]?.attributeValues || {};
    if (!evaluateRequirements(solicitud.requirements, targetAttributeValues)) {
      continue;
    }
    
    resolved.push({
      invitation,
      peticionKey: solicitud.peticionKey,
      peticionActivationKeys: solicitud.peticionActivationKeys,
      peticionKeyCaseSensitive: solicitud.peticionKeyCaseSensitive,
      peticionDescription: solicitud.peticionDescription,
      solicitudKey: solicitud.solicitudKey,
      solicitudActivationKeys: solicitud.solicitudActivationKeys,
      solicitudKeyCaseSensitive: solicitud.solicitudKeyCaseSensitive,
      solicitudDescription: solicitud.solicitudDescription,
      completionDescription: solicitud.completionDescription,
      targetCharacterId: targetCharacter.id,
      targetCharacterName: targetCharacter.name,
      solicitudId: solicitud.id,
    });
  }
  
  return resolved;
}

// ============================================
// Activation Detection (Peticion Key → Create Solicitud)
// ============================================

/**
 * Build regex pattern to detect peticion keys
 * Supports multiple formats: [key], Peticion:key, Peticion=key, |key|, bare key
 */
export function buildPeticionKeyPattern(
  resolvedPeticiones: ResolvedPeticion[],
  caseSensitive: boolean = false
): RegExp | null {
  if (resolvedPeticiones.length === 0) return null;
  
  // Collect all keys (primary + alternatives)
  const allKeys = new Set<string>();
  for (const p of resolvedPeticiones) {
    if (p.peticionKey) allKeys.add(p.peticionKey);
    if (p.peticionActivationKeys) {
      p.peticionActivationKeys.forEach(k => allKeys.add(k));
    }
  }
  
  const keys = Array.from(allKeys)
    .filter(Boolean)
    .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (keys.length === 0) return null;
  
  // Match multiple formats:
  // 1. [key] - bracketed
  // 2. Peticion:key or Peticion=key or Peticion key - explicit format (with : or = or space)
  // 3. |key| - pipe delimited
  // 4. key:valor or key=valor - key with value
  // 5. bare key as word boundary
  const patternStr = `(?:\\[(${keys.join('|')})\\]|Peticion[:=\\s]*(${keys.join('|')})|\\|(${keys.join('|')})\\||(${keys.join('|')})\\s*[=:]|\\b(${keys.join('|')})\\b)`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect peticion activations in text
 * Returns list of peticiones that should create solicitudes
 */
export function detectPeticionActivations(
  text: string,
  context: SolicitudActivationContext
): SolicitudActivationResult[] {
  const results: SolicitudActivationResult[] = [];
  
  if (!context.statsConfig?.enabled) {
    return results;
  }
  
  // Get current attribute values
  const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
  
  // Get resolved peticiones (with keys from target's solicitudes)
  const resolvedPeticiones = getResolvedPeticiones(
    context.statsConfig,
    attributeValues,
    context.allCharacters,
    context.sessionStats,
    context.activePersona
  );
  
  if (resolvedPeticiones.length === 0) {
    return results;
  }
  
  // Build pattern and detect
  const pattern = buildPeticionKeyPattern(resolvedPeticiones);
  if (!pattern) return results;
  
  const detectedKeys = new Set<string>();
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    // Handle 5 capture groups: [key], Peticion:key, |key|, key=:, bare key
    const key = match[1] || match[2] || match[3] || match[4] || match[5];
    if (key && !detectedKeys.has(key.toLowerCase())) {
      detectedKeys.add(key.toLowerCase());
    }
  }
  
  // For each detected key, find the matching peticion (check primary + alternatives)
  for (const detectedKey of detectedKeys) {
    const resolved = resolvedPeticiones.find(p => {
      // Check primary key
      if (p.peticionKey.toLowerCase() === detectedKey) return true;
      // Check alternative keys
      if (p.peticionActivationKeys?.some(k => k.toLowerCase() === detectedKey)) return true;
      return false;
    });
    
    if (!resolved) continue;
    
    results.push({
      activated: false, // Will be set by executeActivation
      peticionKey: resolved.peticionKey,
      targetCharacterId: resolved.targetCharacterId,
      targetCharacterName: resolved.targetCharacterName,
      solicitud: null, // Will be filled by executeActivation
    });
  }
  
  return results;
}

/**
 * Execute peticion activation - create solicitud for target character
 */
export function executePeticionActivation(
  activation: SolicitudActivationResult,
  context: SolicitudActivationContext,
  storeActions: SolicitudStoreActions
): SolicitudActivationResult {
  if (!activation.targetCharacterId) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Find the target character and its solicitud definition
  // Find the invitation that triggered this
  const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
  const resolvedPeticiones = getResolvedPeticiones(
    context.statsConfig,
    attributeValues,
    context.allCharacters,
    context.sessionStats,
    context.activePersona
  );
  
  const resolved = resolvedPeticiones.find(
    p => p.peticionKey === activation.peticionKey && p.targetCharacterId === activation.targetCharacterId
  );
  
  if (!resolved) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Special case: target is the user (__user__)
  // Create solicitud in user's pending list
  if (activation.targetCharacterId === USER_CHARACTER_ID) {
    // Resolve keys in descriptions:
    // - {{solicitante}} = context.characterName (who makes the request)
    // - {{solicitado}} = user's name (who receives)
    const userName = context.activePersona?.name || 'Usuario';
    const resolvedDescription = resolveSolicitudKeys(
      resolved.solicitudDescription,
      context.characterName,  // solicitante
      userName,               // solicitado
      userName,
      context.characterName
    );
    const resolvedCompletion = resolveSolicitudKeys(
      resolved.completionDescription || '',
      context.characterName,  // solicitante
      userName,               // solicitado
      userName,
      context.characterName
    );
    
    const solicitud = storeActions.createSolicitud(
      context.sessionId,
      USER_CHARACTER_ID,
      {
        key: resolved.solicitudKey,
        peticionKey: resolved.peticionKey,  // Store for duplicate detection
        fromCharacterId: context.characterId,
        fromCharacterName: context.characterName,
        description: resolvedDescription,
        completionDescription: resolvedCompletion,
      }
    );
    
    return {
      ...activation,
      activated: !!solicitud,
      solicitud,
    };
  }
  
  // Normal case: target is a character
  const targetCharacter = context.allCharacters.find(c => c.id === activation.targetCharacterId);
  if (!targetCharacter) {
    return {
      ...activation,
      activated: false,
    };
  }
  
  // Resolve keys in descriptions:
  // - {{solicitante}} = context.characterName (who makes the request)
  // - {{solicitado}} = targetCharacter.name (who receives)
  const resolvedDescription = resolveSolicitudKeys(
    resolved.solicitudDescription,
    context.characterName,     // solicitante
    targetCharacter.name,      // solicitado
    context.activePersona?.name,
    context.characterName
  );
  const resolvedCompletion = resolveSolicitudKeys(
    resolved.completionDescription || '',
    context.characterName,     // solicitante
    targetCharacter.name,      // solicitado
    context.activePersona?.name,
    context.characterName
  );
  
  // Create the solicitud for the target character
  // Use solicitudKey for completion detection
  const solicitud = storeActions.createSolicitud(
    context.sessionId,
    activation.targetCharacterId,
    {
      key: resolved.solicitudKey,  // Key the target will use to complete
      peticionKey: resolved.peticionKey,  // Store for duplicate detection
      fromCharacterId: context.characterId,
      fromCharacterName: context.characterName,
      description: resolvedDescription,
      completionDescription: resolvedCompletion,
    }
  );
  
  return {
    ...activation,
    activated: !!solicitud,
    solicitud,
  };
}

// ============================================
// Completion Detection (Solicitud Key → Mark Completed)
// ============================================

/**
 * Build regex pattern to detect solicitud keys
 * Supports multiple formats: [key], Solicitud:key, Solicitud=key, |key|, bare key
 */
export function buildSolicitudKeyPattern(
  solicitudes: SolicitudInstance[],
  caseSensitive: boolean = false
): RegExp | null {
  if (solicitudes.length === 0) return null;
  
  const keys = solicitudes
    .map(s => s.key)
    .filter(Boolean)
    .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (keys.length === 0) return null;
  
  // Match multiple formats:
  // 1. [key] - bracketed
  // 2. Solicitud:key or Solicitud=key or Solicitud key - explicit format (with : or = or space)
  // 3. |key| - pipe delimited
  // 4. key:valor or key=valor - key with value
  // 5. bare key as word boundary
  const patternStr = `(?:\\[(${keys.join('|')})\\]|Solicitud[:=\\s]*(${keys.join('|')})|\\|(${keys.join('|')})\\||(${keys.join('|')})\\s*[=:]|\\b(${keys.join('|')})\\b)`;
  
  try {
    return new RegExp(patternStr, caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/**
 * Detect solicitud completions in text
 * Returns list of solicitudes that should be marked as completed
 */
export function detectSolicitudCompletions(
  text: string,
  context: SolicitudCompletionContext
): SolicitudCompletionResult[] {
  const results: SolicitudCompletionResult[] = [];
  
  // Get pending solicitudes for this character
  const pendingSolicitudes = context.sessionStats?.solicitudes?.characterSolicitudes?.[context.characterId]
    ?.filter(s => s.status === 'pending') || [];
  
  if (pendingSolicitudes.length === 0) {
    return results;
  }
  
  // Build pattern and detect
  const pattern = buildSolicitudKeyPattern(pendingSolicitudes);
  if (!pattern) return results;
  
  const detectedKeys = new Set<string>();
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    // Handle 5 capture groups: [key], Solicitud:key, |key|, key=:, bare key
    const key = match[1] || match[2] || match[3] || match[4] || match[5];
    if (key && !detectedKeys.has(key.toLowerCase())) {
      detectedKeys.add(key.toLowerCase());
    }
  }
  
  // For each detected key, find the matching solicitud
  for (const detectedKey of detectedKeys) {
    const solicitud = pendingSolicitudes.find(
      s => s.key.toLowerCase() === detectedKey
    );
    
    if (solicitud) {
      results.push({
        completed: false,
        solicitudKey: solicitud.key,
        fromCharacterName: solicitud.fromCharacterName,
        solicitud: null, // Will be filled by executeCompletion
      });
    }
  }
  
  return results;
}

/**
 * Execute solicitud completion - mark as completed
 */
export function executeSolicitudCompletion(
  completion: SolicitudCompletionResult,
  context: SolicitudCompletionContext,
  storeActions: SolicitudStoreActions
): SolicitudCompletionResult {
  const solicitud = storeActions.completeSolicitud(
    context.sessionId,
    context.characterId,
    completion.solicitudKey
  );
  
  return {
    ...completion,
    completed: !!solicitud,
    solicitud,
  };
}

// ============================================
// Combined Detection & Execution
// ============================================

export interface SolicitudProcessingResult {
  activations: SolicitudActivationResult[];
  completions: SolicitudCompletionResult[];
  hasChanges: boolean;
}

/**
 * Process text for both peticion activations and solicitud completions
 * This is the main entry point for post-LLM processing
 */
export function processSolicitudes(
  text: string,
  context: SolicitudActivationContext,
  storeActions: SolicitudStoreActions
): SolicitudProcessingResult {
  // Detect and execute activations (peticiones)
  const activationDetections = detectPeticionActivations(text, context);
  const activations = activationDetections.map(activation =>
    executePeticionActivation(activation, context, storeActions)
  );
  
  // Detect and execute completions (solicitudes)
  const completionContext: SolicitudCompletionContext = {
    sessionId: context.sessionId,
    characterId: context.characterId,
    sessionStats: context.sessionStats,
  };
  const completionDetections = detectSolicitudCompletions(text, completionContext);
  const completions = completionDetections.map(completion =>
    executeSolicitudCompletion(completion, completionContext, storeActions)
  );
  
  const hasChanges = 
    activations.some(a => a.activated) || 
    completions.some(c => c.completed);
  
  return {
    activations,
    completions,
    hasChanges,
  };
}

// ============================================
// Streaming Support
// ============================================

/**
 * State for tracking processed solicitudes during streaming
 */
export class SolicitudDetectionState {
  private processedActivations: Set<string> = new Set(); // peticion keys
  private processedCompletions: Set<string> = new Set(); // solicitud keys
  private processedLength: number = 0;
  
  /**
   * Process new text incrementally
   */
  processNewText(
    newText: string,
    context: SolicitudActivationContext,
    storeActions: SolicitudStoreActions
  ): SolicitudProcessingResult {
    console.log(`[SolicitudDetectionState] processNewText called`, {
      newTextLength: newText.length,
      newTextPreview: newText.slice(0, 100),
      processedLength: this.processedLength,
      processedActivations: Array.from(this.processedActivations),
      processedCompletions: Array.from(this.processedCompletions),
      characterId: context.characterId,
      allCharactersCount: context.allCharacters?.length,
    });

    // Only process new content
    const newContent = newText.slice(this.processedLength);
    this.processedLength = newText.length;
    
    console.log(`[SolicitudDetectionState] New content to process`, {
      newContentLength: newContent.length,
      newContentPreview: newContent.slice(0, 100),
    });
    
    if (!newContent.trim()) {
      console.log(`[SolicitudDetectionState] No new content to process, returning early`);
      return { activations: [], completions: [], hasChanges: false };
    }
    
    // Get current attribute values
    const attributeValues = context.sessionStats?.characterStats?.[context.characterId]?.attributeValues || {};
    const resolvedPeticiones = getResolvedPeticiones(
      context.statsConfig,
      attributeValues,
      context.allCharacters,
      context.sessionStats,
      context.activePersona
    );
    
    console.log(`[SolicitudDetectionState] Resolved peticiones`, {
      resolvedCount: resolvedPeticiones.length,
      resolvedPeticiones: resolvedPeticiones.map(p => ({ key: p.peticionKey, target: p.targetCharacterId, targetName: p.targetCharacterName })),
    });
    
    // Helper function to check if a pending solicitud already exists for a key from the same source
    // Uses fresh sessionStats from store if available, otherwise falls back to context
    // IMPORTANT: We check peticionKey (activation key) for duplicates, not solicitudKey (completion key)
    const hasPendingSolicitud = (peticionKey: string, targetCharacterId: string, fromCharacterId: string): boolean => {
      // Get fresh sessionStats from store if available
      const freshSessionStats = storeActions.getSessionStats?.(context.sessionId);
      const sessionStatsToUse = freshSessionStats || context.sessionStats;
      
      console.log(`[hasPendingSolicitud] Checking for duplicate`, {
        peticionKey,
        targetCharacterId,
        fromCharacterId,
        hasFreshStats: !!freshSessionStats,
        hasContextStats: !!context.sessionStats,
        usingFresh: !!freshSessionStats,
      });
      
      const characterSolicitudes = sessionStatsToUse?.solicitudes?.characterSolicitudes?.[targetCharacterId];
      if (!characterSolicitudes) {
        console.log(`[hasPendingSolicitud] No solicitudes found for target ${targetCharacterId}`);
        return false;
      }
      
      const hasDuplicate = characterSolicitudes.some(
        s => s.status === 'pending' &&
             s.fromCharacterId === fromCharacterId &&
             (s.peticionKey?.toLowerCase() === peticionKey.toLowerCase() || 
              // Fallback: if peticionKey not stored, check if this was recently created
              (s.peticionKey === undefined && s.key.toLowerCase() === peticionKey.toLowerCase()))
      );
      
      if (hasDuplicate) {
        console.log(`[hasPendingSolicitud] Found duplicate solicitud`, {
          peticionKey,
          targetCharacterId,
          fromCharacterId,
          existingSolicitudes: characterSolicitudes.map(s => ({ 
            key: s.key, 
            peticionKey: s.peticionKey, 
            from: s.fromCharacterId, 
            status: s.status 
          }))
        });
      } else {
        console.log(`[hasPendingSolicitud] No duplicate found, existing:`, characterSolicitudes.map(s => ({
          key: s.key,
          peticionKey: s.peticionKey,
          from: s.fromCharacterId,
          status: s.status
        })));
      }
      
      return hasDuplicate;
    };
    
    // Filter out already processed peticion keys
    // AND filter out peticiones that already have a pending solicitud
    const unprocessedPeticiones = resolvedPeticiones.filter(
      p => {
        const keyLower = p.peticionKey.toLowerCase();
        const alreadyProcessed = this.processedActivations.has(keyLower);
        const alreadyPending = hasPendingSolicitud(p.peticionKey, p.targetCharacterId, context.characterId);
        
        if (alreadyPending) {
          console.log(`[SolicitudDetectionState] Skipping peticion ${p.peticionKey} - already has pending solicitud for target ${p.targetCharacterId} from ${context.characterId}`);
        }
        
        return !alreadyProcessed && !alreadyPending;
      }
    );
    
    console.log(`[SolicitudDetectionState] Unprocessed peticiones`, {
      unprocessedCount: unprocessedPeticiones.length,
      unprocessedKeys: unprocessedPeticiones.map(p => p.peticionKey),
    });
    
    // Detect new activations
    const pattern = buildPeticionKeyPattern(unprocessedPeticiones);
    const newActivations: SolicitudActivationResult[] = [];
    
    console.log(`[SolicitudDetectionState] Pattern built`, {
      patternSource: pattern?.source,
    });
    
    if (pattern) {
      let match;
      let matchCount = 0;
      // IMPORTANT: Search in the FULL text (newText), not just newContent
      // This is because the key pattern (e.g., "Peticion=pedir_test") may span
      // across previously processed and new content
      while ((match = pattern.exec(newText)) !== null) {
        matchCount++;
        console.log(`[SolicitudDetectionState] Match found`, {
          matchIndex: matchCount,
          match0: match[0],
          match1: match[1],
          match2: match[2],
          match3: match[3],
          match4: match[4],
          match5: match[5],
        });
        // Handle 5 capture groups: [key], Peticion:key, |key|, key=:, bare key
        const key = (match[1] || match[2] || match[3] || match[4] || match[5])?.toLowerCase();
        if (key && !this.processedActivations.has(key)) {
          const resolved = resolvedPeticiones.find(
            p => p.peticionKey.toLowerCase() === key
          );
          
          if (resolved) {
            // Double-check: Don't activate if there's already a pending solicitud for this target from this source
            if (hasPendingSolicitud(resolved.peticionKey, resolved.targetCharacterId, context.characterId)) {
              console.log(`[SolicitudDetectionState] Skipping activation of ${key} - already has pending solicitud for target ${resolved.targetCharacterId} from ${context.characterId}`);
              // Mark as processed so we don't check again
              this.processedActivations.add(key);
              continue;
            }
            
            this.processedActivations.add(key);
            console.log(`[SolicitudDetectionState] Key extracted and added`, { key });
            console.log(`[SolicitudDetectionState] Found resolved peticion for key, executing activation`, { key, targetId: resolved.targetCharacterId });
            const result = executePeticionActivation(
              {
                activated: false,
                peticionKey: resolved.peticionKey,
                targetCharacterId: resolved.targetCharacterId,
                targetCharacterName: resolved.targetCharacterName,
                solicitud: null,
              },
              context,
              storeActions
            );
            
            newActivations.push(result);
          }
        }
      }
      console.log(`[SolicitudDetectionState] Pattern matching complete`, {
        totalMatches: matchCount,
        newActivationsCount: newActivations.length,
      });
    } else {
      console.log(`[SolicitudDetectionState] No pattern built (null pattern)`);
    }
    
    // Get pending solicitudes and filter out already processed
    const pendingSolicitudes = context.sessionStats?.solicitudes?.characterSolicitudes?.[context.characterId]
      ?.filter(s => s.status === 'pending' && !this.processedCompletions.has(s.key.toLowerCase())) || [];
    
    // Detect new completions
    const completionPattern = buildSolicitudKeyPattern(pendingSolicitudes);
    const newCompletions: SolicitudCompletionResult[] = [];
    
    if (completionPattern) {
      let match;
      // IMPORTANT: Search in the FULL text (newText), not just newContent
      while ((match = completionPattern.exec(newText)) !== null) {
        // Handle 5 capture groups: [key], Solicitud:key, |key|, key=:, bare key
        const key = (match[1] || match[2] || match[3] || match[4] || match[5])?.toLowerCase();
        if (key && !this.processedCompletions.has(key)) {
          this.processedCompletions.add(key);
          
          const solicitud = pendingSolicitudes.find(
            s => s.key.toLowerCase() === key
          );
          
          if (solicitud) {
            const result = executeSolicitudCompletion(
              {
                completed: false,
                solicitudKey: solicitud.key,
                fromCharacterName: solicitud.fromCharacterName,
                solicitud: null,
              },
              {
                sessionId: context.sessionId,
                characterId: context.characterId,
                sessionStats: context.sessionStats,
              },
              storeActions
            );
            
            newCompletions.push(result);
          }
        }
      }
    }
    
    const hasChanges = 
      newActivations.some(a => a.activated) || 
      newCompletions.some(c => c.completed);
    
    return {
      activations: newActivations,
      completions: newCompletions,
      hasChanges,
    };
  }
  
  /**
   * Reset state for new message
   */
  reset(): void {
    this.processedActivations.clear();
    this.processedCompletions.clear();
    this.processedLength = 0;
  }
}

/**
 * Create a new solicitud detection state
 */
export function createSolicitudDetectionState(): SolicitudDetectionState {
  return new SolicitudDetectionState();
}
