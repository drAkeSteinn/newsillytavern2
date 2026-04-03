import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';

const SPRITES_DIR = path.join(process.cwd(), 'public', 'sprites');

// Create a new collection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
    }

    // Sanitize collection name
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (sanitizedName.length === 0) {
      return NextResponse.json({ error: 'Invalid collection name' }, { status: 400 });
    }

    // Check if sprites directory exists
    if (!existsSync(SPRITES_DIR)) {
      await fs.mkdir(SPRITES_DIR, { recursive: true });
    }

    // Check if collection already exists
    const collectionPath = path.join(SPRITES_DIR, sanitizedName);
    if (existsSync(collectionPath)) {
      return NextResponse.json({ error: 'Collection already exists' }, { status: 400 });
    }

    // Create collection directory
    await fs.mkdir(collectionPath, { recursive: true });

    return NextResponse.json({
      success: true,
      collection: {
        id: sanitizedName.toLowerCase(),
        name: sanitizedName,
        path: `/sprites/${sanitizedName}`,
        files: []
      }
    });
  } catch (error) {
    console.error('Create collection error:', error);
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
  }
}

// Delete a sprite or collection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const collection = searchParams.get('collection');

    // Delete entire collection
    if (collection && !url) {
      const collectionPath = path.join(SPRITES_DIR, collection);
      
      if (!existsSync(collectionPath)) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      }

      // Delete all files in collection
      const files = await fs.readdir(collectionPath);
      for (const file of files) {
        await fs.unlink(path.join(collectionPath, file));
      }
      
      // Delete collection directory
      await fs.rmdir(collectionPath);

      return NextResponse.json({ success: true, message: 'Collection deleted' });
    }

    // Delete single sprite
    if (url) {
      if (!url.startsWith('/sprites/')) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }

      const filePath = path.join(process.cwd(), 'public', url);
      
      if (!existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      await fs.unlink(filePath);

      return NextResponse.json({ success: true, message: 'Sprite deleted' });
    }

    return NextResponse.json({ error: 'Missing url or collection parameter' }, { status: 400 });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
