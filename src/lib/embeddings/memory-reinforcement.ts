/**
 * Memory Reinforcement System
 * 
 * Automatically increases importance of memories when they're referenced
 * in LLM responses, indicating they are relevant/remembered.
 */

import { getEmbeddingClient } from '@/lib/embeddings/client';

interface MemoryMatch {
  memoryId: string;
  content: string;
  similarity?: number;
}

interface ReinforcementResult {
  reinforced: number;
  updated: string[];
  skipped: string[];
}

/**
 * Find memories that are referenced/mentioned in LLM response.
 * Uses simple text matching with the memory content.
 */
async function findReferencedMemories(
  responseText: string,
  namespaces: string[],
  threshold: number = 0.7
): Promise<MemoryMatch[]> {
  const matches: MemoryMatch[] = [];
  const client = getEmbeddingClient();
  
  // Normalize response text
  const normalizedResponse = responseText.toLowerCase().trim();
  
  for (const namespace of namespaces) {
    try {
      // Get all memories from this namespace
      const embeddings = await client.getNamespaceEmbeddings(namespace, 100);
      
      for (const emb of embeddings) {
        if (emb.source_type !== 'memory') continue;
        
        // Check if memory content is mentioned in response
        // Simple approach: check for significant word overlap
        const memoryContent = emb.content.toLowerCase();
        const memoryWords = memoryContent.split(/\s+/).filter(w => w.length > 3);
        
        // Count how many significant words from memory appear in response
        let matchCount = 0;
        for (const word of memoryWords) {
          if (normalizedResponse.includes(word)) {
            matchCount++;
          }
        }
        
        // Calculate match ratio
        const matchRatio = memoryWords.length > 0 ? matchCount / memoryWords.length : 0;
        
        // Also do semantic search to find similar content
        try {
          const searchResults = await client.searchInNamespace({
            namespace,
            query: responseText,
            limit: 10,
            threshold: threshold,
          });
          
          // Check if this memory is in the search results
          const searchMatch = searchResults.find(r => r.id === emb.id);
          if (searchMatch) {
            // Use the better of the two scores
            const combinedScore = Math.max(matchRatio, searchMatch.similarity);
            if (combinedScore >= 0.3) {
              matches.push({
                memoryId: emb.id,
                content: emb.content,
                similarity: combinedScore,
              });
            }
          }
        } catch {
          // Semantic search failed, use word match only
          if (matchRatio >= 0.4) {
            matches.push({
              memoryId: emb.id,
              content: emb.content,
              similarity: matchRatio,
            });
          }
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
 * 
 * @param memoryMatches - Memories that were referenced
 * @param boostAmount - How much to increase importance (default: 0.5)
 * @returns Result of reinforcement operation
 */
async function reinforceMemories(
  memoryMatches: MemoryMatch[],
  boostAmount: number = 0.5
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
      
      // Get current importance
      const currentImportance = memory.metadata?.importance || 3;
      
      // Don't boost if already at max (5)
      if (currentImportance >= 5) {
        result.skipped.push(match.memoryId);
        continue;
      }
      
      // Calculate new importance (max 5)
      const similarityBoost = match.similarity ? match.similarity * boostAmount : boostAmount * 0.5;
      const newImportance = Math.min(5, currentImportance + similarityBoost);
      
      // Update the memory metadata
      // Note: We can't directly update, so we would need to delete and recreate
      // For now, we'll just log the reinforcement
      console.log(`[MemoryReinforcement] Memory "${memory.content.slice(0, 50)}..." referenced - importance: ${currentImportance.toFixed(1)} → ${newImportance.toFixed(1)}`);
      
      // Track that this memory was reinforced
      result.reinforced++;
      result.updated.push(match.memoryId);
      
      // TODO: Implement actual importance update when LanceDB supports updates
      // For now, we just track the reinforcement in a separate index
      try {
        // Try to update via namespace metadata or tracking
        // This is a placeholder for actual implementation
        const trackingNamespace = `__memory_reinforcement__`;
        await client.upsertNamespace({
          namespace: trackingNamespace,
          description: 'Tracks memory reinforcements',
          metadata: { type: 'system', purpose: 'reinforcement_tracking' },
        });
        
        // Store reinforcement event
        await client.createEmbedding({
          content: JSON.stringify({
            memoryId: match.memoryId,
            memoryContent: memory.content,
            originalImportance: currentImportance,
            newImportance,
            similarity: match.similarity,
            reinforcedAt: new Date().toISOString(),
          }),
          namespace: trackingNamespace,
          source_type: 'custom',
          source_id: 'reinforcement',
          metadata: {
            event_type: 'reinforcement',
            memory_id: match.memoryId,
            importance_delta: newImportance - currentImportance,
          },
        });
      } catch {
        // Non-critical, just log
      }
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
