// ============================================
// Emotion Evaluator - LLM-based emotional state evaluation
// ============================================
//
// Evaluates the emotional state of a character based on
// recent conversation context. Uses a lightweight LLM call
// with caching and rate limiting to avoid unnecessary evaluations.
//
// The evaluator:
// - Takes the character's possible emotional states as input
// - Uses recent messages as context
// - Returns the most appropriate emotional state
// - Caches results to avoid re-evaluation when nothing changed
// - Supports configurable evaluation intervals (turn-based)

import type { ChatMessage, CharacterCard, LLMConfig, EmotionalStateConfig, EmotionalEvaluation } from '@/types';
import {
  streamZAI,
  streamOpenAICompatible,
  streamAnthropic,
  streamOllama,
  streamGrok,
  streamTextGenerationWebUI,
} from '@/lib/llm';

// ============================================
// Cache for emotion evaluations
// ============================================

interface EmotionCacheEntry {
  state: string;
  timestamp: number;
  messageHash: string;  // Hash of the messages used for evaluation
}

const emotionCache = new Map<string, EmotionCacheEntry>();

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a simple hash from message contents for cache invalidation.
 * Uses last N messages' content to detect if context has changed.
 */
function hashMessages(messages: ChatMessage[], count: number): string {
  const recent = messages.slice(-count);
  return recent
    .map(m => `${m.role}:${(m.content || '').slice(0, 100)}`)
    .join('|');
}

/**
 * Check if we can use a cached emotion evaluation.
 * Returns the cached state if valid, null otherwise.
 */
function getCachedEmotion(
  characterId: string,
  messages: ChatMessage[],
  contextCount: number
): string | null {
  const entry = emotionCache.get(characterId);
  if (!entry) return null;

  // Check cache expiry
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    emotionCache.delete(characterId);
    return null;
  }

  // Check if messages changed
  const currentHash = hashMessages(messages, contextCount);
  if (currentHash === entry.messageHash) {
    return entry.state;
  }

  return null;
}

/**
 * Store an emotion evaluation in the cache.
 */
function setCachedEmotion(
  characterId: string,
  state: string,
  messages: ChatMessage[],
  contextCount: number
): void {
  emotionCache.set(characterId, {
    state,
    timestamp: Date.now(),
    messageHash: hashMessages(messages, contextCount),
  });
}

/**
 * Clear the emotion cache for a specific character or all characters.
 */
export function clearEmotionCache(characterId?: string): void {
  if (characterId) {
    emotionCache.delete(characterId);
  } else {
    emotionCache.clear();
  }
}

// ============================================
// System prompt for emotional evaluation
// ============================================

const EMOTION_EVAL_SYSTEM = `Eres un evaluador de estados emocionales para personajes de rol.

Tu tarea es analizar la conversación reciente y determinar el estado emocional actual del personaje.

Reglas IMPORTANTES:
- Debes responder SOLO con UNA de las palabras clave proporcionadas en la lista de estados posibles
- No inventes estados que no estén en la lista
- Si no hay suficiente contexto para determinar un cambio, retorna el estado actual
- Considera tanto lo que dice el personaje como lo que le dicen
- El estado emocional debe reflejar la reacción MÁS RECIENTE del personaje
- Responde SOLO con la palabra del estado, nada más`;

// ============================================
// Main evaluation function
// ============================================

/**
 * Evaluate the emotional state of a character based on recent messages.
 *
 * @param character - The character card with emotional config
 * @param messages - Recent chat messages
 * @param llmConfig - LLM configuration for the evaluation call
 * @param currentState - The current emotional state (for context)
 * @param options - Additional options (contextMessagesCount, etc.)
 * @returns The evaluated emotional state (or current state if evaluation fails)
 */
export async function evaluateEmotionalState(
  character: CharacterCard,
  messages: ChatMessage[],
  llmConfig: LLMConfig,
  currentState: string,
  options?: {
    contextMessagesCount?: number;
    personality?: string;
  }
): Promise<EmotionalEvaluation> {
  const config = character.emotionalConfig;
  if (!config?.enabled || config.states.length === 0) {
    return {
      previousState: currentState,
      newState: currentState,
      confidence: 1,
      reasoning: 'Emotional system disabled',
      timestamp: Date.now(),
    };
  }

  const contextCount = options?.contextMessagesCount || config.contextMessagesCount || 6;

  // Check cache first
  const cached = getCachedEmotion(character.id, messages, contextCount);
  if (cached !== null) {
    return {
      previousState: currentState,
      newState: cached,
      confidence: 0.8,
      reasoning: 'Cached evaluation',
      timestamp: Date.now(),
    };
  }

  // Get recent messages for context
  const recentMessages = messages
    .filter(m => !m.isDeleted && m.content?.trim())
    .slice(-contextCount);

  // Not enough context to evaluate
  if (recentMessages.length === 0) {
    return {
      previousState: currentState,
      newState: currentState,
      confidence: 1,
      reasoning: 'No messages to evaluate',
      timestamp: Date.now(),
    };
  }

  try {
    const charName = character.name;
    const personality = options?.personality || character.personality || '';
    const statesList = config.states.join(', ');

    // Build the context for evaluation
    const chatContext = recentMessages
      .map(m => {
        const speaker = m.role === 'user' ? 'Usuario' : m.characterName || charName;
        return `${speaker}: ${m.content.trim().slice(0, 200)}`;
      })
      .join('\n');

    const systemPrompt = `${EMOTION_EVAL_SYSTEM}\n\nPersonaje: ${charName}
Personalidad: ${personality.slice(0, 300)}
Estado emocional actual: ${currentState}
Estados posibles: ${statesList}`;

    const userMessage = `[Conversación reciente]
${chatContext}

¿Cuál es el estado emocional actual de ${charName}? Responde SOLO con una de: ${statesList}`;

    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    // Configure LLM for evaluation (low temperature, very short response)
    const evalLLMConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: 0.3,  // Low temperature for consistent evaluation
        max_tokens: 20,    // Very short: just the state keyword
      },
    };

    // Use non-streaming approach: collect all tokens
    let generator: AsyncGenerator<string>;

    switch (evalLLMConfig.provider) {
      case 'z-ai':
        generator = streamZAI(evalLLMConfig, llmMessages);
        break;
      case 'anthropic':
        generator = streamAnthropic(evalLLMConfig, systemPrompt, llmMessages.slice(1));
        break;
      case 'ollama':
        generator = streamOllama(evalLLMConfig, llmMessages);
        break;
      case 'grok':
        generator = streamGrok(evalLLMConfig, llmMessages);
        break;
      case 'text-generation-webui':
      case 'koboldcpp':
        generator = streamTextGenerationWebUI(evalLLMConfig, llmMessages);
        break;
      default:
        generator = streamOpenAICompatible(evalLLMConfig, llmMessages);
        break;
    }

    let rawResponse = '';
    for await (const chunk of generator) {
      rawResponse += chunk;
      // Safety: limit to ~50 characters (a single word state)
      if (rawResponse.length > 50) break;
    }

    // Clean up the response
    const cleanState = rawResponse
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/g, '')  // Keep only letters and accents
      .trim();

    // Match against known states (fuzzy matching)
    let matchedState = currentState;
    const normalizedStates = config.states.map(s => s.toLowerCase().trim());

    // Try exact match first
    const exactMatch = normalizedStates.indexOf(cleanState);
    if (exactMatch !== -1) {
      matchedState = config.states[exactMatch];
    } else {
      // Try partial/contains match
      for (let i = 0; i < normalizedStates.length; i++) {
        if (cleanState.includes(normalizedStates[i]) || normalizedStates[i].includes(cleanState)) {
          matchedState = config.states[i];
          break;
        }
      }

      // If still no match, try word-by-word
      if (matchedState === currentState && cleanState.includes(' ')) {
        const words = cleanState.split(/\s+/);
        for (const word of words) {
          const wordMatch = normalizedStates.indexOf(word);
          if (wordMatch !== -1) {
            matchedState = config.states[wordMatch];
            break;
          }
        }
      }
    }

    // Cache the result
    setCachedEmotion(character.id, matchedState, messages, contextCount);

    const changed = matchedState !== currentState;

    return {
      previousState: currentState,
      newState: matchedState,
      confidence: changed ? 0.85 : 0.9,
      reasoning: changed
        ? `Estado cambiado de "${currentState}" a "${matchedState}" basado en el contexto`
        : `Estado "${currentState}" mantenido, no hay cambios significativos`,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.warn('[EmotionEvaluator] Error evaluating emotional state:', error?.message);
    return {
      previousState: currentState,
      newState: currentState,
      confidence: 0,
      reasoning: `Evaluation failed: ${error?.message || 'Unknown error'}`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Check if emotional evaluation should run based on the interval configuration.
 * Uses turn-based counting: evaluates every N turns.
 *
 * @param characterId - The character ID
 * @param sessionStats - Current session stats
 * @param config - Emotional state config
 * @returns Whether evaluation should run
 */
export function shouldEvaluateEmotion(
  characterId: string,
  sessionStats: { characterStats?: Record<string, { emotionalStateTurnCount?: number; emotionalStateLastEval?: number }> },
  config: EmotionalStateConfig
): boolean {
  if (!config.enabled) return false;

  const charStats = sessionStats.characterStats?.[characterId];
  const turnCount = charStats?.emotionalStateTurnCount || 0;
  const interval = config.evaluationInterval || 1;

  // Evaluate if we've reached the interval
  return turnCount % interval === 0;
}

/**
 * Increment the emotional turn counter for a character.
 * Called after each LLM response.
 */
export function incrementEmotionalTurn(
  characterId: string,
  sessionStats: { characterStats: Record<string, any> }
): number {
  if (!sessionStats.characterStats[characterId]) {
    sessionStats.characterStats[characterId] = {
      attributeValues: {},
      lastUpdated: {},
      emotionalStateTurnCount: 0,
    };
  }

  const current = sessionStats.characterStats[characterId].emotionalStateTurnCount || 0;
  const next = current + 1;
  sessionStats.characterStats[characterId].emotionalStateTurnCount = next;
  return next;
}
