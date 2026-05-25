// ============================================
// Tool: Search Memory
// ============================================
// Category: cognitive
// Permission: auto
// Searches both LanceDB embeddings and Character Memory (Zustand store)
// for relevant memories about a specific topic.

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
      memory_subject: {
        type: 'string',
        description: 'Filtrar por sujeto: "usuario" (memorias sobre el jugador), "personaje" (memorias sobre ti), "otro" (sobre otros personajes)',
        enum: ['usuario', 'personaje', 'otro'],
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

/** Extended search result with source indicator */
interface MemorySearchResult extends SearchResult {
  /** Source of the result: 'lancedb' or 'character_memory' */
  source: 'lancedb' | 'character_memory';
}

export async function searchMemoryExecutor(
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const query = String(params.query || '').trim();
  const memoryType = params.memory_type ? String(params.memory_type) : undefined;
  const memorySubject = params.memory_subject ? String(params.memory_subject) : undefined;
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

  const allResults: MemorySearchResult[] = [];

  // ========================================
  // Part 1: Search LanceDB embeddings
  // ========================================
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
          // Filter by memory subject if specified
          if (memorySubject && r.metadata?.memory_subject !== memorySubject) {
            continue;
          }
          allResults.push({ ...r, source: 'lancedb' });
        }
      } catch (nsErr) {
        // Namespace might not exist, skip silently
        console.warn(`[search_memory] Could not search namespace "${ns}":`, nsErr);
      }
    }
  } catch (lancedbError) {
    // LanceDB might be unavailable (e.g., Ollama not running)
    console.warn('[search_memory] LanceDB search failed, falling back to Character Memory only:', lancedbError);
  }

  // ========================================
  // Part 2: Search Character Memory (Zustand store)
  // ========================================
  if (context.characterMemory) {
    const cm = context.characterMemory;
    
    // Collect embedding IDs already found in LanceDB to avoid duplicates
    const lancedbIds = new Set(
      allResults
        .filter(r => r.source === 'lancedb')
        .map(r => r.id)
    );

    // Helper: extract significant query words (>2 chars) for keyword matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Map Spanish memory_type filter values to Character Memory event types
    const typeMap: Record<string, string[]> = {
      hecho: ['fact'],
      evento: ['event'],
      relacion: ['relationship'],
      preferencia: ['fact'],  // preferences are stored as facts
      secreto: ['fact'],      // secrets are stored as facts
      otro: ['state_change', 'emotion', 'location', 'item'],
    };

    // Search events
    for (const event of cm.events) {
      // Skip if this event's embedding was already found in LanceDB
      if (event.embeddingId && lancedbIds.has(event.embeddingId)) continue;

      // Keyword matching: check if any significant word from the query appears in the event content
      const eventContent = event.content.toLowerCase();
      const matches = queryWords.some(w => eventContent.includes(w));
      if (!matches) continue;

      // Filter by type if specified
      if (memoryType) {
        const allowedTypes = typeMap[memoryType] || [memoryType];
        if (!allowedTypes.includes(event.type)) continue;
      }

      // Filter by subject if specified (check metadata)
      if (memorySubject && event.metadata?.memory_subject) {
        if (event.metadata.memory_subject !== memorySubject) continue;
      }

      allResults.push({
        id: event.id,
        content: event.content,
        metadata: {
          importance: event.importance,
          memory_type: event.type,
          memory_subject: event.metadata?.memory_subject || 'personaje',
          source: 'character_memory',
        },
        namespace: 'character-memory',
        source_type: 'memory',
        similarity: 0.8, // Fixed score for keyword matches
        source: 'character_memory',
      });
    }

    // Search relationships
    for (const rel of cm.relationships) {
      const relContent = `${rel.targetName}: ${rel.relationship} (sentimiento: ${rel.sentiment})${rel.notes ? '. ' + rel.notes : ''}`;
      const relLower = relContent.toLowerCase();
      const relMatches = queryWords.some(w => relLower.includes(w));

      if (!relMatches) continue;

      // Filter by type: relationships match "relacion" type
      if (memoryType && memoryType !== 'relacion') continue;

      // Filter by subject if specified
      if (memorySubject) {
        const relSubject = rel.targetId === 'user' || rel.targetId === '__user__' ? 'usuario' : 'otro';
        if (relSubject !== memorySubject) continue;
      }

      allResults.push({
        id: `rel-${rel.targetId}`,
        content: relContent,
        metadata: {
          importance: 3,
          memory_type: 'relacion',
          memory_subject: rel.targetId === 'user' || rel.targetId === '__user__' ? 'usuario' : 'otro',
          source: 'character_memory',
        },
        namespace: 'character-memory',
        source_type: 'memory',
        similarity: 0.75,
        source: 'character_memory',
      });
    }

    // Search notes
    if (cm.notes) {
      const notesLower = cm.notes.toLowerCase();
      const notesMatches = queryWords.some(w => notesLower.includes(w));

      if (notesMatches) {
        // Notes don't have a specific type/subject filter
        allResults.push({
          id: `notes-${cm.characterId}`,
          content: cm.notes,
          metadata: {
            importance: 3,
            memory_type: 'notas',
            memory_subject: 'personaje',
            source: 'character_memory',
          },
          namespace: 'character-memory',
          source_type: 'memory',
          similarity: 0.7,
          source: 'character_memory',
        });
      }
    }
  }

  // Sort by similarity (LanceDB results typically have higher similarity, then Character Memory)
  allResults.sort((a, b) => b.similarity - a.similarity);
  const memories = allResults.slice(0, maxResults);

  if (memories.length === 0) {
    return {
      success: true,
      toolName: 'search_memory',
      result: { query, memories: [], memoryType, memorySubject },
      displayMessage: `🧠 No se encontraron memorias sobre "${query}"${memoryType ? ` (tipo: ${memoryType})` : ''}${memorySubject ? ` (sujeto: ${memorySubject})` : ''}`,
    };
  }

  const lines = [`🧠 Memorias sobre "${query}":`];
  
  if (memoryType) {
    lines[0] += ` [Tipo: ${memoryType}]`;
  }
  if (memorySubject) {
    lines[0] += ` [Sujeto: ${memorySubject}]`;
  }
  
  lines.push('');
  
  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    const importance = m.metadata?.importance || 3;
    const type = m.metadata?.memory_type || 'otro';
    const stars = '★'.repeat(Math.ceil(importance)) + '☆'.repeat(5 - Math.ceil(importance));
    const subject = m.metadata?.memory_subject || 'personaje';
    const subjectLabel = subject === 'usuario' ? '👤 Usuario' : subject === 'otro' ? '🌐 Otro' : '🧑 Personaje';
    const sourceLabel = m.source === 'lancedb' ? '[LanceDB]' : '[Memoria Local]';
    
    lines.push(`${i + 1}. ${m.content}`);
    lines.push(`   ${stars} (${type}) [${subjectLabel}] ${sourceLabel}`);
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
        subject: m.metadata?.memory_subject,
        sentiment: m.metadata?.sentiment,
        source: m.source,
      })),
      memoryType,
      memorySubject,
    },
    displayMessage: lines.join('\n'),
  };
}
