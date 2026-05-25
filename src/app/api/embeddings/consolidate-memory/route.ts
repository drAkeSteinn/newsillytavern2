import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/consolidate-memory
 *
 * Consolidates memories in one or more namespaces by:
 * 1. Removing duplicate/low-value embeddings
 * 2. Grouping related memories and summarizing them with LLM
 * 3. Keeping high-importance and recent memories intact
 *
 * Can be called manually or triggered automatically after extraction.
 * Supports a separate extraction model for the consolidation LLM calls.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      namespaces,
      llmConfig,
      settings = {},
      extractionModelConfig, // New: separate extraction model config
    } = body;

    if (!namespaces || !Array.isArray(namespaces) || namespaces.length === 0) {
      return NextResponse.json({ error: 'Missing required field: namespaces (array)' }, { status: 400 });
    }

    // Dynamic import to avoid loading heavy modules at startup
    const { consolidateMemories, DEFAULT_CONSOLIDATION_SETTINGS } = await import('@/lib/embeddings/memory-consolidation');
    const { buildExtractionLlmConfig } = await import('@/lib/embeddings/memory-extraction');

    // Use separate extraction model if configured, otherwise use chat model
    const effectiveLlmConfig = buildExtractionLlmConfig(llmConfig, extractionModelConfig);

    if (!effectiveLlmConfig || !effectiveLlmConfig.provider) {
      return NextResponse.json({ error: 'Missing required field: llmConfig.provider' }, { status: 400 });
    }

    if (extractionModelConfig?.extractionModelEnabled) {
      console.log(`[consolidate-memory] Using separate extraction model: ${extractionModelConfig.extractionModelProvider}/${extractionModelConfig.extractionModelName}`);
    }

    const fullSettings = {
      ...DEFAULT_CONSOLIDATION_SETTINGS,
      ...settings,
    };

    const result = await consolidateMemories(namespaces, effectiveLlmConfig, fullSettings);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[consolidate-memory] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Memory consolidation failed' }, { status: 500 });
  }
}
