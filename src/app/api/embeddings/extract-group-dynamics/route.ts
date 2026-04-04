import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/extract-group-dynamics
 *
 * Extracts inter-character relationship facts from a full group turn.
 * Analyzes how characters interact with each other and saves as embeddings.
 *
 * Called ASYNC from group-stream route (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      turnContext,
      groupId,
      sessionId,
      llmConfig,
      minImportance = 2,
    } = body;

    if (!turnContext || !groupId) {
      return NextResponse.json({ error: 'Missing required fields: turnContext, groupId' }, { status: 400 });
    }

    // Dynamic import
    const { extractGroupDynamics, saveMemoriesAsEmbeddings } = await import('@/lib/embeddings/memory-extraction');

    // Step 1: Extract group dynamics
    const facts = await extractGroupDynamics(turnContext, llmConfig);

    if (facts.length === 0) {
      return NextResponse.json({ success: true, count: 0, saved: 0 });
    }

    // Step 2: Save as embeddings in group namespace
    const validFacts = facts.filter(f => f.importancia >= minImportance);
    const { saved, namespace } = await saveMemoriesAsEmbeddings(
      validFacts,
      'group', // characterId placeholder for group-level
      sessionId || '',
      groupId,
      minImportance,
    );

    return NextResponse.json({
      success: true,
      count: facts.length,
      saved,
      namespace,
    });
  } catch (error: any) {
    console.error('[extract-group-dynamics] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Group dynamics extraction failed' }, { status: 500 });
  }
}
