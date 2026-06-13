// ============================================
// Chat Emotion Route - Evaluate character emotional state
// ============================================
//
// POST endpoint that evaluates the emotional state of a character
// based on recent conversation context. Returns an EmotionalEvaluation
// result as JSON (not SSE, since it's a single evaluation).

import { NextRequest } from 'next/server';
import type { ChatMessage, CharacterCard, LLMConfig, EmotionalStateConfig } from '@/types';
import { evaluateEmotionalState } from '@/lib/emotions/emotion-evaluator';
import { createErrorResponse } from '@/lib/llm';

/**
 * POST /api/chat/emotion
 *
 * Evaluates the emotional state of a character based on recent messages.
 * Used by the client after receiving an LLM response to update the
 * character's emotional state.
 *
 * Request body:
 * - character: CharacterCard (must have emotionalConfig)
 * - messages: ChatMessage[] (recent conversation)
 * - llmConfig: LLMConfig (for the evaluation LLM call)
 * - currentState: string (current emotional state)
 * - personality?: string (character personality override)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      character,
      messages = [],
      llmConfig,
      currentState = 'neutral',
      personality,
    } = body;

    if (!character?.id || !character?.name) {
      return createErrorResponse('Missing required field: character (with id and name)', 400);
    }

    if (!llmConfig?.provider) {
      return createErrorResponse('Missing required field: llmConfig (with provider)', 400);
    }

    const config: EmotionalStateConfig | undefined = character.emotionalConfig;
    if (!config?.enabled) {
      return Response.json({
        evaluation: {
          previousState: currentState,
          newState: currentState,
          confidence: 1,
          reasoning: 'Emotional system disabled',
          timestamp: Date.now(),
        },
        shouldUpdate: false,
      });
    }

    // Run the evaluation
    const evaluation = await evaluateEmotionalState(
      character as CharacterCard,
      messages as ChatMessage[],
      llmConfig as LLMConfig,
      currentState,
      {
        contextMessagesCount: config.contextMessagesCount,
        personality,
      }
    );

    const shouldUpdate = evaluation.newState !== evaluation.previousState;

    return Response.json({
      evaluation,
      shouldUpdate,
      characterId: character.id,
    });
  } catch (error: any) {
    console.error('[EmotionRoute] Error:', error?.message);
    return createErrorResponse(error?.message || 'Internal server error', 500);
  }
}
