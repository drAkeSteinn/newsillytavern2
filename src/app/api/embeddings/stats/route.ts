import { NextResponse } from 'next/server';

/**
 * GET /api/embeddings/stats - Get embedding statistics
 */
export async function GET() {
  try {
    const { LanceDBWrapper, isLanceDBAvailable } = await import('@/lib/embeddings/lancedb-db');
    
    // Check if LanceDB is available before trying to get stats
    const availability = await isLanceDBAvailable();
    if (!availability.available) {
      return NextResponse.json({
        success: true,
        data: {
          totalEmbeddings: 0,
          totalNamespaces: 0,
          embeddingsByNamespace: {},
          embeddingsBySourceType: {},
          dbAvailable: false,
          dbError: availability.error,
        },
      });
    }

    const stats = await LanceDBWrapper.getStats();
    return NextResponse.json({ success: true, data: { ...stats, dbAvailable: true } });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      data: {
        totalEmbeddings: 0,
        totalNamespaces: 0,
        embeddingsByNamespace: {},
        embeddingsBySourceType: {},
        dbAvailable: false,
        dbError: error.message || 'Error getting stats',
      },
    });
  }
}
