import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { BackgroundIndex, BackgroundIndexEntry } from '@/types';

const BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

// Supported image formats for backgrounds
const BG_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|bmp|svg|mp4|webm|mov)$/i;

async function scanBackgroundsDirectory(): Promise<BackgroundIndex> {
  const backgrounds: BackgroundIndexEntry[] = [];
  
  try {
    // Check if backgrounds directory exists
    try {
      await fs.access(BACKGROUNDS_DIR);
    } catch {
      return { backgrounds: [], lastUpdated: Date.now(), source: 'scan' };
    }

    const entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });
    
    // Process root level background files
    for (const entry of entries) {
      if (entry.isFile() && BG_EXTENSIONS.test(entry.name)) {
        const url = `/backgrounds/${entry.name}`;
        backgrounds.push({
          label: entry.name,
          filename: entry.name,
          url,
          thumb: url,
          pack: '__root__'
        });
      }
    }

    // Process subdirectories (packs)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const packName = entry.name;
        const packPath = path.join(BACKGROUNDS_DIR, packName);
        
        try {
          const packFiles = await fs.readdir(packPath);
          
          for (const file of packFiles) {
            if (BG_EXTENSIONS.test(file)) {
              const url = `/backgrounds/${packName}/${file}`;
              backgrounds.push({
                label: `${packName}/${file}`,
                filename: file,
                url,
                thumb: url,
                pack: packName
              });
            }
          }
        } catch {
          // Skip directories that can't be read
          continue;
        }
      }
    }

    // Sort by label
    backgrounds.sort((a, b) => a.label.localeCompare(b.label));

    return {
      backgrounds,
      lastUpdated: Date.now(),
      source: 'scan'
    };
  } catch (error) {
    console.error('Error scanning backgrounds directory:', error);
    return { backgrounds: [], lastUpdated: Date.now(), source: 'scan' };
  }
}

export async function GET() {
  const index = await scanBackgroundsDirectory();
  return NextResponse.json(index);
}
