import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/[id] - Get a single embedding
 * DELETE /api/embeddings/[id] - Delete a single embedding
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    const embedding = await LanceDBWrapper.getEmbeddingById(id);

    if (!embedding) {
      return NextResponse.json({ error: 'Embedding not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: embedding });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error getting embedding' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    await LanceDBWrapper.deleteEmbedding(id);
    return NextResponse.json({ success: true, message: 'Embedding deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error deleting embedding' }, { status: 500 });
  }
}
