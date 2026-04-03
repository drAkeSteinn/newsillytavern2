import { NextResponse } from 'next/server';

/**
 * POST /api/embeddings/reset - Delete ALL embeddings and namespaces
 */
export async function POST() {
  try {
    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    const result = await LanceDBWrapper.resetAll();

    return NextResponse.json({
      success: true,
      data: {
        deletedEmbeddings: result.deletedEmbeddings,
        deletedNamespaces: result.deletedNamespaces,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error resetting embeddings' }, { status: 500 });
  }
}
