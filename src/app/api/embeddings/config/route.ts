import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/config - Get current embeddings config
 * PUT /api/embeddings/config - Update embeddings config
 */
export async function GET() {
  try {
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const config = getConfig();

    // Also return current LanceDB table dimension for UI comparison
    let tableDimension: number | null = null;
    try {
      const { getTableDimension } = await import('@/lib/embeddings/lancedb-db');
      tableDimension = getTableDimension();
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { ...config, tableDimension },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error loading config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if model or dimension changed — this affects LanceDB table schema
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const oldConfig = getConfig();
    const modelChanged = body.model && body.model !== oldConfig.model;
    const dimensionChanged = body.dimension && body.dimension !== oldConfig.dimension;
    const needTableReinit = modelChanged || dimensionChanged;

    const { saveConfig, invalidateConfigCache } = await import('@/lib/embeddings/config-persistence');
    invalidateConfigCache();

    const newConfig = saveConfig(body);

    // Reset the embedding client singleton so it picks up new config
    const { resetEmbeddingClient } = await import('@/lib/embeddings/client');
    resetEmbeddingClient(newConfig);

    // Force LanceDB reinit if model/dimension changed — this will auto-detect
    // dimension mismatch and recreate the table if needed
    let dimensionMismatch = false;
    let oldDimension: number | null = null;
    if (needTableReinit) {
      try {
        const { initLanceDB, getTableDimension } = await import('@/lib/embeddings/lancedb-db');
        oldDimension = getTableDimension();
        await initLanceDB(undefined, true);
        const newDimension = getTableDimension();
        dimensionMismatch = oldDimension !== null && oldDimension !== newDimension;
      } catch (e: any) {
        console.error('[embeddings/config] Error reinitializing LanceDB:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: newConfig,
      meta: {
        modelChanged,
        dimensionChanged,
        dimensionMismatch,
        oldDimension,
        newDimension: newConfig.dimension,
        note: dimensionMismatch
          ? `La tabla de embeddings fue recreada automáticamente (${oldDimension}D → ${newConfig.dimension}D). Los embeddings anteriores fueron eliminados.`
          : undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error saving config' }, { status: 500 });
  }
}
