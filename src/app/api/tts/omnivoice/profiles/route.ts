// ============================================
// OmniVoice Voice Profiles API
// Endpoint: GET /api/tts/omnivoice/profiles
// Proxies to OmniVoice Studio's /profiles endpoint
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const OMNIVOICE_DEFAULT_URL = 'http://localhost:3900';
const PROFILES_TIMEOUT_MS = 5000;

// TypeScript types for voice profile data
interface VoiceProfile {
  id: string;
  name: string;
  ref_audio_path: string;
  ref_text: string;
  instruct: string;
  language: string;
  locked_audio_path: string;
  seed: number | null;
  is_locked: number;
  personality: string;
  description: string;
  is_demo: number;
  created_at: number;
}

/**
 * GET /api/tts/omnivoice/profiles
 * Fetches voice profiles from OmniVoice Studio
 *
 * Query params:
 *   endpoint - OmniVoice server URL (default: http://localhost:3900)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || OMNIVOICE_DEFAULT_URL;

  // Normalize endpoint URL
  const baseUrl = endpoint.replace(/\/$/, '');

  console.log(`[OmniVoice-Profiles] Fetching profiles from ${baseUrl}/profiles`);

  try {
    const response = await fetch(`${baseUrl}/profiles`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(PROFILES_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[OmniVoice-Profiles] Endpoint returned ${response.status}: ${errorText}`);
      return NextResponse.json({
        success: false,
        profiles: [],
        error: `OmniVoice returned ${response.status}: ${errorText}`,
      }, { status: 502 });
    }

    const data = await response.json();

    // Validate response is an array
    if (!Array.isArray(data)) {
      console.error('[OmniVoice-Profiles] Unexpected response format - expected array');
      return NextResponse.json({
        success: false,
        profiles: [],
        error: 'Unexpected response format from OmniVoice - expected array',
      }, { status: 502 });
    }

    const profiles: VoiceProfile[] = data;
    console.log(`[OmniVoice-Profiles] Successfully fetched ${profiles.length} profiles`);

    return NextResponse.json({
      success: true,
      profiles,
      count: profiles.length,
      endpoint: baseUrl,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';

    if (isTimeout) {
      console.error(`[OmniVoice-Profiles] Connection timed out after ${PROFILES_TIMEOUT_MS}ms`);
      return NextResponse.json({
        success: false,
        profiles: [],
        error: `Connection to OmniVoice timed out after ${PROFILES_TIMEOUT_MS / 1000}s. Is the service running at ${baseUrl}?`,
      }, { status: 504 });
    }

    console.error(`[OmniVoice-Profiles] Connection error:`, message);
    return NextResponse.json({
      success: false,
      profiles: [],
      error: `Cannot connect to OmniVoice at ${baseUrl}: ${message}`,
    }, { status: 502 });
  }
}
