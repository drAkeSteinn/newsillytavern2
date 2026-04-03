// ============================================
// TTS Available Voices API - Fetch voices from TTS-WebUI
// Endpoint: GET /api/tts/available-voices
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';

interface VoiceInfo {
  id: string;
  name: string;
  path: string;
  language?: string;
}

/**
 * Fetch available voices from TTS-WebUI
 * TTS-WebUI exposes voices at /v1/audio/voices endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;

  // Normalize endpoint
  let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');

  try {
    // Fetch voices from TTS-WebUI /v1/audio/voices endpoint
    const response = await fetch(`${baseUrl}/v1/audio/voices`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`[TTS-Voices] Endpoint returned ${response.status}`);
      return NextResponse.json({
        success: false,
        voices: [],
        error: `TTS-WebUI returned ${response.status}`,
      });
    }

    const data = await response.json();
    console.log(`[TTS-Voices] Raw response:`, JSON.stringify(data, null, 2));

    // Parse voices from response
    let voices: VoiceInfo[] = [];

    if (data.voices && Array.isArray(data.voices)) {
      voices = data.voices.map((voice: { id: string; name: string }) => ({
        id: voice.id,
        name: voice.name,
        path: voice.id, // The id IS the path for voice reference
        language: extractLanguage(voice.id),
      }));
    }

    // Filter to only show chatterbox voices (voices/chatterbox/*)
    const chatterboxVoices = voices.filter(v => v.id.startsWith('voices/chatterbox/'));

    console.log(`[TTS-Voices] Found ${chatterboxVoices.length} chatterbox voices`);

    return NextResponse.json({
      success: true,
      voices: chatterboxVoices,
      allVoices: voices, // Include all voices for reference
      endpoint: baseUrl,
    });

  } catch (error) {
    console.error(`[TTS-Voices] Error:`, error);
    return NextResponse.json({
      success: false,
      voices: [],
      error: error instanceof Error ? error.message : 'Failed to fetch voices',
    }, { status: 500 });
  }
}

// Extract language from voice path (e.g., "es-rick" -> "es")
function extractLanguage(voiceId: string): string | undefined {
  const match = voiceId.match(/\/([a-z]{2})-/);
  return match ? match[1] : undefined;
}
