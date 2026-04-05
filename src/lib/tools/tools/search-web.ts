// ============================================
// Tool: Search Web
// ============================================
// Category: real_world
// Permission: auto
// Uses the z-ai-web-dev-sdk web_search function

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const searchWebTool: ToolDefinition = {
  id: 'search_web',
  name: 'search_web',
  label: 'Buscar en Internet',
  icon: 'Globe',
  description:
    'Busca información actualizada en internet. ' +
    'Usa esta herramienta cuando necesites datos recientes, noticias, o información ' +
    'que no tengas en tu conocimiento base.',
  category: 'real_world',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Qué buscar en internet',
        required: true,
      },
      max_results: {
        type: 'number',
        description: 'Cuántos resultados máximo (default: 3, max: 5)',
        required: false,
      },
    },
    required: ['query'],
  },
  permissionMode: 'auto',
};

export async function searchWebExecutor(
  params: Record<string, unknown>,
  _context: ToolContext,
): Promise<ToolExecutionResult> {
  const query = String(params.query || '').trim();
  const maxResults = Math.min(Math.max(Number(params.max_results) || 3, 1), 5);

  if (!query || query.length < 3) {
    return {
      success: false,
      toolName: 'search_web',
      result: null,
      displayMessage: 'La búsqueda requiere un query de al menos 3 caracteres',
      error: 'EMPTY_QUERY',
    };
  }

  try {
    // Dynamic import to avoid issues in non-server contexts
    const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
    const zai = await ZAI.create();

    const results = await zai.functions.invoke('web_search', {
      query,
      num: maxResults,
    });

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        toolName: 'search_web',
        result: { query, results: [] },
        displayMessage: `🔍 No se encontraron resultados para "${query}"`,
      };
    }

    const formattedResults = results.slice(0, maxResults).map((r: Record<string, unknown>) => ({
      title: String(r.name || r.title || ''),
      snippet: String(r.snippet || r.description || ''),
      url: String(r.url || ''),
    }));

    const resultList = formattedResults
      .map((r: { title: string; snippet: string }, i: number) => `${i + 1}. **${r.title}**: ${r.snippet}`)
      .join('\n');

    const displayMessage = `🔍 Resultados para "${query}":\n${resultList}`;

    return {
      success: true,
      toolName: 'search_web',
      result: { query, results: formattedResults },
      displayMessage,
    };
  } catch (error) {
    console.warn('[Tool:search_web] Search failed:', error);
    return {
      success: false,
      toolName: 'search_web',
      result: null,
      displayMessage: `No se pudo completar la búsqueda web para "${query}"`,
      error: error instanceof Error ? error.message : 'SDK_UNAVAILABLE',
    };
  }
}
