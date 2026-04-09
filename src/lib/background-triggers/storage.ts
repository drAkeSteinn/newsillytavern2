// ============================================
// Background Trigger Packs Storage
// ============================================
// Handles reading/writing background trigger pack JSON files
// Each pack is stored in /data/background-triggers/[id].json

import fs from 'fs';
import path from 'path';
import type { 
  BackgroundTriggerPack,
  BackgroundTriggerItem,
  BackgroundCollection,
} from '@/types';

// ============================================
// Constants
// ============================================

const PACKS_DIR = path.join(process.cwd(), 'data', 'background-triggers');
const COLLECTIONS_FILE = path.join(process.cwd(), 'data', 'background-triggers', 'collections.json');
const FILE_EXTENSION = '.json';

// ============================================
// Storage Functions - Packs
// ============================================

/**
 * Ensure the data directory exists
 */
function ensureDirectory(): void {
  if (!fs.existsSync(PACKS_DIR)) {
    fs.mkdirSync(PACKS_DIR, { recursive: true });
  }
}

/**
 * Get all background trigger pack files
 */
export function getBackgroundTriggerPackFiles(): string[] {
  try {
    ensureDirectory();
    
    const files = fs.readdirSync(PACKS_DIR);
    return files
      .filter(file => file.endsWith(FILE_EXTENSION) && file !== 'collections.json')
      .map(file => file.replace(FILE_EXTENSION, ''));
  } catch (err) {
    console.error('[BgTriggerStorage] Error reading packs directory:', err);
    return [];
  }
}

/**
 * Load all background trigger packs from disk
 */
export function loadAllBackgroundTriggerPacks(): BackgroundTriggerPack[] {
  const files = getBackgroundTriggerPackFiles();
  const packs: BackgroundTriggerPack[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(PACKS_DIR, `${file}${FILE_EXTENSION}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const pack = JSON.parse(content) as BackgroundTriggerPack;
      packs.push(pack);
    } catch (err) {
      console.error(`[BgTriggerStorage] Error loading pack ${file}:`, err);
    }
  }
  
  // Sort by priority (higher first)
  return packs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Load a single background trigger pack by ID
 */
export function loadBackgroundTriggerPackById(id: string): BackgroundTriggerPack | null {
  try {
    const filePath = path.join(PACKS_DIR, `${id}${FILE_EXTENSION}`);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BackgroundTriggerPack;
  } catch (err) {
    console.error(`[BgTriggerStorage] Error loading pack ${id}:`, err);
    return null;
  }
}

/**
 * Save a background trigger pack to disk
 */
export function saveBackgroundTriggerPack(pack: BackgroundTriggerPack): void {
  try {
    ensureDirectory();
    
    const filePath = path.join(PACKS_DIR, `${pack.id}${FILE_EXTENSION}`);
    const content = JSON.stringify(pack, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    
    console.log(`[BgTriggerStorage] Saved pack: ${pack.id}`);
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    console.error(`[BgTriggerStorage] Error saving pack ${pack.id}:`, err);
    
    if (error.code === 'EACCES') {
      throw new Error(
        `Permission denied: Cannot write to background-triggers directory. ` +
        `Please run: sudo chown -R $USER:$USER ${path.join(process.cwd(), 'data')}`
      );
    }
    throw err;
  }
}

/**
 * Delete a background trigger pack from disk
 */
export function deleteBackgroundTriggerPack(id: string): void {
  try {
    const filePath = path.join(PACKS_DIR, `${id}${FILE_EXTENSION}`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[BgTriggerStorage] Deleted pack: ${id}`);
    }
  } catch (err: unknown) {
    const error = err as Error & { code?: string };
    console.error(`[BgTriggerStorage] Error deleting pack ${id}:`, err);
    
    if (error.code === 'EACCES') {
      throw new Error(
        `Permission denied: Cannot delete from background-triggers directory. ` +
        `Please run: sudo chown -R $USER:$USER ${path.join(process.cwd(), 'data')}`
      );
    }
    throw err;
  }
}

/**
 * Save all packs at once (bulk operation)
 */
export function saveAllBackgroundTriggerPacks(packs: BackgroundTriggerPack[]): void {
  ensureDirectory();
  
  // Get existing files to delete ones no longer in the list
  const existingFiles = getBackgroundTriggerPackFiles();
  const newIds = new Set(packs.map(p => p.id));
  
  // Delete packs that no longer exist
  for (const fileId of existingFiles) {
    if (!newIds.has(fileId)) {
      deleteBackgroundTriggerPack(fileId);
    }
  }
  
  // Save all packs
  for (const pack of packs) {
    saveBackgroundTriggerPack(pack);
  }
}

// ============================================
// Storage Functions - Collections
// ============================================

/**
 * Load background collections from disk
 */
export function loadBackgroundCollections(): BackgroundCollection[] {
  try {
    if (!fs.existsSync(COLLECTIONS_FILE)) {
      return [];
    }
    
    const content = fs.readFileSync(COLLECTIONS_FILE, 'utf-8');
    return JSON.parse(content) as BackgroundCollection[];
  } catch (err) {
    console.error('[BgTriggerStorage] Error loading collections:', err);
    return [];
  }
}

/**
 * Save background collections to disk
 */
export function saveBackgroundCollections(collections: BackgroundCollection[]): void {
  try {
    ensureDirectory();
    
    const content = JSON.stringify(collections, null, 2);
    fs.writeFileSync(COLLECTIONS_FILE, content, 'utf-8');
    
    console.log(`[BgTriggerStorage] Saved ${collections.length} collections`);
  } catch (err) {
    console.error('[BgTriggerStorage] Error saving collections:', err);
    throw err;
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new background trigger pack with defaults
 */
export function createNewBackgroundTriggerPack(
  id: string,
  name: string,
  collection: string = ''
): BackgroundTriggerPack {
  const now = new Date().toISOString();
  
  return {
    id,
    name,
    active: true,
    collection,
    priority: 50,
    cooldown: 0,
    matchMode: 'any_any',
    transitionDuration: 500,
    transitionType: 'fade',
    items: [],
    defaultOverlays: [],
    returnToDefault: false,
    returnToDefaultAfter: 300000,
    defaultBackground: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new background trigger item with defaults
 */
export function createNewBackgroundTriggerItem(
  backgroundUrl: string,
  backgroundName: string,
  triggerKeys: string[] = []
): BackgroundTriggerItem {
  return {
    id: crypto.randomUUID(),
    backgroundUrl,
    backgroundName,
    triggerKeys,
    contextKeys: [],
    enabled: true,
    priority: 50,
    overlays: [],
    variants: [],
  };
}

/**
 * Duplicate a background trigger pack with a new ID
 */
export function duplicateBackgroundTriggerPack(
  pack: BackgroundTriggerPack,
  newId: string
): BackgroundTriggerPack {
  const now = new Date().toISOString();
  
  return {
    ...pack,
    id: newId,
    name: `${pack.name} (Copy)`,
    items: pack.items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate a background trigger pack
 */
export function validateBackgroundTriggerPack(
  pack: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const p = pack as Partial<BackgroundTriggerPack>;
  
  if (!p.id || typeof p.id !== 'string') {
    errors.push('Pack ID must be a non-empty string');
  }
  
  if (!p.name || typeof p.name !== 'string') {
    errors.push('Pack name must be a non-empty string');
  }
  
  // Validate items
  if (p.items && Array.isArray(p.items)) {
    for (let i = 0; i < p.items.length; i++) {
      const item = p.items[i];
      if (!item.backgroundUrl) {
        errors.push(`Item ${i} is missing backgroundUrl`);
      }
      if (!item.backgroundName) {
        errors.push(`Item ${i} is missing backgroundName`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// Export All
// ============================================

export const BackgroundTriggerStorage = {
  // Pack operations
  loadAll: loadAllBackgroundTriggerPacks,
  loadById: loadBackgroundTriggerPackById,
  save: saveBackgroundTriggerPack,
  saveAll: saveAllBackgroundTriggerPacks,
  delete: deleteBackgroundTriggerPack,
  create: createNewBackgroundTriggerPack,
  duplicate: duplicateBackgroundTriggerPack,
  validate: validateBackgroundTriggerPack,
  
  // Item operations
  createItem: createNewBackgroundTriggerItem,
  
  // Collection operations
  loadCollections: loadBackgroundCollections,
  saveCollections: saveBackgroundCollections,
};
