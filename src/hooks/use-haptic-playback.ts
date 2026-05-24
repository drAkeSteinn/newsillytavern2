'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTavernStore } from '@/store';
import { DEFAULT_HANDY_SETTINGS } from '@/types';

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

/** HSP point format: position (0-100) and time (ms from start) */
export interface HspPoint {
  t: number; // Time in ms from pattern start
  x: number; // Position 0-100 (percentage of stroke range)
}

interface UseHapticPlaybackReturn {
  isConnected: boolean;
  isPlaying: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  sendPosition: (position: number, velocity?: number, stopOnTarget?: boolean) => void;
  sendPositionAtTime: (position: number, timeMs: number, stopOnTarget?: boolean) => void;
  startHapticPlayback: () => void;
  stopHapticPlayback: () => void;
  setEnabled: (enabled: boolean) => void;
  // HSP pattern playback
  playHspPattern: (points: HspPoint[], loop: boolean, playbackRate?: number) => Promise<boolean>;
  stopHspPattern: () => Promise<void>;
  isHspPlaying: boolean;
}

// Helper to read Handy config — tries Zustand store first, falls back to localStorage
function readHandyConfig(): HandyConfig | null {
  try {
    // Try reading from Zustand store's persisted state first
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.appId && handySettings?.connectionKey) {
        return { appId: handySettings.appId, connectionKey: handySettings.connectionKey };
      }
    }
    // Fallback to legacy localStorage keys
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
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.positionInverted !== undefined) return handySettings.positionInverted;
    }
    return localStorage.getItem('handy-inverted') === 'true';
  } catch {
    return false;
  }
}

function readHapticEnabled(): boolean {
  try {
    const storageKey = 'tavernflow-storage';
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const handySettings = parsed?.state?.settings?.handy;
      if (handySettings?.enabled !== undefined) return handySettings.enabled;
    }
    return localStorage.getItem('handy-haptic-enabled') === 'true';
  } catch {
    return false;
  }
}

// ============================================
// Server Time Sync
// ============================================
// NTP-style sync with multiple samples and outlier removal.
// The reference client (handy-rest-api-v3-client.js) uses 30 samples
// with 5 outliers removed. We use 8 samples with 2 outliers removed
// for a good balance of accuracy and startup time.

let serverTimeOffset: number | null = null;
let serverTimeLastSync: number = 0;
const SYNC_SAMPLES = 8;
const SYNC_OUTLIERS = 2;

async function syncServerTime(): Promise<number> {
  const samples: Array<{ offset: number; rtd: number }> = [];

  for (let i = 0; i < SYNC_SAMPLES; i++) {
    try {
      const startLocal = Date.now();
      const response = await fetch('/api/handy/servertime', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const endLocal = Date.now();
      const data = await response.json();
      // Handy API v3 /servertime returns: { result: { server_time: number } }
      const serverTime = data?.result?.server_time ?? data?.result ?? data;

      if (typeof serverTime === 'number' && serverTime > 0) {
        const rtd = endLocal - startLocal;
        const estimatedLocalAtServer = startLocal + rtd / 2;
        const offset = serverTime - estimatedLocalAtServer;
        samples.push({ offset, rtd });
      }
    } catch {
      // Skip failed samples
    }
  }

  if (samples.length > 0) {
    // Sort by round-trip delay and remove worst outliers (highest RTD = least reliable)
    samples.sort((a, b) => a.rtd - b.rtd);
    const trimmed = samples.slice(0, Math.max(1, samples.length - SYNC_OUTLIERS));

    // Average the offsets from remaining samples
    let offsetAccum = 0;
    for (const s of trimmed) {
      offsetAccum += s.offset;
    }
    serverTimeOffset = offsetAccum / trimmed.length;
    serverTimeLastSync = Date.now();
  } else {
    // If all samples failed, use offset 0 (less precise but still works)
    serverTimeOffset = serverTimeOffset ?? 0;
  }
  return serverTimeOffset ?? 0;
}

function estimateServerTime(): number {
  if (serverTimeOffset === null) return Math.round(Date.now());
  // Per Handy API v3 reference: estimate = Math.round(Date.now() + offset)
  return Math.round(Date.now() + serverTimeOffset);
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
  const [isHspPlaying, setIsHspPlaying] = useState(false);

  // Use refs for config that changes from localStorage (avoids setState-in-effect)
  const handyConfigRef = useRef<HandyConfig | null>(readHandyConfig());
  const invertedRef = useRef<boolean>(readInverted());

  const enabledRef = useRef(isEnabled);
  const lastSendTimeRef = useRef<number>(0);
  const lastSentPositionRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hspStreamIdRef = useRef<number | null>(null);

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

    configRefreshRef.current = setInterval(refreshConfig, 2000);

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
    setIsHspPlaying(false);
    onDeviceStatus?.(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    onLog?.('Desconectado del Handy');
  }, [onDeviceStatus, onLog]);

  // Set Handy device mode (must be called before sending HDSP/HSP commands)
  const setDeviceMode = useCallback(async (mode: number): Promise<boolean> => {
    const config = handyConfigRef.current;
    if (!config) return false;

    try {
      const response = await fetch('/api/handy/mode2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          connectionKey: config.connectionKey,
          mode,
        }),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Send position to Handy device using HDSP xpvp (throttled to ~12fps)
  const sendPosition = useCallback((position: number, velocity: number = 1.0, stopOnTarget: boolean = false) => {
    const globalEnabled = readHapticEnabled();
    if (!enabledRef.current || !globalEnabled || !isConnected) return;
    const config = handyConfigRef.current;
    if (!config) return;

    const now = Date.now();
    if (now - lastSendTimeRef.current < 80) return;
    lastSendTimeRef.current = now;

    const roundedPos = Math.round(position * 10) / 10;
    if (lastSentPositionRef.current !== null && lastSentPositionRef.current === roundedPos) return;
    lastSentPositionRef.current = roundedPos;

    const normalizedPosition = Math.max(0, Math.min(1, position / 100));
    const inverted = invertedRef.current;
    const devicePos = inverted ? 1 - normalizedPosition : normalizedPosition;

    const { appId, connectionKey } = config;
    fetch('/api/handy/hdsp/xpvp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        xp: devicePos,
        vp: Math.max(0, Math.min(1, velocity)),
        stop_on_target: stopOnTarget,
        immediate_rsp: true,
      }),
    }).catch(() => {});
  }, [isConnected]);

  // Send position with arrival time using HDSP xpt endpoint
  const sendPositionAtTime = useCallback((position: number, timeMs: number, stopOnTarget: boolean = false) => {
    const globalEnabled = readHapticEnabled();
    if (!enabledRef.current || !globalEnabled || !isConnected) return;
    const config = handyConfigRef.current;
    if (!config) return;

    const now = Date.now();
    if (now - lastSendTimeRef.current < 80) return;
    lastSendTimeRef.current = now;

    const roundedPos = Math.round(position * 10) / 10;
    if (lastSentPositionRef.current !== null && lastSentPositionRef.current === roundedPos) return;
    lastSentPositionRef.current = roundedPos;

    const normalizedPosition = Math.max(0, Math.min(1, position / 100));
    const inverted = invertedRef.current;
    const devicePos = inverted ? 1 - normalizedPosition : normalizedPosition;

    const { appId, connectionKey } = config;
    fetch('/api/handy/hdsp/xpt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        connectionKey,
        xp: devicePos,
        t: Math.max(0, Math.round(timeMs)),
        stop_on_target: stopOnTarget,
        immediate_rsp: true,
      }),
    }).catch(() => {});
  }, [isConnected]);

  // ============================================
  // HSP Pattern Playback
  // ============================================
  //
  // HSP (Handy Server Pattern) loads ALL points into the device buffer
  // before playing, then the device handles timing, interpolation, and
  // looping natively. This eliminates:
  //   - Network latency during playback
  //   - Loop wraparound jumps (device handles loop smoothly)
  //   - Erratic velocity calculations
  //   - Throttling/debounce issues
  //
  // Flow:
  //   1. Sync server time (for precise start)
  //   2. Set device mode to HSP (mode 4)
  //   3. Set slider stroke to full range
  //   4. HSP setup (assign stream ID)
  //   5. HSP add (send points, max 100 per request)
  //   6. HSP play (server_time, start_time, loop, playback_rate)
  //   7. On stop: HSP stop → HSP flush → return to center

  const playHspPattern = useCallback(async (
    points: HspPoint[],
    loop: boolean,
    playbackRate: number = 1,
  ): Promise<boolean> => {
    const globalEnabled = readHapticEnabled();
    if (!enabledRef.current || !globalEnabled) {
      onLog?.('⚠ HSP: Haptic no habilitado');
      return false;
    }
    const config = handyConfigRef.current;
    if (!config) {
      onLog?.('⚠ HSP: No hay configuración de Handy');
      return false;
    }
    if (points.length === 0) {
      onLog?.('⚠ HSP: No hay puntos para reproducir');
      return false;
    }

    const { appId, connectionKey } = config;

    try {
      // 1. Sync server time (multiple samples with outlier removal)
      onLog?.('🕐 Sincronizando tiempo del servidor...');
      await syncServerTime();
      onLog?.(`🕐 Offset: ${serverTimeOffset}ms`);

      // 2. Set device mode to HSP (mode 4)
      onLog?.('🔧 Cambiando a modo HSP...');
      const modeSet = await setDeviceMode(4);
      if (!modeSet) {
        onLog?.('⚠ No se pudo cambiar a modo HSP');
        return false;
      }

      // 3. Set slider stroke to full range
      try {
        await fetch('/api/handy/slider/stroke', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, connectionKey, min: 0, max: 1.0 }),
        });
        onLog?.('🔧 Slider configurado (0-100%)');
      } catch {
        // Non-critical
      }

      // 4. HSP setup with random stream ID
      const streamId = Math.floor(Math.random() * 1024);
      hspStreamIdRef.current = streamId;
      
      onLog?.(`📦 HSP setup (stream ${streamId})...`);
      const setupResponse = await fetch('/api/handy/hsp/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, connectionKey, stream_id: streamId }),
        signal: AbortSignal.timeout(5000),
      });
      
      if (!setupResponse.ok) {
        const errorData = await setupResponse.json().catch(() => null);
        onLog?.(`⚠ HSP setup falló: ${setupResponse.status} ${JSON.stringify(errorData)}`);
        return false;
      }

      // 5. HSP add - send initial batch (up to 10 points for quick start)
      const initialBatch = points.slice(0, 10);
      onLog?.(`📦 Enviando ${initialBatch.length} puntos iniciales...`);
      
      // Apply inversion if needed
      const inverted = invertedRef.current;
      const adjustPoint = (p: HspPoint): HspPoint => ({
        t: p.t,
        x: inverted ? 100 - p.x : p.x,
      });
      
      const adjustedInitial = initialBatch.map(adjustPoint);

      const addResponse = await fetch('/api/handy/hsp/add', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          connectionKey,
          flush: false,
          points: adjustedInitial,
          tail_point_stream_index: adjustedInitial.length - 1,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!addResponse.ok) {
        onLog?.('⚠ HSP add (inicial) falló');
        return false;
      }

      // 6. HSP play - start playback
      // Use current estimated server time directly (like the reference implementation).
      // The initial 10 points give the device enough data to start playing immediately,
      // while remaining points are sent in parallel batches.
      const playServerTime = estimateServerTime();
      onLog?.(`▶️ Iniciando reproducción HSP (${points.length} pts, loop=${loop})...`);
      const playResponse = await fetch('/api/handy/hsp/play', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          connectionKey,
          server_time: playServerTime,
          start_time: 0,
          loop,
          playback_rate: playbackRate,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!playResponse.ok) {
        onLog?.('⚠ HSP play falló');
        return false;
      }

      setIsHspPlaying(true);

      // 7. Send remaining points in batches of max 100
      if (points.length > 10) {
        const remaining = points.slice(10);
        const batchCount = Math.ceil(remaining.length / 100);
        let sentCount = 10;

        for (let i = 0; i < batchCount; i++) {
          const batchPoints = remaining.slice(i * 100, (i + 1) * 100);
          const adjustedBatch = batchPoints.map(adjustPoint);
          sentCount += adjustedBatch.length;

          try {
            await fetch('/api/handy/hsp/add', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                appId,
                connectionKey,
                flush: false,
                points: adjustedBatch,
                tail_point_stream_index: sentCount - 1,
              }),
              signal: AbortSignal.timeout(5000),
            });
          } catch {
            onLog?.(`⚠ Error enviando batch ${i + 1}/${batchCount}`);
          }
        }
        onLog?.(`📦 ${sentCount} puntos totales enviados`);
      }

      setIsPlaying(true);
      onLog?.('✅ Reproducción HSP iniciada');
      return true;

    } catch (err) {
      onLog?.(`❌ HSP error: ${err instanceof Error ? err.message : 'Desconocido'}`);
      setIsHspPlaying(false);
      return false;
    }
  }, [setDeviceMode, onLog]);

  // Stop HSP pattern playback
  const stopHspPattern = useCallback(async (): Promise<void> => {
    const config = handyConfigRef.current;
    if (!config) return;

    const { appId, connectionKey } = config;
    const inverted = invertedRef.current;

    try {
      // 1. Stop HSP playback
      await fetch('/api/handy/hsp/stop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, connectionKey }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});

      // 2. Flush the buffer
      await fetch('/api/handy/hsp/flush', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, connectionKey }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});

      // 3. Switch back to HDSP mode and return to center
      await setDeviceMode(2);

      const centerPos = inverted ? 0.5 : 0.5;
      await fetch('/api/handy/hdsp/xpvp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          connectionKey,
          xp: centerPos,
          vp: 0.3,
          stop_on_target: true,
          immediate_rsp: true,
        }),
      }).catch(() => {});

      // 4. Stop HAMP if running
      setTimeout(() => {
        fetch('/api/handy/hamp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, connectionKey }),
        }).catch(() => {});
      }, 300);

    } catch (err) {
      onLog?.(`⚠ Error deteniendo HSP: ${err instanceof Error ? err.message : 'Desconocido'}`);
    }

    setIsHspPlaying(false);
    setIsPlaying(false);
    hspStreamIdRef.current = null;
    lastSentPositionRef.current = null;
    onLog?.('⏹ Reproducción HSP detenida');
  }, [setDeviceMode, onLog]);

  // Start haptic playback lifecycle (HDSP mode for manual control)
  const startHapticPlayback = useCallback(async () => {
    if (!enabledRef.current) return;

    const modeSet = await setDeviceMode(2);
    if (!modeSet) {
      onLog?.('⚠ No se pudo cambiar a modo HDSP');
    } else {
      onLog?.('Modo HDSP activado');
    }

    const config = handyConfigRef.current;
    if (config) {
      try {
        await fetch('/api/handy/slider/stroke', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: config.appId,
            connectionKey: config.connectionKey,
            min: 0,
            max: 1.0,
          }),
        });
        onLog?.('Slider configurado (0-100%)');
      } catch {
        // Non-critical
      }
    }

    setIsPlaying(true);
    lastSentPositionRef.current = null;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      const pollConfig = handyConfigRef.current;
      if (!pollConfig) return;
      try {
        const params = new URLSearchParams({ appId: pollConfig.appId, connectionKey: pollConfig.connectionKey });
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
  }, [onDeviceStatus, onLog, setDeviceMode]);

  // Stop haptic playback lifecycle and return to center
  const stopHapticPlayback = useCallback(() => {
    // If HSP is playing, use HSP stop
    if (isHspPlaying) {
      stopHspPattern();
      return;
    }

    setIsPlaying(false);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (isConnected) {
      const config = handyConfigRef.current;
      if (config) {
        const inverted = invertedRef.current;
        const normalizedPosition = 0.5;
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
            immediate_rsp: true,
          }),
        }).catch(() => {});

        setTimeout(() => {
          fetch('/api/handy/hamp/stop', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId: config.appId,
              connectionKey: config.connectionKey,
            }),
          }).catch(() => {});
        }, 500);
      }
      lastSentPositionRef.current = null;
    }

    onLog?.('Reproducción háptica detenida');
  }, [isConnected, isHspPlaying, onLog, stopHspPattern]);

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
            immediate_rsp: true,
          }),
        }).catch(() => {});
        fetch('/api/handy/hsp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: config.appId, connectionKey: config.connectionKey }),
        }).catch(() => {});
        fetch('/api/handy/hamp/stop', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: config.appId, connectionKey: config.connectionKey }),
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
    sendPositionAtTime,
    startHapticPlayback,
    stopHapticPlayback,
    setEnabled,
    playHspPattern,
    stopHspPattern,
    isHspPlaying,
  };
}
