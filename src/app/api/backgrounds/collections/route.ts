import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, existsSync, mkdirSync, rmdirSync, unlinkSync, renameSync } from 'fs';
import path from 'path';
import type { BackgroundCollection, BackgroundCollectionEntry, BackgroundFile } from '@/types';

const BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

// Supported image and video formats
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv|ogv)$/i;
const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg|avif|mp4|webm|mov|avi|mkv|ogv)$/i;

/**
 * Ensure the backgrounds directory exists
 */
function ensureBackgroundsDir(): void {
  if (!existsSync(BACKGROUNDS_DIR)) {
    mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  }
}

/**
 * Sanitize folder name (remove special characters)
 */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s_-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Generate unique ID for collection entries
 */
function generateEntryId(): string {
  return `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Read collection.json metadata file if it exists
 */
async function readCollectionMetadata(collectionPath: string, collectionName: string): Promise<Partial<BackgroundCollection> | null> {
  const metadataPath = path.join(collectionPath, 'collection.json');
  
  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);
    
    console.log(`[BgAPI] Found collection.json for "${collectionName}"`);
    return metadata;
  } catch {
    // No metadata file, return null
    return null;
  }
}

/**
 * Save collection.json metadata file
 */
async function saveCollectionMetadata(collectionPath: string, metadata: Partial<BackgroundCollection>): Promise<void> {
  const metadataPath = path.join(collectionPath, 'collection.json');
  const content = JSON.stringify(metadata, null, 2);
  await fs.writeFile(metadataPath, content, 'utf-8');
  console.log(`[BgAPI] Saved collection.json for "${metadata.name}"`);
}

/**
 * Merge filesystem scan with JSON metadata
 * Always includes ALL files, merging metadata entries with auto-generated entries
 */
function mergeWithMetadata(
  files: BackgroundFile[],
  metadata: Partial<BackgroundCollection> | null,
  collectionName: string,
  collectionPath: string
): BackgroundCollection {
  const entries: BackgroundCollectionEntry[] = [];
  const usedUrls = new Set<string>();
  
  // First, add entries from metadata (they have configured triggerKeys, etc.)
  if (metadata?.entries && Array.isArray(metadata.entries)) {
    for (const entry of metadata.entries) {
      // Validate entry has required fields
      if (entry.id && entry.url) {
        entries.push({
          id: entry.id,
          name: entry.name || entry.id,
          url: entry.url,
          triggerKeys: entry.triggerKeys || [],
          contextKeys: entry.contextKeys || [],
          tags: entry.tags,
          transitionDuration: entry.transitionDuration,
        });
        usedUrls.add(entry.url);
      }
    }
  }
  
  // Then, add entries for files NOT in metadata entries
  // This ensures ALL files are available in entries
  for (const file of files) {
    if (!usedUrls.has(file.url)) {
      const entryId = `${collectionName}_${file.name.replace(MEDIA_EXTENSIONS, '')}`;
      entries.push({
        id: entryId,
        name: file.name.replace(MEDIA_EXTENSIONS, ''),
        url: file.url,
        triggerKeys: [],  // No default trigger keys
        contextKeys: [],  // No default context keys
        tags: file.type === 'video' ? ['video'] : undefined,
      });
    }
  }
  
  // Sort entries: those with triggerKeys first, then alphabetically
  entries.sort((a, b) => {
    const aHasTriggers = (a.triggerKeys?.length || 0) > 0 ? 0 : 1;
    const bHasTriggers = (b.triggerKeys?.length || 0) > 0 ? 0 : 1;
    if (aHasTriggers !== bHasTriggers) return aHasTriggers - bHasTriggers;
    return a.name.localeCompare(b.name);
  });
  
  return {
    name: metadata?.name || collectionName,
    path: `/backgrounds/${collectionName}`,
    description: metadata?.description,
    version: metadata?.version,
    transitionDuration: metadata?.transitionDuration,
    entries,
    files: files, // Return full file objects with name, url, type
  };
}

/**
 * Scan backgrounds directory and return collections with metadata
 */
async function scanBackgroundsDirectory(): Promise<BackgroundCollection[]> {
  try {
    const collections: BackgroundCollection[] = [];
    
    // Check if backgrounds directory exists
    try {
      await fs.access(BACKGROUNDS_DIR);
    } catch {
      return collections;
    }

    const entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });
    
    // Process subdirectories (collections)
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const collectionName = entry.name;
        const collectionPath = path.join(BACKGROUNDS_DIR, collectionName);
        const collectionFiles = await fs.readdir(collectionPath);
        
        // Get all media files
        const mediaFiles = collectionFiles
          .filter(file => MEDIA_EXTENSIONS.test(file))
          .map(file => {
            const isVideo = VIDEO_EXTENSIONS.test(file);
            return {
              name: file,
              url: `/backgrounds/${collectionName}/${file}`,
              type: isVideo ? 'video' : 'image' as const
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        
        if (mediaFiles.length > 0) {
          // Read metadata if exists
          const metadata = await readCollectionMetadata(collectionPath, collectionName);
          
          // Merge files with metadata
          const collection = mergeWithMetadata(
            mediaFiles,
            metadata,
            collectionName,
            collectionPath
          );
          
          collections.push(collection);
        }
      }
    }

    return collections.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error scanning backgrounds directory:', error);
    return [];
  }
}

// ============================================
// GET - List all collections
// ============================================
export async function GET() {
  const collections = await scanBackgroundsDirectory();
  return NextResponse.json({ collections });
}

// ============================================
// POST - Create new collection
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, description, folderName } = body;

    // Create new collection
    if (action === 'create' || name) {
      const collectionName = folderName || sanitizeFolderName(name);
      
      if (!collectionName || collectionName.length < 1) {
        return NextResponse.json(
          { error: 'Invalid collection name' },
          { status: 400 }
        );
      }

      ensureBackgroundsDir();
      
      const collectionPath = path.join(BACKGROUNDS_DIR, collectionName);
      
      // Check if already exists
      if (existsSync(collectionPath)) {
        return NextResponse.json(
          { error: `Collection "${collectionName}" already exists` },
          { status: 409 }
        );
      }

      // Create folder
      await fs.mkdir(collectionPath, { recursive: true });

      // Create default collection.json
      const metadata: Partial<BackgroundCollection> = {
        name: name || collectionName,
        description: description || '',
        version: '1.0',
        transitionDuration: 500,
        entries: []
      };

      await saveCollectionMetadata(collectionPath, metadata);

      // Return new collection
      const newCollection: BackgroundCollection = {
        name: metadata.name!,
        path: `/backgrounds/${collectionName}`,
        description: metadata.description,
        version: metadata.version,
        transitionDuration: metadata.transitionDuration,
        entries: [],
        files: []
      };

      return NextResponse.json({ 
        success: true, 
        collection: newCollection,
        message: `Collection "${collectionName}" created successfully`
      });
    }

    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update collection metadata or rename
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderName, newName, newFolderName, description, entries, transitionDuration } = body;

    if (!folderName) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    const collectionPath = path.join(BACKGROUNDS_DIR, folderName);

    if (!existsSync(collectionPath)) {
      return NextResponse.json(
        { error: `Collection "${folderName}" not found` },
        { status: 404 }
      );
    }

    // Read existing metadata
    const existingMetadata = await readCollectionMetadata(collectionPath, folderName) || {};
    
    // Update metadata
    const updatedMetadata: Partial<BackgroundCollection> = {
      name: newName || existingMetadata.name || folderName,
      description: description !== undefined ? description : existingMetadata.description,
      version: existingMetadata.version || '1.0',
      transitionDuration: transitionDuration ?? existingMetadata.transitionDuration ?? 500,
      entries: entries || existingMetadata.entries || []
    };

    // Handle folder rename
    if (newFolderName && newFolderName !== folderName) {
      const sanitizedNewName = sanitizeFolderName(newFolderName);
      
      if (sanitizedNewName !== folderName) {
        const newPath = path.join(BACKGROUNDS_DIR, sanitizedNewName);
        
        if (existsSync(newPath)) {
          return NextResponse.json(
            { error: `Collection "${sanitizedNewName}" already exists` },
            { status: 409 }
          );
        }

        // Rename folder
        renameSync(collectionPath, newPath);
        
        // Update paths in entries
        updatedMetadata.entries = updatedMetadata.entries?.map(entry => ({
          ...entry,
          url: entry.url.replace(`/backgrounds/${folderName}/`, `/backgrounds/${sanitizedNewName}/`)
        })) || [];

        // Save metadata to new location
        await saveCollectionMetadata(newPath, updatedMetadata);

        return NextResponse.json({ 
          success: true,
          oldPath: folderName,
          newPath: sanitizedNewName,
          message: `Collection renamed to "${sanitizedNewName}"`
        });
      }
    }

    // Save updated metadata
    await saveCollectionMetadata(collectionPath, updatedMetadata);

    return NextResponse.json({ 
      success: true,
      message: 'Collection updated successfully'
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Delete collection or specific background
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderName = searchParams.get('folderName');
    const filename = searchParams.get('filename');

    if (!folderName) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    const collectionPath = path.join(BACKGROUNDS_DIR, folderName);

    if (!existsSync(collectionPath)) {
      return NextResponse.json(
        { error: `Collection "${folderName}" not found` },
        { status: 404 }
      );
    }

    // Delete specific file from collection
    if (filename) {
      const filePath = path.join(collectionPath, filename);
      
      if (!existsSync(filePath)) {
        return NextResponse.json(
          { error: `File "${filename}" not found` },
          { status: 404 }
        );
      }

      // Delete file
      await fs.unlink(filePath);

      // Update metadata to remove entry
      const existingMetadata = await readCollectionMetadata(collectionPath, folderName);
      if (existingMetadata?.entries) {
        const fileUrl = `/backgrounds/${folderName}/${filename}`;
        existingMetadata.entries = existingMetadata.entries.filter(e => e.url !== fileUrl);
        await saveCollectionMetadata(collectionPath, existingMetadata);
      }

      return NextResponse.json({ 
        success: true,
        message: `File "${filename}" deleted`
      });
    }

    // Delete entire collection
    // First, delete all files in the folder
    const files = await fs.readdir(collectionPath);
    for (const file of files) {
      await fs.unlink(path.join(collectionPath, file));
    }
    
    // Then remove the folder
    await fs.rmdir(collectionPath);

    return NextResponse.json({ 
      success: true,
      message: `Collection "${folderName}" deleted`
    });
  } catch (error) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
