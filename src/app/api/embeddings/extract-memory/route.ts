import { NextRequest, NextResponse } from 'next/server';

/**
 * Mapping from MemoryType (Spanish, from LLM extraction) to MemoryEvent type (English, for client store).
 */
const MEMORY_TYPE_TO_EVENT_TYPE: Record<string, string> = {
  hecho: 'fact',
  evento: 'event',
  relacion: 'relationship',
  preferencia: 'fact',
  secreto: 'fact',
  otro: 'emotion',
};

/**
 * POST /api/embeddings/extract-memory
 *
 * Extracts memorable facts from the last assistant message using LLM,
 * then saves them as embeddings for future context retrieval.
 *
 * Returns `memoryActivations` array for each saved fact so the client
 * can sync them to Character Memory (Zustand store).
 *
 * After extraction, optionally triggers auto-consolidation if the
 * namespace exceeds the configured threshold.
 *
 * Supports a separate extraction model: if `extractionModelConfig` is
 * provided with `extractionModelEnabled: true`, the extraction and
 * consolidation will use that model instead of the chat model.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      lastMessage,
      characterName,
      characterId,
      sessionId,
      groupId,
      llmConfig,
      minImportance = 2,
      consolidationSettings,
      customPrompt,
      chatContext,
      userName,
      extractionModelConfig, // New: separate extraction model config
      extractFromUser,  // Also extract from the user's last message
      lastUserMessage,  // The last user message content
    } = body;

    if (!lastMessage || !characterName || !characterId) {
      return NextResponse.json({ error: 'Missing required fields: lastMessage, characterName, characterId' }, { status: 400 });
    }

    // Dynamic import to avoid loading heavy modules at startup
    const { extractAndSaveMemories, buildExtractionLlmConfig } = await import('@/lib/embeddings/memory-extraction');

    // Build the LLM config for extraction (uses separate model if configured)
    const extractionLlmConfig = buildExtractionLlmConfig(llmConfig, extractionModelConfig);

    if (extractionModelConfig?.extractionModelEnabled) {
      console.log(`[extract-memory] Using separate extraction model: ${extractionModelConfig.extractionModelProvider}/${extractionModelConfig.extractionModelName}`);
    }

    const result = await extractAndSaveMemories(
      lastMessage,
      characterName,
      characterId,
      sessionId || '',
      extractionLlmConfig, // Use extraction-specific config
      { groupId, minImportance, customPrompt, chatContext, userName }
    );

    // Build memoryActivations for client-side Character Memory sync
    // Each saved fact gets a corresponding memoryActivation with the embedding ID
    const memoryActivations: Array<{
      type: 'save_memory';
      characterId: string;
      eventData: {
        id: string;
        type: string;
        content: string;
        importance: number;
        embeddingId: string;
        sessionId: string;
      };
    }> = [];

    if (result.savedFacts && result.savedFacts.length > 0 && result.embeddingIds.length > 0) {
      for (let i = 0; i < result.savedFacts.length && i < result.embeddingIds.length; i++) {
        const fact = result.savedFacts[i];
        const embeddingId = result.embeddingIds[i];
        memoryActivations.push({
          type: 'save_memory',
          characterId,
          eventData: {
            id: `mem_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
            type: MEMORY_TYPE_TO_EVENT_TYPE[fact.tipo] || 'fact',
            content: fact.contenido,
            importance: fact.importancia,
            embeddingId,
            sessionId: sessionId || '',
          },
        });
      }
    }

    // Optionally extract memories from the last user message too
    let userMemoryResult = null;
    if (extractFromUser && lastUserMessage && lastUserMessage.trim().length > 20) {
      try {
        const { extractMemories: extractUserMemories, saveMemoriesAsEmbeddings } = await import('@/lib/embeddings/memory-extraction');
        const { DEFAULT_USER_MEMORY_EXTRACTION_PROMPT } = await import('@/lib/embeddings/memory-extraction-prompts');
        
        const userFacts = await extractUserMemories(
          lastUserMessage,
          characterName,
          extractionLlmConfig,
          DEFAULT_USER_MEMORY_EXTRACTION_PROMPT,  // Use the user-specific prompt, not the character one
          chatContext,
          userName,
        );
        
        if (userFacts.length > 0) {
          userMemoryResult = await saveMemoriesAsEmbeddings(
            userFacts,
            characterId,
            sessionId || '',
            groupId,
            minImportance,
          );
          
          // Add user memory activations
          if (userMemoryResult.savedFacts && userMemoryResult.savedFacts.length > 0 && userMemoryResult.embeddingIds.length > 0) {
            for (let i = 0; i < userMemoryResult.savedFacts.length && i < userMemoryResult.embeddingIds.length; i++) {
              const fact = userMemoryResult.savedFacts[i];
              const embeddingId = userMemoryResult.embeddingIds[i];
              memoryActivations.push({
                type: 'save_memory',
                characterId,
                eventData: {
                  id: `usermem_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
                  type: MEMORY_TYPE_TO_EVENT_TYPE[fact.tipo] || 'fact',
                  content: fact.contenido,
                  importance: fact.importancia,
                  embeddingId,
                  sessionId: sessionId || '',
                },
              });
            }
          }
          
          console.log(`[extract-memory] Extracted ${userMemoryResult.saved} memories from user message`);
        }
      } catch (userExtractErr) {
        console.warn('[extract-memory] User message extraction failed (non-blocking):', userExtractErr);
      }
    }

    // Auto-consolidation: check if namespace needs consolidation after saving
    // Also uses the extraction model if configured
    let consolidationResult = null;
    if (result.saved > 0 && consolidationSettings?.enabled && extractionLlmConfig) {
      try {
        const { autoConsolidateAfterExtraction } = await import('@/lib/embeddings/memory-consolidation');
        consolidationResult = await autoConsolidateAfterExtraction(
          result.namespace,
          extractionLlmConfig, // Use extraction model for consolidation too
          consolidationSettings,
        );
        if (consolidationResult?.consolidated) {
          console.log(`[extract-memory] Auto-consolidated "${result.namespace}": -${consolidationResult.removedCount} +${consolidationResult.createdCount}`);
        }
      } catch (consolidationErr) {
        // Don't fail the extraction if consolidation fails
        console.warn('[extract-memory] Auto-consolidation failed (non-blocking):', consolidationErr);
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      memoryActivations,
      ...(consolidationResult?.consolidated ? {
        consolidation: {
          removed: consolidationResult.removedCount,
          created: consolidationResult.createdCount,
        }
      } : {}),
    });
  } catch (error: any) {
    console.error('[extract-memory] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Memory extraction failed' }, { status: 500 });
  }
}
