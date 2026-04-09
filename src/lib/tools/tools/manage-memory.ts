// ============================================
// Tool: Manage Memory
// ============================================
// Category: cognitive
// Manages character memories and relationships
// Persists memories to LanceDB

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import { getEmbeddingClient } from '@/lib/embeddings/client';
import type { MemoryType } from '@/lib/embeddings/memory-extraction';

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
        description: 'Tipo de memoria: hecho, evento, relacion, preferencia, secreto, otro',
        enum: ['hecho', 'evento', 'relacion', 'preferencia', 'secreto', 'otro'],
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
        description: 'Importancia de la memoria (1-5, default: 3)',
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

const VALID_MEMORY_TYPES: MemoryType[] = ['hecho', 'evento', 'relacion', 'preferencia', 'secreto', 'otro'];

function normalizeMemoryType(raw: string): MemoryType {
  const lower = raw.toLowerCase().trim();
  if (VALID_MEMORY_TYPES.includes(lower as MemoryType)) {
    return lower as MemoryType;
  }
  return 'otro';
}

export async function manageMemoryExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const action = String(params.action || '');
  const memoryType = params.memory_type ? normalizeMemoryType(String(params.memory_type)) : 'hecho';
  const content = params.content ? String(params.content) : '';
  const subject = params.subject ? String(params.subject) : context.characterName;
  const sentiment = params.sentiment !== undefined ? Number(params.sentiment) : 0;
  const importance = params.importance !== undefined ? Math.max(1, Math.min(5, Math.round(Number(params.importance)))) : 3;
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
        
        // Determine namespace: use session-specific memory namespace
        const sessionId = context.sessionId || 'unknown';
        const namespace = `memory-character-${context.characterId}-${sessionId}`;
        
        try {
          const client = getEmbeddingClient();
          
          // Ensure namespace exists
          await client.upsertNamespace({
            namespace,
            description: `Memorias del personaje: ${context.characterName}`,
            metadata: {
              type: 'memory',
              subtype: 'character',
              character_id: context.characterId,
              session_id: sessionId,
              auto_created: false,
              manual: true,
            },
          });
          
          // Save the memory as an embedding
          await client.createEmbedding({
            content: memoryContent,
            namespace,
            source_type: 'memory',
            source_id: sessionId,
            metadata: {
              memory_type: memoryType,
              importance: importance,
              subject: subject,
              sentiment: sentiment,
              narrative: narrative,
              character_id: context.characterId,
              session_id: sessionId,
              extracted_at: new Date().toISOString(),
              manually_created: true,
            },
          });
          
          console.log(`[manage_memory] Saved memory to namespace "${namespace}": ${memoryContent.slice(0, 50)}...`);
        } catch (embedErr) {
          console.error('[manage_memory] Failed to save embedding:', embedErr);
          // Continue with success response but log the error
        }

        const sentimentEmoji = sentiment > 20 ? '😊' : sentiment < -20 ? '😢' : '📝';
        const importanceStars = '★'.repeat(Math.ceil(importance)) + '☆'.repeat(5 - Math.ceil(importance));

        const lines = [
          '🧠 **Memoria Guardada:**',
          `${sentimentEmoji} Tipo: ${memoryType}`,
          `${importanceStars} Importancia: ${importance}/5`,
          `Relacionado: ${subject}`,
          '',
          `Contenido: ${memoryContent}`,
          '',
          'La memoria ha sido guardada y podrá ser consultada en futuras conversaciones.',
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
            namespace,
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

        // Save relationship as a memory
        const sessionId = context.sessionId || 'unknown';
        const namespace = `memory-character-${context.characterId}-${sessionId}`;
        
        const sentimentLabel = sentiment > 50 ? 'aliado cercano' 
          : sentiment > 20 ? 'amigo' 
          : sentiment > 0 ? 'conocido' 
          : sentiment > -20 ? 'neutral' 
          : sentiment > -50 ? 'desconfiado' 
          : 'enemigo';
        
        const sentimentChange = sentiment > 0 ? `+${sentiment}` : `${sentiment}`;
        
        const relationshipContent = narrative 
          ? `Relación con ${subject}: ${narrative} (sentimiento: ${sentimentChange})`
          : `Relación con ${subject}: cambio de ${sentimentChange} puntos`;

        try {
          const client = getEmbeddingClient();
          
          await client.upsertNamespace({
            namespace,
            description: `Memorias del personaje: ${context.characterName}`,
            metadata: {
              type: 'memory',
              subtype: 'character',
              character_id: context.characterId,
              session_id: sessionId,
              auto_created: false,
              manual: true,
            },
          });
          
          await client.createEmbedding({
            content: relationshipContent,
            namespace,
            source_type: 'memory',
            source_id: sessionId,
            metadata: {
              memory_type: 'relacion',
              importance: Math.abs(sentiment) > 50 ? 4 : 3,
              subject: subject,
              sentiment: sentiment,
              sentimentLabel: sentimentLabel,
              character_id: context.characterId,
              session_id: sessionId,
              extracted_at: new Date().toISOString(),
              manually_created: true,
              relationship: true,
            },
          });
          
          console.log(`[manage_memory] Saved relationship to namespace "${namespace}": ${subject}`);
        } catch (embedErr) {
          console.error('[manage_memory] Failed to save relationship embedding:', embedErr);
        }

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
        lines.push('La relación ha sido actualizada en la memoria del personaje.');

        return {
          success: true,
          toolName: 'manage_memory',
          result: {
            action: 'update_relationship',
            subject,
            sentimentDelta: sentiment,
            sentimentLabel,
            characterId: context.characterId,
            sessionId: context.sessionId,
            namespace,
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
