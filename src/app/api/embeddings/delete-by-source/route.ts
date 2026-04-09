import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/delete-by-source - Delete all embeddings for a source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.source_type || !body.source_id) {
      return NextResponse.json({ error: 'source_type and source_id are required' }, { status: 400 });
    }

    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    const count = await LanceDBWrapper.deleteBySource(body.source_type, body.source_id);

    return NextResponse.json({ success: true, data: { deleted: count } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error deleting embeddings' }, { status: 500 });
  }
}
