// ============================================
// OmniVoice Archetypes API
// Endpoint: GET /api/tts/omnivoice/archetypes
//           POST /api/tts/omnivoice/archetypes/use
// Proxies to OmniVoice Studio's /archetypes endpoints
// ============================================

import { NextRequest, NextResponse } from 'next/server';

const OMNIVOICE_DEFAULT_URL = 'http://localhost:3900';
const ARCHETYPES_TIMEOUT_MS = 5000;

// TypeScript types for archetype data
interface ArchetypeAttrs {
  Gender?: string;
  Age?: string;
  Pitch?: string;
  Style?: string;
  EnglishAccent?: string;
  [key: string]: string | undefined;
}

interface ArchetypeFacets {
  gender?: string;
  age?: string;
  pitch?: string;
  accent?: string;
  whisper?: boolean;
  lang?: string;
  [key: string]: string | boolean | undefined;
}

interface VoiceArchetype {
  id: string;
  name: string;
  icon: string;
  use_case: string;
  instruct: string;
  attrs: ArchetypeAttrs;
  facets: ArchetypeFacets;
  sample_script: string;
  preview_url: string | null;
  is_featured: boolean;
  language: string;
}

interface UseArchetypeRequest {
  endpoint?: string;
  id: string;
  name?: string;
  language?: string;
}

/**
 * GET /api/tts/omnivoice/archetypes
 * Fetches voice archetypes from OmniVoice Studio with optional filtering
 *
 * Query params:
 *   endpoint  - OmniVoice server URL (default: http://localhost:3900)
 *   use_case  - Filter by use case (e.g., "narration", "dialogue")
 *   gender    - Filter by gender (e.g., "female", "male")
 *   lang      - Filter by language (e.g., "English")
 *   limit     - Maximum number of archetypes to return
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || OMNIVOICE_DEFAULT_URL;
  const useCase = searchParams.get('use_case');
  const gender = searchParams.get('gender');
  const lang = searchParams.get('lang');
  const limit = searchParams.get('limit');

  // Normalize endpoint URL
  const baseUrl = endpoint.replace(/\/$/, '');

  // Build query string for OmniVoice
  const params = new URLSearchParams();
  if (useCase) params.set('use_case', useCase);
  if (gender) params.set('gender', gender);
  if (lang) params.set('lang', lang);
  if (limit) params.set('limit', limit);

  const queryString = params.toString();
  const fetchUrl = `${baseUrl}/archetypes${queryString ? `?${queryString}` : ''}`;

  console.log(`[OmniVoice-Archetypes] Fetching archetypes from ${fetchUrl}`);

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(ARCHETYPES_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[OmniVoice-Archetypes] Endpoint returned ${response.status}: ${errorText}`);
      return NextResponse.json({
        success: false,
        archetypes: [],
        error: `OmniVoice returned ${response.status}: ${errorText}`,
      }, { status: 502 });
    }

    const data = await response.json();

    // Validate response is an array
    if (!Array.isArray(data)) {
      console.error('[OmniVoice-Archetypes] Unexpected response format - expected array');
      return NextResponse.json({
        success: false,
        archetypes: [],
        error: 'Unexpected response format from OmniVoice - expected array',
      }, { status: 502 });
    }

    const archetypes: VoiceArchetype[] = data;
    console.log(`[OmniVoice-Archetypes] Successfully fetched ${archetypes.length} archetypes`);

    return NextResponse.json({
      success: true,
      archetypes,
      count: archetypes.length,
      endpoint: baseUrl,
      filters: {
        use_case: useCase || null,
        gender: gender || null,
        lang: lang || null,
        limit: limit ? parseInt(limit, 10) : null,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';

    if (isTimeout) {
      console.error(`[OmniVoice-Archetypes] Connection timed out after ${ARCHETYPES_TIMEOUT_MS}ms`);
      return NextResponse.json({
        success: false,
        archetypes: [],
        error: `Connection to OmniVoice timed out after ${ARCHETYPES_TIMEOUT_MS / 1000}s. Is the service running at ${baseUrl}?`,
      }, { status: 504 });
    }

    console.error(`[OmniVoice-Archetypes] Connection error:`, message);
    return NextResponse.json({
      success: false,
      archetypes: [],
      error: `Cannot connect to OmniVoice at ${baseUrl}: ${message}`,
    }, { status: 502 });
  }
}

/**
 * POST /api/tts/omnivoice/archetypes/use
 * Creates a voice profile from an archetype
 *
 * Proxies to: POST {endpoint}/archetypes/{id}/use
 *
 * Request body:
 *   endpoint  - OmniVoice server URL (default: http://localhost:3900)
 *   id        - Archetype ID (required)
 *   name      - Optional name for the new profile
 *   language  - Optional language override
 */
export async function POST(request: NextRequest) {
  try {
    const body: UseArchetypeRequest = await request.json();

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'Archetype ID is required',
      }, { status: 400 });
    }

    const endpoint = body.endpoint || OMNIVOICE_DEFAULT_URL;
    const baseUrl = endpoint.replace(/\/$/, '');
    const useUrl = `${baseUrl}/archetypes/${encodeURIComponent(body.id)}/use`;

    console.log(`[OmniVoice-Archetypes] Using archetype "${body.id}" → ${useUrl}`);

    // Build request body for OmniVoice
    const requestBody: Record<string, unknown> = {};
    if (body.name) requestBody.name = body.name;
    if (body.language) requestBody.language = body.language;

    const response = await fetch(useUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
      signal: AbortSignal.timeout(ARCHETYPES_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[OmniVoice-Archetypes] Use endpoint returned ${response.status}: ${errorText}`);
      return NextResponse.json({
        success: false,
        error: `OmniVoice returned ${response.status}: ${errorText}`,
      }, { status: 502 });
    }

    const profile = await response.json();
    console.log(`[OmniVoice-Archetypes] Successfully created profile from archetype "${body.id}"`);

    return NextResponse.json({
      success: true,
      profile,
      archetypeId: body.id,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';

    if (isTimeout) {
      console.error(`[OmniVoice-Archetypes] Use request timed out after ${ARCHETYPES_TIMEOUT_MS}ms`);
      return NextResponse.json({
        success: false,
        error: `Request to OmniVoice timed out after ${ARCHETYPES_TIMEOUT_MS / 1000}s`,
      }, { status: 504 });
    }

    console.error(`[OmniVoice-Archetypes] Use error:`, message);
    return NextResponse.json({
      success: false,
      error: `Failed to use archetype: ${message}`,
    }, { status: 500 });
  }
}
