// ============================================
// Tool: Search Memory
// ============================================
// Category: cognitive
// Permission: auto
// Searches the LanceDB embeddings for relevant memories

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import { retrieveEmbeddingsContext } from '@/lib/embeddings/chat-context';

export const searchMemoryTool: ToolDefinition = {
  id: 'search_memory',
  name: 'search_memory',
  label: 'Buscar Memoria',
  icon: 'Brain',
  description:
    'Busca en tu memoria información relacionada con un tema específico. ' +
    'Usa esta herramienta cuando necesites recordar algo que el usuario mencionó anteriormente ' +
    'o cuando quieras verificar si tienes información sobre un tema en tu memoria.',
  category: 'cognitive',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Qué buscar en la memoria (ej: "gustos del usuario", "nombre del amigo")',
        required: true,
      },
      max_results: {
        type: 'number',
        description: 'Cuántos resultados máximos devolver (default: 5)',
        required: false,
      },
    },
    required: ['query'],
  },
  permissionMode: 'auto',
};

export async function searchMemoryExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const query = String(params.query || '').trim();
  const maxResults = Math.min(Math.max(Number(params.max_results) || 5, 1), 10);

  if (!query || query.length < 2) {
    return {
      success: false,
      toolName: 'search_memory',
      result: null,
      displayMessage: 'La búsqueda de memoria requiere un query de al menos 2 caracteres',
      error: 'EMPTY_QUERY',
    };
  }

  try {
    // Use the existing embeddings retrieval system
    const result = await retrieveEmbeddingsContext(
      query,
      {
        strategy: 'session',
        namespaces: [
          `character-${context.characterId}-${context.sessionId}`,
          `character-${context.characterId}`,
        ],
        characterId: context.characterId,
        sessionId: context.sessionId,
        groupId: context.groupId,
        embeddingNamespaces: undefined,
        maxResults,
        maxTokenBudget: 500, // Small budget for tool results
      },
      {
        ollamaEndpoint: process.env.OLLAMA_ENDPOINT || '',
        modelName: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
      },
    );

    const memories = result.results
      .filter(r => r.source_type === 'memory')
      .slice(0, maxResults);

    if (memories.length === 0) {
      return {
        success: true,
        toolName: 'search_memory',
        result: { query, memories: [] },
        displayMessage: `🧠 No se encontraron memorias sobre "${query}"`,
      };
    }

    const memoryList = memories.map(m => `- ${m.content}`).join('\n');
    const displayMessage = `🧠 Memorias sobre "${query}":\n${memoryList}`;

    return {
      success: true,
      toolName: 'search_memory',
      result: {
        query,
        memories: memories.map(m => ({
          content: m.content,
          importance: m.metadata?.importance,
          type: m.metadata?.memory_type,
        })),
      },
      displayMessage,
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'search_memory',
      result: null,
      displayMessage: 'Error al buscar en la memoria',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
