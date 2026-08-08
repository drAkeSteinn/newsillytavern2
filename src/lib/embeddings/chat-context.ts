/**
 * Embeddings Chat Context Retrieval
 *
 * Provides utilities for automatically retrieving relevant embeddings
 * during chat and injecting them as context into the LLM prompt.
 *
 * Results are SPLIT into two categories:
 * - Non-memory (lore, world, rules, events) → injected before chat history (first)
 * - Memory (auto-extracted facts, source_type='memory') → injected before chat history (second)
 *
 * Both are injected before chat history in this order:
 *   [CONTEXTO RELEVANTE] → [MEMORIA RELEVANTE] → [Historial del chat]
 *
 * Used by /api/chat/stream, /api/chat/group-stream, and /api/chat/regenerate routes.
 */

import type { PromptSection, EmbeddingsChatSettings } from '@/types';
import { getEmbeddingClient } from './client';
import { loadConfig, getModelContextLength } from './config-persistence';
import { LanceDBWrapper } from './lancedb-db';
import type { SearchResult } from './types';
import { CHARS_PER_TOKEN } from './types';

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
  /** Non-memory context string (lore, world, rules) — goes before chat history (first) */
  nonMemoryContextString: string;
  /** Non-memory prompt section for prompt viewer — goes before chat history (first) */
  nonMemorySection: PromptSection | null;
  /** Non-memory count */
  nonMemoryCount: number;
  /** Non-memory type groups: type → count */
  nonMemoryTypeGroups: Record<string, number>;

  // --- Memory (auto-extracted, source_type='memory') ---
  /** Memory context string — goes before chat history (second) */
  memoryContextString: string;
  /** Memory prompt section for prompt viewer — goes before chat history (second) */
  memorySection: PromptSection | null;
  /** Memory count */
  memoryCount: number;
  /** Memory type groups: type → count */
  memoryTypeGroups: Record<string, number>;
  /** User memory count (sujeto=usuario or sujeto=otro) */
  userMemoryCount: number;
  /** Character memory count (sujeto=personaje or missing) */
  characterMemoryCount: number;

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
    userMemoryCount: 0,
    characterMemoryCount: 0,
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
 * @param groupId - The group ID (for group strategy)
 * @param existingMemoryEvents - Character Memory events from Zustand store, used to deduplicate memory-type embeddings
 * @returns EmbeddingsContextResult with separate non-memory and memory sections
 */
export async function retrieveEmbeddingsContext(
  userMessage: string,
  characterId?: string,
  sessionId?: string,
  settings?: Partial<EmbeddingsChatSettings>,
  groupId?: string,
  existingMemoryEvents?: Array<{ content: string; importance: number }>,
  lastAssistantMessage?: string,  // NEW parameter for bidirectional search
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
    // Character/group embeddingNamespaces are AUGMENTED on top of the strategy namespaces,
    // not replaced. This way the session memory and character lore namespaces are always
    // searched, plus any additional specialized namespaces the user assigns.
    const strategyNamespaces = getNamespacesForStrategy(
      settings.namespaceStrategy || 'character',
      characterId,
      sessionId,
      groupId,
    );
    const customNamespaces = settings.customNamespaces;
    const namespaceSet = new Set(strategyNamespaces);
    if (customNamespaces && customNamespaces.length > 0) {
      for (const ns of customNamespaces) {
        namespaceSet.add(ns);
      }
    }
    const namespaces = Array.from(namespaceSet);

    if (namespaces.length === 0) {
      return emptyResult();
    }

    // Smart truncation: calculate max chars based on the embedding model's context window.
    // Use 75% of the model's context as safe budget (same as ollama-client.ts).
    // Priority: config.modelContextLength (auto-detected) > hardcoded map > default (512)
    const embeddingModel = config.model || 'bge-m3:567m';
    const modelContextTokens = getModelContextLength();
    const safeTokenBudget = Math.floor(modelContextTokens * 0.75);
    const maxSearchQueryChars = Math.floor(safeTokenBudget * CHARS_PER_TOKEN);

    const searchQuery = userMessage.length > maxSearchQueryChars
      ? userMessage.slice(0, maxSearchQueryChars)
      : userMessage;

    if (userMessage.length > maxSearchQueryChars) {
      console.warn(
        `[Embeddings] Search query truncated from ${userMessage.length} to ${maxSearchQueryChars} chars ` +
        `(model: ${embeddingModel}, context: ${modelContextTokens} tokens)`
      );
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
            query: searchQuery,
            limit: maxResults * 2,
            threshold,
          });
        } else {
          results = await client.searchInNamespace({
            namespace: ns,
            query: searchQuery,
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

    // Bidirectional search: Also search with the last assistant message
    // This captures memories relevant to what the character was talking about,
    // even when the user's message is short or context-dependent (e.g., "Sí", "Claro")
    if (lastAssistantMessage && lastAssistantMessage.trim().length > 20) {
      // Truncate assistant query to avoid context-length errors
      let assistantQuery = lastAssistantMessage.trim();
      if (assistantQuery.length > maxSearchQueryChars) {
        assistantQuery = assistantQuery.slice(0, maxSearchQueryChars);
        console.warn(
          `[Embeddings] Assistant search query truncated to ${maxSearchQueryChars} chars`
        );
      }
      const assistantThreshold = Math.min(threshold + 0.1, 1.0);  // Cap at 1.0 to avoid disabling search
      for (const ns of namespaces) {
        try {
          let results: SearchResult[];
          if (ns === '*') {
            results = await client.searchSimilar({
              query: assistantQuery,
              limit: Math.ceil(maxResults / 2),  // Smaller limit for secondary search
              threshold: assistantThreshold,
            });
          } else {
            results = await client.searchInNamespace({
              namespace: ns,
              query: assistantQuery,
              limit: Math.ceil(maxResults / 2),
              threshold: assistantThreshold,
            });
          }

          for (const r of results) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              allResults.push(r);
            }
          }
        } catch (err) {
          console.warn(`[Embeddings] Assistant search failed for namespace "${ns}":`, err);
        }
      }
    }

    if (allResults.length === 0) {
      return emptyResult();
    }

    // Sort by similarity (highest first)
    allResults.sort((a, b) => b.similarity - a.similarity);

    // Apply composite scoring: combine similarity with importance
    // This ensures highly important memories get a boost even if they're slightly less similar
    allResults.forEach(r => {
      const importance = (r.metadata as Record<string, any>)?.importance || 3;
      // Importance boost: +0.02 per importance level above 3, -0.02 per level below
      // This is subtle enough not to override semantic relevance but gives important memories an edge
      const importanceBoost = (importance - 3) * 0.02;
      // Only boost memory-type embeddings (lore/world content uses flat importance)
      if (r.source_type === 'memory') {
        r.similarity = Math.min(1.0, r.similarity + importanceBoost);
      }
    });

    // Re-sort after composite scoring
    allResults.sort((a, b) => b.similarity - a.similarity);

    // Filter out the LATEST summary embedding — it's injected separately as [RECUERDOS ANTERIORES]
    // to avoid duplication. OLD summaries (is_latest=false or no is_latest flag) are KEPT
    // so they can be found via semantic search for long-term recall.
    // Filter BEFORE slicing so we don't lose non-summary results that rank just below summaries.
    const nonLatestSummaryResults = allResults.filter(r => {
      if (r.source_type !== 'summary') return true; // Keep all non-summary results
      // For summary-type: only keep if it's NOT the latest one
      const isLatest = (r.metadata as Record<string, any>)?.is_latest;
      return !isLatest; // Exclude latest summary (injected directly), keep old ones
    });
    let trimmed = nonLatestSummaryResults.slice(0, maxResults);

    // If we hit the max results limit, prefer higher importance memories
    if (trimmed.length >= maxResults) {
      // Sort by importance (desc) as tiebreaker, then similarity
      trimmed.sort((a, b) => {
        const impA = (a.metadata as Record<string, any>)?.importance || 3;
        const impB = (b.metadata as Record<string, any>)?.importance || 3;
        if (impB !== impA) return impB - impA;
        return b.similarity - a.similarity;
      });
      trimmed = trimmed.slice(0, maxResults);
    }

    // Deduplicate: Remove memory-type embeddings that overlap with existing Character Memory events.
    // Only memory-type (source_type='memory') results are deduplicated — lore/world content is never filtered.
    if (existingMemoryEvents && existingMemoryEvents.length > 0) {
      const eventContents = existingMemoryEvents.map(e => e.content.toLowerCase().trim());
      const beforeCount = trimmed.filter(r => r.source_type === 'memory').length;

      trimmed = trimmed.filter(r => {
        if (r.source_type !== 'memory') return true; // Only deduplicate memory-type embeddings

        const embeddingContent = r.content.toLowerCase().trim();

        for (const eventContent of eventContents) {
          // Calculate word-level overlap (words longer than 3 chars to avoid stop-word noise)
          const eventWords = new Set(eventContent.split(/\s+/).filter(w => w.length > 3));
          const embeddingWords = new Set(embeddingContent.split(/\s+/).filter(w => w.length > 3));

          if (eventWords.size === 0 || embeddingWords.size === 0) continue;

          let overlapCount = 0;
          for (const word of embeddingWords) {
            if (eventWords.has(word)) overlapCount++;
          }

          const overlapRatio = overlapCount / Math.max(eventWords.size, embeddingWords.size);

          // If >60% word overlap, consider it a duplicate and skip
          if (overlapRatio > 0.6) {
            console.log(`[Dedup] Skipping duplicate embedding: "${r.content.slice(0, 60)}..." (overlaps with Character Memory, ratio=${overlapRatio.toFixed(2)})`);
            return false;
          }
        }

        return true;
      });

      const afterCount = trimmed.filter(r => r.source_type === 'memory').length;
      if (beforeCount !== afterCount) {
        console.log(`[Dedup] Removed ${beforeCount - afterCount} duplicate memory embedding(s) (Character Memory overlap)`);
      }
    }

    // Load namespace info to get types for grouping
    const namespaceTypes = await getNamespaceTypesMap(trimmed);

    // SPLIT results: memory (source_type='memory') vs non-memory (everything else)
    const nonMemoryResults = trimmed.filter(r => r.source_type !== 'memory');
    const memoryResults = trimmed.filter(r => r.source_type === 'memory');

    // Give each category half the token budget (memory gets slightly more as it's more actionable)
    const nonMemoryBudget = Math.floor(maxBudget * 0.45);
    const memoryBudget = Math.floor(maxBudget * 0.55);

    // Build grouped context strings for non-memory
    const nonMemory = buildGroupedContextString(nonMemoryResults, namespaceTypes, nonMemoryBudget, 'CONTEXTO RELEVANTE');

    // Split memory results by subject
    const userMemories = memoryResults.filter(r => {
      const subject = (r.metadata as Record<string, any>)?.memory_subject;
      return subject === 'usuario' || subject === 'otro';
    });
    const characterMemories = memoryResults.filter(r => {
      const subject = (r.metadata as Record<string, any>)?.memory_subject;
      return subject === 'personaje' || !subject; // Default: personaje for backward compat
    });

    // Split budget 50/50
    const userBudget = Math.floor(memoryBudget * 0.5);
    const charBudget = memoryBudget - userBudget;

    const userCtx = buildGroupedContextString(userMemories, namespaceTypes, userBudget, 'MEMORIA DEL USUARIO');
    const charCtx = buildGroupedContextString(characterMemories, namespaceTypes, charBudget, 'MEMORIA DEL PERSONAJE');

    // Combine memory with [MEMORIA RELEVANTE] wrapper
    // Only build if at least one section has content
    const hasUserMemory = userCtx.contextString.trim().length > 0;
    const hasCharMemory = charCtx.contextString.trim().length > 0;
    let memoryContextString = '';
    if (hasUserMemory || hasCharMemory) {
      const memoryParts: string[] = ['[MEMORIA RELEVANTE]'];
      if (hasUserMemory) memoryParts.push('', userCtx.contextString);
      if (hasCharMemory) memoryParts.push('', charCtx.contextString);
      memoryContextString = memoryParts.join('\n');
    }
    const memoryTypeGroups = { ...userCtx.typeGroups, ...charCtx.typeGroups };

    if (!nonMemory.contextString.trim() && !memoryContextString.trim()) {
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

    const memorySection: PromptSection | null = memoryContextString.trim()
      ? {
          type: 'memory',
          label: 'MEMORIA',
          content: memoryContextString,
          color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
        }
      : null;

    // Build combined (legacy) for backward compat
    const allContextParts: string[] = [];
    if (nonMemory.contextString.trim()) allContextParts.push(nonMemory.contextString);
    if (memoryContextString.trim()) allContextParts.push(memoryContextString);
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
      memoryContextString,
      memorySection: showInViewer ? memorySection : null,
      memoryCount: memoryResults.length,
      memoryTypeGroups,
      userMemoryCount: userMemories.length,
      characterMemoryCount: characterMemories.length,

      // Legacy
      contextString: combinedContextString,
      section: showInViewer ? combinedSection : null,
      typeGroups: { ...nonMemory.typeGroups, ...memoryTypeGroups },
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
 * IMPORTANT: Only searches namespaces explicitly configured. No hardcoded
 * 'default', 'world', or 'world-building' namespaces are included unless
 * the character/group card explicitly lists them in embeddingNamespaces.
 *
 * Always includes:
 *   - memory-character-{characterId}-{sessionId} (session-scoped memories)
 *   - character-{characterId} (character lore/knowledge)
 *
 * Plus any namespaces configured in the character/group card's embeddingNamespaces.
 * The character/group embeddingNamespaces are passed via settings.customNamespaces.
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

    case 'character':
    case 'session': {
      const ns: string[] = [];
      // ALWAYS include: session-specific MEMORY namespace (memories extracted from chat)
      if (characterId && sessionId) ns.push(`memory-character-${characterId}-${sessionId}`);
      if (groupId && sessionId) ns.push(`memory-group-${groupId}-${sessionId}`);
      // ALWAYS include: character/group lore namespace (manually created content)
      if (characterId) ns.push(`character-${characterId}`);
      if (groupId) ns.push(`group-${groupId}`);
      // NO hardcoded 'default', 'world', 'world-building' — only search what's configured.
      // Character/group card namespaces are passed via settings.customNamespaces and merged
      // by the calling code in retrieveEmbeddingsContext().
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
  userMemoryCount: number;
  characterMemoryCount: number;
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
    userMemoryCount: result.userMemoryCount,
    characterMemoryCount: result.characterMemoryCount,
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
