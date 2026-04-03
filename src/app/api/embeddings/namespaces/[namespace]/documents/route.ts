import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/namespaces/[namespace]/documents - List documents in a namespace
 * DELETE /api/embeddings/namespaces/[namespace]/documents - Delete all embeddings in namespace (clear documents)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ namespace: string }> }
) {
  try {
    const { namespace } = await params;
    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');

    const embeddings = await LanceDBWrapper.getNamespaceEmbeddings(namespace, 1000);

    // Group by source_id to get "documents"
    const docMap = new Map<string, {
      source_id: string;
      source_type: string;
      count: number;
      firstChunk: string;
      created_at: string;
      ids: string[];
    }>();

    for (const emb of embeddings) {
      const docId = emb.source_id || emb.id;
      const existing = docMap.get(docId);
      if (existing) {
        existing.count++;
        existing.ids.push(emb.id);
      } else {
        docMap.set(docId, {
          source_id: docId,
          source_type: emb.source_type || 'custom',
          count: 1,
          firstChunk: typeof emb.content === 'string' ? emb.content.slice(0, 200) : '',
          created_at: emb.created_at instanceof Date ? emb.created_at.toISOString() : String(emb.created_at),
          ids: [emb.id],
        });
      }
    }

    const documents = Array.from(docMap.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      data: {
        namespace,
        documents,
        totalDocuments: documents.length,
        totalEmbeddings: embeddings.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error listing documents',
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ namespace: string }> }
) {
  try {
    const { namespace } = await params;
    const body = await request.json().catch(() => ({}));
    const { source_id } = body;
    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');

    if (source_id) {
      // Delete specific document
      await LanceDBWrapper.deleteBySource(source_id, namespace);
      return NextResponse.json({ success: true, message: `Document "${source_id}" deleted` });
    }

    // Delete all embeddings in namespace
    const embeddings = await LanceDBWrapper.getNamespaceEmbeddings(namespace, 10000);
    for (const emb of embeddings) {
      try { await LanceDBWrapper.deleteEmbedding(emb.id); } catch { /* skip */ }
    }

    return NextResponse.json({
      success: true,
      message: `All embeddings in namespace "${namespace}" deleted`,
      deletedCount: embeddings.length,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error deleting documents',
    }, { status: 500 });
  }
}
