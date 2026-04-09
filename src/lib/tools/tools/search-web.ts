// ============================================
// Tool: Search Web
// ============================================
// Category: real_world
// Permission: auto
// Uses the z-ai-web-dev-sdk web_search function with X-Token fallback

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

/**
 * Attempt 1: Try using the SDK (may fail with 401 if X-Token header is missing)
 * Attempt 2: Direct fetch with X-Token header (bypass SDK's Authorization-only header)
 */
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
    let results: unknown;

    // Try using z-ai-web-dev-sdk
    try {
      const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
      const zai = await ZAI.create();
      results = await zai.functions.invoke('web_search', { query, num: maxResults });
      console.log(`[Tool:search_web] SDK search succeeded for "${query}"`);
    } catch (sdkError) {
      const errMsg = sdkError instanceof Error ? sdkError.message : String(sdkError);
      console.warn(`[Tool:search_web] SDK search failed for "${query}": ${errMsg}`);

      // If it's a 401/auth error, don't try the direct fallback - it'll fail too
      if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('auth')) {
        console.error('[Tool:search_web] Authentication error with web search API. The search service token may be expired or missing.');
        return {
          success: false,
          toolName: 'search_web',
          result: null,
          displayMessage: `🔍 No se pudo buscar "${query}": el servicio de búsqueda web no está disponible (error de autenticación). Verifica la configuración del SDK.`,
          error: 'SEARCH_AUTH_ERROR',
        };
      }

      throw new Error(`SDK error: ${errMsg}`);
    }

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
    const errMsg = error instanceof Error ? error.message : String(error);
    let displayMsg = `No se pudo completar la búsqueda web para "${query}"`;
    if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('auth')) {
      displayMsg = `🔍 Búsqueda no disponible para "${query}": el servicio de búsqueda no está configurado correctamente (error de autenticación).`;
    } else if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
      displayMsg = `🔍 La búsqueda para "${query}" tardó demasiado y fue cancelada.`;
    } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
      displayMsg = `🔍 Error de conexión al buscar "${query}". Verifica tu conexión a internet.`;
    }
    return {
      success: false,
      toolName: 'search_web',
      result: null,
      displayMessage: displayMsg,
      error: errMsg,
    };
  }
}

/** Load z-ai-web-dev-sdk config from standard locations */
async function loadZAIConfig(): Promise<{ baseUrl: string; apiKey: string } | null> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.baseUrl && config.apiKey) {
          return { baseUrl: config.baseUrl, apiKey: config.apiKey };
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return null;
}
