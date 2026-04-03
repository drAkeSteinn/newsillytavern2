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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      namespaces,
      llmConfig,
      settings = {},
    } = body;

    if (!namespaces || !Array.isArray(namespaces) || namespaces.length === 0) {
      return NextResponse.json({ error: 'Missing required field: namespaces (array)' }, { status: 400 });
    }

    if (!llmConfig || !llmConfig.provider) {
      return NextResponse.json({ error: 'Missing required field: llmConfig.provider' }, { status: 400 });
    }

    // Dynamic import to avoid loading heavy modules at startup
    const { consolidateMemories, DEFAULT_CONSOLIDATION_SETTINGS } = await import('@/lib/embeddings/memory-consolidation');

    const fullSettings = {
      ...DEFAULT_CONSOLIDATION_SETTINGS,
      ...settings,
    };

    const result = await consolidateMemories(namespaces, llmConfig, fullSettings);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[consolidate-memory] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Memory consolidation failed' }, { status: 500 });
  }
}
