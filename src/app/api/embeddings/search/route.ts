import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/search - Vector similarity search
 * 
 * Always uses the configured embedding model from persisted config.
 * The frontend sends the model name explicitly as a safety check.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.query && !body.queryVector) {
      return NextResponse.json({ error: 'query o queryVector es requerido' }, { status: 400 });
    }

    // Load persisted config to get the correct model, threshold, etc.
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const config = getConfig();

    // Ensure the model from persisted config is used
    const modelToUse = config.model || body.model || 'bge-m3:567m';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    const dimension = config.dimension || 1024;

    // If the frontend sent a model but it differs from persisted config, 
    // log a warning but use the persisted config model
    if (body.model && body.model !== modelToUse) {
      console.warn(`[embeddings/search] Frontend sent model "${body.model}" but persisted config has "${modelToUse}". Using persisted config model.`);
    }

    // Get the embedding client with the correct config
    const { getEmbeddingClient, resetEmbeddingClient } = await import('@/lib/embeddings/client');

    // Always reset the client before search to ensure it uses the latest config
    resetEmbeddingClient({
      ollamaUrl,
      model: modelToUse,
      dimension,
      similarityThreshold: config.similarityThreshold,
      maxResults: config.maxResults,
    });

    const client = getEmbeddingClient();
    const results = await client.searchSimilar({
      query: body.query,
      queryVector: body.queryVector,
      namespace: body.namespace,
      limit: body.limit || config.maxResults || 10,
      threshold: body.threshold ?? config.similarityThreshold ?? 0,
      source_type: body.source_type,
      source_id: body.source_id,
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: results.length,
        meta: {
          model: modelToUse,
          threshold: body.threshold ?? config.similarityThreshold ?? 0,
          limit: body.limit || config.maxResults || 10,
          namespace: body.namespace || 'all',
        },
      },
    });
  } catch (error: any) {
    console.error('[embeddings/search] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al buscar embeddings',
    }, { status: 500 });
  }
}
