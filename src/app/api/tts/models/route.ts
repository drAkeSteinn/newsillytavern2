// ============================================
// TTS Models API Route - List available TTS/ASR models
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778/v1';

// Default TTS models for TTS-WebUI
const DEFAULT_TTS_MODELS = [
  { id: 'chatterbox-tts', name: 'Chatterbox TTS', type: 'tts', description: 'High-quality voice cloning TTS' },
  { id: 'chatterbox-turbo', name: 'Chatterbox Turbo', type: 'tts', description: 'Fast TTS with voice cloning' },
  { id: 'kokoro', name: 'Kokoro TTS', type: 'tts', description: 'Lightweight Japanese TTS' },
  { id: 'xttsv2', name: 'XTTS v2', type: 'tts', description: 'Multi-language voice cloning' },
  { id: 'styletts2', name: 'StyleTTS 2', type: 'tts', description: 'Controllable style TTS' },
  { id: 'parler-tts', name: 'Parler TTS', type: 'tts', description: 'High-fidelity TTS' },
];

// Default Whisper models for ASR
const DEFAULT_WHISPER_MODELS = [
  { id: 'whisper-large-v3', name: 'Whisper Large V3', type: 'asr', description: 'Best quality, slower' },
  { id: 'whisper-large-v2', name: 'Whisper Large V2', type: 'asr', description: 'High quality' },
  { id: 'whisper-medium', name: 'Whisper Medium', type: 'asr', description: 'Balanced speed/quality' },
  { id: 'whisper-small', name: 'Whisper Small', type: 'asr', description: 'Faster, good quality' },
  { id: 'whisper-tiny', name: 'Whisper Tiny', type: 'asr', description: 'Fastest, basic quality' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;
  const type = searchParams.get('type'); // 'tts' | 'asr' | null (all)

  try {
    // Try to get models from TTS-WebUI
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      let models = data.data || [];

      // Filter by type if specified
      if (type === 'tts') {
        models = models.filter((m: { id: string }) =>
          !m.id.toLowerCase().includes('whisper') &&
          (m.id.toLowerCase().includes('tts') ||
           m.id.toLowerCase().includes('chatterbox') ||
           m.id.toLowerCase().includes('kokoro') ||
           m.id.toLowerCase().includes('xtts'))
        );
      } else if (type === 'asr') {
        models = models.filter((m: { id: string }) =>
          m.id.toLowerCase().includes('whisper')
        );
      }

      // If no models found, return defaults
      if (models.length === 0) {
        if (type === 'tts') {
          return NextResponse.json({
            status: 'online',
            endpoint,
            models: DEFAULT_TTS_MODELS,
            note: 'Using default TTS models (TTS-WebUI returned no TTS models)',
          });
        } else if (type === 'asr') {
          return NextResponse.json({
            status: 'online',
            endpoint,
            models: DEFAULT_WHISPER_MODELS,
            note: 'Using default Whisper models (TTS-WebUI returned no ASR models)',
          });
        } else {
          return NextResponse.json({
            status: 'online',
            endpoint,
            models: [...DEFAULT_TTS_MODELS, ...DEFAULT_WHISPER_MODELS],
            note: 'Using default models (TTS-WebUI returned no models)',
          });
        }
      }

      return NextResponse.json({
        status: 'online',
        endpoint,
        models,
      });
    }

    // Service is offline, return defaults
    const defaultModels = type === 'tts'
      ? DEFAULT_TTS_MODELS
      : type === 'asr'
        ? DEFAULT_WHISPER_MODELS
        : [...DEFAULT_TTS_MODELS, ...DEFAULT_WHISPER_MODELS];

    return NextResponse.json({
      status: 'offline',
      endpoint,
      models: defaultModels,
      note: 'TTS-WebUI is offline, showing default models',
    });

  } catch (error) {
    const defaultModels = type === 'tts'
      ? DEFAULT_TTS_MODELS
      : type === 'asr'
        ? DEFAULT_WHISPER_MODELS
        : [...DEFAULT_TTS_MODELS, ...DEFAULT_WHISPER_MODELS];

    return NextResponse.json({
      status: 'offline',
      endpoint,
      models: defaultModels,
      error: error instanceof Error ? error.message : 'Cannot connect to TTS service',
      note: 'TTS-WebUI is offline, showing default models',
    });
  }
}
