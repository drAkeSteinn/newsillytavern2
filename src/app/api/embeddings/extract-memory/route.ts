import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/extract-memory
 *
 * Extracts memorable facts from the last assistant message using LLM,
 * then saves them as embeddings for future context retrieval.
 *
 * After extraction, optionally triggers auto-consolidation if the
 * namespace exceeds the configured threshold.
 *
 * This endpoint is called ASYNC from chat routes (fire-and-forget).
 * It should NOT block the chat response.
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
    } = body;

    if (!lastMessage || !characterName || !characterId) {
      return NextResponse.json({ error: 'Missing required fields: lastMessage, characterName, characterId' }, { status: 400 });
    }

    // Dynamic import to avoid loading heavy modules at startup
    const { extractAndSaveMemories } = await import('@/lib/embeddings/memory-extraction');

    const result = await extractAndSaveMemories(
      lastMessage,
      characterName,
      characterId,
      sessionId || '',
      llmConfig,
      { groupId, minImportance, customPrompt }
    );

    // Auto-consolidation: check if namespace needs consolidation after saving
    let consolidationResult = null;
    if (result.saved > 0 && consolidationSettings?.enabled && llmConfig) {
      try {
        const { autoConsolidateAfterExtraction } = await import('@/lib/embeddings/memory-consolidation');
        consolidationResult = await autoConsolidateAfterExtraction(
          result.namespace,
          llmConfig,
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
