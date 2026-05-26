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
    const { content, characterId, characterName, memoryType, importance, memorySubject, sessionId } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (!characterId) {
      return NextResponse.json({ error: 'characterId is required' }, { status: 400 });
    }

    // Use session-specific namespace if sessionId is provided, otherwise use generic character namespace
    const sessionSuffix = sessionId && sessionId !== 'unknown' ? `-${sessionId}` : '';
    const namespace = sessionId ? `memory-character-${characterId}${sessionSuffix}` : `character-${characterId}`;

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
        session_id: sessionId || undefined,
        manual: true,
        manually_created: true,
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
 * DELETE /api/embeddings/manual-memory
 *
 * Supports two deletion modes:
 * 1. By embeddingId: ?embeddingId=xxx
 * 2. By content search: ?searchTarget=Name&characterId=xxx&memoryType=relacion
 *    Finds and deletes embeddings that contain the searchTarget in their content.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const embeddingId = searchParams.get('embeddingId');
    const searchTarget = searchParams.get('searchTarget');
    const characterId = searchParams.get('characterId');
    const memoryType = searchParams.get('memoryType');

    const { getEmbeddingClient } = await import('@/lib/embeddings/client');
    const client = getEmbeddingClient();

    // Mode 1: Delete by specific embedding ID
    if (embeddingId) {
      await client.deleteEmbedding(embeddingId);
      return NextResponse.json({ success: true, deletedBy: 'id' });
    }

    // Mode 2: Delete by content search (find embeddings containing searchTarget)
    if (searchTarget && characterId) {
      const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
      const namespace = `character-${characterId}`;
      
      let deletedCount = 0;
      try {
        const embeddings = await LanceDBWrapper.getNamespaceEmbeddings(namespace, 500);
        for (const emb of embeddings) {
          if (emb.source_type !== 'memory') continue;
          if (memoryType && emb.metadata?.memory_type !== memoryType) continue;
          if (emb.content.toLowerCase().includes(searchTarget.toLowerCase())) {
            try {
              await client.deleteEmbedding(emb.id);
              deletedCount++;
            } catch { /* skip */ }
          }
        }
      } catch {
        // Namespace might not exist, try session-specific namespace
        const { getConfig } = await import('@/lib/embeddings/config-persistence');
        const config = getConfig();
        // Search across all memory namespaces for this character
        try {
          const allNamespaces = await LanceDBWrapper.getAllNamespaces();
          const charMemoryNamespaces = allNamespaces.filter(ns => 
            ns.namespace.startsWith(`memory-character-${characterId}`)
          );
          for (const ns of charMemoryNamespaces) {
            try {
              const embeddings = await LanceDBWrapper.getNamespaceEmbeddings(ns.namespace, 500);
              for (const emb of embeddings) {
                if (emb.source_type !== 'memory') continue;
                if (memoryType && emb.metadata?.memory_type !== memoryType) continue;
                if (emb.content.toLowerCase().includes(searchTarget.toLowerCase())) {
                  try {
                    await client.deleteEmbedding(emb.id);
                    deletedCount++;
                  } catch { /* skip */ }
                }
              }
            } catch { /* skip namespace */ }
          }
        } catch { /* skip */ }
      }

      return NextResponse.json({ success: true, deletedBy: 'search', deletedCount });
    }

    return NextResponse.json({ error: 'embeddingId or searchTarget+characterId is required' }, { status: 400 });
  } catch (error: any) {
    console.error('[manual-memory] Delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error deleting embedding' },
      { status: 500 }
    );
  }
}
