// ============================================
// Cooldown Manager - Centralized Cooldown Tracking
// ============================================

import type { CooldownConfig, CooldownState } from './types';

// ============================================
// Cooldown Manager Class
// ============================================

class CooldownManagerImpl {
  private state: Map<string, CooldownState> = new Map();
  private defaultConfig: CooldownConfig = {
    global: 0,     // 0 = no global cooldown by default
    perTrigger: 0, // 0 = no per-trigger cooldown by default
  };
  
  /**
   * Get or create state for a context (e.g., character or session)
   */
  private getState(contextKey: string): CooldownState {
    if (!this.state.has(contextKey)) {
      this.state.set(contextKey, {
        lastGlobalTrigger: 0,
        lastTriggerTimes: new Map(),
      });
    }
    return this.state.get(contextKey)!;
  }
  
  /**
   * Check if a trigger is ready (cooldown elapsed)
   */
  isReady(
    contextKey: string,
    triggerId: string,
    config?: Partial<CooldownConfig>
  ): boolean {
    const now = Date.now();
    const state = this.getState(contextKey);
    const { global, perTrigger } = { ...this.defaultConfig, ...config };
    
    // Check global cooldown
    if (global > 0 && now - state.lastGlobalTrigger < global) {
      return false;
    }
    
    // Check per-trigger cooldown
    if (perTrigger > 0) {
      const lastTime = state.lastTriggerTimes.get(triggerId) ?? 0;
      if (now - lastTime < perTrigger) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Mark a trigger as fired
   */
  markFired(contextKey: string, triggerId: string): void {
    const now = Date.now();
    const state = this.getState(contextKey);
    
    state.lastGlobalTrigger = now;
    state.lastTriggerTimes.set(triggerId, now);
  }
  
  /**
   * Get remaining cooldown time
   */
  getRemainingCooldown(
    contextKey: string,
    triggerId: string,
    config?: Partial<CooldownConfig>
  ): { global: number; perTrigger: number } {
    const now = Date.now();
    const state = this.getState(contextKey);
    const { global, perTrigger } = { ...this.defaultConfig, ...config };
    
    const globalRemaining = Math.max(0, global - (now - state.lastGlobalTrigger));
    const triggerRemaining = Math.max(
      0, 
      perTrigger - (now - (state.lastTriggerTimes.get(triggerId) ?? 0))
    );
    
    return {
      global: globalRemaining,
      perTrigger: triggerRemaining,
    };
  }
  
  /**
   * Set default cooldown config
   */
  setDefaultConfig(config: Partial<CooldownConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
  
  /**
   * Reset cooldowns for a context
   */
  reset(contextKey: string): void {
    this.state.delete(contextKey);
  }
  
  /**
   * Reset all cooldowns
   */
  resetAll(): void {
    this.state.clear();
  }
  
  /**
   * Clean up old entries (call periodically)
   */
  cleanup(maxAge: number = 60000): void {
    const now = Date.now();
    
    for (const [key, state] of this.state) {
      // If no recent activity, remove
      if (now - state.lastGlobalTrigger > maxAge) {
        this.state.delete(key);
      }
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let cooldownInstance: CooldownManagerImpl | null = null;

export function getCooldownManager(): CooldownManagerImpl {
  if (!cooldownInstance) {
    cooldownInstance = new CooldownManagerImpl();
    
    // Cleanup every 30 seconds
    if (typeof window !== 'undefined') {
      setInterval(() => cooldownInstance?.cleanup(), 30000);
    }
  }
  return cooldownInstance;
}

export function resetCooldownManager(): void {
  cooldownInstance?.resetAll();
  cooldownInstance = null;
}
