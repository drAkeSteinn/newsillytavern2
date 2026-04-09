import { NextRequest, NextResponse } from 'next/server';
import {
  loadAllBackgroundTriggerPacks,
  loadBackgroundTriggerPackById,
  saveBackgroundTriggerPack,
  saveAllBackgroundTriggerPacks,
  deleteBackgroundTriggerPack,
  createNewBackgroundTriggerPack,
  createNewBackgroundTriggerItem,
  duplicateBackgroundTriggerPack,
  validateBackgroundTriggerPack,
  loadBackgroundCollections,
  saveBackgroundCollections,
} from '@/lib/background-triggers/storage';
import type { BackgroundTriggerPack, BackgroundTriggerItem } from '@/types';

// GET - Load background trigger packs or single pack
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const collections = searchParams.get('collections');

    // Get collections
    if (collections === 'true') {
      const bgCollections = loadBackgroundCollections();
      return NextResponse.json({ collections: bgCollections });
    }

    // Get single pack by ID
    if (id) {
      const pack = loadBackgroundTriggerPackById(id);
      if (!pack) {
        return NextResponse.json(
          { error: `Pack not found: ${id}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ pack });
    }

    // Get all packs
    const packs = loadAllBackgroundTriggerPacks();
    return NextResponse.json({ packs });
  } catch (error) {
    console.error('[API] Error loading background trigger packs:', error);
    return NextResponse.json(
      { error: 'Failed to load background trigger packs' },
      { status: 500 }
    );
  }
}

// POST - Create new pack, duplicate, or save
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pack, id, name, collection, sourceId, newId } = body;

    // Duplicate existing pack
    if (action === 'duplicate' && sourceId && newId) {
      const source = loadBackgroundTriggerPackById(sourceId);
      if (!source) {
        return NextResponse.json(
          { error: `Source pack not found: ${sourceId}` },
          { status: 404 }
        );
      }

      const duplicated = duplicateBackgroundTriggerPack(source, newId);
      saveBackgroundTriggerPack(duplicated);
      
      return NextResponse.json({ 
        success: true, 
        pack: duplicated,
        message: 'Pack duplicated successfully'
      });
    }

    // Create new pack with basic info
    if (id && name) {
      const newPack = createNewBackgroundTriggerPack(id, name, collection || '');
      
      // Validate
      const validation = validateBackgroundTriggerPack(newPack);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        );
      }

      // Save to disk
      saveBackgroundTriggerPack(newPack);
      
      return NextResponse.json({ 
        success: true, 
        pack: newPack,
        message: 'Pack created successfully'
      });
    }

    // Save full pack
    if (pack) {
      const validation = validateBackgroundTriggerPack(pack);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        );
      }

      // Update timestamp
      pack.updatedAt = new Date().toISOString();
      saveBackgroundTriggerPack(pack as BackgroundTriggerPack);
      
      return NextResponse.json({ 
        success: true, 
        pack,
        message: 'Pack saved successfully'
      });
    }

    // Save collections
    if (body.collections && Array.isArray(body.collections)) {
      saveBackgroundCollections(body.collections);
      return NextResponse.json({ 
        success: true,
        message: 'Collections saved successfully'
      });
    }

    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error saving background trigger pack:', error);
    return NextResponse.json(
      { error: 'Failed to save background trigger pack' },
      { status: 500 }
    );
  }
}

// PUT - Update existing pack or all packs
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pack, packs } = body;

    // Update all packs at once
    if (packs && Array.isArray(packs)) {
      for (const p of packs as BackgroundTriggerPack[]) {
        const validation = validateBackgroundTriggerPack(p);
        if (!validation.valid) {
          return NextResponse.json(
            { error: `Validation failed for pack ${p.id}`, errors: validation.errors },
            { status: 400 }
          );
        }
      }
      
      saveAllBackgroundTriggerPacks(packs as BackgroundTriggerPack[]);

      return NextResponse.json({ 
        success: true,
        message: 'All packs saved successfully'
      });
    }

    // Update single pack
    if (pack) {
      if (!pack.id) {
        return NextResponse.json(
          { error: 'Pack with ID is required' },
          { status: 400 }
        );
      }

      // Validate
      const validation = validateBackgroundTriggerPack(pack);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Validation failed', errors: validation.errors },
          { status: 400 }
        );
      }

      // Update timestamp
      pack.updatedAt = new Date().toISOString();

      // Save to disk
      saveBackgroundTriggerPack(pack);

      return NextResponse.json({ 
        success: true, 
        pack,
        message: 'Pack updated successfully'
      });
    }

    return NextResponse.json(
      { error: 'Missing pack data' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error updating background trigger pack:', error);
    return NextResponse.json(
      { error: 'Failed to update background trigger pack' },
      { status: 500 }
    );
  }
}

// DELETE - Delete pack
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Pack ID is required' },
        { status: 400 }
      );
    }

    // Check if pack exists
    const existing = loadBackgroundTriggerPackById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Pack not found: ${id}` },
        { status: 404 }
      );
    }

    // Delete from disk
    deleteBackgroundTriggerPack(id);

    return NextResponse.json({ 
      success: true,
      message: 'Pack deleted successfully'
    });
  } catch (error) {
    console.error('[API] Error deleting background trigger pack:', error);
    return NextResponse.json(
      { error: 'Failed to delete background trigger pack' },
      { status: 500 }
    );
  }
}
