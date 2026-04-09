import { useTavernStore } from '@/store/tavern-store';
import { useSyncExternalStore } from 'react';

/**
 * Hook to check if the Zustand store has finished hydrating from localStorage
 * This prevents hydration mismatches between server and client renders
 * 
 * Uses useSyncExternalStore for SSR-safe hydration detection
 */
function subscribe(callback: () => void) {
  // Zustand persist middleware provides onFinishHydration
  const unsubscribe = useTavernStore.persist.onFinishHydration(callback);
  return unsubscribe;
}

function getSnapshot() {
  return useTavernStore.persist.hasHydrated();
}

function getServerSnapshot() {
  return false;
}

export function useHydration() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
