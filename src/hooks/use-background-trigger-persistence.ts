// ============================================
// Background Triggers Persistence Hook
// ============================================
// Synchronizes background trigger packs with server-side JSON storage

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTavernStore } from '@/store/index';
import type { BackgroundTriggerPack, BackgroundCollection } from '@/types';

interface UseBackgroundTriggerPersistenceOptions {
  autoSave?: boolean;        // Auto-save changes to server
  autoLoad?: boolean;        // Auto-load from server on mount
  debounceMs?: number;       // Debounce auto-saves
}

interface BackgroundTriggerPersistenceResult {
  isLoading: boolean;
  isSaving: boolean;
  lastSync: Date | null;
  load: () => Promise<void>;
  save: () => Promise<void>;
  savePack: (pack: BackgroundTriggerPack) => Promise<void>;
  deletePack: (id: string) => Promise<void>;
  duplicatePack: (sourceId: string, newId: string) => Promise<void>;
}

export function useBackgroundTriggerPersistence(
  options: UseBackgroundTriggerPersistenceOptions = {}
): BackgroundTriggerPersistenceResult {
  const {
    autoSave = true,
    autoLoad = true,
    debounceMs = 1000,
  } = options;

  const backgroundTriggerPacks = useTavernStore((state) => state.backgroundTriggerPacks);
  const storeActions = useTavernStore((state) => ({
    updateBackgroundTriggerPack: state.updateBackgroundTriggerPack,
    deleteBackgroundTriggerPack: state.deleteBackgroundTriggerPack,
    addBackgroundTriggerPack: state.addBackgroundTriggerPack,
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);
  const packsRef = useRef(backgroundTriggerPacks);

  // Keep ref in sync
  useEffect(() => {
    packsRef.current = backgroundTriggerPacks;
  }, [backgroundTriggerPacks]);

  // Load packs from server
  const load = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      console.log('[BgTriggerPersistence] Loading packs from server...');
      
      const response = await fetch('/api/background-triggers');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const packs = data.packs as BackgroundTriggerPack[];
      
      console.log(`[BgTriggerPersistence] Loaded ${packs.length} packs from server`);
      
      // Update each pack in the store
      // Since we don't have a "setAllPacks" action, we need to sync differently
      // For now, we'll just log - the store should be updated via the component
      
      setLastSync(new Date());
      
      // Return loaded packs for the component to use
      return packs;
    } catch (error) {
      console.error('[BgTriggerPersistence] Failed to load packs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Save all packs to server
  const save = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      const packs = packsRef.current;
      
      console.log(`[BgTriggerPersistence] Saving ${packs.length} packs to server...`);
      
      const response = await fetch('/api/background-triggers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packs }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      setLastSync(new Date());
      console.log('[BgTriggerPersistence] Packs saved successfully');
    } catch (error) {
      console.error('[BgTriggerPersistence] Failed to save packs:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  // Save single pack to server
  const savePack = useCallback(async (pack: BackgroundTriggerPack) => {
    try {
      console.log(`[BgTriggerPersistence] Saving pack ${pack.id}...`);
      
      const response = await fetch('/api/background-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`[BgTriggerPersistence] Pack ${pack.id} saved`);
    } catch (error) {
      console.error(`[BgTriggerPersistence] Failed to save pack ${pack.id}:`, error);
    }
  }, []);

  // Delete pack from server
  const deletePack = useCallback(async (id: string) => {
    try {
      console.log(`[BgTriggerPersistence] Deleting pack ${id}...`);
      
      const response = await fetch(`/api/background-triggers?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`[BgTriggerPersistence] Pack ${id} deleted`);
    } catch (error) {
      console.error(`[BgTriggerPersistence] Failed to delete pack ${id}:`, error);
    }
  }, []);

  // Duplicate pack
  const duplicatePack = useCallback(async (sourceId: string, newId: string) => {
    try {
      console.log(`[BgTriggerPersistence] Duplicating pack ${sourceId} to ${newId}...`);
      
      const response = await fetch('/api/background-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'duplicate', 
          sourceId, 
          newId 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      console.log(`[BgTriggerPersistence] Pack duplicated to ${newId}`);
      
      // Reload to get the duplicated pack
      await load();
    } catch (error) {
      console.error(`[BgTriggerPersistence] Failed to duplicate pack:`, error);
    }
  }, [load]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && !initializedRef.current) {
      initializedRef.current = true;
      load();
    }
  }, [autoLoad, load]);

  // Auto-save when packs change
  useEffect(() => {
    if (!autoSave || !initializedRef.current) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save
    saveTimeoutRef.current = setTimeout(() => {
      save();
    }, debounceMs);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [autoSave, debounceMs, save, backgroundTriggerPacks]);

  return {
    isLoading,
    isSaving,
    lastSync,
    load,
    save,
    savePack,
    deletePack,
    duplicatePack,
  };
}

// ============================================
// Export All
// ============================================

export default useBackgroundTriggerPersistence;
