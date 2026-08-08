/**
 * Memory Consolidation for Embeddings
 *
 * When a namespace accumulates too many embeddings, this module
 * intelligently consolidates them to keep the context relevant:
 *
 * Architecture:
 *   1. Check namespace count using lightweight count method (no vectors loaded)
 *   2. Load ONLY metadata (id, content, metadata) — skip vector data
 *   3. Rank embeddings by importance + recency
 *   4. Keep high-importance and recent memories intact (protected zone)
 *   5. Group older/low-importance memories by type using LLM
 *   6. Replace grouped memories with concise consolidated summaries
 *   7. Delete the originals that were consolidated
 *
 * OPTIMIZED: Never loads full vector data into memory.
 * Uses countByNamespaceAndSourceType() for threshold checks and
 * getNamespaceEmbeddingsMetadata() for metadata-only access.
 * This reduces memory usage from ~160MB (10K × 16KB vectors)
 * to ~2MB (10K × ~200B metadata).
 */

import { generateResponse } from '@/lib/llm/generation';
import type { LLMConfig, ChatApiMessage } from '@/lib/llm/types';
import { getEmbeddingClient } from '@/lib/embeddings/client';
import { getModelContextLength } from '@/lib/embeddings/config-persistence';
import { CHARS_PER_TOKEN } from './types';

// ============================================
// Types
// ============================================

export interface ConsolidationResult {
  /** Whether consolidation was performed */
  consolidated: boolean;
  /** Number of embeddings before consolidation */
  beforeCount: number;
  /** Number of embeddings after consolidation */
  afterCount: number;
  /** Number of original memories that were removed */
  removedCount: number;
  /** Number of new consolidated memories created */
  createdCount: number;
  /** Namespaces that were consolidated */
  namespaces: string[];
}

export interface ConsolidationSettings {
  /** Enable auto-consolidation after extraction */
  enabled: boolean;
  /** Trigger consolidation when namespace exceeds this count (default: 50) */
  threshold: number;
  /** Keep the N most recent memories untouched (default: 10) */
  keepRecent: number;
  /** Keep all memories with importance >= this value (default: 4) */
  keepHighImportance: number;
  /** Max number of old memories to consolidate in one pass (default: 20) */
  batchSize: number;
}

const DEFAULT_CONSOLIDATION_SETTINGS: ConsolidationSettings = {
  enabled: false,
  threshold: 50,
  keepRecent: 10,
  keepHighImportance: 4,
  batchSize: 20,
};

// ============================================
// Consolidation Prompt
// ============================================

const CONSOLIDATION_PROMPT = `Eres un consolidador de memoria para un personaje de rol. Tu tarea es COMBINAR varios hechos individuales en un resumen conciso que capture la esencia de todos ellos.

Reglas estrictas:
- Combina hechos relacionados o similares en una sola frase
- Preserva toda la información IMPORTANTE (nombres, lugares, eventos, relaciones)
- El resumen debe estar en tercera persona
- Máximo 3 frases por grupo, cada frase máximo 40 palabras
- Si los hechos son contradictorios, conserva la versión más reciente
- Mantén el mismo nivel de importancia o superior al promedio del grupo
- NO inventes información nueva
- NO uses viñetas ni formatos especiales

Responde SOLO con un JSON array, sin explicaciones, sin markdown.

Formato:
[{{"contenido":"resumen combinado","tipo":"tipo dominante","importancia":N}}]

Ahora consolida estos hechos del grupo "{groupName}":

{factsList}`;

// ============================================
// Core: Consolidate a Single Namespace
// ============================================

/**
 * Consolidate memories in a single namespace.
 *
 * OPTIMIZED: Uses lightweight metadata-only queries instead of loading
 * full vector data. This reduces memory usage by ~98%.
 *
 * Strategy:
 * 1. Count memory embeddings using lightweight count method
 * 2. Load ONLY metadata (no vectors) for sorting and partitioning
 * 3. Separate into protected (recent + high importance) and candidates
 * 4. Group candidates by memory_type
 * 5. Ask LLM to consolidate each group
 * 6. Save consolidated embeddings, delete originals
 */
async function consolidateNamespace(
  namespace: string,
  llmConfig: LLMConfig,
  settings: ConsolidationSettings,
): Promise<{ removed: number; created: number }> {
  const client = getEmbeddingClient();

  // Step 1: Count memory embeddings using lightweight method (no vectors loaded)
  const memoryCount = await client.countByNamespaceAndSourceType(namespace, 'memory');

  if (memoryCount <= settings.threshold) {
    return { removed: 0, created: 0 };
  }

  console.log(`[Consolidation] Namespace "${namespace}" has ${memoryCount} memory embeddings (threshold: ${settings.threshold})`);

  // Step 2: Load only metadata (no vectors!) for sorting and partitioning
  const memoryEmbeddings = await client.getNamespaceEmbeddingsMetadata(namespace, {
    limit: 10000,
    sourceType: 'memory',
  });

  if (memoryEmbeddings.length <= settings.threshold) {
    return { removed: 0, created: 0 };
  }

  // Step 3: Sort by importance (desc) then by recency (desc)
  const sorted = [...memoryEmbeddings].sort((a, b) => {
    const impA = a.metadata?.importance || 3;
    const impB = b.metadata?.importance || 3;
    if (impB !== impA) return impB - impA; // Higher importance first

    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA; // More recent first
  });

  // Step 4: Separate protected vs candidates
  const protectedList: typeof sorted = [];
  const candidates: typeof sorted = [];

  for (const emb of sorted) {
    const importance = emb.metadata?.importance || 3;
    const isRecent = protectedList.length < settings.keepRecent;
    const isHighImportance = importance >= settings.keepHighImportance;

    if (isRecent || isHighImportance) {
      protectedList.push(emb);
    } else {
      candidates.push(emb);
    }
  }

  if (candidates.length < 3) {
    console.log(`[Consolidation] Only ${candidates.length} candidates in "${namespace}" — not enough to consolidate`);
    return { removed: 0, created: 0 };
  }

  // Step 5: Group candidates by memory_type
  const groups: Record<string, typeof candidates> = {};
  for (const emb of candidates) {
    const type = emb.metadata?.memory_type || 'otro';
    if (!groups[type]) groups[type] = [];
    groups[type].push(emb);
  }

  // Step 6: Consolidate each group (limit batch size)
  let totalRemoved = 0;
  let totalCreated = 0;

  for (const [type, group] of Object.entries(groups)) {
    // Take up to batchSize memories from this group
    const batch = group.slice(0, settings.batchSize);
    if (batch.length < 2) continue;

    try {
      const consolidated = await consolidateGroup(batch, type, namespace, llmConfig);
      if (consolidated.length > 0) {
        // Delete originals
        const idsToDelete = batch.map(e => e.id);
        for (const id of idsToDelete) {
          try { await client.deleteEmbedding(id); } catch { /* skip */ }
        }
        totalRemoved += batch.length;

        // Save consolidated memories
        for (const fact of consolidated) {
          try {
            await client.createEmbedding({
              content: fact.contenido,
              namespace,
              source_type: 'memory',
              source_id: 'consolidated',
              metadata: {
                importance: fact.importancia,
                memory_type: fact.tipo,
                consolidated_at: new Date().toISOString(),
                consolidated_from: batch.length,
                character_id: batch[0].metadata?.character_id,
                is_consolidated: true,
              },
            });
            totalCreated++;
          } catch (err) {
            console.warn('[Consolidation] Failed to save consolidated memory:', err);
          }
        }
      }
    } catch (err) {
      console.warn(`[Consolidation] Failed to consolidate group "${type}" in "${namespace}":`, err);
    }
  }

  console.log(`[Consolidation] "${namespace}": removed ${totalRemoved}, created ${totalCreated}`);
  return { removed: totalRemoved, created: totalCreated };
}

// ============================================
// Core: Consolidate a Group of Memories
// ============================================

/**
 * Use LLM to consolidate a group of related memories into fewer,
 * more concise summaries.
 */
async function consolidateGroup(
  embeddings: Array<{ content: string; metadata: { importance?: number; memory_type?: string; [key: string]: unknown } }>,
  groupName: string,
  namespace: string,
  llmConfig: LLMConfig,
): Promise<Array<{ contenido: string; tipo: string; importancia: number }>> {
  const factsList = embeddings
    .map((e, i) => `${i + 1}. [${e.metadata?.memory_type || 'otro'}] (imp:${e.metadata?.importance || 3}) ${e.content}`)
    .join('\n');

  // Truncate the facts list to fit within the embedding model's context window.
  // The consolidation prompt + facts will be sent to the LLM, but the resulting
  // consolidated memories will be re-embedded, so we keep the input within bounds.
  const modelContextTokens = getModelContextLength();
  const maxFactsChars = Math.floor(modelContextTokens * CHARS_PER_TOKEN * 0.6); // 60% budget for facts
  const truncatedFactsList = factsList.length > maxFactsChars
    ? factsList.slice(0, maxFactsChars)
    : factsList;

  const prompt = CONSOLIDATION_PROMPT
    .replace('{groupName}', `${groupName} (${namespace})`)
    .replace('{factsList}', truncatedFactsList);

  try {
    const extractionConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: 0.1,
        maxTokens: 512,
      },
    };

    const chatMessages: ChatApiMessage[] = [
      { role: 'assistant', content: 'Eres un consolidador de memoria. Responde SOLO con JSON.' },
      { role: 'user', content: prompt },
    ];

    const result = await generateResponse(
      llmConfig.provider,
      chatMessages,
      extractionConfig,
      'MemoryConsolidator'
    );

    // Parse the result using the same robust parser from memory-extraction
    const { extractFactsFromLLMOutput } = await import('./memory-extraction');
    const facts = extractFactsFromLLMOutput(result.message || '');

    // Ensure we actually reduced the count (consolidation should produce fewer items)
    if (facts.length >= embeddings.length) {
      console.log(`[Consolidation] LLM returned ${facts.length} facts for ${embeddings.length} inputs — no reduction, skipping`);
      return [];
    }

    return facts;
  } catch (error) {
    console.warn('[Consolidation] LLM consolidation failed:', error);
    return [];
  }
}

// ============================================
// Public API
// ============================================

/**
 * Check if a namespace needs consolidation.
 * OPTIMIZED: Uses lightweight count method (no vector data loaded).
 */
export async function needsConsolidation(
  namespace: string,
  settings: ConsolidationSettings = DEFAULT_CONSOLIDATION_SETTINGS,
): Promise<boolean> {
  if (!settings.enabled) return false;

  // Count only memory embeddings using lightweight method
  const client = getEmbeddingClient();
  const memoryCount = await client.countByNamespaceAndSourceType(namespace, 'memory');
  return memoryCount > settings.threshold;
}

/**
 * Consolidate memories across multiple namespaces.
 * This is the main entry point.
 *
 * OPTIMIZED: Uses lightweight count and metadata methods throughout.
 */
export async function consolidateMemories(
  namespaces: string[],
  llmConfig: LLMConfig,
  settings: ConsolidationSettings = DEFAULT_CONSOLIDATION_SETTINGS,
): Promise<ConsolidationResult> {
  const emptyResult: ConsolidationResult = {
    consolidated: false,
    beforeCount: 0,
    afterCount: 0,
    removedCount: 0,
    createdCount: 0,
    namespaces: [],
  };

  if (!settings.enabled || namespaces.length === 0 || !llmConfig) {
    return emptyResult;
  }

  const client = getEmbeddingClient();

  let totalBefore = 0;
  let totalAfter = 0;
  let totalRemoved = 0;
  let totalCreated = 0;
  const processedNamespaces: string[] = [];

  for (const namespace of namespaces) {
    try {
      // Count only memory embeddings using lightweight method (no vectors loaded)
      const memoryCount = await client.countByNamespaceAndSourceType(namespace, 'memory');
      if (memoryCount <= settings.threshold) continue;

      totalBefore += memoryCount;
      processedNamespaces.push(namespace);

      const { removed, created } = await consolidateNamespace(namespace, llmConfig, settings);
      totalRemoved += removed;
      totalCreated += created;

      // Re-count after consolidation
      const afterMemoryCount = await client.countByNamespaceAndSourceType(namespace, 'memory');
      totalAfter += afterMemoryCount;
    } catch (err) {
      console.warn(`[Consolidation] Failed to consolidate namespace "${namespace}":`, err);
    }
  }

  return {
    consolidated: totalRemoved > 0,
    beforeCount: totalBefore,
    afterCount: totalAfter,
    removedCount: totalRemoved,
    createdCount: totalCreated,
    namespaces: processedNamespaces,
  };
}

/**
 * Auto-consolidate after memory extraction.
 * Checks the target namespace and consolidates if needed.
 *
 * OPTIMIZED: Uses lightweight count method for threshold check.
 */
export async function autoConsolidateAfterExtraction(
  namespace: string,
  llmConfig: LLMConfig,
  settings?: Partial<ConsolidationSettings>,
): Promise<ConsolidationResult | null> {
  const fullSettings: ConsolidationSettings = {
    ...DEFAULT_CONSOLIDATION_SETTINGS,
    ...settings,
  };

  if (!fullSettings.enabled) return null;

  // Count only memory embeddings using lightweight method
  const client = getEmbeddingClient();
  const currentMemoryCount = await client.countByNamespaceAndSourceType(namespace, 'memory');

  if (currentMemoryCount <= fullSettings.threshold) return null;

  console.log(`[Consolidation] Auto-consolidation triggered for "${namespace}" (${currentMemoryCount}/${fullSettings.threshold})`);

  return consolidateMemories([namespace], llmConfig, fullSettings);
}

export { DEFAULT_CONSOLIDATION_SETTINGS };
