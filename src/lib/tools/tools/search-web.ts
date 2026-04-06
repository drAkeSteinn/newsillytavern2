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

    // Attempt 1: Use z-ai-web-dev-sdk
    try {
      const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
      const zai = await ZAI.create();
      results = await zai.functions.invoke('web_search', { query, num: maxResults });
      console.log(`[Tool:search_web] SDK search succeeded for "${query}"`);
    } catch (sdkError) {
      // Attempt 2: Direct fetch with X-Token header
      console.warn('[Tool:search_web] SDK failed, trying direct fetch with X-Token...', sdkError instanceof Error ? sdkError.message : sdkError);

      const config = await loadZAIConfig();
      if (!config) {
        throw new Error('No se encontró configuración de z-ai-web-dev-sdk');
      }

      const url = `${config.baseUrl}/functions/invoke`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': config.apiKey,
          'X-Z-AI-From': 'Z',
        },
        body: JSON.stringify({
          function_name: 'web_search',
          arguments: { query, num: maxResults },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Direct fetch failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      results = data.result;
      console.log(`[Tool:search_web] Direct X-Token fetch succeeded for "${query}"`);
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
    return {
      success: false,
      toolName: 'search_web',
      result: null,
      displayMessage: `No se pudo completar la búsqueda web para "${query}"`,
      error: error instanceof Error ? error.message : 'SDK_UNAVAILABLE',
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
