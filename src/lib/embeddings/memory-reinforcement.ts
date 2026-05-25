/**
 * Memory Reinforcement System
 * 
 * Automatically increases importance of memories when they're referenced
 * in LLM responses, indicating they are relevant/remembered.
 * 
 * OPTIMIZED: Uses a single semantic search per namespace instead of
 * O(n²) per-embedding search. This reduces from N+1 API calls per
 * namespace to just 1 call per namespace.
 */

import { getEmbeddingClient } from '@/lib/embeddings/client';

interface MemoryMatch {
  memoryId: string;
  content: string;
  similarity: number;
}

interface ReinforcementResult {
  reinforced: number;
  updated: string[];
  skipped: string[];
}

/**
 * Find memories that are referenced/mentioned in LLM response.
 * 
 * OPTIMIZED: Does a single semantic search per namespace using the response
 * text as the query, then applies word-overlap filtering. This replaces the
 * old O(n²) approach that did a separate search for EACH embedding.
 */
async function findReferencedMemories(
  responseText: string,
  namespaces: string[],
  threshold: number = 0.7
): Promise<MemoryMatch[]> {
  const matches: MemoryMatch[] = [];
  const client = getEmbeddingClient();
  
  // Normalize response text for word matching
  const normalizedResponse = responseText.toLowerCase().trim();
  
  for (const namespace of namespaces) {
    try {
      // Single semantic search using the response text as query
      const searchResults = await client.searchInNamespace({
        namespace,
        query: responseText,
        limit: 20, // Get top 20 most similar memories
        threshold: 0.3, // Lower threshold for initial retrieval, we'll filter more below
      });
      
      // Filter to only memory-type embeddings and apply stricter matching
      for (const result of searchResults) {
        if (result.source_type !== 'memory') continue;
        
        // Word overlap check: verify that significant words from the memory
        // actually appear in the response (prevents false positive matches)
        const memoryContent = result.content.toLowerCase();
        const memoryWords = memoryContent.split(/\s+/).filter(w => w.length > 3);
        let matchCount = 0;
        for (const word of memoryWords) {
          if (normalizedResponse.includes(word)) {
            matchCount++;
          }
        }
        const wordOverlapRatio = memoryWords.length > 0 ? matchCount / memoryWords.length : 0;
        
        // Combined score: semantic similarity weighted heavily, with word overlap as confirmation
        // If word overlap is high (>= 0.3), trust the semantic score
        // If word overlap is low, require higher semantic score
        const effectiveThreshold = wordOverlapRatio >= 0.3 
          ? threshold 
          : Math.max(threshold, 0.8); // Require very high semantic similarity if no word overlap
        
        if (result.similarity >= effectiveThreshold || wordOverlapRatio >= 0.5) {
          const combinedScore = Math.max(result.similarity, wordOverlapRatio);
          matches.push({
            memoryId: result.id,
            content: result.content,
            similarity: combinedScore,
          });
        }
      }
    } catch (err) {
      console.warn(`[MemoryReinforcement] Failed to check namespace "${namespace}":`, err);
    }
  }
  
  // Deduplicate by memoryId
  const seen = new Set<string>();
  return matches.filter(m => {
    if (seen.has(m.memoryId)) return false;
    seen.add(m.memoryId);
    return true;
  });
}

/**
 * Increase importance of memories that were referenced in the response.
 * Uses integer importance scale (1-5) for consistency with extraction.
 * 
 * @param memoryMatches - Memories that were referenced
 * @param boostAmount - How much to increase importance (default: 1, whole step)
 * @returns Result of reinforcement operation
 */
async function reinforceMemories(
  memoryMatches: MemoryMatch[],
  boostAmount: number = 1
): Promise<ReinforcementResult> {
  const result: ReinforcementResult = {
    reinforced: 0,
    updated: [],
    skipped: [],
  };
  
  if (memoryMatches.length === 0) {
    return result;
  }
  
  const client = getEmbeddingClient();
  
  for (const match of memoryMatches) {
    try {
      // Get current memory
      const memory = await client.getEmbedding(match.memoryId);
      if (!memory) {
        result.skipped.push(match.memoryId);
        continue;
      }
      
      // Get current importance (support both old float and new integer scales)
      const currentImportance = memory.metadata?.importance || 3;
      const normalizedImportance = currentImportance > 1 
        ? Math.round(currentImportance) 
        : Math.round(currentImportance * 5);
      
      // Don't boost if already at max (5)
      if (normalizedImportance >= 5) {
        result.skipped.push(match.memoryId);
        continue;
      }
      
      // Calculate new importance using integer steps (max 5)
      // Higher similarity = bigger boost
      const similarityFactor = match.similarity >= 0.9 ? 1.0 : match.similarity >= 0.7 ? 0.7 : 0.5;
      const boost = Math.round(boostAmount * similarityFactor);
      const newImportance = Math.min(5, normalizedImportance + Math.max(1, boost));
      
      // Update the memory via delete + recreate (preserving namespace and source)
      const updatedMetadata = {
        ...memory.metadata,
        importance: newImportance,
        last_reinforced_at: new Date().toISOString(),
      };
      
      await client.updateEmbedding(match.memoryId, memory.content, updatedMetadata);
      
      console.log(`[MemoryReinforcement] Memory "${memory.content.slice(0, 50)}..." referenced - importance: ${normalizedImportance} → ${newImportance}`);
      
      // Track that this memory was reinforced
      result.reinforced++;
      result.updated.push(match.memoryId);
    } catch (err) {
      console.warn(`[MemoryReinforcement] Failed to reinforce memory ${match.memoryId}:`, err);
      result.skipped.push(match.memoryId);
    }
  }
  
  return result;
}

/**
 * Main entry point: Check LLM response for memory references and reinforce them.
 * 
 * @param responseText - The LLM's response text
 * @param namespaces - Namespaces to search for memories
 * @param enableReinforcement - Whether reinforcement is enabled
 * @param threshold - Similarity threshold for matching (default: 0.7)
 */
export async function processResponseAndReinforceMemories(
  responseText: string,
  namespaces: string[],
  enableReinforcement: boolean = true,
  threshold: number = 0.7
): Promise<ReinforcementResult> {
  if (!enableReinforcement || !responseText?.trim()) {
    return { reinforced: 0, updated: [], skipped: [] };
  }
  
  // Minimum response length to check for reinforcement
  if (responseText.length < 50) {
    return { reinforced: 0, updated: [], skipped: [] };
  }
  
  console.log(`[MemoryReinforcement] Checking response (${responseText.length} chars) in ${namespaces.length} namespaces`);
  
  // Find referenced memories
  const matches = await findReferencedMemories(responseText, namespaces, threshold);
  
  console.log(`[MemoryReinforcement] Found ${matches.length} referenced memories`);
  
  if (matches.length === 0) {
    return { reinforced: 0, updated: [], skipped: [] };
  }
  
  // Reinforce the memories
  const result = await reinforceMemories(matches);
  
  console.log(`[MemoryReinforcement] Result: ${result.reinforced} reinforced, ${result.skipped.length} skipped`);
  
  return result;
}

/**
 * Check if memory reinforcement is enabled in settings.
 */
export function isReinforcementEnabled(embeddingsChat: {
  memoryReinforcementEnabled?: boolean;
  memoryReinforcementThreshold?: number;
}): boolean {
  return embeddingsChat?.memoryReinforcementEnabled === true;
}
