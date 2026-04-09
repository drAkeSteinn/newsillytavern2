// ============================================
// Tool: Search Memory
// ============================================
// Category: cognitive
// Permission: auto
// Searches the LanceDB embeddings for relevant memories

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';
import { getEmbeddingClient } from '@/lib/embeddings/client';
import type { SearchResult } from '@/lib/embeddings/types';

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
      memory_type: {
        type: 'string',
        description: 'Filtrar por tipo: hecho, evento, relacion, preferencia, secreto (opcional)',
        enum: ['hecho', 'evento', 'relacion', 'preferencia', 'secreto', 'otro'],
        required: false,
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
  const memoryType = params.memory_type ? String(params.memory_type) : undefined;
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
    const client = getEmbeddingClient();
    const sessionId = context.sessionId || 'unknown';
    
    // Define namespaces to search: session-specific memory + character lore
    const namespaces = [
      `memory-character-${context.characterId}-${sessionId}`,
      `memory-character-${context.characterId}`,
      `character-${context.characterId}`,
    ];
    
    // Add group namespaces if in a group
    if (context.groupId) {
      namespaces.push(`memory-group-${context.groupId}-${sessionId}`);
      namespaces.push(`memory-group-${context.groupId}`);
      namespaces.push(`group-${context.groupId}`);
    }
    
    // Also search default namespaces
    namespaces.push('default', 'world');
    
    // Remove duplicates
    const uniqueNamespaces = [...new Set(namespaces)];
    
    let allResults: SearchResult[] = [];
    
    // Search in each namespace
    for (const ns of uniqueNamespaces) {
      try {
        const results = await client.searchInNamespace({
          namespace: ns,
          query: query,
          limit: maxResults,
          threshold: 0.3,
        });
        
        // Filter to only memory-type embeddings
        const memoryResults = results.filter(r => r.source_type === 'memory');
        
        for (const r of memoryResults) {
          // Filter by memory type if specified
          if (memoryType && r.metadata?.memory_type !== memoryType) {
            continue;
          }
          allResults.push(r);
        }
      } catch (nsErr) {
        // Namespace might not exist, skip silently
        console.warn(`[search_memory] Could not search namespace "${ns}":`, nsErr);
      }
    }
    
    // Sort by similarity and limit
    allResults.sort((a, b) => b.similarity - a.similarity);
    const memories = allResults.slice(0, maxResults);

    if (memories.length === 0) {
      return {
        success: true,
        toolName: 'search_memory',
        result: { query, memories: [], memoryType },
        displayMessage: `🧠 No se encontraron memorias sobre "${query}"${memoryType ? ` (tipo: ${memoryType})` : ''}`,
      };
    }

    const lines = [`🧠 Memorias sobre "${query}":`];
    
    if (memoryType) {
      lines[0] += ` [Tipo: ${memoryType}]`;
    }
    
    lines.push('');
    
    for (let i = 0; i < memories.length; i++) {
      const m = memories[i];
      const importance = m.metadata?.importance || 3;
      const type = m.metadata?.memory_type || 'otro';
      const stars = '★'.repeat(Math.ceil(importance)) + '☆'.repeat(5 - Math.ceil(importance));
      
      lines.push(`${i + 1}. ${m.content}`);
      lines.push(`   ${stars} (${type})`);
    }

    return {
      success: true,
      toolName: 'search_memory',
      result: {
        query,
        memories: memories.map(m => ({
          content: m.content,
          namespace: m.namespace,
          importance: m.metadata?.importance,
          type: m.metadata?.memory_type,
          sentiment: m.metadata?.sentiment,
          subject: m.metadata?.subject,
        })),
        memoryType,
        searchedNamespaces: uniqueNamespaces,
      },
      displayMessage: lines.join('\n'),
    };
  } catch (error) {
    console.error('[search_memory] Error:', error);
    return {
      success: false,
      toolName: 'search_memory',
      result: null,
      displayMessage: 'Error al buscar en la memoria',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
