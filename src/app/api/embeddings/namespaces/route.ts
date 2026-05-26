import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/embeddings/namespaces - List all namespaces
 * POST /api/embeddings/namespaces - Create or update a namespace
 */
export async function GET() {
  try {
    const { LanceDBWrapper, isLanceDBAvailable } = await import('@/lib/embeddings/lancedb-db');
    
    const availability = await isLanceDBAvailable();
    if (!availability.available) {
      return NextResponse.json({
        success: true,
        data: { namespaces: [], dbAvailable: false, dbError: availability.error },
      });
    }

    const namespaces = await LanceDBWrapper.getAllNamespaces();
    const stats = await LanceDBWrapper.getStats();

    // Enrich namespaces with embedding counts and auto-session classification
    const autoPatterns = [
      /^memory-character-/,      // memory-character-{charId}-{sessionId}
      /^memory-group-/,           // memory-group-{groupId}-{sessionId}
      /^character-/,              // character-{charId} (character lore, auto-included by strategy)
      /^group-/,                  // group-{groupId} (group lore, auto-included by strategy)
    ];
    const alwaysIncludedNames = new Set(['default', 'world', 'world-building']);

    const enriched = namespaces.map(ns => {
      const meta = (ns.metadata as Record<string, unknown>) || {};
      const isAutoCreated = meta.auto_created === true;
      const matchesAutoPattern = autoPatterns.some(p => p.test(ns.namespace));
      const isAlwaysIncluded = alwaysIncludedNames.has(ns.namespace);
      const isSessionNamespace = isAutoCreated || matchesAutoPattern || isAlwaysIncluded;

      return {
        ...ns,
        embedding_count: stats.embeddingsByNamespace[ns.namespace] || 0,
        isSessionNamespace,
        sessionReason: isSessionNamespace
          ? isAlwaysIncluded
            ? 'always_included'
            : isAutoCreated
              ? 'auto_created'
              : 'auto_pattern'
          : undefined,
      };
    });

    return NextResponse.json({ success: true, data: { namespaces: enriched, dbAvailable: true } });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      data: { namespaces: [], dbAvailable: false, dbError: error.message || 'Error listing namespaces' },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.namespace) {
      return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
    }

    const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
    const ns = await LanceDBWrapper.upsertNamespace({
      namespace: body.namespace,
      description: body.description,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, data: ns });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Error creating namespace' }, { status: 500 });
  }
}
