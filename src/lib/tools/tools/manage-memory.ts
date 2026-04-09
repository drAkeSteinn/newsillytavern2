// ============================================
// Tool: Manage Memory
// ============================================
// Category: cognitive
// Manages character memories and relationships

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const manageMemoryTool: ToolDefinition = {
  id: 'manage_memory',
  name: 'manage_memory',
  label: 'Gestionar Memoria',
  icon: 'Brain',
  description:
    'Gestiona la memoria del personaje: eventos importantes, relaciones y notas. ' +
    'Úsala para guardar información que el personaje debe recordar, ' +
    'actualizar relaciones con otros personajes, o consultar memorias guardadas.',
  category: 'cognitive',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Acción: save_memory (guardar), update_relationship (actualizar relación), get_memories (ver memorias)',
        enum: ['save_memory', 'update_relationship', 'get_memories', 'save_note'],
        required: true,
      },
      memory_type: {
        type: 'string',
        description: 'Tipo de memoria: event (evento), relationship (relación), fact (hecho), emotion (emoción), location (lugar), item (objeto)',
        enum: ['event', 'relationship', 'fact', 'emotion', 'location', 'item'],
        required: false,
      },
      content: {
        type: 'string',
        description: 'Contenido de la memoria a guardar',
        required: false,
      },
      subject: {
        type: 'string',
        description: 'Personaje, lugar u objeto relacionado con la memoria',
        required: false,
      },
      sentiment: {
        type: 'number',
        description: 'Cambio de sentimiento (-100 muy negativo, +100 muy positivo) para relaciones',
        required: false,
      },
      importance: {
        type: 'number',
        description: 'Importancia de la memoria (0.0 a 1.0, default: 0.5)',
        required: false,
      },
      narrative: {
        type: 'string',
        description: 'Descripción narrativa del evento o acción',
        required: false,
      },
    },
    required: ['action'],
  },
  permissionMode: 'auto',
};

export async function manageMemoryExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const action = String(params.action || '');
  const memoryType = params.memory_type ? String(params.memory_type) : 'event';
  const content = params.content ? String(params.content) : '';
  const subject = params.subject ? String(params.subject) : context.characterName;
  const sentiment = params.sentiment !== undefined ? Number(params.sentiment) : 0;
  const importance = params.importance !== undefined ? Number(params.importance) : 0.5;
  const narrative = params.narrative ? String(params.narrative) : '';

  try {
    switch (action) {
      case 'save_memory':
      case 'save_note': {
        if (!content && !narrative) {
          return {
            success: false,
            toolName: 'manage_memory',
            result: null,
            displayMessage: 'Para guardar una memoria, especifica content o narrative.',
            error: 'Missing required parameter: content or narrative',
          };
        }

        const memoryContent = content || narrative;
        const sentimentEmoji = sentiment > 20 ? '😊' : sentiment < -20 ? '😢' : '📝';
        const importanceStars = '★'.repeat(Math.ceil(importance * 5)) + '☆'.repeat(5 - Math.ceil(importance * 5));

        const lines = [
          '🧠 **Memoria Guardada:**',
          `${sentimentEmoji} Tipo: ${memoryType}`,
          `${importanceStars} Importancia: ${Math.round(importance * 100)}%`,
          `Relacionado: ${subject}`,
          '',
          `Contenido: ${memoryContent}`,
          '',
          'La memoria será guardada y podrá ser consultada en futuras conversaciones.',
        ];

        return {
          success: true,
          toolName: 'manage_memory',
          result: {
            action: 'save_memory',
            memoryType,
            content: memoryContent,
            subject,
            importance,
            characterId: context.characterId,
            sessionId: context.sessionId,
          },
          displayMessage: lines.join('\n'),
        };
      }

      case 'update_relationship': {
        if (!subject) {
          return {
            success: false,
            toolName: 'manage_memory',
            result: null,
            displayMessage: 'Para actualizar una relación, especifica subject (nombre del otro personaje).',
            error: 'Missing required parameter: subject',
          };
        }

        const sentimentLabel = sentiment > 50 ? 'aliado cercano' 
          : sentiment > 20 ? 'amigo' 
          : sentiment > 0 ? 'conocido' 
          : sentiment > -20 ? 'neutral' 
          : sentiment > -50 ? 'desconfiado' 
          : 'enemigo';
        
        const sentimentChange = sentiment > 0 ? `+${sentiment}` : `${sentiment}`;

        const lines = [
          '💜 **Relación Actualizada:**',
          `Personaje: ${subject}`,
          `Cambio: ${sentimentChange}`,
          `Estado actual: ${sentimentLabel}`,
        ];

        if (narrative) {
          lines.push(`Razón: ${narrative}`);
        }

        lines.push('');
        lines.push('La relación será actualizada en la memoria del personaje.');

        return {
          success: true,
          toolName: 'manage_memory',
          result: {
            action: 'update_relationship',
            subject,
            sentimentDelta: sentiment,
            characterId: context.characterId,
            sessionId: context.sessionId,
          },
          displayMessage: lines.join('\n'),
        };
      }

      case 'get_memories': {
        const lines = [
          '🧠 **Sistema de Memorias:**',
          '',
          'El personaje recuerda información relevante de conversaciones anteriores.',
          'Las memorias se consultan automáticamente cuando son relevantes.',
          '',
          'Para guardar un recuerdo importante, usa save_memory.',
          'Para actualizar relaciones, usa update_relationship.',
          '',
          `Personaje: ${context.characterName}`,
        ];

        return {
          success: true,
          toolName: 'manage_memory',
          result: { 
            action: 'get_memories', 
            characterId: context.characterId,
            sessionId: context.sessionId 
          },
          displayMessage: lines.join('\n'),
        };
      }

      default:
        return {
          success: false,
          toolName: 'manage_memory',
          result: null,
          displayMessage: `Acción desconocida: ${action}. Acciones: save_memory, update_relationship, get_memories`,
          error: `Unknown action: ${action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      toolName: 'manage_memory',
      result: null,
      displayMessage: 'Error al gestionar la memoria.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
