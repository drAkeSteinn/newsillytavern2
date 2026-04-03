import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SPRITES_DIR = path.join(process.cwd(), 'public', 'sprites');
const METADATA_FILENAME = 'metadata.json';

// Supported sprite formats
const ALL_SPRITE_EXTENSIONS = /\.(png|jpg|jpeg|webp|gif|webm|apng)$/i;

interface SpriteIndexEntry {
  label: string;
  filename: string;
  url: string;
  thumb?: string;
  pack?: string;
  expressions?: string[];
}

interface SpriteMetadataEntry {
  label: string;
  filename: string;
  createdAt: string;
  updatedAt?: string;
}

// Metadata structure for each collection
interface CollectionMetadata {
  version: number;
  collectionName: string;
  sprites: {
    [filename: string]: SpriteMetadataEntry;
  };
  createdAt?: string;
  updatedAt?: string;
}

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Get metadata file path for a collection
function getMetadataPath(collectionName: string): string {
  return path.join(SPRITES_DIR, collectionName, METADATA_FILENAME);
}

// Load metadata for a specific collection
async function loadCollectionMetadata(collectionName: string): Promise<CollectionMetadata> {
  const metaPath = getMetadataPath(collectionName);
  try {
    const data = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    // Return empty metadata structure
    return {
      version: 1,
      collectionName,
      sprites: {},
      createdAt: new Date().toISOString(),
    };
  }
}

// Save metadata for a specific collection
async function saveCollectionMetadata(collectionName: string, meta: CollectionMetadata) {
  const collectionDir = path.join(SPRITES_DIR, collectionName);
  await ensureDir(collectionDir);
  
  meta.updatedAt = new Date().toISOString();
  const metaPath = getMetadataPath(collectionName);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

// Build label from filename
function generateLabelFromFilename(filename: string): string {
  const baseName = filename.replace(/\.[^.]+$/, '');
  return baseName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');
}

async function buildSpriteIndex(): Promise<{ sprites: SpriteIndexEntry[]; lastUpdated: number; source: string }> {
  const sprites: SpriteIndexEntry[] = [];
  
  try {
    // Check if sprites directory exists
    try {
      await fs.access(SPRITES_DIR);
    } catch {
      return { sprites: [], lastUpdated: Date.now(), source: SPRITES_DIR };
    }

    const entries = await fs.readdir(SPRITES_DIR, { withFileTypes: true });
    
    // Process subdirectories (collections/packs)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionName = entry.name;
        const collectionPath = path.join(SPRITES_DIR, collectionName);

        let collectionFiles: string[] = [];
        try {
          collectionFiles = await fs.readdir(collectionPath);
        } catch {
          continue;
        }

        // Load collection-specific metadata
        const meta = await loadCollectionMetadata(collectionName);

        for (const file of collectionFiles) {
          // Skip metadata file
          if (file === METADATA_FILENAME) continue;
          if (!ALL_SPRITE_EXTENSIONS.test(file)) continue;
          
          const baseName = file.replace(/\.[^.]+$/, '');
          
          // Use metadata label if defined, otherwise generate from filename
          const metaEntry = meta.sprites[file];
          const label = metaEntry?.label || generateLabelFromFilename(file);
          
          const url = `/sprites/${collectionName}/${file}`;
          
          // Try to find expressions from filename patterns
          const expressions: string[] = [];
          const expressionPatterns = ['happy', 'sad', 'angry', 'idle', 'talk', 'thinking', 'blush', 'surprised'];
          for (const exp of expressionPatterns) {
            if (baseName.toLowerCase().includes(exp)) {
              expressions.push(exp);
            }
          }
          
          sprites.push({
            label,
            filename: file,
            url,
            pack: collectionName,
            expressions: expressions.length > 0 ? expressions : undefined,
          });
        }
      }
    }

    // Sort by label
    sprites.sort((a, b) => a.label.localeCompare(b.label));
    
    return {
      sprites,
      lastUpdated: Date.now(),
      source: SPRITES_DIR,
    };
  } catch (error) {
    console.error('Error building sprite index:', error);
    return { sprites: [], lastUpdated: Date.now(), source: SPRITES_DIR };
  }
}

export async function GET() {
  const index = await buildSpriteIndex();
  return NextResponse.json(index);
}

// POST - Add new sprite metadata to a collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, filename, url, pack = 'custom' } = body;
    
    if (!label || !filename) {
      return NextResponse.json({ error: 'Label and filename are required' }, { status: 400 });
    }
    
    // Ensure collection directory exists
    const collectionDir = path.join(SPRITES_DIR, pack);
    await ensureDir(collectionDir);
    
    // Load collection metadata
    const meta = await loadCollectionMetadata(pack);
    
    // Check for duplicate label in this collection
    for (const [existingFile, data] of Object.entries(meta.sprites)) {
      if (data.label === label && existingFile !== filename) {
        return NextResponse.json({ error: 'Ya existe un sprite con este label en esta colección' }, { status: 400 });
      }
    }
    
    // Add or update sprite metadata
    meta.sprites[filename] = {
      label,
      filename,
      createdAt: meta.sprites[filename]?.createdAt || new Date().toISOString(),
    };
    
    await saveCollectionMetadata(pack, meta);
    
    return NextResponse.json({
      success: true,
      sprite: {
        label,
        filename,
        url: url || `/sprites/${pack}/${filename}`,
        pack,
      },
    });
  } catch (error) {
    console.error('Error adding sprite metadata:', error);
    return NextResponse.json({ error: 'Error al agregar sprite' }, { status: 500 });
  }
}

// PATCH - Rename sprite label in a collection
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldLabel, newLabel, pack, filename } = body;
    
    if (!oldLabel || !newLabel || !pack) {
      return NextResponse.json({ error: 'oldLabel, newLabel and pack are required' }, { status: 400 });
    }
    
    // Load collection metadata
    const meta = await loadCollectionMetadata(pack);
    
    // Find the entry with old label
    let foundFilename: string | null = filename || null;
    
    if (!foundFilename) {
      // Search by label
      for (const [fn, data] of Object.entries(meta.sprites)) {
        if (data.label === oldLabel) {
          foundFilename = fn;
          break;
        }
      }
    }
    
    // If not in metadata, try to find by filename pattern in filesystem
    if (!foundFilename) {
      try {
        const collectionDir = path.join(SPRITES_DIR, pack);
        const files = await fs.readdir(collectionDir);
        
        for (const file of files) {
          if (file === METADATA_FILENAME) continue;
          if (!ALL_SPRITE_EXTENSIONS.test(file)) continue;
          
          const generatedLabel = generateLabelFromFilename(file);
          if (generatedLabel === oldLabel) {
            foundFilename = file;
            break;
          }
        }
      } catch {
        // Collection directory not found
      }
    }
    
    if (!foundFilename) {
      return NextResponse.json({ error: 'Sprite no encontrado' }, { status: 404 });
    }
    
    // Check for duplicate new label in the same collection
    for (const [fn, data] of Object.entries(meta.sprites)) {
      if (data.label === newLabel && fn !== foundFilename) {
        return NextResponse.json({ error: 'Ya existe un sprite con este label en esta colección' }, { status: 400 });
      }
    }
    
    // Update or create the entry
    meta.sprites[foundFilename] = {
      label: newLabel,
      filename: foundFilename,
      createdAt: meta.sprites[foundFilename]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await saveCollectionMetadata(pack, meta);
    
    return NextResponse.json({ 
      success: true, 
      sprite: {
        label: newLabel,
        filename: foundFilename,
        pack,
        url: `/sprites/${pack}/${foundFilename}`,
      }
    });
  } catch (error) {
    console.error('Error renaming sprite:', error);
    return NextResponse.json({ error: 'Error al renombrar sprite' }, { status: 500 });
  }
}

// DELETE - Remove sprite metadata and file from a collection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const label = searchParams.get('label');
    const pack = searchParams.get('pack');
    
    if (!label || !pack) {
      return NextResponse.json({ error: 'Label and pack are required' }, { status: 400 });
    }
    
    // Load collection metadata
    const meta = await loadCollectionMetadata(pack);
    
    // Find the entry by label
    let foundFilename: string | null = null;
    
    for (const [fn, data] of Object.entries(meta.sprites)) {
      if (data.label === label) {
        foundFilename = fn;
        break;
      }
    }
    
    // If not in metadata, try to find by filename pattern
    if (!foundFilename) {
      try {
        const collectionDir = path.join(SPRITES_DIR, pack);
        const files = await fs.readdir(collectionDir);
        
        for (const file of files) {
          if (file === METADATA_FILENAME) continue;
          if (!ALL_SPRITE_EXTENSIONS.test(file)) continue;
          
          const generatedLabel = generateLabelFromFilename(file);
          if (generatedLabel === label) {
            foundFilename = file;
            break;
          }
        }
      } catch {
        // Collection directory not found
      }
    }
    
    if (!foundFilename) {
      return NextResponse.json({ error: 'Sprite no encontrado' }, { status: 404 });
    }
    
    // Delete the actual file
    try {
      const filePath = path.join(SPRITES_DIR, pack, foundFilename);
      await fs.unlink(filePath);
    } catch {
      // File might not exist, continue
    }
    
    // Remove from metadata
    delete meta.sprites[foundFilename];
    await saveCollectionMetadata(pack, meta);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sprite:', error);
    return NextResponse.json({ error: 'Error al eliminar sprite' }, { status: 500 });
  }
}
