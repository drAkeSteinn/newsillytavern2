import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/ensure-namespace
 *
 * Ensures that embedding namespaces exist for a character or group session.
 * Called when a chat session starts.
 * 
 * Creates memory-specific namespaces:
 * - memory-character-{characterId}-{sessionId}
 * - memory-group-{groupId}-{sessionId}
 * - memory-group-members-{groupId}-{sessionId} (for individual character memories in group)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, characterName, groupId, groupName, memberIds, memberNames, sessionId } = body;

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
    const createdNamespaces: string[] = [];

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (groupId) {
      // Group memory namespace (general group memories)
      const groupNamespace = `memory-group-${groupId}-${sessionId}`;
      try {
        await client.upsertNamespace({
          namespace: groupNamespace,
          description: `Memorias del grupo: ${groupName || groupId}`,
          metadata: {
            type: 'memory',
            subtype: 'group',
            group_id: groupId,
            group_name: groupName || '',
            session_id: sessionId,
            auto_created: true,
          },
        });
        createdNamespaces.push(groupNamespace);
      } catch (err) {
        console.warn('[ensure-namespace] Failed to create group namespace:', err);
      }

      // Individual character namespaces for group members
      if (memberIds && Array.isArray(memberIds)) {
        for (let i = 0; i < memberIds.length; i++) {
          const memberId = memberIds[i];
          const memberName = memberNames?.[i] || '';
          const memberNamespace = `memory-character-${memberId}-${sessionId}`;
          try {
            await client.upsertNamespace({
              namespace: memberNamespace,
              description: `Memorias de ${memberName || memberId} en el grupo`,
              metadata: {
                type: 'memory',
                subtype: 'character_in_group',
                character_id: memberId,
                character_name: memberName,
                group_id: groupId,
                session_id: sessionId,
                auto_created: true,
              },
            });
            if (!createdNamespaces.includes(memberNamespace)) {
              createdNamespaces.push(memberNamespace);
            }
          } catch (err) {
            console.warn(`[ensure-namespace] Failed to create member namespace for ${memberId}:`, err);
          }
        }
      }
    } else if (characterId) {
      // Single character chat - character memory namespace
      const characterNamespace = `memory-character-${characterId}-${sessionId}`;
      try {
        await client.upsertNamespace({
          namespace: characterNamespace,
          description: `Memorias del personaje: ${characterName || characterId}`,
          metadata: {
            type: 'memory',
            subtype: 'character',
            character_id: characterId,
            character_name: characterName || '',
            session_id: sessionId,
            auto_created: true,
          },
        });
        createdNamespaces.push(characterNamespace);
      } catch (err) {
        console.warn('[ensure-namespace] Failed to create character namespace:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        namespaces: createdNamespaces,
      },
    });
  } catch (error: any) {
    console.error('[ensure-namespace] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to ensure namespaces' },
      { status: 500 }
    );
  }
}
