import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Supported image and video types
const ALLOWED_TYPES = [
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'image/webp', 
  'video/webm',
  'video/mp4',
  'video/quicktime' // .mov
];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB for videos

/**
 * Generate unique ID for collection entries
 */
function generateEntryId(): string {
  return `bg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Read and update collection.json when uploading backgrounds
 */
async function updateCollectionJson(collectionPath: string, filename: string, publicUrl: string): Promise<void> {
  const metadataPath = path.join(collectionPath, 'collection.json');
  
  try {
    let metadata: Record<string, unknown> = {
      name: path.basename(collectionPath),
      version: '1.0',
      transitionDuration: 500,
      entries: []
    };

    // Read existing metadata if exists
    if (existsSync(metadataPath)) {
      const content = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(content);
    }

    // Check if entry already exists
    const entries = (metadata.entries as Array<Record<string, unknown>>) || [];
    const existingIndex = entries.findIndex(e => e.url === publicUrl);
    
    const isVideo = /\.(mp4|webm|mov|avi|mkv|ogv)$/i.test(filename);
    const name = filename.replace(/\.[^.]+$/, '');
    
    const newEntry = {
      id: generateEntryId(),
      name,
      url: publicUrl,
      triggerKeys: [],
      contextKeys: [],
      tags: isVideo ? ['video'] : []
    };

    if (existingIndex >= 0) {
      // Update existing entry (preserve triggerKeys, contextKeys, tags)
      entries[existingIndex] = {
        ...entries[existingIndex],
        name,
        url: publicUrl
      };
    } else {
      // Add new entry
      entries.push(newEntry);
    }

    metadata.entries = entries;
    
    // Save metadata
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`[Upload] Updated collection.json for ${path.basename(collectionPath)}`);
  } catch (error) {
    console.error('[Upload] Error updating collection.json:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'avatar'; // avatar, background, sprite, etc.
    const collection = formData.get('collection') as string | null; // For sprites/backgrounds: collection name

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, WebM, MP4, MOV' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${timestamp}-${randomString}.${ext}`;

    // Determine upload directory based on type
    let uploadDir: string;
    let publicUrl: string;

    if (type === 'background' && collection) {
      // Upload to backgrounds collection
      uploadDir = path.join(process.cwd(), 'public', 'backgrounds', collection);
      publicUrl = `/backgrounds/${collection}/${filename}`;
    } else if (type === 'sprite' && collection) {
      // Upload to sprites collection
      uploadDir = path.join(process.cwd(), 'public', 'sprites', collection);
      publicUrl = `/sprites/${collection}/${filename}`;
    } else {
      // Default upload location
      uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
      publicUrl = `/uploads/${type}/${filename}`;
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Write file
    const filePath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update collection.json if uploading background
    if (type === 'background' && collection) {
      await updateCollectionJson(uploadDir, filename, publicUrl);
    }

    // Determine if it's an animation
    const isAnimation = /\.(gif|webm|mp4|mov|apng)$/i.test(filename);
    const isVideo = /\.(webm|mp4|mov|avi|mkv)$/i.test(filename);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      isAnimation,
      isVideo
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || !url.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', url);
    
    // Check if file exists and delete
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
