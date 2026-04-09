// ============================================
// Summary Generation API
// Generates summaries of conversation history
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/llm';
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
  
  const systemPrompt = `You are a memory summarization AI for a roleplay conversation.
Your task is to create concise, comprehensive summaries that preserve:
- Key events and plot developments
- Important character decisions and motivations
- Emotional moments and relationship changes
- World-building details and established facts
- Ongoing quests or objectives

Guidelines:
- Write as a narrative summary, not bullet points
- Maintain chronological order
- Preserve the tone and style of the roleplay
- Focus on information that would be important for future conversations
- Avoid redundant details
- Keep the summary under ${settings.maxSummaryTokens} tokens
- If a previous summary exists, integrate it and update with new information`;

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
    userPrompt = `Previous Summary:
${previousSummary}

New Messages to Integrate:
${formattedMessages}

Please update the summary to include the new information while preserving important details from the previous summary.`;
  } else {
    userPrompt = customPrompt;
  }

  return { systemPrompt, userPrompt };
}

// ============================================
// Token Estimation
// ============================================

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<SummaryResponse>> {
  try {
    const body: SummaryRequest = await request.json();
    const { messages, characterName, userName, settings, previousSummary, apiConfig } = body;

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

    const summaryContent = response.content || '';
    const tokenCount = estimateTokens(summaryContent);

    // Create summary data
    const summary: SummaryData = {
      id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: '',
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
