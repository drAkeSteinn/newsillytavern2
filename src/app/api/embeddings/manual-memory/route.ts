import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/manual-memory
 *
 * Creates an embedding from a manually-entered character memory.
 * Bridges the CharacterMemory (Zustand) system with LanceDB embeddings.
 *
 * Also registers/updates the character namespace so it appears in the UI.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, characterId, characterName, memoryType, importance, memorySubject } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (!characterId) {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    const namespace = `character-${characterId}`;

    // Load persisted config
    const { getConfig } = await import('@/lib/embeddings/config-persistence');
    const persistedConfig = getConfig();

    const { getEmbeddingClient, resetEmbeddingClient } = await import('@/lib/embeddings/client');
    resetEmbeddingClient({
      ollamaUrl: persistedConfig.ollamaUrl,
      model: persistedConfig.model,
      dimension: persistedConfig.dimension,
    });

    const client = getEmbeddingClient();

    // Register namespace
    try {
      await client.upsertNamespace({
        namespace,
        description: `Memorias del personaje ${characterName || characterId}`,
        metadata: {
          type: 'character_memory',
          character_id: characterId,
          character_name: characterName || '',
        },
      });
    } catch (nsErr) {
      console.warn('[manual-memory] Failed to upsert namespace (non-blocking):', nsErr);
    }

    // Create embedding
    const embeddingId = await client.createEmbedding({
      content: content.trim(),
      namespace,
      source_type: 'memory',
      source_id: `manual-${characterId}`,
      metadata: {
        importance: importance ?? 3,
        memory_type: memoryType || 'hecho',
        memory_subject: memorySubject || 'personaje',
        extracted_at: new Date().toISOString(),
        character_id: characterId,
        manual: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: embeddingId,
        namespace,
      },
    });
  } catch (error: any) {
    console.error('[manual-memory] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error creating manual memory embedding' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/embeddings/manual-memory?embeddingId=xxx
 *
 * Deletes a manually-created embedding by ID.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const embeddingId = searchParams.get('embeddingId');

    if (!embeddingId) {
      return NextResponse.json({ error: 'embeddingId is required' }, { status: 400 });
    }

    const { getEmbeddingClient } = await import('@/lib/embeddings/client');
    const client = getEmbeddingClient();
    await client.deleteEmbedding(embeddingId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[manual-memory] Delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error deleting embedding' },
      { status: 500 }
    );
  }
}
