// ============================================
// TTS Speech API Route - Generate audio from text
// Supports TTS-WebUI (OpenAI compatible) and other providers
// ============================================

import { NextRequest, NextResponse } from 'next/server';

// TTS-WebUI configuration
const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';

// Available TTS models
const TTS_MODELS = [
  { id: 'multilingual', name: 'Chatterbox Multilingual', description: 'Multi-language TTS with voice cloning' },
  { id: 'chatterbox', name: 'Chatterbox', description: 'English TTS with voice cloning' },
  { id: 'chatterbox-turbo', name: 'Chatterbox Turbo', description: 'Fast TTS (350M params)' },
];

// Supported languages for multilingual model
const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

interface TTSRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  response_format?: 'mp3' | 'wav' | 'ogg' | 'flac';
  language?: string;
  reference_audio?: string;
  // Provider settings
  provider?: 'tts-webui' | 'z-ai' | 'custom';
  endpoint?: string;
  apiKey?: string;
  // Advanced TTS parameters
  exaggeration?: number;
  cfg_weight?: number;
  temperature?: number;
  // Additional params for TTS-WebUI
  device?: string;
  dtype?: string;
}

interface TTSWebUIResponse {
  audio?: string; // base64 encoded audio
  error?: string;
}

/**
 * Generate speech using TTS-WebUI (OpenAI compatible API)
 * 
 * For multilingual model, the correct format is:
 * {
 *   "model": "chatterbox",
 *   "input": "text",
 *   "voice": "voices/chatterbox/es-rick.wav",
 *   "response_format": "wav",
 *   "params": {
 *     "model_name": "multilingual",
 *     "language_id": "es",
 *     "dtype": "bfloat16",
 *     "device": "auto",
 *     "exaggeration": 0.5,
 *     "cfg_weight": 0.5,
 *     "temperature": 0.8
 *   }
 * }
 */
async function generateWithTTSWebUI(
  text: string,
  options: {
    endpoint: string;
    model: string;
    voice?: string;
    speed?: number;
    response_format?: string;
    language?: string;
    reference_audio?: string;
    exaggeration?: number;
    cfg_weight?: number;
    temperature?: number;
    device?: string;
    dtype?: string;
  }
): Promise<TTSWebUIResponse> {
  const { 
    endpoint, 
    model, 
    voice, 
    speed, 
    response_format, 
    language,
    exaggeration,
    cfg_weight,
    temperature,
    device,
    dtype
  } = options;

  try {
    // Normalize endpoint (remove trailing /v1 if present, we'll add it)
    let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');
    
    // Build request body for TTS-WebUI
    // Base fields (OpenAI compatible)
    const requestBody: Record<string, unknown> = {
      input: text,
      response_format: response_format || 'wav',
    };

    // Set model - always use 'chatterbox' as base model
    requestBody.model = 'chatterbox';

    // Add voice/reference audio for voice cloning
    // Only set voice if we have a valid voice ID (not 'default' or empty)
    // For multilingual model, voice is optional (uses synthetic voice)
    if (voice && voice !== 'default' && voice !== 'none') {
      requestBody.voice = voice;
    }
    // If no valid voice provided, don't set 'voice' at all
    // TTS-WebUI will use its default behavior for the selected model

    // Add speed if specified
    if (speed !== undefined && speed !== 1.0) {
      requestBody.speed = speed;
    }

    // Build params object for model-specific parameters
    const params: Record<string, unknown> = {};

    // For multilingual model, add model_name and language_id to params
    if (model === 'multilingual') {
      params.model_name = 'multilingual';
      if (language) {
        params.language_id = language;
      }
    }

    // Add device and dtype (defaults for TTS-WebUI)
    params.device = device || 'auto';
    params.dtype = dtype || 'bfloat16';

    // Add advanced TTS parameters to params object
    if (exaggeration !== undefined) {
      params.exaggeration = exaggeration;
    }
    if (cfg_weight !== undefined) {
      params.cfg_weight = cfg_weight;
    }
    if (temperature !== undefined) {
      params.temperature = temperature;
    }

    // Only add params if we have any
    if (Object.keys(params).length > 0) {
      requestBody.params = params;
    }

    console.log(`[TTS] Request to ${baseUrl}/v1/audio/speech:`);
    console.log(`[TTS] Full request details:`);
    console.log(`  - endpoint: ${baseUrl}`);
    console.log(`  - model: ${requestBody.model}`);
    console.log(`  - voice: ${requestBody.voice}`);
    console.log(`  - response_format: ${requestBody.response_format}`);
    console.log(`  - params:`, JSON.stringify(params, null, 2));
    console.log(`[TTS] Full JSON body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TTS] Error ${response.status}:`, errorText);
      return { error: `TTS-WebUI error: ${response.status} - ${errorText}` };
    }

    // The response is audio binary data
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    console.log(`[TTS] Success: ${audioBuffer.byteLength} bytes received`);
    return { audio: base64Audio };
  } catch (error) {
    console.error(`[TTS] Connection error:`, error);
    return { error: `Failed to connect to TTS-WebUI: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Generate speech using Z.ai SDK TTS
 */
async function generateWithZAI(
  text: string,
  options: {
    voice?: string;
    speed?: number;
    response_format?: string;
  }
): Promise<TTSWebUIResponse> {
  try {
    // Dynamic import for Z.ai SDK
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Use Z.ai TTS function
    const result = await zai.functions.invoke('tts', {
      text: text,
      voice: options.voice || 'default',
      speed: options.speed || 1.0,
      format: options.response_format || 'mp3',
    });

    if (result?.data?.audio) {
      return { audio: result.data.audio };
    }

    return { error: 'Z.ai TTS returned no audio' };
  } catch (error) {
    return { error: `Z.ai TTS error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TTSRequest = await request.json();

    // Validate required fields
    if (!body.text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const provider = body.provider || 'tts-webui';
    const endpoint = body.endpoint || TTS_WEBUI_DEFAULT_URL;

    let result: TTSWebUIResponse;

    switch (provider) {
      case 'tts-webui':
        result = await generateWithTTSWebUI(body.text, {
          endpoint,
          model: body.model || 'multilingual',
          voice: body.voice,
          speed: body.speed,
          response_format: body.response_format,
          language: body.language,
          exaggeration: body.exaggeration,
          cfg_weight: body.cfg_weight,
          temperature: body.temperature,
        });
        break;

      case 'z-ai':
        result = await generateWithZAI(body.text, {
          voice: body.voice,
          speed: body.speed,
          response_format: body.response_format,
        });
        break;

      case 'custom':
        // Custom endpoint - assume OpenAI compatible
        result = await generateWithTTSWebUI(body.text, {
          endpoint: body.endpoint || endpoint,
          model: body.model || 'multilingual',
          voice: body.voice,
          speed: body.speed,
          response_format: body.response_format,
          language: body.language,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown TTS provider: ${provider}` },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Return audio as base64
    return NextResponse.json({
      success: true,
      audio: result.audio,
      format: body.response_format || 'wav',
    });

  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: `TTS API error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// GET endpoint to check TTS service status and get available models/languages
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;

  // Normalize endpoint
  let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

  try {
    // Try a simple TTS request to check if service is running
    // Use multilingual model without voice (synthetic voice)
    const testResponse = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'chatterbox',
        input: 'test',
        response_format: 'wav',
        params: {
          model_name: 'multilingual',
          language_id: 'en',
          device: 'auto',
          dtype: 'bfloat16',
        },
      }),
    });

    if (testResponse.ok || (testResponse.status >= 400 && testResponse.status < 500)) {
      // Service is online (even if request was rejected, it's responding)
      return NextResponse.json({
        status: 'online',
        endpoint: baseUrl,
        models: TTS_MODELS,
        languages: SUPPORTED_LANGUAGES,
      });
    }

    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: `Service returned ${testResponse.status}`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'offline',
      endpoint: baseUrl,
      error: error instanceof Error ? error.message : 'Cannot connect to TTS service',
    });
  }
}
