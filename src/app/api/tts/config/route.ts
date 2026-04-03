// ============================================
// TTS Config API - Persist TTS configuration
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { TTSWebUIConfig, ASRConfig } from '@/types';

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'tts-config.json');

// Default configuration
const DEFAULT_TTS_CONFIG: TTSWebUIConfig = {
  enabled: false,
  autoGeneration: false,
  baseUrl: 'http://localhost:7778',
  model: 'multilingual',
  whisperModel: 'whisper-large-v3',
  speed: 1.0,
  responseFormat: 'wav',
  language: 'es',
  exaggeration: 0.5,
  cfgWeight: 0.5,
  temperature: 0.8,
  generateDialogues: true,
  generateNarrations: true,
  generatePlainText: true,
  applyRegex: false,
};

const DEFAULT_ASR_CONFIG: ASRConfig = {
  enabled: true,
  provider: 'tts-webui',
  model: 'whisper-small', // Recommended for Spanish - good balance of speed and accuracy
};

interface TTSConfigFile {
  tts: TTSWebUIConfig;
  asr: ASRConfig;
  updatedAt: string;
}

// Ensure config directory exists
async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

// Read config from file
async function readConfig(): Promise<TTSConfigFile> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(content);
    
    // Migrate old properties to new ones
    const ttsConfig = { ...DEFAULT_TTS_CONFIG, ...config.tts };
    
    // Migration: narrateDialoguesOnly -> generateDialogues
    if ('narrateDialoguesOnly' in ttsConfig && !('generateDialogues' in ttsConfig)) {
      // If narrateDialoguesOnly was true, only generate dialogues
      ttsConfig.generateDialogues = true;
      ttsConfig.generateNarrations = !ttsConfig.ignoreAsterisks;
      ttsConfig.generatePlainText = !ttsConfig.ignorePlainText;
    }
    
    // Migration: ignoreAsterisks -> generateNarrations (inverse)
    if ('ignoreAsterisks' in ttsConfig && !('generateNarrations' in ttsConfig)) {
      ttsConfig.generateNarrations = !(ttsConfig as Record<string, unknown>).ignoreAsterisks;
    }
    
    // Migration: ignorePlainText -> generatePlainText (inverse)
    if ('ignorePlainText' in ttsConfig && !('generatePlainText' in ttsConfig)) {
      ttsConfig.generatePlainText = !(ttsConfig as Record<string, unknown>).ignorePlainText;
    }
    
    // Remove old properties
    delete (ttsConfig as Record<string, unknown>).narrateDialoguesOnly;
    delete (ttsConfig as Record<string, unknown>).ignoreAsterisks;
    delete (ttsConfig as Record<string, unknown>).ignorePlainText;
    
    return {
      tts: ttsConfig,
      asr: { ...DEFAULT_ASR_CONFIG, ...config.asr },
      updatedAt: config.updatedAt || new Date().toISOString(),
    };
  } catch {
    // File doesn't exist, return defaults
    return {
      tts: DEFAULT_TTS_CONFIG,
      asr: DEFAULT_ASR_CONFIG,
      updatedAt: new Date().toISOString(),
    };
  }
}

// Write config to file
async function writeConfig(config: TTSConfigFile): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// GET - Load config
export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read config',
    }, { status: 500 });
  }
}

// POST - Save config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Read existing config to merge
    const existing = await readConfig();

    const newConfig: TTSConfigFile = {
      tts: { ...DEFAULT_TTS_CONFIG, ...existing.tts, ...body.tts },
      asr: { ...DEFAULT_ASR_CONFIG, ...existing.asr, ...body.asr },
      updatedAt: new Date().toISOString(),
    };

    await writeConfig(newConfig);

    return NextResponse.json({
      success: true,
      config: newConfig,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save config',
    }, { status: 500 });
  }
}
