import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/batch - Create multiple embeddings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items is required and must be a non-empty array' }, { status: 400 });
    }

    if (body.items.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per batch' }, { status: 400 });
    }

    for (const item of body.items) {
      if (!item.content || typeof item.content !== 'string') {
        return NextResponse.json({ error: 'Each item must have a valid content field' }, { status: 400 });
      }
    }

    const { getEmbeddingClient } = await import('@/lib/embeddings/client');
    const client = getEmbeddingClient();
    const embeddingIds = await client.createBatchEmbeddings(body.items, body.namespace);

    return NextResponse.json({ success: true, data: { count: embeddingIds.length, ids: embeddingIds } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error creating batch embeddings' }, { status: 500 });
  }
}
