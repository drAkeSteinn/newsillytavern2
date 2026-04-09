// ============================================
// Solicitud Handler - Handles Peticiones/Solicitudes Activation
// ============================================
//
// This handler processes:
// 1. Peticion activations - When LLM uses a peticion key, create solicitud for target character
// 2. Solicitud completions - When LLM uses a solicitud key, mark it as completed
//
// Flow:
// - Character A has Peticion with key "solicitar_madera" and objetivo Character B
// - LLM writes [solicitar_madera] in Character A's response
// - Handler creates SolicitudInstance for Character B
// - Character B sees solicitud in {{solicitudes}} block
// - LLM writes [solicitar_madera] in Character B's response
// - Handler marks solicitud as completed

import type { TriggerContext } from '../trigger-bus';
import type {
  CharacterStatsConfig,
  SessionStats,
  SolicitudInstance,
  CharacterCard,
  InvitationDefinition,
} from '@/types';
import {
  processSolicitudes,
  createSolicitudDetectionState,
  type SolicitudProcessingResult,
  type SolicitudStoreActions,
} from '@/lib/stats/solicitud-executor';

// ============================================
// Types
// ============================================

export interface SolicitudHandlerState {
  detectionStates: Map<string, ReturnType<typeof createSolicitudDetectionState>>;
  processedMessages: Set<string>;
}

export interface SolicitudTriggerContext extends TriggerContext {
  characterId: string;
  characterName: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  sessionId: string;
  allCharacters: CharacterCard[];
  // Active persona for targeting __user__ in peticiones
  activePersona?: { id: string; name: string; statsConfig?: any } | null;
}

export interface SolicitudHandlerResult {
  matched: boolean;
  processingResult?: SolicitudProcessingResult;
}

// ============================================
// State Management
// ============================================

export function createSolicitudHandlerState(): SolicitudHandlerState {
  return {
    detectionStates: new Map(),
    processedMessages: new Set(),
  };
}

export function resetSolicitudHandlerState(
  state: SolicitudHandlerState,
  characterId: string,
  messageKey: string
): void {
  if (!characterId) {
    // Reset all states
    for (const detectionState of state.detectionStates.values()) {
      detectionState.reset();
    }
  } else {
    const detectionState = state.detectionStates.get(characterId);
    if (detectionState) {
      detectionState.reset();
    }
  }
  state.processedMessages.delete(messageKey);
}

export function clearSolicitudHandlerState(state: SolicitudHandlerState): void {
  state.detectionStates.clear();
  state.processedMessages.clear();
}

// ============================================
// Detection Functions
// ============================================

/**
 * Check for peticion activations and solicitud completions in text
 */
export function checkSolicitudTriggersInText(
  text: string,
  context: SolicitudTriggerContext,
  state: SolicitudHandlerState,
  storeActions: SolicitudStoreActions
): SolicitudHandlerResult {
  const { characterId, statsConfig, sessionStats, sessionId, allCharacters, characterName } = context;

  console.log(`[SolicitudHandler] checkSolicitudTriggersInText called`, {
    characterId,
    characterName,
    textLength: text.length,
    textPreview: text.slice(0, 100),
    statsEnabled: statsConfig?.enabled,
    hasInvitations: statsConfig?.invitations?.length,
    allCharactersCount: allCharacters?.length,
    hasPersonaInAllCharacters: allCharacters?.some(c => c.id === '__user__'),
  });

  // Check if stats system is enabled
  if (!statsConfig?.enabled) {
    console.log(`[SolicitudHandler] Stats not enabled, returning early`);
    return { matched: false };
  }

  // Check if there are any peticiones configured
  const hasPeticiones = statsConfig.invitations && statsConfig.invitations.length > 0;
  const hasPendingSolicitudes = sessionStats?.solicitudes?.characterSolicitudes?.[characterId]
    ?.some(s => s.status === 'pending');

  console.log(`[SolicitudHandler] Conditions check`, {
    hasPeticiones,
    hasPendingSolicitudes,
    invitationsDetail: statsConfig.invitations?.map(i => ({ key: i.peticionKey, target: i.objetivo })),
  });

  if (!hasPeticiones && !hasPendingSolicitudes) {
    console.log(`[SolicitudHandler] No peticiones and no pending solicitudes, returning early`);
    return { matched: false };
  }

  // Get or create detection state for this character
  let detectionState = state.detectionStates.get(characterId);
  if (!detectionState) {
    detectionState = createSolicitudDetectionState();
    state.detectionStates.set(characterId, detectionState);
  }

  // Process solicitudes
  const result = detectionState.processNewText(text, {
    sessionId,
    characterId,
    characterName,
    statsConfig,
    sessionStats,
    allCharacters,
    activePersona: context.activePersona,
  }, storeActions);

  return {
    matched: result.hasChanges,
    processingResult: result,
  };
}

/**
 * Process solicitudes for a character in streaming mode
 */
export function processSolicitudInStreaming(
  text: string,
  context: SolicitudTriggerContext,
  state: SolicitudHandlerState,
  storeActions: SolicitudStoreActions
): SolicitudHandlerResult {
  return checkSolicitudTriggersInText(text, context, state, storeActions);
}

/**
 * Get available peticiones for a character (filtered by requirements)
 */
export function getAvailablePeticionesForCharacter(
  statsConfig: CharacterStatsConfig | undefined,
  attributeValues: Record<string, number | string>
): InvitationDefinition[] {
  if (!statsConfig?.enabled || !statsConfig.invitations) {
    return [];
  }

  return statsConfig.invitations.filter(peticion => {
    if (!peticion.requirements || peticion.requirements.length === 0) {
      return true;
    }
    return peticion.requirements.every(req => {
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
        default: return false;
      }
    });
  });
}

// ============================================
// Export Index
// ============================================

export type {
  SolicitudHandlerState,
  SolicitudTriggerContext,
  SolicitudHandlerResult,
};
