'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface HandyConfig {
  appId: string;
  connectionKey: string;
}

interface UseHapticPlaybackOptions {
  isEnabled: boolean;
  onDeviceStatus?: (connected: boolean) => void;
  onLog?: (message: string) => void;
}

interface UseHapticPlaybackReturn {
  isConnected: boolean;
  isPlaying: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendPosition: (position: number, velocity?: number) => void;
  startHapticPlayback: () => void;
  stopHapticPlayback: () => void;
  setEnabled: (enabled: boolean) => void;
}

// Helper to read Handy config from localStorage
function readHandyConfig(): HandyConfig | null {
  try {
    const saved = localStorage.getItem('handy-config');
    if (saved) {
      const cfg = JSON.parse(saved) as HandyConfig;
      if (cfg.appId && cfg.connectionKey) return cfg;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function readInverted(): boolean {
  try {
    return localStorage.getItem('handy-inverted') === 'true';
  } catch {
    return false;
  }
}

// ============================================
// Hook
// ============================================

export function useHapticPlayback({
  isEnabled,
  onDeviceStatus,
  onLog,
}: UseHapticPlaybackOptions): UseHapticPlaybackReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Use refs for config that changes from localStorage (avoids setState-in-effect)
  const handyConfigRef = useRef<HandyConfig | null>(readHandyConfig());
  const invertedRef = useRef<boolean>(readInverted());

  const enabledRef = useRef(isEnabled);
  const lastSendTimeRef = useRef<number>(0);
  const lastSentPositionRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = isEnabled;
  }, [isEnabled]);

  // Refresh config from localStorage periodically and on storage events
  useEffect(() => {
    const refreshConfig = () => {
      handyConfigRef.current = readHandyConfig();
      invertedRef.current = readInverted();
    };

    // Poll every 2 seconds to catch same-tab changes
    configRefreshRef.current = setInterval(refreshConfig, 2000);

    // Listen for cross-tab storage changes
    const handleStorage = () => {
      refreshConfig();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('handy-config-changed', handleStorage);

    return () => {
      if (configRefreshRef.current) clearInterval(configRefreshRef.current);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('handy-config-changed', handleStorage);
    };
  }, []);

  // Test Handy connection
  const connect = useCallback(async (): Promise<boolean> => {
    const config = readHandyConfig();
    if (!config) {
      handyConfigRef.current = null;
      onLog?.('No hay configuración de Handy (appId/connectionKey)');
      return false;
    }

    handyConfigRef.current = config;
    const { appId, connectionKey } = config;
    onLog?.('Probando conexión Handy...');

    try {
      const params = new URLSearchParams({ appId, connectionKey });
      const response = await fetch(`/api/handy/connected?${params}`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();
      const result = data?.result ?? data;
      const connected = result?.connected === true;

      setIsConnected(connected);
      onDeviceStatus?.(connected);

      if (connected) {
        onLog?.('Handy conectado ✓');
      } else {
        onLog?.('Handy no encontrado');
      }

      return connected;
    } catch (err) {
      setIsConnected(false);
      onDeviceStatus?.(false);
      onLog?.(`Error de conexión: ${err instanceof Error ? err.message : 'Desconocido'}`);
      return false;
    }
  }, [onDeviceStatus, onLog]);

  // Disconnect
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsPlaying(false);
    onDeviceStatus?.(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    onLog?.('Desconectado del Handy');
  }, [onDeviceStatus, onLog]);

  // Send position to Handy device (throttled to ~12fps)
  const sendPosition = useCallback((position: number, velocity: number = 1.0) => {
    if (!enabledRef.current || !isConnected) return;
    const config = handyConfigRef.current;
    if (!config) return;

    // Throttle to ~12fps (80ms interval)
    const now = Date.now();
    if (now - lastSendTimeRef.current < 80) return;
    lastSendTimeRef.current = now;

    // Skip if position hasn't changed (debounce)
    const roundedPos = Math.round(position * 10) / 10;
    if (lastSentPositionRef.current !== null && lastSentPositionRef.current === roundedPos) return;
    lastSentPositionRef.current = roundedPos;

    // Normalize position from 0-100 to 0-1
    const normalizedPosition = Math.max(0, Math.min(1, position / 100));

    // Apply inversion if enabled
    const inverted = invertedRef.current;
    const devicePos = inverted ? 1 - normalizedPosition : normalizedPosition;

    // Send to device
    const { appId, connectionKey } = config;
    fetch('/api/handy/hdsp/xpvp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        xp: devicePos,
        vp: Math.max(0, Math.min(1, velocity)),
        stop_on_target: false,
      }),
    }).catch(() => {
      // Silently fail - don't spam errors during playback
    });
  }, [isConnected]);

  // Start haptic playback lifecycle
  const startHapticPlayback = useCallback(() => {
    if (!enabledRef.current) return;
    setIsPlaying(true);
    lastSentPositionRef.current = null; // Reset debounce

    // Start polling connection status
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      const config = handyConfigRef.current;
      if (!config) return;
      try {
        const params = new URLSearchParams({ appId: config.appId, connectionKey: config.connectionKey });
        const response = await fetch(`/api/handy/connected?${params}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        const result = data?.result ?? data;
        const connected = result?.connected === true;
        setIsConnected(connected);
        onDeviceStatus?.(connected);
      } catch {
        // Silently fail polling
      }
    }, 5000);

    onLog?.('Reproducción háptica iniciada');
  }, [onDeviceStatus, onLog]);

  // Stop haptic playback lifecycle and return to center
  const stopHapticPlayback = useCallback(() => {
    setIsPlaying(false);

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Send center position (50) to return device to neutral
    if (isConnected) {
      const config = handyConfigRef.current;
      if (config) {
        const inverted = invertedRef.current;
        const normalizedPosition = 0.5; // Center
        const devicePos = inverted ? 1 - normalizedPosition : normalizedPosition;

        fetch('/api/handy/hdsp/xpvp', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
            xp: devicePos,
            vp: 0.3,
            stop_on_target: true,
          }),
        }).catch(() => {
          // Silently fail
        });
      }
      lastSentPositionRef.current = null;
    }

    onLog?.('Reproducción háptica detenida');
  }, [isConnected, onLog]);

  // Set enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    if (!enabled && isPlaying) {
      stopHapticPlayback();
    }
  }, [isPlaying, stopHapticPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      // Send center position on unmount
      const config = handyConfigRef.current;
      if (config) {
        const inverted = invertedRef.current;
        const normPos = 0.5;
        const devicePos = inverted ? 1 - normPos : normPos;
        fetch('/api/handy/hdsp/xpvp', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
            xp: devicePos,
            vp: 0.3,
            stop_on_target: true,
          }),
        }).catch(() => {});
      }
    };
  }, []);

  return {
    isConnected,
    isPlaying,
    connect,
    disconnect,
    sendPosition,
    startHapticPlayback,
    stopHapticPlayback,
    setEnabled,
  };
}
