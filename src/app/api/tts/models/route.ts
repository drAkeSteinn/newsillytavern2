// ============================================
// TTS Models API Route - List available TTS/ASR models
// Supports TTS-WebUI and OmniVoice providers
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778/v1';

// Default TTS models for TTS-WebUI
const DEFAULT_TTS_WEBUI_MODELS = [
  { id: 'chatterbox-tts', name: 'Chatterbox TTS', type: 'tts', description: 'High-quality voice cloning TTS' },
  { id: 'chatterbox-turbo', name: 'Chatterbox Turbo', type: 'tts', description: 'Fast TTS with voice cloning' },
  { id: 'kokoro', name: 'Kokoro TTS', type: 'tts', description: 'Lightweight Japanese TTS' },
  { id: 'xttsv2', name: 'XTTS v2', type: 'tts', description: 'Multi-language voice cloning' },
  { id: 'styletts2', name: 'StyleTTS 2', type: 'tts', description: 'Controllable style TTS' },
  { id: 'parler-tts', name: 'Parler TTS', type: 'tts', description: 'High-fidelity TTS' },
];

// Default TTS models for OmniVoice
const DEFAULT_OMNIVOICE_MODELS = [
  { id: 'omnivoice', name: 'OmniVoice', type: 'tts', description: 'Default multi-engine TTS (646+ languages, voice cloning)' },
  { id: 'cosyvoice', name: 'CosyVoice 3', type: 'tts', description: '9 languages + 18 dialects, voice cloning + instruct' },
  { id: 'voxcpm2', name: 'VoxCPM2', type: 'tts', description: '30 languages, voice cloning + instruct' },
  { id: 'moss-tts-nano', name: 'MOSS-TTS-Nano', type: 'tts', description: '20 languages, lightweight' },
  { id: 'kitten-tts', name: 'KittenTTS', type: 'tts', description: 'English, lightweight CPU-friendly' },
  { id: 'gpt-sovits', name: 'GPT-SoVITS', type: 'tts', description: 'Voice cloning + instruct' },
];

// Default Whisper models for ASR
const DEFAULT_WHISPER_MODELS = [
  { id: 'whisper-large-v3', name: 'Whisper Large V3', type: 'asr', description: 'Best quality, slower' },
  { id: 'whisper-large-v2', name: 'Whisper Large V2', type: 'asr', description: 'High quality' },
  { id: 'whisper-medium', name: 'Whisper Medium', type: 'asr', description: 'Balanced speed/quality' },
  { id: 'whisper-small', name: 'Whisper Small', type: 'asr', description: 'Faster, good quality' },
  { id: 'whisper-tiny', name: 'Whisper Tiny', type: 'asr', description: 'Fastest, basic quality' },
];

// Default ASR models for OmniVoice
const DEFAULT_OMNIVOICE_ASR_MODELS = [
  { id: 'whisperx', name: 'WhisperX', type: 'asr', description: 'Word-level timing, best for dubbing' },
  { id: 'faster-whisper', name: 'Faster-Whisper', type: 'asr', description: 'Fast transcription (CTranslate2)' },
  { id: 'pytorch-whisper', name: 'PyTorch Whisper', type: 'asr', description: 'CUDA/CPU fallback' },
  { id: 'funasr', name: 'FunASR', type: 'asr', description: '50+ languages, built-in VAD + diarization' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;
  const type = searchParams.get('type'); // 'tts' | 'asr' | null (all)
  const provider = searchParams.get('provider') || 'tts-webui';

  try {
    // Try to get models from the TTS service
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
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
           m.id.toLowerCase().includes('xtts') ||
           m.id.toLowerCase().includes('omnivoice') ||
           m.id.toLowerCase().includes('cosyvoice') ||
           m.id.toLowerCase().includes('sovits'))
        );
      } else if (type === 'asr') {
        models = models.filter((m: { id: string }) =>
          m.id.toLowerCase().includes('whisper') ||
          m.id.toLowerCase().includes('funasr')
        );
      }

      // If no models found, return defaults
      if (models.length === 0) {
        return NextResponse.json(getDefaultResponse(provider, type, endpoint, 'online'));
      }

      return NextResponse.json({
        status: 'online',
        endpoint,
        provider,
        models,
      });
    }

    // Service is offline, return defaults
    return NextResponse.json(getDefaultResponse(provider, type, endpoint, 'offline'));

  } catch (error) {
    return NextResponse.json(getDefaultResponse(provider, type, endpoint, 'offline', error));
  }
}

function getDefaultResponse(
  provider: string,
  type: string | null,
  endpoint: string,
  status: 'online' | 'offline',
  error?: unknown
) {
  const isOmniVoice = provider === 'omnivoice';
  const ttsDefaults = isOmniVoice ? DEFAULT_OMNIVOICE_MODELS : DEFAULT_TTS_WEBUI_MODELS;
  const asrDefaults = isOmniVoice ? DEFAULT_OMNIVOICE_ASR_MODELS : DEFAULT_WHISPER_MODELS;

  const defaultModels = type === 'tts'
    ? ttsDefaults
    : type === 'asr'
      ? asrDefaults
      : [...ttsDefaults, ...asrDefaults];

  return {
    status,
    endpoint,
    provider,
    models: defaultModels,
    error: error instanceof Error ? error.message : undefined,
    note: status === 'offline'
      ? `${isOmniVoice ? 'OmniVoice' : 'TTS-WebUI'} is offline, showing default models`
      : `Using default ${isOmniVoice ? 'OmniVoice' : 'TTS-WebUI'} models`,
  };
}
