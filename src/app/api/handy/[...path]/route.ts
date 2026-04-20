import { NextRequest, NextResponse } from 'next/server';

/**
 * Handy API v3 Proxy
 *
 * Official API v3 base: https://www.handyfeeling.com/api/handy-rest/v3
 *
 * AUTHENTICATION (based on official examples from platform-api-examples):
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Method A: App ID as Bearer token (simplest, recommended)        │
 *   │   - Send: Authorization: Bearer <app_id>                        │
 *   │   - Send: X-Connection-Key: <device_connection_key>             │
 *   │   - Works for ALL device endpoints directly                     │
 *   │   - Also works for SSE as: ?apikey=<app_id>&ck=<connection_key> │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Method B: REST API Key → Token issuance (two-step)             │
 *   │   Step 1: GET /auth/token/issue                                 │
 *   │     Headers: X-Api-Key: <rest_api_key>                          │
 *   │     Query:   ?apikey=<rest_api_key>&ck=<connection_key>         │
 *   │   Step 2: Use returned token for all device operations           │
 *   │     Headers: Authorization: Bearer <token>                      │
 *   │            X-Connection-Key: <device_connection_key>             │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 *   ⚠ X-Api-Key does NOT work directly for device endpoints (401)!
 *   ⚠ Only /servertime works without any authentication.
 *
 * Client → Proxy flow:
 *   GET requests:  appId and connectionKey as query parameters
 *   POST/PUT requests: appId and connectionKey as body fields
 *
 * Response format (v3):
 *   Success: { result: { ... } }
 *   Error:   { error: { code, name, message, connected } }
 */

const HANDY_API_V3 = 'https://www.handyfeeling.com/api/handy-rest/v3';

// ---- Endpoint name mapping ----
// The Handy v3 API uses lowercase paths with slashes: /connected, /hamp/start, /hdsp/xpvp
// Our internal names already match the API format, so most mappings are identity.
// Only 'mode2' differs (internal name for PUT /mode to avoid collision with GET /mode).
const ENDPOINT_MAP: Record<string, string> = {
  'mode2': 'mode', // PUT /mode (same URL as GET /mode)
};

function resolveEndpoint(pathSegments: string[], method: 'GET' | 'POST' | 'PUT' = 'GET'): string {
  const internal = pathSegments.join('/').replace(/^\/+|\/+$/g, '');
  return ENDPOINT_MAP[internal] || internal;
}

const VALID_ENDPOINTS = new Set([
  // Internal names (for validation before mapping)
  'servertime',
  'auth/token/issue',
  'connected',
  'info',
  'capabilities',
  'statistics',
  'mode',
  'mode2',
  'hamp/state',
  'hamp/start',
  'hamp/stop',
  'hamp/velocity',
  'hamp/stroke',
  'hdsp/state',
  'hdsp/xpvp',
  'hdsp/xpva',
  'hdsp/xava',
  'hdsp/xpt',
  'hdsp/xat',
  'hssp/state',
  'hssp/setup',
  'hssp/play',
  'hssp/stop',
  'hssp/pause',
  'hssp/resume',
  'hvp/state',
  'hvp/start',
  'hvp/stop',
  'hsp/setup',
  'hsp/add',
  'hsp/play',
  'hsp/stop',
  'hsp/flush',
  'hsp/state',
  'hsp/threshold',
  'slider/state',
  'slider/stroke',
  'settings/slider',
  'hstp/info',
  'hstp/offset',
  'hstp/clocksync',
  'sse',
]);

// Endpoints that do NOT require authentication
const NO_AUTH_ENDPOINTS = new Set([
  'servertime',
]);

// ---- Helpers ----

function sanitizeForLog(value: string): string {
  if (!value || value.length <= 6) return '****';
  return value.substring(0, 4) + '...';
}

function extractForwardParams(searchParams: URLSearchParams, ...excludeKeys: string[]): string {
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (!excludeKeys.includes(key)) {
      params.set(key, value);
    }
  });
  return params.toString();
}

// ---- Token cache (in-memory) ----
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function issueToken(
  restApiKey: string,
  connectionKey: string,
): Promise<{ token: string; expiresAt: number } | null> {
  const cacheKey = `${restApiKey}:${connectionKey}`;
  const cached = tokenCache.get(cacheKey);
  // Use cached token if it's valid for at least 5 more minutes
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached;
  }

  const params = new URLSearchParams({ apikey: restApiKey, ck: connectionKey });
  const url = `${HANDY_API_V3}/auth/token/issue?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': restApiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.result?.token) {
    console.error(`[Handy v3] Token issue failed:`, response.status, JSON.stringify(data));
    return null;
  }

  const result = {
    token: data.result.token as string,
    expiresAt: new Date(data.result.expires_at as string).getTime(),
  };

  tokenCache.set(cacheKey, result);
  return result;
}

// ---- Build headers for Handy API ----

function buildHandyHeaders(
  appId: string | null,
  connectionKey: string | null,
  issuedToken: string | null,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Authentication: prefer App ID as Bearer token, fall back to issued token
  if (appId) {
    headers['Authorization'] = `Bearer ${appId}`;
  } else if (issuedToken) {
    headers['Authorization'] = `Bearer ${issuedToken}`;
  }

  if (connectionKey) {
    headers['X-Connection-Key'] = connectionKey;
  }

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

// ---- GET handler ----

async function handleGet(
  request: NextRequest,
  pathSegments: string[],
) {
  // Validate using internal name, then resolve to v3 API name
  const internalName = pathSegments.join('/').replace(/^\/+|\/+$/g, '');
  if (!VALID_ENDPOINTS.has(internalName) && !NO_AUTH_ENDPOINTS.has(internalName)) {
    console.warn(`[Handy v3] Unknown GET endpoint: ${internalName}`);
  }
  const endpoint = resolveEndpoint(pathSegments, 'GET');

  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId') || null;
  const connectionKey = searchParams.get('connectionKey') || null;
  const restApiKey = searchParams.get('restApiKey') || null;

  const needsAuth = !NO_AUTH_ENDPOINTS.has(endpoint);

  if (needsAuth && !appId && !restApiKey) {
    return NextResponse.json(
      { error: { code: 400, name: 'BAD_REQUEST', message: 'appId or restApiKey is required for authentication' } },
      { status: 400 },
    );
  }

  // Special handling for /auth/token/issue
  if (endpoint === 'auth/token/issue') {
    const apiKey = searchParams.get('restApiKey') || appId;
    const ck = connectionKey || searchParams.get('ck');
    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 400, name: 'BAD_REQUEST', message: 'restApiKey or appId is required' } },
        { status: 400 },
      );
    }
    const tokenParams = new URLSearchParams({ apikey: apiKey });
    if (ck) tokenParams.set('ck', ck);

    const url = `${HANDY_API_V3}/auth/token/issue?${tokenParams.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: response.status });
  }

  // Issue token if using REST API Key (Method B)
  let issuedToken: string | null = null;
  if (!appId && restApiKey && connectionKey) {
    const tokenResult = await issueToken(restApiKey, connectionKey);
    if (!tokenResult) {
      return NextResponse.json(
        { error: { code: 401, name: 'AUTH_FAILED', message: 'Failed to issue token using REST API Key' } },
        { status: 401 },
      );
    }
    issuedToken = tokenResult.token;
  }

  // Build Handy headers
  const handyHeaders = buildHandyHeaders(appId, connectionKey, issuedToken, false);

  // Build URL with any extra query params forwarded
  const extraParams = extractForwardParams(searchParams, 'appId', 'connectionKey', 'restApiKey', 'ck');
  const url = `${HANDY_API_V3}/${endpoint}${extraParams ? '?' + extraParams : ''}`;

  console.log(
    `[Handy v3] GET ${internalName} → /${endpoint}` +
      (appId ? ` appId=${sanitizeForLog(appId)}` : '') +
      (connectionKey ? ` ck=${sanitizeForLog(connectionKey)}` : '') +
      (issuedToken ? ` token=${sanitizeForLog(issuedToken)}` : '') +
      (extraParams ? ` ?${extraParams}` : ''),
  );

  // SSE endpoint: forward as streaming response
  if (endpoint === 'sse') {
    // SSE uses ?apikey=<app_id>&ck=<connection_key> query params
    const sseParams = new URLSearchParams();
    if (appId) sseParams.set('apikey', appId);
    else if (issuedToken) sseParams.set('apikey', issuedToken);
    if (connectionKey) sseParams.set('ck', connectionKey);

    const eventsParam = searchParams.get('events');
    if (eventsParam) sseParams.set('events', eventsParam);

    const sseUrl = `${HANDY_API_V3}/sse?${sseParams.toString()}`;

    console.log(`[Handy v3] SSE proxy to: ${sseUrl.toString().substring(0, 80)}...`);

    const eventSource = await fetch(sseUrl, {
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(300000), // 5 min timeout for SSE
    });

    if (!eventSource.ok) {
      return NextResponse.json(
        { error: { code: eventSource.status, name: 'SSE_ERROR', message: 'Failed to connect to Handy SSE stream' } },
        { status: eventSource.status },
      );
    }

    // Forward SSE as a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = eventSource.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          console.error('[Handy v3] SSE stream error:', err);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: handyHeaders,
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`[Handy v3] GET /${endpoint} failed: ${response.status}`, JSON.stringify(data));
  }

  return NextResponse.json(data ?? {}, { status: response.status });
}

// ---- Write handler (POST/PUT from client → PUT to Handy) ----

async function handleWrite(
  request: NextRequest,
  pathSegments: string[],
) {
  // Validate using internal name, then resolve to v3 API name
  const internalName = pathSegments.join('/').replace(/^\/+|\/+$/g, '');
  if (!VALID_ENDPOINTS.has(internalName) && !NO_AUTH_ENDPOINTS.has(internalName)) {
    console.warn(`[Handy v3] Unknown write endpoint: ${internalName}`);
  }
  const endpoint = resolveEndpoint(pathSegments, 'PUT');

  const body = await request.json().catch(() => ({}));
  const { appId, connectionKey, restApiKey, ...payload } = body as Record<string, unknown>;

  if (!appId && !restApiKey) {
    return NextResponse.json(
      { error: { code: 400, name: 'BAD_REQUEST', message: 'appId or restApiKey is required for authentication' } },
      { status: 400 },
    );
  }

  // Issue token if using REST API Key (Method B)
  let issuedToken: string | null = null;
  if (!appId && restApiKey && connectionKey) {
    const tokenResult = await issueToken(restApiKey as string, connectionKey as string);
    if (!tokenResult) {
      return NextResponse.json(
        { error: { code: 401, name: 'AUTH_FAILED', message: 'Failed to issue token using REST API Key' } },
        { status: 401 },
      );
    }
    issuedToken = tokenResult.token;
  }

  // Build Handy headers
  const handyHeaders = buildHandyHeaders(
    appId as string | null,
    connectionKey as string | null,
    issuedToken,
    Object.keys(payload).length > 0,
  );

  // Determine the HTTP method to send to Handy
  const handyMethod = 'PUT';
  let url = `${HANDY_API_V3}/${endpoint}`;

  console.log(
    `[Handy v3] ${handyMethod} ${internalName} → /${endpoint}` +
      (appId ? ` appId=${sanitizeForLog(appId as string)}` : '') +
      (connectionKey ? ` ck=${sanitizeForLog(connectionKey as string)}` : '') +
      (issuedToken ? ` token=${sanitizeForLog(issuedToken)}` : '') +
      ` payload=${JSON.stringify(payload).substring(0, 120)}`,
  );

  // For endpoints with query params (e.g. hstp/clocksync)
  let finalUrl = url;
  let finalPayload = payload;

  if (endpoint === 'hstp/clocksync') {
    const qp = new URLSearchParams();
    if (payload.syncCount !== undefined) qp.set('syncCount', String(payload.syncCount));
    if (payload.outliers !== undefined) qp.set('outliers', String(payload.outliers));
    finalUrl = `${url}${qp.toString() ? '?' + qp.toString() : ''}`;
    finalPayload = {};
  }

  const response = await fetch(finalUrl, {
    method: handyMethod,
    headers: handyHeaders,
    body: Object.keys(finalPayload).length > 0 ? JSON.stringify(finalPayload) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`[Handy v3] ${handyMethod} /${endpoint} failed: ${response.status}`, JSON.stringify(data));
  }

  return NextResponse.json(data ?? {}, { status: response.status });
}

// ---- Route handlers ----

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    return await handleGet(request, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    console.error('[Handy v3] GET error:', message);

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? 504 : 500,
          name: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    return await handleWrite(request, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    console.error('[Handy v3] POST error:', message);

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? 504 : 500,
          name: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    return await handleWrite(request, path);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    console.error('[Handy v3] PUT error:', message);

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? 504 : 500,
          name: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
