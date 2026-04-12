/**
 * Memory Extraction for Embeddings
 *
 * Automatically extracts memorable facts from chat messages using LLM,
 * with robust JSON parsing (multi-layer fallback) and validation.
 * Extracted memories are saved as embeddings for later context retrieval.
 *
 * Architecture:
 *   Capa 1: LLM generates structured facts from last assistant message
 *   Capa 2: Robust JSON parser extracts array from any format
 *   Capa 3: Simple line-based fallback if all parsing fails
 */

import { generateResponse } from '@/lib/llm/generation';
import type { LLMConfig, ChatApiMessage } from '@/lib/llm/types';
import { getEmbeddingClient } from '@/lib/embeddings/client';
import type { CreateEmbeddingParams } from '@/lib/embeddings/types';
import { DEFAULT_MEMORY_EXTRACTION_PROMPT, DEFAULT_GROUP_DYNAMICS_PROMPT } from './memory-extraction-prompts';

// ============================================
// Types
// ============================================

/** A single extracted memory fact */
export interface MemoryFact {
  contenido: string;
  tipo: MemoryType;
  importancia: number; // 1-5
  sujeto?: 'usuario' | 'personaje' | 'otro';
}

export type MemoryType = 'hecho' | 'evento' | 'relacion' | 'preferencia' | 'secreto' | 'otro';

/** Result of memory extraction */
export interface MemoryExtractionResult {
  /** Number of valid facts extracted */
  count: number;
  /** The extracted facts */
  facts: MemoryFact[];
  /** Number of facts saved as embeddings */
  saved: number;
  /** Namespace used for storage */
  namespace: string;
  /** IDs of the created embeddings */
  embeddingIds: string[];
}

/** Settings for memory extraction */
export interface MemoryExtractionSettings {
  /** Whether auto-extraction is enabled */
  enabled: boolean;
  /** Extract every N turns (default: 5). A turn = 1 user message + responses. */
  frequency: number;
  /** Minimum importance to save (1-5, default: 2) */
  minImportance: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_EXTRACTION_SETTINGS: MemoryExtractionSettings = {
  enabled: false,
  frequency: 5,
  minImportance: 2,
};

// Use the prompt from the clean prompts file
const MEMORY_EXTRACTION_PROMPT = DEFAULT_MEMORY_EXTRACTION_PROMPT;

// ============================================
// Robust JSON Parser (3-layer fallback)
// ============================================

/**
 * Extract a JSON array of MemoryFact from any LLM output.
 * Tries multiple parsing strategies in order of reliability.
 */
export function extractFactsFromLLMOutput(text: string): MemoryFact[] {
  if (!text || !text.trim()) return [];

  const trimmed = text.trim();

  // Layer 1: Direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return validateAndNormalizeFacts(parsed);
    }
  } catch {}

  // Layer 2: Extract JSON array from markdown fences or surrounding text
  // Try to find ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    const extracted = extractJSONArray(inner);
    if (extracted.length > 0) return extracted;
  }

  // Layer 3: Find [ ... ] anywhere in the text
  const extracted = extractJSONArray(trimmed);
  if (extracted.length > 0) return extracted;

  // Layer 4: Parse individual JSON objects line by line
  const lineParsed = parseIndividualObjects(trimmed);
  if (lineParsed.length > 0) return lineParsed;

  // Layer 5: Simple line format fallback (HECHO | importance | tipo | descripcion)
  const simpleParsed = parseSimpleLines(trimmed);
  if (simpleParsed.length > 0) return simpleParsed;

  return [];
}

/**
 * Try to find and parse a JSON array in text
 */
function extractJSONArray(text: string): MemoryFact[] {
  // Find outermost [ ... ]
  const bracketStart = text.indexOf('[');
  const bracketEnd = text.lastIndexOf(']');
  if (bracketStart === -1 || bracketEnd === -1 || bracketEnd <= bracketStart) return [];

  const arrayStr = text.substring(bracketStart, bracketEnd + 1);

  try {
    const parsed = JSON.parse(arrayStr);
    if (Array.isArray(parsed)) {
      return validateAndNormalizeFacts(parsed);
    }
  } catch {
    // Try fixing common issues
    try {
      // Remove trailing commas before ] or }
      const fixed = arrayStr.replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(fixed);
      if (Array.isArray(parsed)) {
        return validateAndNormalizeFacts(parsed);
      }
    } catch {
      // Try replacing smart quotes
      try {
        const fixed = arrayStr.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) {
          return validateAndNormalizeFacts(parsed);
        }
      } catch {}
    }
  }

  return [];
}

/**
 * Parse individual JSON objects that appear on their own lines
 */
function parseIndividualObjects(text: string): MemoryFact[] {
  // Match lines that look like JSON objects containing "contenido"
  const objectPattern = /\{[^{}]*?"contenido"\s*:\s*"[^"]*"[^{}]*?\}/g;
  const matches = text.match(objectPattern);
  if (!matches) return [];

  const results: MemoryFact[] = [];
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);
      if (parsed.contenido) {
        const fact = normalizeSingleFact(parsed);
        if (fact) results.push(fact);
      }
    } catch {
      // Try fixing: escape unescaped quotes within string values
      try {
        const fixed = match.replace(/(?<=:\s*")((?:[^"\\]|\\.)*?)(?=")/g, (substring: string) => {
          return substring.replace(/(?<!\\)"/g, '\\"');
        });
        const parsed = JSON.parse(fixed);
        if (parsed.contenido) {
          const fact = normalizeSingleFact(parsed);
          if (fact) results.push(fact);
        }
      } catch {}
    }
  }
  return results;
}

/**
 * Parse simple line format: HECHO | importance | tipo | descripcion
 */
function parseSimpleLines(text: string): MemoryFact[] {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('HECHO |'))
    .map(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 4) return null;
      return {
        contenido: parts.slice(3).join('|').trim(),
        tipo: normalizeMemoryType(parts[2]),
        importancia: clampImportance(parseInt(parts[1]) || 3),
      };
    })
    .filter((f): f is MemoryFact => f !== null && f.contenido.length > 3);
}

// ============================================
// Validation & Normalization
// ============================================

const VALID_TYPES = ['hecho', 'evento', 'relacion', 'preferencia', 'secreto', 'otro'] as const;
const TYPE_ALIASES: Record<string, MemoryType> = {
  'hecho': 'hecho',
  'eventos': 'evento',
  'evento': 'evento',
  'relación': 'relacion',
  'relacion': 'relacion',
  'relationship': 'relacion',
  'preferencia': 'preferencia',
  'secreto': 'secreto',
  'secret': 'secreto',
  'other': 'otro',
  'otro': 'otro',
};

function validateAndNormalizeFacts(arr: unknown[]): MemoryFact[] {
  return arr.map(item => normalizeSingleFact(item)).filter((f): f is MemoryFact => f !== null);
}

function normalizeSingleFact(item: unknown): MemoryFact | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;

  const contenido = String(obj.contenido || obj.content || obj.text || '').trim();
  if (!contenido || contenido.length < 3 || contenido.length > 200) return null;
  if (contenido.toLowerCase() === 'ninguno' || contenido.toLowerCase() === 'none') return null;

  // Parse sujeto (subject): usuario, personaje, or otro. Default to 'personaje' for backward compat.
  const rawSujeto = String(obj.sujeto || obj.subject || '').toLowerCase().trim();
  let sujeto: 'usuario' | 'personaje' | 'otro' = 'personaje';
  if (rawSujeto === 'usuario' || rawSujeto === 'user') {
    sujeto = 'usuario';
  } else if (rawSujeto === 'personaje' || rawSujeto === 'character') {
    sujeto = 'personaje';
  } else if (rawSujeto === 'otro' || rawSujeto === 'other') {
    sujeto = 'otro';
  }

  return {
    contenido,
    tipo: normalizeMemoryType(String(obj.tipo || obj.type || 'hecho')),
    importancia: clampImportance(Number(obj.importancia || obj.importance || 3)),
    sujeto,
  };
}

function normalizeMemoryType(raw: string): MemoryType {
  const lower = raw.toLowerCase().trim();
  return TYPE_ALIASES[lower] || 'otro';
}

function clampImportance(val: number): number {
  return Math.max(1, Math.min(5, Math.round(val) || 3));
}

// ============================================
// Core: Extract Memory via LLM
// ============================================

/**
 * Extract memorable facts from the last assistant message using LLM.
 * Uses robust multi-layer JSON parsing.
 *
 * @param chatContext - Optional recent messages to provide context (improves fact extraction quality)
 */
export async function extractMemories(
  lastAssistantMessage: string,
  characterName: string,
  llmConfig: LLMConfig,
  customPrompt?: string,
  chatContext?: string,
  userName?: string,
): Promise<MemoryFact[]> {
  if (!lastAssistantMessage?.trim() || lastAssistantMessage.length < 20) {
    return []; // Too short to contain meaningful memories
  }

  const promptTemplate = (customPrompt && customPrompt.trim()) ? customPrompt : MEMORY_EXTRACTION_PROMPT;

  // Build the context section if provided
  const contextSection = chatContext?.trim()
    ? `Contexto reciente de la conversación:\n${chatContext}\n`
    : '';

  const prompt = promptTemplate
    .replace('{chatContext}', contextSection)
    .replace('{characterName}', characterName)
    .replace('{userName}', userName || 'User')
    .replace('{lastMessage}', lastAssistantMessage);

  try {
    // Use a low temperature for consistent output
    const extractionConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: 0.1,
        maxTokens: 512,
      },
    };

    const chatMessages: ChatApiMessage[] = [
      { role: 'assistant', content: 'Eres un extractor de memoria. Responde SOLO con JSON.' },
      { role: 'user', content: prompt },
    ];

    const result = await generateResponse(
      llmConfig.provider,
      chatMessages,
      extractionConfig,
      'MemoryExtractor'
    );

    const facts = extractFactsFromLLMOutput(result.message || '');
    console.log(`[Memory] Extracted ${facts.length} facts from ${characterName}'s message`);
    return facts;
  } catch (error) {
    console.warn('[Memory] LLM extraction failed:', error);
    return [];
  }
}

// ============================================
// Core: Save Extracted Memories as Embeddings
// ============================================

/**
 * Save extracted memory facts as embeddings in the appropriate namespace.
 */
export async function saveMemoriesAsEmbeddings(
  facts: MemoryFact[],
  characterId: string,
  sessionId: string,
  groupId?: string,
  minImportance: number = 2,
): Promise<{ saved: number; embeddingIds: string[]; namespace: string }> {
  if (facts.length === 0) {
    return { saved: 0, embeddingIds: [], namespace: '' };
  }

  // Filter by minimum importance
  const validFacts = facts.filter(f => f.importancia >= minImportance);
  if (validFacts.length === 0) {
    return { saved: 0, embeddingIds: [], namespace: '' };
  }

  // Determine namespace (include sessionId to isolate memories per session)
  // Pattern: memory-character-{characterId}-{sessionId} or memory-group-{groupId}-{sessionId}
  const sessionSuffix = sessionId && sessionId !== 'unknown' ? `-${sessionId}` : '';
  const namespace = groupId
    ? `memory-group-${groupId}${sessionSuffix}`
    : `memory-character-${characterId}${sessionSuffix}`;

  const sourceId = sessionId || 'unknown';
  const embeddingIds: string[] = [];

  try {
    const client = getEmbeddingClient();

    // Register namespace so it appears in the UI
    try {
      await client.upsertNamespace({
        namespace,
        description: groupId
          ? `Memorias del grupo: sesión ${sessionId || 'unknown'}`
          : `Memorias de personaje: sesión ${sessionId || 'unknown'}`,
        metadata: {
          type: 'memory',
          subtype: groupId ? 'group' : 'character',
          character_id: characterId,
          session_id: sessionId,
          group_id: groupId || undefined,
          auto_created: true,
        },
      });
    } catch (nsErr) {
      console.warn('[Memory] Failed to upsert namespace (non-blocking):', nsErr);
    }

    for (const fact of validFacts) {
      try {
        const params: CreateEmbeddingParams = {
          content: fact.contenido,
          namespace,
          source_type: 'memory',
          source_id: sourceId,
          metadata: {
            importance: fact.importancia,
            memory_type: fact.tipo,
            memory_subject: fact.sujeto || 'personaje',
            extracted_at: new Date().toISOString(),
            character_id: characterId,
            session_id: sessionId,
            group_id: groupId || undefined,
          },
        };

        const id = await client.createEmbedding(params);
        embeddingIds.push(id);
      } catch (err) {
        console.warn('[Memory] Failed to save individual memory:', err);
      }
    }

    console.log(`[Memory] Saved ${embeddingIds.length}/${validFacts.length} memories to namespace "${namespace}"`);
  } catch (error) {
    console.error('[Memory] Failed to save memories:', error);
  }

  return { saved: embeddingIds.length, embeddingIds, namespace };
}

// ============================================
// Public API: Extract + Save (combined)
// ============================================

/**
 * Extract group dynamics from a full turn of conversation.
 * Analyzes inter-character relationships and interactions.
 */
export async function extractGroupDynamics(
  turnContext: string,
  llmConfig: LLMConfig,
): Promise<MemoryFact[]> {
  if (!turnContext?.trim() || turnContext.length < 50) {
    return [];
  }

  const prompt = DEFAULT_GROUP_DYNAMICS_PROMPT
    .replace('{turnContext}', turnContext);

  try {
    const extractionConfig: LLMConfig = {
      ...llmConfig,
      parameters: {
        ...llmConfig.parameters,
        temperature: 0.1,
        maxTokens: 512,
      },
    };

    const chatMessages: ChatApiMessage[] = [
      { role: 'assistant', content: 'Eres un extractor de dinámicas grupales. Responde SOLO con JSON.' },
      { role: 'user', content: prompt },
    ];

    const result = await generateResponse(
      llmConfig.provider,
      chatMessages,
      extractionConfig,
      'GroupDynamicsExtractor'
    );

    const facts = extractFactsFromLLMOutput(result.message || '');
    console.log(`[Memory] Extracted ${facts.length} group dynamics facts`);
    return facts;
  } catch (error) {
    console.warn('[Memory] Group dynamics extraction failed:', error);
    return [];
  }
}

/**
 * Full pipeline: Extract memories from message → Save as embeddings.
 * This is the main entry point called from chat routes.
 */
export async function extractAndSaveMemories(
  lastAssistantMessage: string,
  characterName: string,
  characterId: string,
  sessionId: string,
  llmConfig: LLMConfig,
  options: {
    groupId?: string;
    minImportance?: number;
    customPrompt?: string;
    chatContext?: string;
    userName?: string;
  } = {}
): Promise<MemoryExtractionResult> {
  const { groupId, minImportance = 2, customPrompt, chatContext, userName } = options;

  const emptyResult: MemoryExtractionResult = {
    count: 0,
    facts: [],
    saved: 0,
    namespace: '',
    embeddingIds: [],
  };

  try {
    // Step 1: Extract facts via LLM (with optional chat context)
    const facts = await extractMemories(lastAssistantMessage, characterName, llmConfig, customPrompt, chatContext, userName);

    if (facts.length === 0) {
      return emptyResult;
    }

    // Step 2: Save as embeddings
    const { saved, embeddingIds, namespace } = await saveMemoriesAsEmbeddings(
      facts,
      characterId,
      sessionId,
      groupId,
      minImportance,
    );

    return {
      count: facts.length,
      facts,
      saved,
      namespace,
      embeddingIds,
    };
  } catch (error) {
    console.error('[Memory] extractAndSaveMemories failed:', error);
    return emptyResult;
  }
}

/**
 * Check if memory extraction should trigger based on turn count.
 * A turn = 1 user message + N assistant responses.
 */
export function shouldExtractMemory(
  turnCount: number,
  settings: MemoryExtractionSettings = DEFAULT_EXTRACTION_SETTINGS,
): boolean {
  return settings.enabled && turnCount > 0 && turnCount % settings.frequency === 0;
}

export { DEFAULT_EXTRACTION_SETTINGS };
