import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Se requiere el parámetro "endpoint"' },
      { status: 400 }
    );
  }

  try {
    // Normalize endpoint - strip trailing slash, ensure /v1 base
    const baseUrl = endpoint.replace(/\/+$/, '');
    const modelsUrl = baseUrl.endsWith('/v1')
      ? `${baseUrl}/models`
      : `${baseUrl}/v1/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(modelsUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `LM Studio respondió con ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Tiempo de espera agotado (5s)'
      : err instanceof Error
        ? err.message
        : 'Error de conexión';

    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
