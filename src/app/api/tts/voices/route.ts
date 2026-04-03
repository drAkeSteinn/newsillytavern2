// ============================================
// TTS Voices API Route - Manage voice references for voice cloning
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const VOICES_DIR = path.join(process.cwd(), 'public', 'uploads', 'voices');
const TTS_WEBUI_DEFAULT_URL = 'http://localhost:7778';

// Ensure voices directory exists
async function ensureVoicesDir() {
  try {
    await fs.mkdir(VOICES_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

// Get list of voice references
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || TTS_WEBUI_DEFAULT_URL;

  try {
    await ensureVoicesDir();

    // Read voices from local directory
    const files = await fs.readdir(VOICES_DIR);
    const voices: Array<{
      id: string;
      name: string;
      path: string;
      url: string;
      type: string;
      size: number;
      createdAt: Date;
    }> = [];

    for (const file of files) {
      if (file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.ogg') || file.endsWith('.flac')) {
        const filePath = path.join(VOICES_DIR, file);
        const stats = await fs.stat(filePath);

        voices.push({
          id: file.replace(/\.[^.]+$/, ''),
          name: file,
          path: filePath,
          url: `/uploads/voices/${file}`,
          type: file.split('.').pop() || 'wav',
          size: stats.size,
          createdAt: stats.birthtime,
        });
      }
    }

    // Also try to get voices from TTS-WebUI if available
    let webuiVoices: string[] = [];
    try {
      // Normalize endpoint
      let baseUrl = endpoint.replace(/\/v1$/, '').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/v1/audio/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Parse voices from different possible formats
        if (Array.isArray(data)) {
          webuiVoices = data.map((v: Record<string, unknown>) => v.path || v.voice || v.id || '').filter(Boolean);
        } else if (data.voices && Array.isArray(data.voices)) {
          webuiVoices = data.voices.map((v: Record<string, unknown>) => v.path || v.voice || v.id || '').filter(Boolean);
        } else if (data.data && Array.isArray(data.data)) {
          webuiVoices = data.data.map((v: Record<string, unknown>) => v.path || v.voice || v.id || '').filter(Boolean);
        }
      }
    } catch {
      // TTS-WebUI doesn't have a /v1/audio/ endpoint or is offline
    }

    return NextResponse.json({
      success: true,
      voices,
      webuiVoices,
      endpoint,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get voices',
    }, { status: 500 });
  }
}

// Upload a new voice reference
export async function POST(request: NextRequest) {
  try {
    await ensureVoicesDir();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid file type: ${file.type}. Supported: wav, mp3, ogg, flac`,
      }, { status: 400 });
    }

    // Generate filename
    const extension = file.name.split('.').pop() || 'wav';
    const filename = name
      ? `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`
      : `voice_${Date.now()}.${extension}`;

    const filePath = path.join(VOICES_DIR, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      voice: {
        id: filename.replace(/\.[^.]+$/, ''),
        name: filename,
        url: `/uploads/voices/${filename}`,
        path: filePath,
        type: extension,
        size: buffer.length,
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload voice',
    }, { status: 500 });
  }
}

// Delete a voice reference
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('id');

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 });
    }

    // Find and delete the file
    const files = await fs.readdir(VOICES_DIR);
    const voiceFile = files.find(f => f.startsWith(voiceId));

    if (!voiceFile) {
      return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
    }

    await fs.unlink(path.join(VOICES_DIR, voiceFile));

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete voice',
    }, { status: 500 });
  }
}
