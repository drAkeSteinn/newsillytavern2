// ============================================
// TTS Available Voices API - Fetch voices from TTS providers
// Endpoint: GET /api/tts/available-voices
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';

interface VoiceInfo {
  id: string;
  name: string;
  path: string;
  language?: string;
  type?: 'profile' | 'openai_alias' | string;
  description?: string;
  engineId?: string;
}

interface OmniVoiceEngine {
  id: string;
  display_name: string;
  available: boolean;
  reason: string;
}

/**
 * Fetch available voices from TTS-WebUI or OmniVoice
 * Both expose /v1/audio/voices endpoint (OpenAI compatible)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;
  const provider = searchParams.get('provider') || 'tts-webui';

  // Normalize endpoint
  let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

  try {
    // Fetch voices from /v1/audio/voices endpoint (same for both providers)
    const response = await fetch(`${baseUrl}/v1/audio/voices`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`[TTS-Voices] Endpoint returned ${response.status}`);
      return NextResponse.json({
        success: false,
        voices: [],
        engines: [],
        error: `TTS service returned ${response.status}`,
      });
    }

    const data = await response.json();
    console.log(`[TTS-Voices] Raw response:`, JSON.stringify(data, null, 2));

    // Parse voices from response
    let voices: VoiceInfo[] = [];
    let engines: OmniVoiceEngine[] = [];

    if (data.voices && Array.isArray(data.voices)) {
      if (provider === 'omnivoice') {
        // OmniVoice response format:
        // { voice_id, name, type, language?, description? }
        voices = data.voices.map((voice: {
          voice_id?: string;
          id?: string;
          name?: string;
          type?: string;
          language?: string;
          description?: string;
        }) => {
          const voiceId = voice.voice_id || voice.id || '';
          return {
            id: voiceId,
            name: voice.name || voiceId.split('/').pop() || voiceId,
            path: voiceId,
            language: voice.language || extractLanguage(voiceId),
            type: voice.type,
            description: voice.description,
            engineId: undefined, // will be set below if engines available
          };
        });

        // Capture engines array from OmniVoice response
        if (data.engines && Array.isArray(data.engines)) {
          engines = data.engines;
          // Associate voices with the default engine if they don't have one
          const defaultEngine = engines.find((e: OmniVoiceEngine) => e.available);
          if (defaultEngine) {
            voices = voices.map(v => ({
              ...v,
              engineId: v.engineId || defaultEngine.id,
            }));
          }
        }

        console.log(`[TTS-Voices] OmniVoice: Found ${voices.length} voices, ${engines.length} engines`);
        if (engines.length > 0) {
          engines.forEach((e: OmniVoiceEngine) => {
            console.log(`[TTS-Voices]   Engine: ${e.id} (${e.display_name}) - available: ${e.available} (${e.reason})`);
          });
        }
      } else {
        // TTS-WebUI response format:
        // { id (path like "voices/chatterbox/en-someone"), name? }
        voices = data.voices.map((voice: { id: string; name?: string }) => ({
          id: voice.id,
          name: voice.name || voice.id.split('/').pop() || voice.id,
          path: voice.id,
          language: extractLanguage(voice.id),
        }));

        console.log(`[TTS-Voices] TTS-WebUI: Found ${voices.length} total voices`);
      }
    }

    // Filter voices based on provider
    let filteredVoices: VoiceInfo[];
    if (provider === 'omnivoice') {
      // OmniVoice: Show all voices (profiles + built-in OpenAI aliases)
      filteredVoices = voices;
      console.log(`[TTS-Voices] OmniVoice: ${filteredVoices.length} voices after filtering`);
    } else {
      // TTS-WebUI: Filter to only show chatterbox voices (voices/chatterbox/*)
      filteredVoices = voices.filter(v => v.id.startsWith('voices/chatterbox/'));
      console.log(`[TTS-Voices] TTS-WebUI: ${filteredVoices.length} chatterbox voices after filtering`);
    }

    // Group voices by type for OmniVoice (better UX for frontend)
    let groupedVoices: Record<string, VoiceInfo[]> | undefined;
    if (provider === 'omnivoice') {
      groupedVoices = {
        profiles: filteredVoices.filter(v => v.type === 'profile'),
        aliases: filteredVoices.filter(v => v.type === 'openai_alias'),
        other: filteredVoices.filter(v => v.type && v.type !== 'profile' && v.type !== 'openai_alias'),
      };
      console.log(`[TTS-Voices] OmniVoice grouped: ${groupedVoices.profiles.length} profiles, ${groupedVoices.aliases.length} aliases, ${groupedVoices.other.length} other`);
    }

    return NextResponse.json({
      success: true,
      voices: filteredVoices,
      allVoices: voices,
      engines: engines,
      ...(groupedVoices ? { grouped: groupedVoices } : {}),
      endpoint: baseUrl,
      provider,
    });

  } catch (error) {
    console.error(`[TTS-Voices] Error:`, error);
    return NextResponse.json({
      success: false,
      voices: [],
      engines: [],
      error: error instanceof Error ? error.message : 'Failed to fetch voices',
    }, { status: 500 });
  }
}

// Extract language from voice path (e.g., "es-rick" -> "es")
function extractLanguage(voiceId: string): string | undefined {
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}
