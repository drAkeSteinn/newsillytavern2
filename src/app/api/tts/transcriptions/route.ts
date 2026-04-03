// ============================================
// TTS Transcriptions API Route - Speech-to-Text using Whisper
// Supports TTS-WebUI (OpenAI compatible Whisper API)
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// TTS-WebUI configuration
const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';

// Whisper models with correct format for TTS-WebUI
const WHISPER_MODELS = [
  { id: 'openai/whisper-large-v3', name: 'Whisper Large V3', vram: '~10GB' },
  { id: 'openai/whisper-medium', name: 'Whisper Medium', vram: '~5GB' },
  { id: 'openai/whisper-small', name: 'Whisper Small (Recommended ES)', vram: '~2GB' },
  { id: 'openai/whisper-base', name: 'Whisper Base', vram: '~1GB' },
  { id: 'openai/whisper-tiny', name: 'Whisper Tiny', vram: '~0.5GB' },
  { id: 'distil-whisper/distil-large-v3', name: 'Distil Whisper Large V3', vram: '~1.5GB' },
];

interface TranscriptionRequest {
  audio: string; // Base64 encoded audio
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
  // Provider settings
  provider?: 'tts-webui' | 'z-ai';
  endpoint?: string;
}

interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe audio using TTS-WebUI Whisper API
 * 
 * Correct format based on curl:
 * curl -X POST "http://localhost:7778/v1/audio/transcriptions" \
 *   -F "file=@audio.wav" \
 *   -F "model=openai/whisper-large-v3" \
 *   -F "language=es" \
 *   -F "response_format=json"
 */
async function transcribeWithTTSWebUI(
  audioBase64: string,
  options: {
    endpoint: string;
    model: string;
    language?: string;
    prompt?: string;
    response_format?: string;
    temperature?: number;
  }
): Promise<{ data?: TranscriptionResponse; error?: string }> {
  const { endpoint, model, language, prompt, response_format, temperature } = options;

  try {
    // Normalize endpoint (remove trailing /v1 if present, we'll add it)
    let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Create form data with correct field names for OpenAI-compatible API
    const formData = new FormData();
    
    // File field - use 'file' as field name, and provide a filename with extension
    // Whisper needs to know the file format
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    
    // Model field - use the correct format with provider prefix
    // Format: "openai/whisper-large-v3" or "distil-whisper/distil-large-v3"
    const modelId = model.startsWith('openai/') || model.startsWith('distil-') 
      ? model 
      : `openai/${model}`;
    formData.append('model', modelId);
    
    // Optional fields
    if (language) {
      formData.append('language', language);
    }
    if (prompt) {
      formData.append('prompt', prompt);
    }
    if (response_format) {
      formData.append('response_format', response_format);
    }
    if (temperature !== undefined) {
      formData.append('temperature', temperature.toString());
    }

    console.log(`[ASR] Request to ${baseUrl}/v1/audio/transcriptions`);
    console.log(`[ASR] Model: ${modelId}, Language: ${language || 'auto'}`);

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ASR] Error ${response.status}:`, errorText);
      return { error: `Whisper API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`[ASR] Success: transcribed ${data.text?.length || 0} characters`);
    return { data };

  } catch (error) {
    console.error(`[ASR] Connection error:`, error);
    return { error: `Failed to transcribe: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Transcribe audio using Z.ai SDK ASR
 */
async function transcribeWithZAI(
  audioBase64: string,
  options: {
    language?: string;
    model?: string;
  }
): Promise<{ data?: TranscriptionResponse; error?: string }> {
  try {
    // Dynamic import for Z.ai SDK
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Use Z.ai ASR function
    const result = await zai.functions.invoke('asr', {
      audio: audioBase64,
      language: options.language,
      model: options.model,
    });

    if (result?.data?.text) {
      return {
        data: {
          text: result.data.text,
          language: result.data.language,
          duration: result.data.duration,
        },
      };
    }

    return { error: 'Z.ai ASR returned no transcription' };
  } catch (error) {
    return { error: `Z.ai ASR error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TranscriptionRequest = await request.json();

    // Validate required fields
    if (!body.audio) {
      return NextResponse.json(
        { error: 'Audio data is required (base64 encoded)' },
        { status: 400 }
      );
    }

    const provider = body.provider || 'tts-webui';
    const endpoint = body.endpoint || TTS_WEBUI_DEFAULT_URL;

    // Get the model with correct format
    // Default to openai/whisper-small for Spanish
    const model = body.model || 'openai/whisper-small';

    let result: { data?: TranscriptionResponse; error?: string };

    switch (provider) {
      case 'tts-webui':
        result = await transcribeWithTTSWebUI(body.audio, {
          endpoint,
          model,
          language: body.language,
          prompt: body.prompt,
          response_format: body.response_format,
          temperature: body.temperature,
        });
        break;

      case 'z-ai':
        result = await transcribeWithZAI(body.audio, {
          language: body.language,
          model: body.model,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown ASR provider: ${provider}` },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result.data,
    });

  } catch (error) {
    console.error('Transcription API error:', error);
    return NextResponse.json(
      { error: `Transcription API error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check available Whisper models
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;

  // Normalize endpoint
  let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

  try {
    // Try a simple test to check if ASR is available
    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: new FormData(), // Empty form to test endpoint
    });

    // Any response (even error) means service is online
    if (response.status !== 404) {
      return NextResponse.json({
        status: 'online',
        endpoint: baseUrl,
        models: WHISPER_MODELS.map(m => ({
          id: m.id,
          name: m.name,
          vram: m.vram,
          type: 'asr'
        })),
      });
    }

    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: `ASR endpoint not found`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: error instanceof Error ? error.message : 'Cannot connect to TTS service',
    });
  }
}
