// ============================================
// Tool: Manage Solicitud (Request System)
// ============================================
// Category: in_character
// Manages peticiones/solicitudes between characters
//
// Architecture: Stateless server-side validation → returns metadata via SSE → client executes
// Similar to manage-quest and manage-action tools

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import type { InvitationDefinition, SolicitudDefinition, SolicitudInstance } from '@/types';
import { resolveAllKeys, buildKeyResolutionContext } from '@/lib/key-resolver';

/**
 * Resolve ALL template keys in text, with optional solicitante/solicitado overrides.
 * Uses the comprehensive key resolver for {{user}}, {{char}}, stats, events, etc.
 * Then overrides {{solicitante}} and {{solicitado}} with context-specific values if provided
 * (since these vary per solicitud call, unlike the fixed context in resolveEventKeys).
 */
function resolveToolKeysWithContext(
  text: string,
  context: ToolContext,
  solicitanteName?: string,
  solicitadoName?: string
): string {
  if (!text) return text;
  const keyContext = buildKeyResolutionContext(
    { id: context.characterId, name: context.characterName } as import('@/types').CharacterCard,
    context.userName,
    undefined, // persona
    undefined, // resolvedStats
    context.sessionStats,
  );
  let result = resolveAllKeys(text, keyContext);
  // Override solicitante/solicitado with call-specific values
  if (solicitanteName) {
    result = result.replace(/\{\{solicitante\}\}/gi, solicitanteName);
  }
  if (solicitadoName) {
    result = result.replace(/\{\{solicitado\}\}/gi, solicitadoName);
  }
  return result;
}

export const manageSolicitudTool: ToolDefinition = {
  id: 'manage_solicitud',
  name: 'manage_solicitud',
  label: 'Gestionar Solicitud',
  icon: 'Handshake',
  description:
    'Gestiona peticiones y solicitudes entre personajes. ' +
    'Usa "get_info" para ver las solicitudes pendientes y peticiones disponibles.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Acción a realizar',
        enum: ['get_info', 'make_request', 'complete_request'],
      },
      solicitud_key: {
        type: 'string',
        description: 'Key de la solicitud a completar (debe coincidir con una solicitud pendiente)',
      },
      peticion_key: {
        type: 'string',
        description: 'Key de la petición a realizar (debe coincidir con una petición disponible)',
      },
    },
    required: ['action'],
  },
  permissionMode: 'auto',
};

/**
 * Get resolved peticiones for a character (server-side version)
 * Maps invitations to their target's solicitud definitions
 */
function getResolvedPeticiones(
  statsConfig: ToolContext['statsConfig'],
  allCharacters: ToolContext['allCharacters'],
  sessionStats: ToolContext['sessionStats'],
): Array<{
  invitation: InvitationDefinition;
  solicitud: SolicitudDefinition;
  targetCharacterId: string;
  targetCharacterName: string;
}> {
  if (!statsConfig?.enabled || !statsConfig.invitations || !allCharacters) {
    return [];
  }

  const resolved: Array<{
    invitation: InvitationDefinition;
    solicitud: SolicitudDefinition;
    targetCharacterId: string;
    targetCharacterName: string;
  }> = [];

  for (const invitation of statsConfig.invitations) {
    if (!invitation.objetivo?.characterId || !invitation.objetivo?.solicitudId) {
      continue;
    }

    // Find target character
    const targetCharacter = allCharacters.find(c => c.id === invitation.objetivo!.characterId);
    if (!targetCharacter) continue;

    // Find the solicitud definition on the target
    const solicitud = targetCharacter.statsConfig?.solicitudDefinitions?.find(
      s => s.id === invitation.objetivo!.solicitudId
    );
    if (!solicitud) continue;

    resolved.push({
      invitation,
      solicitud,
      targetCharacterId: targetCharacter.id,
      targetCharacterName: targetCharacter.name,
    });
  }

  return resolved;
}

/**
 * Get pending solicitudes for a character
 */
function getPendingSolicitudes(
  sessionStats: ToolContext['sessionStats'],
  characterId: string,
): SolicitudInstance[] {
  if (!sessionStats?.solicitudes?.characterSolicitudes?.[characterId]) {
    return [];
  }

  return sessionStats.solicitudes.characterSolicitudes[characterId]
    .filter(s => s.status === 'pending');
}

export async function manageSolicitudExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const action = String(params.action || '');
  const solicitudKey = params.solicitud_key ? String(params.solicitud_key) : '';
  const peticionKey = params.peticion_key ? String(params.peticion_key) : '';

  const { characterId, characterName, sessionId, statsConfig, sessionStats, allCharacters } = context;

  try {
    switch (action) {
      case 'get_info': {
        // Build info about available peticiones and pending solicitudes
        const pendingSolicitudes = getPendingSolicitudes(sessionStats, characterId);
        const resolvedPeticiones = getResolvedPeticiones(statsConfig, allCharacters, sessionStats);

        const lines: string[] = ['**Sistema de Solicitudes**', ''];

        if (resolvedPeticiones.length > 0) {
          lines.push('**Peticiones disponibles** (puedes hacer estas solicitudes a otros):');
          for (const { solicitud, targetCharacterName } of resolvedPeticiones) {
            const desc = resolveToolKeysWithContext(solicitud.peticionDescription, context, characterName, targetCharacterName);
            lines.push(`- key: "${solicitud.peticionKey}" → ${targetCharacterName}: ${desc}`);
          }
          lines.push('');
        }

        if (pendingSolicitudes.length > 0) {
          lines.push('**Solicitudes pendientes** (te han hecho estas solicitudes):');
          for (const sol of pendingSolicitudes) {
            const desc = resolveToolKeysWithContext(sol.description, context, sol.fromCharacterName, characterName);
            lines.push(`- key: "${sol.key}" de ${sol.fromCharacterName}: ${desc}`);
          }
          lines.push('');
        }

        if (resolvedPeticiones.length === 0 && pendingSolicitudes.length === 0) {
          lines.push('No hay peticiones disponibles ni solicitudes pendientes.');
        } else {
          lines.push('Usa "make_request" con una peticion_key para hacer una petición.');
          lines.push('Usa "complete_request" con una solicitud_key para completar una solicitud.');
        }

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: { action: 'get_info', sessionId },
          displayMessage: lines.join('\n'),
        };
      }

      case 'make_request': {
        if (!peticionKey) {
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: 'Debes especificar "peticion_key". Usa "get_info" para ver las peticiones disponibles.',
            error: 'Missing required parameter: peticion_key',
          };
        }

        // Find the matching peticion
        const resolvedPeticiones = getResolvedPeticiones(statsConfig, allCharacters, sessionStats);
        const match = resolvedPeticiones.find(p =>
          p.solicitud.peticionKey.toLowerCase() === peticionKey.toLowerCase() ||
          p.solicitud.peticionActivationKeys?.some(k => k.toLowerCase() === peticionKey.toLowerCase())
        );

        if (!match) {
          const availableKeys = resolvedPeticiones.map(p => p.solicitud.peticionKey);
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: `No se encontró una petición con key "${peticionKey}". Peticiones disponibles: ${availableKeys.length > 0 ? availableKeys.join(', ') : 'ninguna'}. Usa "get_info" para ver las opciones.`,
            error: `Invalid peticion_key: ${peticionKey}`,
          };
        }

        // Check for duplicate pending solicitudes
        const existingSolicitudes = sessionStats?.solicitudes?.characterSolicitudes?.[match.targetCharacterId] || [];
        const hasDuplicate = existingSolicitudes.some(
          s => s.status === 'pending' &&
               s.fromCharacterId === characterId &&
               (s.peticionKey?.toLowerCase() === match.solicitud.peticionKey.toLowerCase() ||
                s.key.toLowerCase() === match.solicitud.solicitudKey.toLowerCase())
        );

        if (hasDuplicate) {
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: `Ya existe una solicitud pendiente de "${match.solicitud.peticionKey}" para ${match.targetCharacterName}.`,
            error: `Duplicate solicitud: ${match.solicitud.peticionKey}`,
          };
        }

        const resolvedDesc = resolveToolKeysWithContext(match.solicitud.peticionDescription, context, characterName, match.targetCharacterName);
        const lines = [
          `📬 **Petición realizada**`,
          `Peticion: ${match.solicitud.peticionKey}`,
          `Para: ${match.targetCharacterName}`,
          `Descripción: ${resolvedDesc}`,
        ];

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: {
            action: 'make_request',
            peticionKey: match.solicitud.peticionKey,
            targetCharacterId: match.targetCharacterId,
            targetCharacterName: match.targetCharacterName,
          },
          displayMessage: lines.join('\n'),
          solicitudActivation: {
            type: 'create_solicitud',
            solicitudKey: match.solicitud.solicitudKey,
            peticionKey: match.solicitud.peticionKey,
            targetCharacterId: match.targetCharacterId,
            targetCharacterName: match.targetCharacterName,
            fromCharacterId: characterId,
            fromCharacterName: characterName,
            description: match.solicitud.solicitudDescription,
            completionDescription: match.solicitud.completionDescription,
          },
        };
      }

      case 'complete_request': {
        if (!solicitudKey) {
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: 'Debes especificar "solicitud_key". Usa "get_info" para ver las solicitudes pendientes.',
            error: 'Missing required parameter: solicitud_key',
          };
        }

        // Find the matching pending solicitud
        const pendingSolicitudes = getPendingSolicitudes(sessionStats, characterId);
        const match = pendingSolicitudes.find(s =>
          s.key.toLowerCase() === solicitudKey.toLowerCase() ||
          s.solicitudActivationKeys?.some(k => k.toLowerCase() === solicitudKey.toLowerCase())
        );

        if (!match) {
          const availableKeys = pendingSolicitudes.map(s => s.key);
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: `No se encontró una solicitud pendiente con key "${solicitudKey}". Solicitudes pendientes: ${availableKeys.length > 0 ? availableKeys.join(', ') : 'ninguna'}. Usa "get_info" para ver las opciones.`,
            error: `Invalid solicitud_key: ${solicitudKey}`,
          };
        }

        const resolvedDesc = resolveToolKeysWithContext(match.description, context, match.fromCharacterName, characterName);
        const lines = [
          `✅ **Solicitud completada**`,
          `Solicitud: ${match.key}`,
          `De: ${match.fromCharacterName}`,
          `Descripción: ${resolvedDesc}`,
        ];

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: {
            action: 'complete_request',
            solicitudKey: match.key,
            fromCharacterName: match.fromCharacterName,
          },
          displayMessage: lines.join('\n'),
          solicitudActivation: {
            type: 'complete_solicitud',
            solicitudKey: match.key,
            targetCharacterId: undefined,
            targetCharacterName: match.fromCharacterName,
            fromCharacterId: match.fromCharacterId,
            fromCharacterName: match.fromCharacterName,
            description: match.description,
            completionDescription: match.completionDescription,
          },
        };
      }

      default:
        return {
          success: false,
          toolName: 'manage_solicitud',
          result: null,
          displayMessage: `Acción desconocida: "${action}". Usa "get_info", "make_request" o "complete_request".`,
          error: `Unknown action: ${action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      toolName: 'manage_solicitud',
      result: null,
      displayMessage: 'Error al gestionar la solicitud.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
