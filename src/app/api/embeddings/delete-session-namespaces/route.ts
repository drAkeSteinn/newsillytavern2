import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/delete-session-namespaces
 *
 * Deletes all memory namespaces and their embeddings for a specific session.
 * Called when a chat session is deleted.
 *
 * Strategy: Find ALL namespaces that have this sessionId in their metadata,
 * regardless of naming pattern. This catches both direct and member namespaces.
 *
 * Falls back to pattern-based matching if metadata search fails.
 *
 * Deletes namespaces matching the session:
 * - memory-character-{characterId}-{sessionId}
 * - memory-group-{groupId}-{sessionId}
 * - memory-character-{memberId}-{sessionId} (for group members)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, groupId, sessionId, memberIds } = body;

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

    // Strategy 1: Find all namespaces with this sessionId in metadata
    // This is the most reliable approach — it catches everything
    try {
      const allNamespaces = await client.getAllNamespaces();
      const sessionNamespaces = allNamespaces.filter(ns =>
        ns.metadata?.session_id === sessionId
      );

      for (const ns of sessionNamespaces) {
        try {
          await client.deleteNamespace(ns.namespace);
          deletedNamespaces.push(ns.namespace);
          console.log(`[delete-session-namespaces] Deleted namespace (metadata match): ${ns.namespace}`);
        } catch (err) {
          console.warn(`[delete-session-namespaces] Failed to delete namespace ${ns.namespace}:`, err);
        }
      }

      // If metadata-based search found namespaces, we're done
      if (sessionNamespaces.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            deletedNamespaces,
          },
        });
      }
    } catch (err) {
      console.warn('[delete-session-namespaces] Metadata-based search failed, falling back to pattern matching:', err);
    }

    // Strategy 2: Fallback to pattern-based matching
    const namespacesToDelete: string[] = [];

    if (groupId) {
      namespacesToDelete.push(`memory-group-${groupId}-${sessionId}`);
    }

    if (characterId) {
      namespacesToDelete.push(`memory-character-${characterId}-${sessionId}`);
    }

    // For group sessions, also delete individual member namespaces
    if (groupId && memberIds && Array.isArray(memberIds)) {
      for (const memberId of memberIds) {
        const memberNamespace = `memory-character-${memberId}-${sessionId}`;
        if (!namespacesToDelete.includes(memberNamespace)) {
          namespacesToDelete.push(memberNamespace);
        }
      }
    }

    // Delete each namespace and all its embeddings
    for (const namespace of namespacesToDelete) {
      try {
        await client.deleteNamespace(namespace);
        deletedNamespaces.push(namespace);
        console.log(`[delete-session-namespaces] Deleted namespace (pattern match): ${namespace}`);
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
