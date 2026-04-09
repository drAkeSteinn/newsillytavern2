/**
 * Advanced Semantic Search for Embeddings
 * 
 * Provides enhanced search capabilities with:
 * - Multi-stage retrieval (broad → narrow)
 * - Reranking by relevance
 * - Context expansion
 * - Temporal decay
 * - Diversity boosting
 */

import { getEmbeddingClient } from '@/lib/embeddings/client';
import type { SearchResult } from '@/lib/embeddings/types';

export interface AdvancedSearchOptions {
  /** Search query */
  query: string;
  /** Namespaces to search */
  namespaces: string[];
  /** Maximum results to return */
  limit?: number;
  /** Base similarity threshold */
  threshold?: number;
  /** Include memories older than N days (0 = no limit) */
  maxAgeDays?: number;
  /** Minimum importance filter (1-5) */
  minImportance?: number;
  /** Memory types to filter (e.g., ['hecho', 'evento']) */
  memoryTypes?: string[];
  /** Expand context by searching related concepts */
  expandContext?: boolean;
  /** Number of expansion terms */
  expansionTerms?: number;
  /** Boost recent memories */
  temporalBoost?: boolean;
  /** Boost diverse results (avoid redundancy) */
  diversityBoost?: boolean;
}

export interface AdvancedSearchResult {
  results: SearchResult[];
  searchedNamespaces: string[];
  totalFound: number;
  expandedTerms?: string[];
  metadata: {
    queryTimeMs: number;
    namespacesSearched: number;
    initialResults: number;
    rerankedResults: number;
  };
}

/**
 * Multi-stage search: broad search → rerank → diversify
 */
export async function advancedSemanticSearch(
  options: AdvancedSearchOptions
): Promise<AdvancedSearchResult> {
  const startTime = Date.now();
  
  const {
    query,
    namespaces,
    limit = 20,
    threshold = 0.3,
    maxAgeDays = 0,
    minImportance,
    memoryTypes,
    expandContext = false,
    expansionTerms = 3,
    temporalBoost = true,
    diversityBoost = true,
  } = options;

  if (!query?.trim() || namespaces.length === 0) {
    return {
      results: [],
      searchedNamespaces: namespaces,
      totalFound: 0,
      metadata: {
        queryTimeMs: Date.now() - startTime,
        namespacesSearched: namespaces.length,
        initialResults: 0,
        rerankedResults: 0,
      },
    };
  }

  const client = getEmbeddingClient();
  let expandedTerms: string[] | undefined;
  let searchQueries = [query];

  // Stage 1: Context Expansion
  if (expandContext) {
    try {
      // Search for conceptually similar terms to expand query
      const expansionSearch = await client.searchSimilar({
        query,
        namespace: namespaces[0], // Use first namespace for expansion
        limit: expansionTerms,
        threshold: 0.5,
      });

      // Extract unique terms from results that could expand the search
      const termsSet = new Set<string>();
      for (const result of expansionSearch) {
        const words = result.content
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4 && !query.toLowerCase().includes(w));
        words.slice(0, 2).forEach(w => termsSet.add(w));
      }

      expandedTerms = Array.from(termsSet).slice(0, expansionTerms);
      if (expandedTerms.length > 0) {
        // Create expanded queries
        searchQueries = [
          query,
          ...expandedTerms.map(term => `${query} ${term}`),
        ];
      }
    } catch (err) {
      console.warn('[AdvancedSearch] Context expansion failed:', err);
    }
  }

  // Stage 2: Broad Search across all queries and namespaces
  const allResults = new Map<string, SearchResult>();
  const seenContent = new Set<string>();

  for (const sq of searchQueries) {
    for (const ns of namespaces) {
      try {
        const results = await client.searchInNamespace({
          namespace: ns,
          query: sq,
          limit: limit,
          threshold,
        });

        for (const result of results) {
          // Skip if we've seen similar content
          const contentKey = result.content.toLowerCase().slice(0, 50);
          if (seenContent.has(contentKey)) continue;
          seenContent.add(contentKey);

          // Apply filters
          if (memoryTypes && memoryTypes.length > 0) {
            const resultType = result.metadata?.memory_type;
            if (!resultType || !memoryTypes.includes(resultType)) continue;
          }

          if (minImportance !== undefined) {
            const importance = result.metadata?.importance || 3;
            if (importance < minImportance) continue;
          }

          if (maxAgeDays > 0) {
            const createdAt = new Date(result.metadata?.created_at || 0);
            const daysOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld > maxAgeDays) continue;
          }

          // Use best score if already exists
          const existing = allResults.get(result.id);
          if (!existing || result.similarity > existing.similarity) {
            allResults.set(result.id, result);
          }
        }
      } catch (err) {
        console.warn(`[AdvancedSearch] Search failed for namespace "${ns}":`, err);
      }
    }
  }

  let results = Array.from(allResults.values());

  // Stage 3: Temporal Boost (favor recent memories)
  if (temporalBoost) {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    
    results = results.map(r => {
      const createdAt = new Date(r.metadata?.created_at || 0).getTime();
      const daysOld = (now - createdAt) / dayMs;
      
      // Exponential decay: memory halves in value every 7 days
      const temporalFactor = Math.pow(0.9, daysOld / 7);
      
      // Boost score by temporal factor
      const boostedScore = r.similarity * (0.5 + 0.5 * temporalFactor);
      
      return { ...r, similarity: boostedScore };
    });
  }

  // Stage 4: Reranking by multiple factors
  results = rerankResults(results, {
    temporalBoost,
    diversityBoost,
    limit,
  });

  // Stage 5: Final limit
  results = results.slice(0, limit);

  return {
    results,
    searchedNamespaces: namespaces,
    totalFound: results.length,
    expandedTerms,
    metadata: {
      queryTimeMs: Date.now() - startTime,
      namespacesSearched: namespaces.length,
      initialResults: allResults.size,
      rerankedResults: results.length,
    },
  };
}

/**
 * Rerank results considering multiple signals
 */
function rerankResults(
  results: SearchResult[],
  options: {
    temporalBoost: boolean;
    diversityBoost: boolean;
    limit: number;
  }
): SearchResult[] {
  // Score each result with a composite score
  const scored = results.map(r => {
    let compositeScore = r.similarity;
    
    // Importance boost
    const importance = r.metadata?.importance || 3;
    compositeScore += (importance - 3) * 0.05; // ±0.1 based on importance
    
    // Recency boost (if not already applied via temporal)
    if (!options.temporalBoost) {
      const createdAt = new Date(r.metadata?.created_at || 0).getTime();
      const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysOld < 1) compositeScore += 0.1; // Recent boost
      else if (daysOld < 7) compositeScore += 0.05;
    }
    
    // Memory type bonus
    const memoryType = r.metadata?.memory_type;
    if (memoryType === 'hecho') compositeScore += 0.02;
    else if (memoryType === 'evento') compositeScore += 0.01;
    
    return { result: r, score: compositeScore };
  });

  // Diversity boost: penalize similar content
  if (options.diversityBoost) {
    const selected: SearchResult[] = [];
    const selectedContent = new Set<string>();
    
    // Sort by composite score
    scored.sort((a, b) => b.score - a.score);
    
    for (const { result, score } of scored) {
      // Create content signature
      const words = result.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const signature = words.slice(0, 5).join(' ');
      
      // Check diversity: reduce score if similar content already selected
      let diversityPenalty = 0;
      for (const selectedContent of selected.map(r => r.content.toLowerCase())) {
        const overlap = words.filter(w => selectedContent.includes(w)).length;
        diversityPenalty += overlap / words.length * 0.1;
      }
      
      const finalScore = score - diversityPenalty;
      
      if (selected.length < options.limit) {
        selected.push({ ...result, similarity: finalScore });
      }
    }
    
    return selected;
  }

  // No diversity boost: just sort by score
  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => ({ ...s.result, similarity: s.score }));
}

/**
 * Quick search with sensible defaults
 */
export async function quickSearch(
  query: string,
  namespaces: string[],
  options?: {
    limit?: number;
    memoryTypes?: string[];
  }
): Promise<SearchResult[]> {
  const result = await advancedSemanticSearch({
    query,
    namespaces,
    limit: options?.limit || 10,
    threshold: 0.35,
    memoryTypes: options?.memoryTypes,
    expandContext: false,
    temporalBoost: true,
    diversityBoost: true,
  });
  
  return result.results;
}
