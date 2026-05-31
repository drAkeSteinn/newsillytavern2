// ============================================
// Summary Generation API
// Generates summaries of conversation history
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/llm';
import { getEmbeddingClient } from '@/lib/embeddings/client';
import type { ChatMessage, SummaryData, SummarySettings, LLMConfig } from '@/types';

// ============================================
// Request/Response Types
// ============================================

interface SummaryRequest {
  messages: ChatMessage[];
  characterName: string;
  userName: string;
  settings: SummarySettings;
  previousSummary?: string;
  characterId?: string;
  sessionId?: string;
  apiConfig: {
    provider: string;
    endpoint: string;
    apiKey?: string;
    model: string;
  };
}

interface SummaryResponse {
  summary: SummaryData;
  success: boolean;
  error?: string;
}

// ============================================
// Summary Generation Prompt Builder
// ============================================

function buildSummaryPrompt(
  messages: ChatMessage[],
  characterName: string,
  userName: string,
  settings: SummarySettings,
  previousSummary?: string
): { systemPrompt: string; userPrompt: string } {
  
  const systemPrompt = `Eres una IA de resumen de memoria para una conversación de rol.
Generas "recuerdos anteriores" que preservan la continuidad de la historia.
Tu tarea es crear recuerdos anteriores concisos y completos que preserven:
- Eventos clave y desarrollos de la trama
- Decisiones importantes de los personajes y sus motivaciones
- Momentos emocionales y cambios en las relaciones
- Detalles del mundo y hechos establecidos
- Misiones u objetivos en curso

Directrices:
- Escribe como un resumen narrativo, no como una lista de viñetas
- Mantén el orden cronológico
- Preserva el tono y estilo del rol
- Enfócate en información que sea importante para conversaciones futuras
- Evita detalles redundantes
- Mantén el resumen bajo ${settings.maxSummaryTokens} tokens
- Si existe un resumen previo, intégralo y actualízalo con la nueva información`;

  // Format messages for summarization
  const formattedMessages = messages
    .filter(m => !m.isDeleted)
    .map(m => {
      const name = m.role === 'user' ? userName : characterName;
      return `${name}: ${m.content}`;
    })
    .join('\n\n');

  // Use custom prompt template with {{conversation}} placeholder
  let customPrompt = settings.promptTemplate;
  
  // Replace {{conversation}} placeholder with actual conversation
  if (customPrompt.includes('{{conversation}}')) {
    customPrompt = customPrompt.replace('{{conversation}}', formattedMessages);
  } else {
    // If no placeholder, append conversation
    customPrompt = `${customPrompt}\n\nMessages:\n${formattedMessages}`;
  }

  let userPrompt = '';
  
  if (previousSummary) {
    userPrompt = `Resumen anterior:
${previousSummary}

Nuevos mensajes a integrar:
${formattedMessages}

Actualiza los recuerdos anteriores para incluir la nueva información, preservando los detalles importantes del resumen previo.`;
  } else {
    userPrompt = customPrompt;
  }

  return { systemPrompt, userPrompt };
}

// ============================================
// Token Estimation
// ============================================

function estimateTokens(text: string): number {
  // Estimación aproximada: ~4 caracteres por token para español
  return Math.ceil(text.length / 4);
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<SummaryResponse>> {
  try {
    const body: SummaryRequest = await request.json();
    const { messages, characterName, userName, settings, previousSummary, apiConfig, characterId, sessionId } = body;

    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        error: 'Summary generation is disabled',
        summary: {
          id: '',
          sessionId: '',
          content: '',
          messageRange: { start: 0, end: 0 },
          tokens: 0,
          createdAt: new Date().toISOString(),
        }
      });
    }

    // Filter messages to summarize
    const visibleMessages = messages.filter(m => !m.isDeleted);
    
    if (visibleMessages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No messages to summarize',
        summary: {
          id: '',
          sessionId: '',
          content: '',
          messageRange: { start: 0, end: 0 },
          tokens: 0,
          createdAt: new Date().toISOString(),
        }
      });
    }

    // Build prompts
    const { systemPrompt, userPrompt } = buildSummaryPrompt(
      visibleMessages,
      characterName,
      userName,
      settings,
      previousSummary
    );

    // Build LLM config
    const llmConfig: LLMConfig = {
      id: 'summary-config',
      name: 'Summary Generator',
      provider: apiConfig.provider as any,
      endpoint: apiConfig.endpoint,
      apiKey: apiConfig.apiKey,
      model: apiConfig.model,
      parameters: {
        temperature: 0.3, // Lower temperature for more consistent summaries
        topP: 0.9,
        topK: 40,
        maxTokens: settings.maxSummaryTokens,
        stream: false,
        contextSize: 4096,
        repetitionPenalty: 1.1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stopStrings: [],
      },
      isActive: true,
    };

    // Generate summary
    const response = await generateResponse(
      apiConfig.provider,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      llmConfig,
      characterName
    );

    const summaryContent = response.message || '';
    const tokenCount = estimateTokens(summaryContent);

    // Save summary as embedding in the session namespace for future semantic search
    try {
      const client = getEmbeddingClient();
      const effectiveCharId = characterId || 'default';
      const effectiveSessId = sessionId || 'unknown';
      const namespace = `memory-character-${effectiveCharId}-${effectiveSessId}`;

      // Delete any previous summary embedding for this session (keep only the latest)
      // Use direct metadata query instead of semantic search to avoid accidentally deleting non-summary embeddings
      try {
        const { LanceDBWrapper } = await import('@/lib/embeddings/lancedb-db');
        const existingSummaries = await LanceDBWrapper.getNamespaceEmbeddingsMetadata(namespace, {
          sourceType: 'summary',
          limit: 10,
        });
        for (const existing of existingSummaries) {
          if (existing.metadata?.session_id === effectiveSessId) {
            await client.deleteEmbedding(existing.id);
            console.log(`[Summary] Deleted previous summary embedding: ${existing.id}`);
          }
        }
      } catch (delErr) {
        console.warn('[Summary] Could not delete previous summary embedding:', delErr);
      }

      // Save the new summary as an embedding
      await client.createEmbedding({
        content: summaryContent,
        namespace,
        source_type: 'summary',
        source_id: effectiveSessId,
        metadata: {
          type: 'summary',
          character_id: effectiveCharId,
          session_id: effectiveSessId,
          message_range_start: 0,
          message_range_end: visibleMessages.length - 1,
          tokens: tokenCount,
          created_at: new Date().toISOString(),
        },
      });

      console.log(`[Summary] Saved summary embedding to namespace "${namespace}"`);
    } catch (embedErr) {
      console.warn('[Summary] Failed to save summary as embedding (non-blocking):', embedErr);
    }

    // Create summary data
    const summary: SummaryData = {
      id: `summary-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sessionId: sessionId || '',
      content: summaryContent,
      messageRange: {
        start: 0,
        end: visibleMessages.length - 1,
      },
      tokens: tokenCount,
      createdAt: new Date().toISOString(),
      model: apiConfig.model,
    };

    return NextResponse.json({
      success: true,
      summary,
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during summary generation',
      summary: {
        id: '',
        sessionId: '',
        content: '',
        messageRange: { start: 0, end: 0 },
        tokens: 0,
        createdAt: new Date().toISOString(),
      }
    }, { status: 500 });
  }
}

// ============================================
// GET endpoint for summary status/check
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  return NextResponse.json({
    status: 'ok',
    sessionId,
    message: 'Summary API is available'
  });
}
