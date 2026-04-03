'use client';

import { usePersistenceSync } from '@/hooks/use-persistence-sync';

/**
 * Provider component that initializes persistence sync
 * Must be rendered in a client component
 */
export function PersistenceProvider({ children }: { children: React.ReactNode }) {
  // Initialize persistence sync hook
  usePersistenceSync();

  return <>{children}</>;
}
