// ============================================
// OmniVoice Archetype Preview API
// Endpoint: GET /api/tts/omnivoice/archetypes/preview
// Proxies to OmniVoice Studio's /archetypes/{id}/preview endpoint
// Returns streaming WAV audio for archetype preview
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const OMNIVOICE_DEFAULT_URL = 'http://localhost:3900';
const PREVIEW_TIMEOUT_MS = 15000; // Longer timeout for audio generation

/**
 * GET /api/tts/omnivoice/archetypes/preview
 * Fetches a preview audio sample for a voice archetype
 *
 * Query params:
 *   endpoint - OmniVoice server URL (default: http://localhost:3900)
 *   id       - Archetype ID (required, e.g., "feat_00_the_librarian")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || OMNIVOICE_DEFAULT_URL;
  const archetypeId = searchParams.get('id');

  if (!archetypeId) {
    return NextResponse.json({
      success: false,
      error: 'Archetype ID is required. Pass ?id=feat_00_the_librarian',
    }, { status: 400 });
  }

  // Normalize endpoint URL
  const baseUrl = endpoint.replace(/\/$/, '');
  const previewUrl = `${baseUrl}/archetypes/${encodeURIComponent(archetypeId)}/preview`;

  console.log(`[OmniVoice-Preview] Fetching preview audio for archetype "${archetypeId}" from ${previewUrl}`);

  try {
    const response = await fetch(previewUrl, {
      method: 'GET',
      headers: {
        'Accept': 'audio/wav,audio/*',
      },
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[OmniVoice-Preview] Endpoint returned ${response.status}: ${errorText}`);
      return NextResponse.json({
        success: false,
        error: `OmniVoice returned ${response.status}: ${errorText}`,
      }, { status: 502 });
    }

    // Get content type from the upstream response, defaulting to audio/wav
    const contentType = response.headers.get('content-type') || 'audio/wav';
    const contentLength = response.headers.get('content-length');

    console.log(`[OmniVoice-Preview] Streaming audio: type=${contentType}, size=${contentLength || 'unknown'}`);

    // Stream the audio binary back to the client
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': 'public, max-age=3600', // Cache preview audio for 1 hour
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';

    if (isTimeout) {
      console.error(`[OmniVoice-Preview] Request timed out after ${PREVIEW_TIMEOUT_MS}ms`);
      return NextResponse.json({
        success: false,
        error: `Preview audio generation timed out after ${PREVIEW_TIMEOUT_MS / 1000}s. The archetype may need to generate a sample first.`,
      }, { status: 504 });
    }

    console.error(`[OmniVoice-Preview] Connection error:`, message);
    return NextResponse.json({
      success: false,
      error: `Cannot connect to OmniVoice at ${baseUrl}: ${message}`,
    }, { status: 502 });
  }
}
