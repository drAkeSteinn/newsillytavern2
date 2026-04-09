import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/ensure-namespace
 *
 * Ensures that embedding namespaces exist for a character or group.
 * Called when a chat session starts or resets so the namespace
 * appears in the embeddings settings namespace section.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { characterId, characterName, groupId, groupName, memberIds, memberNames } = body;

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

    if (groupId) {
      const namespace = `group-${groupId}`;
      try {
        await client.upsertNamespace({
          namespace,
          description: `Memorias del grupo: ${groupName || groupId}`,
          metadata: {
            type: 'Memoria del Grupo',
            group_id: groupId,
            group_name: groupName || '',
            auto_created: true,
          },
        });
        createdNamespaces.push(namespace);
      } catch (err) {
        console.warn('[ensure-namespace] Failed to create group namespace:', err);
      }
    }

    if (characterId) {
      const namespace = `character-${characterId}`;
      try {
        await client.upsertNamespace({
          namespace,
          description: `Memorias del personaje: ${characterName || characterId}`,
          metadata: {
            type: 'Memoria del Personaje',
            character_id: characterId,
            character_name: characterName || '',
            auto_created: true,
          },
        });
        createdNamespaces.push(namespace);
      } catch (err) {
        console.warn('[ensure-namespace] Failed to create character namespace:', err);
      }
    }

    // Create namespaces for all group members
    if (memberIds && Array.isArray(memberIds)) {
      for (let i = 0; i < memberIds.length; i++) {
        const memberId = memberIds[i];
        const memberName = memberNames?.[i] || '';
        const namespace = `character-${memberId}`;
        try {
          await client.upsertNamespace({
            namespace,
            description: `Memorias del personaje: ${memberName || memberId}`,
            metadata: {
              type: 'Memoria del Personaje',
              character_id: memberId,
              character_name: memberName,
              auto_created: true,
            },
          });
          if (!createdNamespaces.includes(namespace)) {
            createdNamespaces.push(namespace);
          }
        } catch (err) {
          console.warn(`[ensure-namespace] Failed to create member namespace for ${memberId}:`, err);
        }
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
