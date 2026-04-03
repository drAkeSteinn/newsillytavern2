import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/preview-chunks - Preview how text will be chunked
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, splitterType, chunkSize, chunkOverlap } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (!splitterType) {
      return NextResponse.json({ error: 'splitterType is required' }, { status: 400 });
    }

    const { splitText, SPLITTER_INFO } = await import('@/lib/embeddings/splitters/text-splitter');

    const config = {
      chunkSize: chunkSize || SPLITTER_INFO[splitterType as keyof typeof SPLITTER_INFO]?.defaultChunkSize || 1000,
      chunkOverlap: chunkOverlap || SPLITTER_INFO[splitterType as keyof typeof SPLITTER_INFO]?.defaultOverlap || 200,
    };

    const result = splitText(content, splitterType, config);

    return NextResponse.json({
      success: true,
      data: {
        chunks: result.chunks,
        totalChunks: result.totalChunks,
        totalCharacters: result.totalCharacters,
        avgChunkSize: result.avgChunkSize,
        config,
        splitterType,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error previewing chunks',
    }, { status: 500 });
  }
}
