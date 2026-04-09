// ============================================
// Tool: Manage Solicitud (Request System)
// ============================================
// Category: in_character
// Manages peticiones/solicitudes between characters

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const manageSolicitudTool: ToolDefinition = {
  id: 'manage_solicitud',
  name: 'manage_solicitud',
  label: 'Gestionar Solicitud',
  icon: 'Handshake',
  description:
    'Gestiona peticiones y solicitudes entre personajes. ' +
    'Úsala cuando quieras hacer una petición a otro personaje ' +
    'o completar una solicitud que te han hecho.',
  category: 'in_character',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Acción: get_solicitudes (ver pendientes), make_request (hacer petición), complete_request (completar solicitud)',
        enum: ['get_solicitudes', 'make_request', 'complete_request'],
        required: true,
      },
      request_type: {
        type: 'string',
        description: 'Tipo de petición (ej: madera, información, ayuda)',
        required: false,
      },
      target_character: {
        type: 'string',
        description: 'Nombre del personaje objetivo de la petición',
        required: false,
      },
      request_key: {
        type: 'string',
        description: 'Key única para esta petición (ej: pedir_madera)',
        required: false,
      },
      completion_key: {
        type: 'string',
        description: 'Key de completación para la solicitud (ej: entrego_madera)',
        required: false,
      },
      narrative: {
        type: 'string',
        description: 'Descripción narrativa de la petición o respuesta',
        required: false,
      },
    },
    required: ['action'],
  },
  permissionMode: 'auto',
};

export async function manageSolicitudExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const action = String(params.action || '');
  const requestType = params.request_type ? String(params.request_type) : '';
  const targetCharacter = params.target_character ? String(params.target_character) : '';
  const requestKey = params.request_key ? String(params.request_key).toLowerCase().replace(/\s+/g, '_') : '';
  const completionKey = params.completion_key ? String(params.completion_key).toLowerCase().replace(/\s+/g, '_') : '';
  const narrative = params.narrative ? String(params.narrative) : '';

  try {
    switch (action) {
      case 'get_solicitudes': {
        const lines = [
          '🤝 **Sistema de Solicitudes:**',
          '',
          'Las solicitudes pendientes se muestran en el prompt como {{solicitudes}}.',
          'Usa keys para activar/completar solicitudes.',
          '',
          '**Keys de detección:**',
          '- Hacer petición: Escribe [pedir:tipo] en tu respuesta',
          '- Completar solicitud: Escribe [entregar:tipo] en tu respuesta',
        ];

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: { action: 'get_solicitudes', sessionId: context.sessionId },
          displayMessage: lines.join('\n'),
        };
      }

      case 'make_request': {
        if (!requestType || !targetCharacter) {
          return {
            success: false,
            toolName: 'manage_solicitud',
            result: null,
            displayMessage: 'Para hacer una petición, especifica request_type y target_character.',
            error: 'Missing required parameters: request_type, target_character',
          };
        }

        const key = requestKey || `pedir_${requestType.toLowerCase().replace(/\s+/g, '_')}`;
        const makeRequestKey = `pedir:${requestType.toLowerCase()}`;
        
        const lines = [
          '📬 **Petición Creada:**',
          `Tipo: ${requestType}`,
          `Para: ${targetCharacter}`,
        ];

        if (narrative) {
          lines.push(`Narrativa: ${narrative}`);
        }

        lines.push('');
        lines.push(`**Incluye en tu respuesta:** [${makeRequestKey}]`);
        lines.push(`El sistema creará una solicitud para ${targetCharacter}.`);

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: {
            action: 'make_request',
            requestType,
            targetCharacter,
            detectionKey: makeRequestKey,
          },
          displayMessage: lines.join('\n'),
        };
      }

      case 'complete_request': {
        const completeKey = completionKey || `entregar:${requestType.toLowerCase()}`;
        
        const lines = [
          '✅ **Solicitud Completada:**',
        ];

        if (narrative) {
          lines.push(`Acción: ${narrative}`);
        }

        lines.push('');
        lines.push(`**Incluye en tu respuesta:** [${completeKey}]`);
        lines.push('El sistema marcará la solicitud como completada.');

        return {
          success: true,
          toolName: 'manage_solicitud',
          result: {
            action: 'complete_request',
            completionKey: completeKey,
            requestType,
          },
          displayMessage: lines.join('\n'),
        };
      }

      default:
        return {
          success: false,
          toolName: 'manage_solicitud',
          result: null,
          displayMessage: `Acción desconocida: ${action}. Acciones: get_solicitudes, make_request, complete_request`,
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
