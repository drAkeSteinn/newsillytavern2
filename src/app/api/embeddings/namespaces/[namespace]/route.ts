import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/embeddings/namespaces/[namespace] - Delete a namespace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ namespace: string }> }
) {
  try {
    const { namespace } = await params;
    if (!namespace) {
      return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
    }

    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');

    // First delete all embeddings in this namespace
    const embeddings = await LanceDBWrapper.getNamespaceEmbeddings(namespace, 10000);
    let deletedEmbeddings = 0;
    for (const emb of embeddings) {
      try {
        await LanceDBWrapper.deleteEmbedding(emb.id);
        deletedEmbeddings++;
      } catch { /* skip */ }
    }

    // Then delete the namespace itself
    await LanceDBWrapper.deleteNamespace(namespace);

    return NextResponse.json({
      success: true,
      message: `Namespace "${namespace}" deleted`,
      deletedEmbeddings,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error deleting namespace' }, { status: 500 });
  }
}
