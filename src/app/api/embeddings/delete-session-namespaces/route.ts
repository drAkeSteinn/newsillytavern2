import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/delete-session-namespaces
 *
 * Deletes all memory namespaces and their embeddings for a specific session.
 * Called when a chat session is deleted.
 * 
 * Deletes namespaces matching the session:
 * - memory-character-{characterId}-{sessionId}
 * - memory-group-{groupId}-{sessionId}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, groupId, sessionId } = body;

    const { getEmbeddingClient, resetEmbeddingClient } = await import('@/lib/embeddings/client');
    const { getConfig } = await import('@/lib/embeddings/config-persistence');

    // Ensure client is initialized with persisted config
    const persistedConfig = getConfig();
    resetEmbeddingClient({
      ollamaUrl: persistedConfig.ollamaUrl,
      model: persistedConfig.model,
      dimension: persistedConfig.dimension,
    });

    const client = getEmbeddingClient();
    const deletedNamespaces: string[] = [];

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Find and delete all namespaces containing this sessionId
    const namespacesToDelete: string[] = [];

    if (groupId) {
      namespacesToDelete.push(`memory-group-${groupId}-${sessionId}`);
    }

    if (characterId) {
      namespacesToDelete.push(`memory-character-${characterId}-${sessionId}`);
    }

    // Delete each namespace and all its embeddings
    for (const namespace of namespacesToDelete) {
      try {
        await client.deleteNamespace(namespace);
        deletedNamespaces.push(namespace);
        console.log(`[delete-session-namespaces] Deleted namespace: ${namespace}`);
      } catch (err) {
        console.warn(`[delete-session-namespaces] Failed to delete namespace ${namespace}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedNamespaces,
      },
    });
  } catch (error: any) {
    console.error('[delete-session-namespaces] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete session namespaces' },
      { status: 500 }
    );
  }
}
