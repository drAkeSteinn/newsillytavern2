/**
 * Embeddings Chat Context Retrieval
 *
 * Provides utilities for automatically retrieving relevant embeddings
 * during chat and injecting them as context into the LLM prompt.
 *
 * Results are SPLIT into two categories:
 * - Non-memory (lore, world, rules, events) → injected into system prompt
 * - Memory (auto-extracted facts, source_type='memory') → injected before chat history
 *
 * This separation leverages recency primacy: static knowledge (lore) goes with
 * the character definition, while dynamic memories go near the conversation.
 *
 * Used by /api/chat/stream, /api/chat/group-stream, and /api/chat/regenerate routes.
 */

import type { PromptSection, EmbeddingsChatSettings } from '@/types';
import { getEmbeddingClient } from './client';
import { loadConfig } from './config-persistence';
import { LanceDBWrapper } from './lancedb-db';
import type { SearchResult } from './types';

/** Result of embeddings context retrieval — split into non-memory and memory */
export interface EmbeddingsContextResult {
  /** Whether any embeddings were found */
  found: boolean;
  /** Total number of embeddings retrieved */
  count: number;
  /** The raw search results for UI display */
  results: SearchResult[];
  /** Namespaces that were searched */
  searchedNamespaces: string[];

  // --- Non-memory (lore, world, rules, events) ---
  /** Non-memory context string (lore, world, rules) — goes into system prompt */
  nonMemoryContextString: string;
  /** Non-memory prompt section for prompt viewer — goes into system sections */
  nonMemorySection: PromptSection | null;
  /** Non-memory count */
  nonMemoryCount: number;
  /** Non-memory type groups: type → count */
  nonMemoryTypeGroups: Record<string, number>;

  // --- Memory (auto-extracted, source_type='memory') ---
  /** Memory context string — goes before chat history */
  memoryContextString: string;
  /** Memory prompt section for prompt viewer — goes before chat history */
  memorySection: PromptSection | null;
  /** Memory count */
  memoryCount: number;
  /** Memory type groups: type → count */
  memoryTypeGroups: Record<string, number>;

  // --- Legacy fields (combined, for backward compat) ---
  /** Combined context string (all results) */
  contextString: string;
  /** Combined prompt section */
  section: PromptSection | null;
  /** Combined type groups */
  typeGroups?: Record<string, number>;
}

/** Create an empty result */
function emptyResult(): EmbeddingsContextResult {
  return {
    found: false,
    count: 0,
    results: [],
    searchedNamespaces: [],
    nonMemoryContextString: '',
    nonMemorySection: null,
    nonMemoryCount: 0,
    nonMemoryTypeGroups: {},
    memoryContextString: '',
    memorySection: null,
    memoryCount: 0,
    memoryTypeGroups: {},
    contextString: '',
    section: null,
    typeGroups: {},
  };
}

/**
 * Retrieve embeddings context for a chat message.
 *
 * Searches relevant namespaces based on the configured strategy,
 * splits results into non-memory and memory, builds grouped context
 * strings for each, and returns separate PromptSections.
 *
 * @param userMessage - The user's current message (used as search query)
 * @param characterId - The active character's ID (for character strategy)
 * @param sessionId - The active session's ID (for session strategy)
 * @param settings - EmbeddingsChatSettings from the store
 * @returns EmbeddingsContextResult with separate non-memory and memory sections
 */
export async function retrieveEmbeddingsContext(
  userMessage: string,
  characterId?: string,
  sessionId?: string,
  settings?: Partial<EmbeddingsChatSettings>,
  groupId?: string,
): Promise<EmbeddingsContextResult> {
  if (!settings?.enabled) {
    return emptyResult();
  }

  if (!userMessage.trim()) {
    return emptyResult();
  }

  try {
    const client = getEmbeddingClient();
    const config = loadConfig();

    // Determine namespaces to search based on strategy
    const customNamespaces = settings.customNamespaces;
    const namespaces = (customNamespaces && customNamespaces.length > 0)
      ? customNamespaces
      : getNamespacesForStrategy(
          settings.namespaceStrategy || 'character',
          characterId,
          sessionId,
          groupId,
        );

    if (namespaces.length === 0) {
      return emptyResult();
    }

    // Search each namespace (with deduplication)
    const maxResults = config.maxResults || 5;
    const threshold = config.similarityThreshold || 0.5;
    const maxBudget = settings.maxTokenBudget || 1024;

    const seenIds = new Set<string>();
    const allResults: SearchResult[] = [];

    for (const ns of namespaces) {
      try {
        let results: SearchResult[];
        if (ns === '*') {
          results = await client.searchSimilar({
            query: userMessage,
            limit: maxResults * 2,
            threshold,
          });
        } else {
          results = await client.searchInNamespace({
            namespace: ns,
            query: userMessage,
            limit: maxResults,
            threshold,
          });
        }

        for (const r of results) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allResults.push(r);
          }
        }
      } catch (err) {
        console.warn(`[Embeddings] Search failed for namespace "${ns}":`, err);
      }
    }

    if (allResults.length === 0) {
      return emptyResult();
    }

    // Sort by similarity (highest first)
    allResults.sort((a, b) => b.similarity - a.similarity);
    const trimmed = allResults.slice(0, maxResults);

    // Load namespace info to get types for grouping
    const namespaceTypes = await getNamespaceTypesMap(trimmed);

    // SPLIT results: memory (source_type='memory') vs non-memory (everything else)
    const nonMemoryResults = trimmed.filter(r => r.source_type !== 'memory');
    const memoryResults = trimmed.filter(r => r.source_type === 'memory');

    // Give each category half the token budget (memory gets slightly more as it's more actionable)
    const nonMemoryBudget = Math.floor(maxBudget * 0.45);
    const memoryBudget = Math.floor(maxBudget * 0.55);

    // Build grouped context strings for each category
    const nonMemory = buildGroupedContextString(nonMemoryResults, namespaceTypes, nonMemoryBudget, 'CONTEXTO RELEVANTE');
    const memory = buildGroupedContextString(memoryResults, namespaceTypes, memoryBudget, 'MEMORIA DEL PERSONAJE');

    if (!nonMemory.contextString.trim() && !memory.contextString.trim()) {
      return emptyResult();
    }

    const showInViewer = settings.showInPromptViewer !== false;

    // Build separate PromptSections
    const nonMemorySection: PromptSection | null = nonMemory.contextString.trim()
      ? {
          type: 'context',
          label: 'CONTEXTO',
          content: nonMemory.contextString,
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        }
      : null;

    const memorySection: PromptSection | null = memory.contextString.trim()
      ? {
          type: 'memory',
          label: 'MEMORIA',
          content: memory.contextString,
          color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
        }
      : null;

    // Build combined (legacy) for backward compat
    const allContextParts: string[] = [];
    if (nonMemory.contextString.trim()) allContextParts.push(nonMemory.contextString);
    if (memory.contextString.trim()) allContextParts.push(memory.contextString);
    const combinedContextString = allContextParts.join('\n\n');

    const combinedSection: PromptSection | null = combinedContextString.trim()
      ? {
          type: 'memory',
          label: 'CONTEXTO',
          content: combinedContextString,
          color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
        }
      : null;

    return {
      found: true,
      count: trimmed.length,
      results: trimmed,
      searchedNamespaces: namespaces,

      // Non-memory
      nonMemoryContextString: nonMemory.contextString,
      nonMemorySection: showInViewer ? nonMemorySection : null,
      nonMemoryCount: nonMemoryResults.length,
      nonMemoryTypeGroups: nonMemory.typeGroups,

      // Memory
      memoryContextString: memory.contextString,
      memorySection: showInViewer ? memorySection : null,
      memoryCount: memoryResults.length,
      memoryTypeGroups: memory.typeGroups,

      // Legacy
      contextString: combinedContextString,
      section: showInViewer ? combinedSection : null,
      typeGroups: { ...nonMemory.typeGroups, ...memory.typeGroups },
    };
  } catch (error) {
    console.error('[Embeddings] Context retrieval failed:', error);
    return emptyResult();
  }
}

/**
 * Build a map of namespace name → type string by loading all namespaces from DB.
 */
async function getNamespaceTypesMap(results: SearchResult[]): Promise<Record<string, string>> {
  try {
    const allNamespaces = await LanceDBWrapper.getAllNamespaces();
    const typeMap: Record<string, string> = {};

    const uniqueNamespaces = new Set<string>();
    for (const r of results) {
      if (r.namespace) uniqueNamespaces.add(r.namespace);
    }

    for (const ns of allNamespaces) {
      if (uniqueNamespaces.has(ns.namespace)) {
        const type = (ns.metadata as Record<string, any>)?.type;
        if (type && typeof type === 'string' && type.trim()) {
          typeMap[ns.namespace] = type.trim().toUpperCase();
        }
      }
    }

    return typeMap;
  } catch (err) {
    console.warn('[Embeddings] Could not load namespace types for grouping:', err);
    return {};
  }
}

/**
 * Determine which namespaces to search based on the configured strategy.
 *
 * Memory namespaces now include sessionId:
 *   - character-{characterId}-{sessionId}
 *   - group-{groupId}-{sessionId}
 *
 * So we search BOTH the session-specific AND the generic namespace to cover
 * memories from the current session and any manually created embeddings.
 */
function getNamespacesForStrategy(
  strategy: EmbeddingsChatSettings['namespaceStrategy'],
  characterId?: string,
  sessionId?: string,
  groupId?: string,
): string[] {
  switch (strategy) {
    case 'global':
      return ['*'];

    case 'character': {
      const ns: string[] = [];
      // Session-specific memory namespaces (primary — memories from this session)
      if (characterId && sessionId) ns.push(`character-${characterId}-${sessionId}`);
      if (groupId && sessionId) ns.push(`group-${groupId}-${sessionId}`);
      // Also search the generic character/group namespace for manually created lore
      if (characterId) ns.push(`character-${characterId}`);
      if (groupId) ns.push(`group-${groupId}`);
      // Always include common lore/world namespaces
      ns.push('default', 'world', 'world-building');
      return ns;
    }

    case 'session': {
      const ns: string[] = [];
      // Session-specific namespaces (primary)
      if (characterId && sessionId) ns.push(`character-${characterId}-${sessionId}`);
      if (groupId && sessionId) ns.push(`group-${groupId}-${sessionId}`);
      if (sessionId) ns.push(`session-${sessionId}`);
      // Also search generic namespaces for manually created content
      if (characterId) ns.push(`character-${characterId}`);
      if (groupId) ns.push(`group-${groupId}`);
      ns.push('default', 'world');
      return ns;
    }

    default:
      return ['*'];
  }
}

/**
 * Build a grouped context string from search results.
 * Results are grouped by their namespace type (if available).
 *
 * @param header - The main header label (e.g. 'CONTEXTO RELEVANTE' or 'MEMORIA DEL PERSONAJE')
 */
function buildGroupedContextString(
  results: SearchResult[],
  namespaceTypes: Record<string, string>,
  maxTokenBudget: number,
  header: string
): { contextString: string; typeGroups: Record<string, number> } {
  const maxChars = maxTokenBudget * 4;

  // Group results by type
  const groups = new Map<string, SearchResult[]>();
  const ungrouped: SearchResult[] = [];

  for (const result of results) {
    const type = namespaceTypes[result.namespace];
    if (type) {
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(result);
    } else {
      ungrouped.push(result);
    }
  }

  const typeGroups: Record<string, number> = {};
  const parts: string[] = [];
  let totalChars = 0;

  // Main header
  const headerLine = `[${header}]`;
  parts.push(headerLine);
  totalChars += headerLine.length + 2;

  // Add each typed group
  for (const [type, typeResults] of groups) {
    const groupHeader = `[${type}]`;
    const headerLen = groupHeader.length + 2;
    const entries: string[] = [];

    let groupChars = 0;
    for (const result of typeResults) {
      const entry = `- ${result.content}`;
      if (totalChars + headerLen + groupChars + entry.length + 2 > maxChars) {
        break;
      }
      entries.push(entry);
      groupChars += entry.length + 2;
    }

    if (entries.length > 0) {
      parts.push(`${groupHeader}\n${entries.join('\n')}`);
      totalChars += headerLen + groupChars;
      typeGroups[type] = entries.length;
    }
  }

  // Add ungrouped results
  if (ungrouped.length > 0) {
    const entries: string[] = [];
    for (const result of ungrouped) {
      const entry = `- ${result.content}`;
      if (totalChars + entry.length + 2 > maxChars) {
        break;
      }
      entries.push(entry);
      totalChars += entry.length + 2;
    }

    if (entries.length > 0) {
      if (groups.size > 0) {
        const groupHeader = '[OTRO CONTEXTO]';
        parts.push(`${groupHeader}\n${entries.join('\n')}`);
        totalChars += groupHeader.length + 2;
        typeGroups['OTRO CONTEXTO'] = entries.length;
      } else {
        // No types — simple list (no sub-header needed, main header already exists)
        parts.push(entries.join('\n'));
        typeGroups['SIN TIPO'] = entries.length;
      }
    }
  }

  if (parts.length <= 1) return { contextString: '', typeGroups: {} };

  return {
    contextString: parts.join('\n\n'),
    typeGroups,
  };
}

/**
 * Extract embeddings metadata from a context result for SSE transmission.
 */
export function formatEmbeddingsForSSE(result: EmbeddingsContextResult): {
  count: number;
  namespaces: string[];
  nonMemoryCount: number;
  memoryCount: number;
  nonMemoryTypeGroups: Record<string, number>;
  memoryTypeGroups: Record<string, number>;
  topResults: Array<{
    content: string;
    similarity: number;
    namespace: string;
    source_type?: string;
  }>;
} | null {
  if (!result.found) return null;

  return {
    count: result.count,
    namespaces: result.searchedNamespaces,
    nonMemoryCount: result.nonMemoryCount,
    memoryCount: result.memoryCount,
    nonMemoryTypeGroups: result.nonMemoryTypeGroups,
    memoryTypeGroups: result.memoryTypeGroups,
    topResults: result.results.slice(0, 5).map(r => ({
      content: r.content.slice(0, 200),
      similarity: r.similarity,
      namespace: r.namespace,
      source_type: r.source_type,
    })),
  };
}
