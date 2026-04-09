// ============================================
// Solicitud Key Handler - Unified KeyHandler Implementation
// ============================================
//
// Implements the KeyHandler interface for peticiones/solicitudes.
// Works with DetectedKey[] from the unified KeyDetector.
//
// Detection patterns:
// - [key] - Simple key (e.g., [pedir_madera])
// - Peticion:key - Prefix format (e.g., Peticion=pedir_madera)
// - Solicitud:key - Prefix format for completion
// - key:value - With value (e.g., pedir_madera:aceptar)

import type { DetectedKey } from '../key-detector';
import type { KeyHandler, TriggerMatch, TriggerMatchResult } from '../types';
import type { TriggerContext } from '../trigger-bus';
import type { CharacterCard, CharacterStatsConfig, SessionStats, InvitationDefinition } from '@/types';
import { normalizeKey, keyMatches } from '../key-detector';
import {
  createSolicitudHandlerState,
  checkSolicitudTriggersInText,
  type SolicitudHandlerState,
  type SolicitudTriggerContext,
} from './solicitud-handler';

// ============================================
// Types
// ============================================

export interface SolicitudKeyHandlerContext extends TriggerContext {
  characterId: string;
  characterName: string;
  statsConfig: CharacterStatsConfig | undefined;
  sessionStats: SessionStats | undefined;
  sessionId: string;
  allCharacters: CharacterCard[];
  activePersona?: { id: string; name: string; statsConfig?: any } | null;
  storeActions?: {
    createSolicitud: (sessionId: string, targetCharacterId: string, solicitud: any) => any;
    completeSolicitud: (sessionId: string, characterId: string, solicitudKey: string) => any;
    getSessionStats?: (sessionId: string) => SessionStats | null;
  };
}

export interface SolicitudMatchData {
  type: 'activation' | 'completion';
  peticionKey: string;
  solicitudKey?: string;
  invitation: InvitationDefinition;
  targetCharacterId: string;
  targetCharacterName: string;
  value?: string;
}

// ============================================
// Solicitud Key Handler Class
// ============================================

export class SolicitudKeyHandler implements KeyHandler {
  readonly id = 'solicitud';
  readonly type = 'solicitud' as const;
  readonly priority = 95; // Very high - peticiones/solicitudes are important
  
  private state: SolicitudHandlerState;
  
  constructor() {
    this.state = createSolicitudHandlerState();
  }
  
  /**
   * Check if this handler should process a detected key
   */
  canHandle(key: DetectedKey, context: TriggerContext): boolean {
    const solContext = context as SolicitudKeyHandlerContext;
    
    // Check if stats system is enabled
    if (!solContext.statsConfig?.enabled) {
      return false;
    }
    
    // Check if character has invitations (peticiones)
    const hasInvitations = solContext.statsConfig.invitations && 
      solContext.statsConfig.invitations.length > 0;
    
    // Check if there are pending solicitudes for this character
    const hasPendingSolicitudes = solContext.sessionStats?.solicitudes?.characterSolicitudes?.[solContext.characterId]
      ?.some(s => s.status === 'pending');
    
    if (!hasInvitations && !hasPendingSolicitudes) {
      return false;
    }
    
    // Check if key matches any invitation or solicitud
    return this.findMatchingInvitation(key, solContext) !== null ||
      this.findMatchingSolicitud(key, solContext) !== null;
  }
  
  /**
   * Find a matching invitation for the key
   */
  private findMatchingInvitation(
    key: DetectedKey, 
    context: SolicitudKeyHandlerContext
  ): { invitation: InvitationDefinition; targetCharacterId: string } | null {
    const invitations = context.statsConfig?.invitations || [];
    
    for (const invitation of invitations) {
      // Check peticionKey (activation key)
      if (invitation.peticionKey && keyMatches(key.key, normalizeKey(invitation.peticionKey))) {
        // Resolve target character
        const targetCharacterId = invitation.objetivo;
        return { invitation, targetCharacterId };
      }
      
      // Check alternative activation keys
      if (invitation.peticionActivationKeys) {
        for (const altKey of invitation.peticionActivationKeys) {
          if (keyMatches(key.key, normalizeKey(altKey))) {
            const targetCharacterId = invitation.objetivo;
            return { invitation, targetCharacterId };
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Find a matching solicitud for the key (completion)
   */
  private findMatchingSolicitud(
    key: DetectedKey,
    context: SolicitudKeyHandlerContext
  ): { solicitudKey: string; solicitud: any } | null {
    const solicitudes = context.sessionStats?.solicitudes?.characterSolicitudes?.[context.characterId] || [];
    
    for (const solicitud of solicitudes) {
      if (solicitud.status !== 'pending') continue;
      
      // Check solicitudKey (completion key)
      if (solicitud.solicitudKey && keyMatches(key.key, normalizeKey(solicitud.solicitudKey))) {
        return { solicitudKey: solicitud.solicitudKey, solicitud };
      }
      
      // Check alternative completion keys
      if (solicitud.solicitudActivationKeys) {
        for (const altKey of solicitud.solicitudActivationKeys) {
          if (keyMatches(key.key, normalizeKey(altKey))) {
            return { solicitudKey: solicitud.solicitudKey, solicitud };
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Process a key and return match result
   */
  handleKey(key: DetectedKey, context: TriggerContext): TriggerMatchResult | null {
    const solContext = context as SolicitudKeyHandlerContext;
    
    // Check for activation (peticion)
    const invitationMatch = this.findMatchingInvitation(key, solContext);
    if (invitationMatch) {
      const { invitation, targetCharacterId } = invitationMatch;
      
      // Find target character name
      const targetCharacter = solContext.allCharacters.find(c => c.id === targetCharacterId);
      const targetCharacterName = targetCharacter?.name || targetCharacterId;
      
      return {
        matched: true,
        trigger: {
          triggerId: `solicitud_activation_${invitation.peticionKey}`,
          triggerType: 'solicitud',
          keyword: key.key,
          data: {
            type: 'activation',
            peticionKey: invitation.peticionKey,
            solicitudKey: invitation.solicitudKey,
            invitation,
            targetCharacterId,
            targetCharacterName,
            value: key.value,
          } as SolicitudMatchData,
        },
        key,
      };
    }
    
    // Check for completion (solicitud)
    const solicitudMatch = this.findMatchingSolicitud(key, solContext);
    if (solicitudMatch) {
      const { solicitudKey, solicitud } = solicitudMatch;
      
      return {
        matched: true,
        trigger: {
          triggerId: `solicitud_completion_${solicitudKey}`,
          triggerType: 'solicitud',
          keyword: key.key,
          data: {
            type: 'completion',
            peticionKey: solicitud.peticionKey,
            solicitudKey,
            solicitud,
            targetCharacterId: context.character?.id || '',
            targetCharacterName: context.character?.name || '',
            value: key.value,
          } as SolicitudMatchData,
        },
        key,
      };
    }
    
    return null;
  }
  
  /**
   * Execute the trigger action
   */
  execute(match: TriggerMatch, context: TriggerContext): void {
    const solContext = context as SolicitudKeyHandlerContext;
    const data = match.data as SolicitudMatchData;
    
    if (!solContext.storeActions) {
      console.warn('[SolicitudKeyHandler] No store actions provided');
      return;
    }
    
    if (data.type === 'activation') {
      // Create a new solicitud for the target character
      const solicitud = {
        peticionKey: data.peticionKey,
        solicitudKey: data.solicitudKey,
        sourceCharacterId: solContext.characterId,
        targetCharacterId: data.targetCharacterId,
        status: 'pending' as const,
        createdAt: Date.now(),
        description: data.invitation.peticionDescription || data.invitation.solicitudDescription,
      };
      
      const result = solContext.storeActions.createSolicitud(
        solContext.sessionId,
        data.targetCharacterId,
        solicitud
      );
      
      if (result) {
        console.log(`[SolicitudKeyHandler] Created solicitud: ${data.solicitudKey} for ${data.targetCharacterName}`);
      }
    } else if (data.type === 'completion') {
      // Complete the solicitud
      const result = solContext.storeActions.completeSolicitud(
        solContext.sessionId,
        solContext.characterId,
        data.solicitudKey!
      );
      
      if (result) {
        console.log(`[SolicitudKeyHandler] Completed solicitud: ${data.solicitudKey}`);
      }
    }
  }
  
  /**
   * Get all registered keys for word-based detection
   */
  getRegisteredKeys(context: TriggerContext): string[] {
    const solContext = context as SolicitudKeyHandlerContext;
    const keys: string[] = [];
    
    if (!solContext.statsConfig?.enabled) return keys;
    
    // Add all peticion keys from invitations
    const invitations = solContext.statsConfig.invitations || [];
    for (const invitation of invitations) {
      if (invitation.peticionKey) keys.push(invitation.peticionKey);
      if (invitation.peticionActivationKeys) keys.push(...invitation.peticionActivationKeys);
    }
    
    // Add all solicitud keys from pending solicitudes
    const solicitudes = solContext.sessionStats?.solicitudes?.characterSolicitudes?.[solContext.characterId] || [];
    for (const solicitud of solicitudes) {
      if (solicitud.status === 'pending') {
        if (solicitud.solicitudKey) keys.push(solicitud.solicitudKey);
        if (solicitud.solicitudActivationKeys) keys.push(...solicitud.solicitudActivationKeys);
      }
    }
    
    return keys;
  }
  
  /**
   * Reset state for new message
   */
  reset(messageKey: string): void {
    this.state.processedMessages.delete(messageKey);
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.state.processedMessages.clear();
    this.state.detectionStates.clear();
  }
}

// ============================================
// Factory Function
// ============================================

export function createSolicitudKeyHandler(): SolicitudKeyHandler {
  return new SolicitudKeyHandler();
}
