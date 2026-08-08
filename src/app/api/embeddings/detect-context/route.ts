import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/detect-context
 *
 * Auto-detects the embedding model's context length by querying Ollama's /api/show,
 * then saves the detected value to the persisted config.
 *
 * Body: { ollamaUrl?: string, model?: string }
 * Returns: { success: true, contextLength: number, model: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { getConfig, saveConfig } = await import('@/lib/embeddings/config-persistence');
    const { detectModelContextLength } = await import('@/lib/embeddings/ollama-client');

    const config = getConfig();
    const ollamaUrl = body.ollamaUrl || config.ollamaUrl;
    const model = body.model || config.model;

    if (!ollamaUrl || !model) {
      return NextResponse.json(
        { success: false, error: 'Se requiere ollamaUrl y model' },
        { status: 400 },
      );
    }

    const contextLength = await detectModelContextLength(ollamaUrl, model);

    // Save the detected context length to config
    saveConfig({ modelContextLength: contextLength });

    // Reset the embedding client so it picks up the new config
    try {
      const { resetEmbeddingClient } = await import('@/lib/embeddings/client');
      resetEmbeddingClient({ ...getConfig() });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      contextLength,
      model,
    });
  } catch (error: any) {
    console.error('[detect-context] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error detecting context length' },
      { status: 500 },
    );
  }
}
