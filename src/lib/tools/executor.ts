// ============================================
// Tool Executor - Executes tool calls using z-ai-web-dev-sdk
// ============================================

import type { ToolCall, ToolCallResult } from './types';

/**
 * Execute a single tool call and return the result.
 * All tool execution happens server-side using z-ai-web-dev-sdk.
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
  const { id, name, arguments: args } = toolCall;

  try {
    let result: string;

    switch (name) {
      case 'search_web': {
        result = await executeSearchWeb(args);
        break;
      }

      default: {
        return {
          toolCallId: id,
          toolName: name,
          success: false,
          result: '',
          error: `Herramienta desconocida: ${name}`,
        };
      }
    }

    return {
      toolCallId: id,
      toolName: name,
      success: true,
      result,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido ejecutando herramienta';
    console.error(`[Tool Executor] Error executing ${name}:`, errorMsg);
    return {
      toolCallId: id,
      toolName: name,
      success: false,
      result: '',
      error: errorMsg,
    };
  }
}

/**
 * Execute multiple tool calls in parallel.
 */
export async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
  console.log(`[Tool Executor] Executing ${toolCalls.length} tool call(s):`, 
    toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 80)}...)`));
  
  const results = await Promise.all(toolCalls.map(executeToolCall));
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[Tool Executor] Completed: ${successCount}/${results.length} successful`);
  
  return results;
}

/**
 * search_web implementation using z-ai-web-dev-sdk
 */
async function executeSearchWeb(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  const maxResults = Math.min(Math.max((args.max_results as number) || 5, 1), 10);

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query es requerido para search_web');
  }

  console.log(`[Tool Executor] Searching web: "${query}" (max: ${maxResults})`);

  try {
    const ZAI = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.default.create();

    const results = await zai.functions.invoke('web_search', {
      query: query.trim(),
      num: maxResults,
    });

    if (!Array.isArray(results) || results.length === 0) {
      return 'No se encontraron resultados para la búsqueda.';
    }

    // Format results for the LLM
    const formatted = results
      .map((r: { name?: string; url?: string; snippet?: string; date?: string; host_name?: string }, i: number) => {
        const title = r.name || 'Sin título';
        const url = r.url || '';
        const snippet = r.snippet || '';
        const date = r.date || '';
        
        let line = `${i + 1}. **${title}**`;
        if (url) line += `\n   URL: ${url}`;
        if (date) line += `\n   Fecha: ${date}`;
        if (snippet) line += `\n   ${snippet}`;
        return line;
      })
      .join('\n\n');

    return `Resultados de búsqueda para "${query}":\n\n${formatted}`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error en búsqueda web: ${msg}`);
  }
}
