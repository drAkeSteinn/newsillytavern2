// ============================================
// Tool Definitions - Available tools for the LLM
// ============================================

import type { ToolDefinition } from './types';

/**
 * search_web: Busca en internet y devuelve los resultados más relevantes.
 * Usa z-ai-web-dev-sdk para realizar la búsqueda real.
 */
export const searchWebTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Busca información en internet y devuelve los resultados más relevantes con títulos, URLs y descripciones. Úsala cuando el usuario pregunte sobre información actual, noticias, datos que no conoces, o necesites verificar algo en internet.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La consulta de búsqueda. Sé específico y detallado para mejores resultados.',
        },
        max_results: {
          type: 'number',
          description: 'Número máximo de resultados a devolver (1-10, default: 5)',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * All available tool definitions.
 * Add new tools here and enable them in ToolsSettings.
 */
export const ALL_TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  search_web: searchWebTool,
};

/**
 * Get tool definitions array for providers that accept tools array.
 * Only includes tools that are in the enabledTools list.
 */
export function getEnabledToolDefinitions(enabledTools: string[]): ToolDefinition[] {
  return enabledTools
    .filter(name => ALL_TOOL_DEFINITIONS[name])
    .map(name => ALL_TOOL_DEFINITIONS[name]);
}
