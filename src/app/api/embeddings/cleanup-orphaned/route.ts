import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/cleanup-orphaned
 *
 * Garbage collection: Removes orphaned memory namespaces whose sessions
 * no longer exist in the store. Called on app startup or periodically.
 *
 * An orphaned namespace is a memory-* namespace with a session_id in its
 * metadata that doesn't match any active session.
 *
 * Non-memory namespaces (character-*, group-*, default, world, etc.) are
 * NEVER deleted — they are persistent lore/knowledge.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activeSessionIds } = body as { activeSessionIds: string[] };

    if (!Array.isArray(activeSessionIds)) {
      return NextResponse.json(
        { success: false, error: 'activeSessionIds must be an array of session IDs' },
        { status: 400 }
      );
    }

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
    const keptNamespaces: string[] = [];

    // Get all namespaces from LanceDB
    const allNamespaces = await client.getAllNamespaces();

    // Build a Set for fast lookup
    const activeSessionSet = new Set(activeSessionIds);

    for (const ns of allNamespaces) {
      // Only consider memory-* namespaces for cleanup
      // Non-memory namespaces (character-*, group-*, default, world, etc.) are persistent
      if (!ns.namespace.startsWith('memory-')) {
        continue;
      }

      const metadata = ns.metadata as Record<string, any> | undefined;
      const sessionId = metadata?.session_id;

      // If namespace has no session_id metadata, check the naming pattern
      // Pattern: memory-character-{charId}-{sessionId} or memory-group-{groupId}-{sessionId}
      if (!sessionId) {
        // Try to extract sessionId from the namespace name
        // The last segment after the last dash is typically the sessionId
        const parts = ns.namespace.split('-');
        // memory-character-{charId}-{sessionId} → parts = [memory, character, charId, sessionId]
        // memory-group-{groupId}-{sessionId} → parts = [memory, group, groupId, sessionId]
        if (parts.length >= 4) {
          // The sessionId is everything after the 3rd dash (UUIDs contain dashes)
          const possibleSessionId = parts.slice(3).join('-');
          if (possibleSessionId && !activeSessionSet.has(possibleSessionId)) {
            try {
              await client.deleteNamespace(ns.namespace);
              deletedNamespaces.push(ns.namespace);
              console.log(`[cleanup-orphaned] Deleted namespace (no metadata, pattern match): ${ns.namespace}`);
            } catch (err) {
              console.warn(`[cleanup-orphaned] Failed to delete namespace ${ns.namespace}:`, err);
            }
            continue;
          }
        }
        // Can't determine session — skip (safer to keep than delete)
        keptNamespaces.push(ns.namespace);
        continue;
      }

      // Check if the session still exists
      if (!activeSessionSet.has(sessionId)) {
        // Orphaned! Delete it
        try {
          await client.deleteNamespace(ns.namespace);
          deletedNamespaces.push(ns.namespace);
          console.log(`[cleanup-orphaned] Deleted orphaned namespace: ${ns.namespace} (session ${sessionId} no longer exists)`);
        } catch (err) {
          console.warn(`[cleanup-orphaned] Failed to delete namespace ${ns.namespace}:`, err);
        }
      } else {
        keptNamespaces.push(ns.namespace);
      }
    }

    console.log(`[cleanup-orphaned] Cleanup complete: deleted ${deletedNamespaces.length}, kept ${keptNamespaces.length}`);

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: deletedNamespaces.length,
        keptCount: keptNamespaces.length,
        deletedNamespaces,
        keptNamespaces,
      },
    });
  } catch (error: any) {
    console.error('[cleanup-orphaned] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cleanup orphaned namespaces' },
      { status: 500 }
    );
  }
}
