import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SOUNDS_DIR = path.join(process.cwd(), 'public', 'sounds');

async function scanSoundsDirectory(): Promise<{ name: string; path: string; files: string[] }[]> {
  try {
    const collections: { name: string; path: string; files: string[] }[] = [];
    
    // Check if sounds directory exists
    try {
      await fs.access(SOUNDS_DIR);
    } catch {
      return collections;
    }

    const entries = await fs.readdir(SOUNDS_DIR, { withFileTypes: true });
    
    // Process root level sound files
    const rootFiles: string[] = [];
    for (const entry of entries) {
      if (entry.isFile() && /\.(mp3|wav|ogg|m4a|webm)$/i.test(entry.name)) {
        rootFiles.push(`/sounds/${entry.name}`);
      }
    }
    
    if (rootFiles.length > 0) {
      collections.push({
        name: '__root__',
        path: '/sounds',
        files: rootFiles
      });
    }

    // Process subdirectories (collections)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionPath = path.join(SOUNDS_DIR, entry.name);
        const collectionFiles = await fs.readdir(collectionPath);
        
        const soundFiles = collectionFiles
          .filter(file => /\.(mp3|wav|ogg|m4a|webm)$/i.test(file))
          .map(file => `/sounds/${entry.name}/${file}`)
          .sort();
        
        if (soundFiles.length > 0) {
          collections.push({
            name: entry.name,
            path: `/sounds/${entry.name}`,
            files: soundFiles
          });
        }
      }
    }

    return collections.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error scanning sounds directory:', error);
    return [];
  }
}

export async function GET() {
  const collections = await scanSoundsDirectory();
  return NextResponse.json({ collections });
}
