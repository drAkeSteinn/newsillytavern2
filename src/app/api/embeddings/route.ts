import { NextRequest, NextResponse } from 'next/server';
import { LanceDBWrapper } from '@/lib/embeddings/lancedb-db';

/**
 * GET /api/embeddings - List all embeddings with optional filters
 * Query params: namespace, source_type, source_id, limit
 * POST /api/embeddings - Create a single embedding
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const namespace = searchParams.get('namespace');
    const sourceType = searchParams.get('source_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);

    let embeddings;
    if (namespace) {
      embeddings = await LanceDBWrapper.getNamespaceEmbeddings(namespace, limit);
    } else {
      embeddings = await LanceDBWrapper.getAllEmbeddings(limit);
    }

    // Filter by source_type if specified
    if (sourceType) {
      embeddings = embeddings.filter((emb: any) => emb.source_type === sourceType);
    }

    const formatted = embeddings.map((emb: any) => ({
      id: emb.id,
      content: emb.content,
      metadata: emb.metadata || {},
      namespace: emb.namespace || 'default',
      source_type: emb.source_type,
      source_id: emb.source_id,
      created_at: emb.created_at instanceof Date ? emb.created_at.toISOString() : emb.created_at,
    }));

    return NextResponse.json({ success: true, data: { embeddings: formatted, total: formatted.length } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error listing embeddings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content is required and must be a string' }, { status: 400 });
    }

    if (body.content.trim().length === 0) {
      return NextResponse.json({ error: 'content cannot be empty' }, { status: 400 });
    }

    // Load persisted config to ensure the correct embedding model is used
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const persistedConfig = getConfig();

    const { getEmbeddingClient, resetEmbeddingClient } = await import('@/lib/embeddings/client');
    
    // Reset client to use persisted config model
    resetEmbeddingClient({
      ollamaUrl: persistedConfig.ollamaUrl,
      model: persistedConfig.model,
      dimension: persistedConfig.dimension,
    });

    const client = getEmbeddingClient();
    const embeddingId = await client.createEmbedding(body);

    return NextResponse.json({ success: true, data: { id: embeddingId } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error creating embedding' }, { status: 500 });
  }
}
