import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/create-from-file - Create embeddings from uploaded file
 * Splits text, generates vectors, stores in LanceDB
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      content,
      namespace,
      splitterType,
      chunkSize,
      chunkOverlap,
      source_type,
      source_id,
    } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (!namespace) {
      return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
    }

    if (!splitterType) {
      return NextResponse.json({ error: 'splitterType is required' }, { status: 400 });
    }

    // Load persisted config to use the correct embedding model
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const persistedConfig = getConfig();

    const { splitText, SPLITTER_INFO } = await import('@/lib/embeddings/splitters/text-splitter');
    const { getEmbeddingClient, resetEmbeddingClient } = await import('@/lib/embeddings/client');

    const splitterInfo = SPLITTER_INFO[splitterType as keyof typeof SPLITTER_INFO];
    const config = {
      chunkSize: chunkSize || splitterInfo?.defaultChunkSize || 1000,
      chunkOverlap: chunkOverlap || splitterInfo?.defaultOverlap || 200,
    };

    // Split text
    const splitResult = splitText(content, splitterType, config);

    if (splitResult.chunks.length === 0) {
      return NextResponse.json({ error: 'No se generaron fragmentos. Intenta aumentar el tamaño de fragmento.' }, { status: 400 });
    }

    // Reset the embedding client to ensure it uses the persisted config model
    resetEmbeddingClient({
      ollamaUrl: persistedConfig.ollamaUrl,
      model: persistedConfig.model,
      dimension: persistedConfig.dimension,
    });

    // Ensure the target namespace exists before creating embeddings
    const client = getEmbeddingClient();
    try {
      await client.upsertNamespace({ namespace });
    } catch {
      // Non-critical: embedding creation can still proceed
    }

    const docId = source_id || `${namespace}-${Date.now()}`;
    const createdIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < splitResult.chunks.length; i++) {
      try {
        const chunk = splitResult.chunks[i];
        const id = await client.createEmbedding({
          content: chunk,
          namespace,
          source_type: source_type || 'file',
          source_id: docId,
          metadata: {
            chunkIndex: i,
            totalChunks: splitResult.chunks.length,
            splitterType,
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap,
            fileName: source_id || 'upload',
          },
        });
        createdIds.push(id);
      } catch (e: any) {
        errors.push(`Chunk ${i}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        createdCount: createdIds.length,
        errorCount: errors.length,
        errors: errors.slice(0, 10),
        documentId: docId,
        namespace,
        totalChunks: splitResult.chunks.length,
        embeddingIds: createdIds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error creating embeddings',
    }, { status: 500 });
  }
}
