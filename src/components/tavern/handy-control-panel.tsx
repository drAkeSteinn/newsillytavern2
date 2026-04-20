'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Play,
  Square,
  Wifi,
  WifiOff,
  Loader2,
  Zap,
  Gauge,
  ArrowUpDown,
  Info,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Eye,
  EyeOff,
  Smartphone,
  Fingerprint,
  CircleDot,
  Radio,
  Activity,
  Hexagon,
  ChevronRight,
  Clock,
  Cpu,
  StopCircle,
  Power,
  RotateCcw,
  Waves,
  Timer,
  Crosshair,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DeviceInfo {
  fw_version?: string;
  fw_status?: number;
  fw_feature_flags?: string;
  hw_model_no?: number;
  hw_model_name?: string;
  hw_model_variant?: number;
  session_id?: string;
}

interface Capabilities {
  slider?: number;
  lra?: number;
  erm?: number;
  battery?: boolean;
  vulva_oriented?: boolean;
}

interface SliderSettings {
  x_limit_start?: number;
  x_limit_stop?: number;
  x_end_buffer?: number;
  x_end_zone_size?: number;
  x_end_zone_speed?: number;
  x_min_speed?: number;
  x_max_speed?: number;
  x_min_speed_theoretical?: number;
  x_max_speed_theoretical?: number;
  turn_time?: number;
  regulator_timeout?: number;
  temp_high_trigger?: number;
  temp_offset?: number;
  x_stroke_min?: number;
  x_stroke_max?: number;
  temp_hysteresis?: number;
  overclock_enabled?: boolean;
  x_inverse_motor?: boolean;
  x_inverse_hall?: boolean;
}

type TestResult = 'idle' | 'testing' | 'success' | 'error';

const MODE_NAMES: Record<number, string> = {
  0: 'HAMP',
  1: 'HSSP',
  2: 'HDSP',
  3: 'Maintenance',
  4: 'HSP',
  5: 'OTA',
  6: 'Button',
  7: 'Idle',
  8: 'Vibrate',
  9: 'HRPP',
};

const MODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Movimiento alternativo con velocidad y recorrido',
  2: 'Control directo de posición',
  4: 'Streaming en tiempo real con patrones',
  7: 'Inactivo',
  8: 'Vibración (si el hardware lo soporta)',
};

// ============================================
// API Client
// ============================================

function useHandyAPI() {
  const { toast } = useToast();

  const unwrap = useCallback((data: Record<string, unknown> | null): Record<string, unknown> | null => {
    if (!data || typeof data !== 'object') return null;
    if ('error' in data && data.error) return null;
    if ('result' in data) return data.result as Record<string, unknown>;
    return data;
  }, []);

  const call = useCallback(async (
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    appId: string,
    connectionKey: string,
    body?: Record<string, unknown>,
    timeoutMs = 10000,
  ): Promise<Record<string, unknown> | null> => {
    const url = `/api/handy/${endpoint}`;
    if (method === 'GET') {
      const params = new URLSearchParams({ appId, connectionKey });
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await response.json();
    } else {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, connectionKey, ...body }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await response.json();
    }
  }, []);

  return { call, unwrap, toast };
}

// ============================================
// Connection Status Component
// ============================================

function ConnectionStatusBadge({ connected, latency }: { connected: boolean; latency?: number }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
      connected
        ? "border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800"
        : "border-muted bg-muted/40"
    )}>
      <div className={cn(
        "w-2.5 h-2.5 rounded-full transition-all",
        connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted-foreground/30"
      )} />
      <div className="flex-1">
        <span className={cn("font-medium text-xs", connected ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
          {connected ? 'Dispositivo Conectado' : 'Desconectado'}
        </span>
        {connected && latency != null && (
          <span className="text-[10px] text-muted-foreground ml-2 font-mono">{latency}ms</span>
        )}
      </div>
      {connected ? (
        <Wifi className="w-4 h-4 text-green-500" />
      ) : (
        <WifiOff className="w-4 h-4 text-muted-foreground/50" />
      )}
    </div>
  );
}

// ============================================
// Activity Log
// ============================================

interface LogEntry {
  id: string;
  time: Date;
  type: 'send' | 'recv' | 'error' | 'info';
  message: string;
  detail?: string;
}

function ActivityLog({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div ref={scrollRef} className="space-y-1 max-h-40 overflow-y-auto pr-1">
      {entries.slice(-20).map((entry) => (
        <div key={entry.id} className="flex items-start gap-2 text-[11px]">
          <span className="text-muted-foreground font-mono shrink-0">
            {entry.time.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={cn(
            "shrink-0 font-bold",
            entry.type === 'send' && "text-blue-500",
            entry.type === 'recv' && "text-green-500",
            entry.type === 'error' && "text-red-500",
            entry.type === 'info' && "text-muted-foreground",
          )}>
            {entry.type === 'send' ? '→' : entry.type === 'recv' ? '←' : entry.type === 'error' ? '✗' : '•'}
          </span>
          <span className={cn(
            entry.type === 'error' ? "text-red-600 dark:text-red-400" : "text-foreground/80"
          )}>
            {entry.message}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Position Bar (visual indicator for HDSP/HSP)
// ============================================

function PositionBar({ position, min = 0, max = 100, label }: { position: number; min?: number; max?: number; label?: string }) {
  const clampedMin = Math.min(min, max);
  const clampedMax = Math.max(min, max);
  const pct = clampedMax > clampedMin ? ((position - clampedMin) / (clampedMax - clampedMin)) * 100 : 50;
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{position.toFixed(1)}%</span>
      </div>}
      <div className="relative h-6 rounded-md bg-muted/60 border overflow-hidden">
        {/* Device physical range indicator */}
        <div
          className="absolute top-0 bottom-0 bg-primary/10 rounded"
          style={{ left: `${clampedMin}%`, width: `${clampedMax - clampedMin}%` }}
        />
        {/* Current position */}
        <div
          className="absolute top-0.5 bottom-0.5 w-3 bg-primary rounded-sm shadow-sm transition-all duration-100"
          style={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 6px)` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function HandyControlPanel() {
  const { call, unwrap, toast } = useHandyAPI();

  // Config
  const [appId, setAppId] = useState('');
  const [connectionKey, setConnectionKey] = useState('');
  const [showAppId, setShowAppId] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Device state
  const [connected, setConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [currentMode, setCurrentMode] = useState<number>(7);
  const [lastLatency, setLastLatency] = useState<number | undefined>();
  const [connecting, setConnecting] = useState(false);

  // HAMP
  const [hampPlaying, setHampPlaying] = useState(false);
  const [hampVelocity, setHampVelocity] = useState(50);
  const [hampStroke, setHampStroke] = useState(80);
  // Device's physical slider range (raw API values, typically 0-109.3)
  const [deviceMin, setDeviceMin] = useState(0);
  const [deviceMax, setDeviceMax] = useState(109.3);
  // Manual stroke calibration positions (raw API values)
  const [manualStrokeMin, setManualStrokeMin] = useState<number | null>(null);
  const [manualStrokeMax, setManualStrokeMax] = useState<number | null>(null);
  const [currentSliderPos, setCurrentSliderPos] = useState<number | null>(null);
  const [readingPosition, setReadingPosition] = useState(false);
  // Manual position override (when device reading is wrong)
  const [manualPositionOverride, setManualPositionOverride] = useState<string>('');
  const [applyingStrokeReset, setApplyingStrokeReset] = useState(false);
  // Software inversion: when device reads inverted positions
  const [positionInverted, setPositionInverted] = useState(false);
  // Slider hardware settings (read-only from device)
  const [sliderSettings, setSliderSettings] = useState<SliderSettings | null>(null);

  // HDSP
  const [hdspPosition, setHdspPosition] = useState(50);
  const lastHdspSentRef = useRef<number | null>(null);

  // HVP
  const [hvpEnabled, setHvpEnabled] = useState(false);
  const [hvpAmplitude, setHvpAmplitude] = useState(0);
  const [hvpFrequency, setHvpFrequency] = useState(80);
  const [hvpPosition, setHvpPosition] = useState(50);

  // HSP Streaming
  const [hspPlaying, setHspPlaying] = useState(false);
  const [hspSpeed, setHspSpeed] = useState(1.0);
  const [hspPattern, setHspPattern] = useState<'sine' | 'ramp' | 'pulse' | 'sawtooth'>('sine');
  const [hspLivePosition, setHspLivePosition] = useState(50);
  const hspIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hspStartTimeRef = useRef<number>(0);

  // Activity log
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const prevConnectedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track last user-initiated mode change to prevent polling from overwriting it
  const modeChangeTimeRef = useRef<number>(0);
  const MODE_LOCK_DURATION = 10000; // 10 seconds: ignore device-reported mode changes after user sets mode

  // ---- Config persistence ----
  useEffect(() => {
    try {
      const saved = localStorage.getItem('handy-config');
      if (saved) {
        const cfg = JSON.parse(saved);
        setAppId(cfg.appId || '');
        setConnectionKey(cfg.connectionKey || '');
      }
      const inv = localStorage.getItem('handy-inverted');
      if (inv === 'true') setPositionInverted(true);
    } catch {}
  }, []);

  const toggleInversion = useCallback(() => {
    setPositionInverted(prev => {
      const next = !prev;
      localStorage.setItem('handy-inverted', String(next));
      return next;
    });
  }, []);

  const saveConfig = useCallback(() => {
    localStorage.setItem('handy-config', JSON.stringify({ appId, connectionKey }));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  }, [appId, connectionKey]);

  const hasAppId = appId.trim().length >= 5;
  const hasCK = connectionKey.trim().length >= 5;
  const hasConfig = hasAppId && hasCK;

  // ---- Activity log helpers ----
  const addLog = useCallback((type: LogEntry['type'], message: string, detail?: string) => {
    setLogEntries(prev => [...prev.slice(-49), { id: Math.random().toString(36).slice(2), time: new Date(), type, message, detail }]);
  }, []);

  // ---- Connect & discover ----
  const connectAndDiscover = useCallback(async () => {
    if (!hasConfig) {
      toast({ description: 'Ingresa App ID y Connection Key', variant: 'destructive' });
      return;
    }

    setConnecting(true);
    setTestResult('testing');
    setTestMessage('');
    const aid = appId.trim();
    const ck = connectionKey.trim();
    const t0 = Date.now();

    try {
      // 1. Server connectivity
      const stData = await call('GET', 'servertime', aid, ck, undefined, 8000);
      if (!stData || 'error' in stData) {
        setTestResult('error');
        setTestMessage('No se pudo conectar al servidor Handy.');
        setConnecting(false);
        return;
      }
      addLog('recv', `Servidor OK (server_time: ${((stData as Record<string, Record<string, number>>)?.result?.server_time ?? 0).toString().slice(0, -3)})`);

      // 2. Device connection
      const connData = await call('GET', 'connected', aid, ck, undefined, 8000);
      const connResult = unwrap(connData);
      const isConn = connResult?.connected === true;
      const latency = Date.now() - t0;
      setLastLatency(latency);

      if (!isConn) {
        setTestResult('error');
        setTestMessage('Dispositivo no encontrado. Verifica que esté encendido y conectado al WiFi.');
        setConnected(false);
        setConnecting(false);
        addLog('error', `Dispositivo desconectado`);
        return;
      }

      addLog('recv', `Dispositivo conectado (${latency}ms)`);
      setConnected(true);

      // 3. Device info
      const infoData = await call('GET', 'info', aid, ck, undefined, 8000);
      const infoResult = unwrap(infoData);
      if (infoResult) {
        const info: DeviceInfo = {
          fw_version: infoResult.fw_version as string | undefined,
          fw_status: infoResult.fw_status as number | undefined,
          hw_model_no: infoResult.hw_model_no as number | undefined,
          hw_model_name: infoResult.hw_model_name as string | undefined,
          session_id: infoResult.session_id as string | undefined,
        };
        setDeviceInfo(info);
        addLog('info', `Modelo: ${info.hw_model_name || '?'} FW: ${info.fw_version || '?'}`);
      }

      // 4. Capabilities
      const capData = await call('GET', 'capabilities', aid, ck, undefined, 8000);
      const capResult = unwrap(capData);
      if (capResult) {
        const caps: Capabilities = {
          slider: (capResult.slider as number) ?? 0,
          lra: (capResult.lra as number) ?? 0,
          erm: (capResult.erm as number) ?? 0,
          battery: (capResult.battery as boolean) ?? false,
        };
        setCapabilities(caps);
        addLog('info', `Capabilities: slider=${caps.slider}, lra=${caps.lra}, erm=${caps.erm}`);
      }

      // 5. Mode
      const modeData = await call('GET', 'mode', aid, ck, undefined, 8000);
      const modeResult = unwrap(modeData);
      if (modeResult && typeof modeResult.mode === 'number') {
        setCurrentMode(modeResult.mode);
        addLog('info', `Modo actual: ${MODE_NAMES[modeResult.mode] || '?'}`);
      }

      // 6. Slider stroke (device physical limits)
      const strokeData = await call('GET', 'slider/stroke', aid, ck, undefined, 8000);
      const strokeResult = unwrap(strokeData);
      if (strokeResult) {
        // API returns normalized min/max (0-1) and absolute min/max (mm)
        // Store absolute mm values for deviceMin/deviceMax (used in calibration UI)
        const absMin = strokeResult.min_absolute as number;
        const absMax = strokeResult.max_absolute as number;
        const normMin = strokeResult.min as number;
        const normMax = strokeResult.max as number;
        setDeviceMin(absMin != null ? Math.round(absMin * 100) / 100 : 0);
        setDeviceMax(absMax != null ? Math.round(absMax * 100) / 100 : SLIDER_ABS_MAX);
        addLog('info', `Rango físico: ${absMin?.toFixed(1) ?? 0} — ${absMax?.toFixed(1) ?? SLIDER_ABS_MAX} mm (norm: ${normMin?.toFixed(3)} — ${normMax?.toFixed(3)})`);
      }

      // 7. Slider settings (inversion flags, limits - read-only)
      try {
        const settData = await call('GET', 'settings/slider', aid, ck, undefined, 8000);
        const settResult = unwrap(settData);
        if (settResult) {
          const sett: SliderSettings = {
            x_limit_start: settResult.x_limit_start as number | undefined,
            x_limit_stop: settResult.x_limit_stop as number | undefined,
            x_stroke_min: settResult.x_stroke_min as number | undefined,
            x_stroke_max: settResult.x_stroke_max as number | undefined,
            x_inverse_motor: settResult.x_inverse_motor as boolean | undefined,
            x_inverse_hall: settResult.x_inverse_hall as boolean | undefined,
            x_min_speed: settResult.x_min_speed as number | undefined,
            x_max_speed: settResult.x_max_speed as number | undefined,
          };
          setSliderSettings(sett);
          addLog('info', `Settings: inverse_motor=${sett.x_inverse_motor}, inverse_hall=${sett.x_inverse_hall}`);
        }
      } catch {
        addLog('info', 'No se pudieron leer settings del slider (puede no estar disponible en este firmware)');
      }

      // 8. HAMP state
      const hampData = await call('GET', 'hamp/state', aid, ck, undefined, 8000);
      const hampResult = unwrap(hampData);
      if (hampResult) {
        setHampPlaying((hampResult.play_state as number) === 1);
      }

      setTestResult('success');
      setTestMessage(`Conectado. Latencia: ${latency}ms`);
      saveConfig();
    } catch (err) {
      setTestResult('error');
      setTestMessage(`Error: ${err instanceof Error ? err.message : 'Desconocido'}`);
      addLog('error', `Error de conexión: ${err instanceof Error ? err.message : '?'}`);
    } finally {
      setConnecting(false);
    }
  }, [hasConfig, appId, connectionKey, call, unwrap, saveConfig, toast, addLog]);

  // ---- Polling ----
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (hasConfig && connected) {
      pollRef.current = setInterval(async () => {
        try {
          const t0 = Date.now();
          const data = await call('GET', 'connected', appId.trim(), connectionKey.trim());
          const result = unwrap(data);
          const isConn = result?.connected === true;
          setConnected(isConn);
          setLastLatency(Date.now() - t0);

          if (isConn && !prevConnectedRef.current) {
            toast({ description: 'The Handy reconectado' });
            addLog('recv', 'Dispositivo reconectado');
          } else if (!isConn && prevConnectedRef.current) {
            toast({ description: 'The Handy desconectado', variant: 'destructive' });
            addLog('error', 'Dispositivo desconectado');
          }
          prevConnectedRef.current = isConn;

          // Poll mode — but respect mode lock to avoid reverting user's selection
          // Don't overwrite mode if user changed it recently or HSP streaming is active
          const modeLocked = (Date.now() - modeChangeTimeRef.current) < MODE_LOCK_DURATION;
          if (!modeLocked) {
            const modeData = await call('GET', 'mode', appId.trim(), connectionKey.trim());
            const modeResult = unwrap(modeData);
            if (modeResult && typeof modeResult.mode === 'number') {
              const reportedMode = modeResult.mode;
              // Only update if the device reports a different mode AND we're not streaming HSP
              // (during HSP streaming, device may report different modes between hdsp commands)
              if (reportedMode !== currentMode) {
                setCurrentMode(reportedMode);
                addLog('recv', `Modo detectado por dispositivo: ${MODE_NAMES[reportedMode]} (${reportedMode})`);
              }
            }
          }

          // Only poll HAMP state when in HAMP mode
          if (currentMode === 0) {
            const hampData = await call('GET', 'hamp/state', appId.trim(), connectionKey.trim());
            const hampResult = unwrap(hampData);
            if (hampResult) setHampPlaying((hampResult.play_state as number) === 1);
          }
        } catch {}
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasConfig, connected, appId, connectionKey, call, unwrap, toast, addLog]);

  // ---- Clean up HSP interval on unmount or mode change ----
  useEffect(() => {
    return () => {
      if (hspIntervalRef.current) {
        clearInterval(hspIntervalRef.current);
        hspIntervalRef.current = null;
      }
    };
  }, []);

  // ---- Position inversion helpers ----
  // When positionInverted is true, the device reads positions inverted.
  // We need to transform: display = max - raw, send = max - desired
  const SLIDER_ABS_MAX = 109.3;

  const invertPosition = useCallback((normalized: number): number => {
    // normalized: 0-1 value from API's slider/state position field
    // When inverted, flip: 0→1, 1→0
    return positionInverted ? 1 - normalized : normalized;
  }, [positionInverted]);

  const invertNormalized = useCallback((norm: number): number => {
    // norm: 0-1 value; inverted: 1 - norm
    return positionInverted ? 1 - norm : norm;
  }, [positionInverted]);

  // ---- Device commands ----

  // Ref for hspStopStream to allow setMode to call it without circular deps
  const hspStopRef = useRef<() => void>(() => {});

  const setMode = useCallback(async (mode: number) => {
    // Stop any active HSP streaming if switching away from HSP mode
    if (currentMode === 4 && mode !== 4 && hspPlaying) {
      hspStopRef.current();
    }
    setLoading(true);
    addLog('send', `Cambiar modo → ${MODE_NAMES[mode]} (${mode})`);
    // Lock mode: prevent polling from overwriting for 10 seconds
    modeChangeTimeRef.current = Date.now();
    try {
      await call('PUT', 'mode2', appId.trim(), connectionKey.trim(), { mode });
      setCurrentMode(mode);
      setHampPlaying(false);
      setHvpEnabled(false);
      lastHdspSentRef.current = null;
      setHdspPosition(50);
      addLog('recv', `Modo cambiado a ${MODE_NAMES[mode]}`);
      toast({ description: `Modo: ${MODE_NAMES[mode]}` });
    } catch {
      addLog('error', 'Error al cambiar modo');
    } finally {
      setLoading(false);
    }
  }, [call, appId, connectionKey, addLog, toast, currentMode, hspPlaying]);

  // =============================================
  // HAMP Functions
  // =============================================

  const computeStrokeRange = useCallback((strokePercent: number) => {
    // strokePercent: 0 = no movement (center only), 100 = full device range
    // If manual stroke positions are set, use those as the base range
    // Otherwise use the device's detected physical limits (mm scale 0-109.3)
    const baseMin = manualStrokeMin !== null ? manualStrokeMin : deviceMin;
    const baseMax = manualStrokeMax !== null ? manualStrokeMax : deviceMax;
    const center = (baseMin + baseMax) / 2;
    const halfRange = Math.abs(baseMax - baseMin) / 2;
    const effectiveRange = (strokePercent / 100) * halfRange;
    // Raw mm values (0-109.3), normalized to 0-1 for API
    const rawMin = Math.max(0, center - effectiveRange);
    const rawMax = Math.min(SLIDER_ABS_MAX, center + effectiveRange);
    return { min: rawMin / SLIDER_ABS_MAX, max: rawMax / SLIDER_ABS_MAX, center, effectiveRange, rawMin, rawMax };
  }, [deviceMin, deviceMax, manualStrokeMin, manualStrokeMax]);

  const hampStart = useCallback(async () => {
    setLoading(true);
    addLog('send', 'HAMP → START');
    try {
      // Set stroke range first (normalized 0-1 for API)
      const { min, max, rawMin, rawMax } = computeStrokeRange(hampStroke);
      addLog('send', `Slider stroke: min=${min.toFixed(3)} max=${max.toFixed(3)} (${rawMin.toFixed(1)}—${rawMax.toFixed(1)} mm)`);
      await call('PUT', 'slider/stroke', appId.trim(), connectionKey.trim(), { min, max });

      const result = await call('PUT', 'hamp/start', appId.trim(), connectionKey.trim());
      if (result) {
        const r = unwrap(result);
        addLog('recv', `HAMP started: play_state=${r?.play_state}, velocity=${r?.velocity}`);
      }
      if (hampVelocity > 0) {
        await call('PUT', 'hamp/velocity', appId.trim(), connectionKey.trim(), { velocity: hampVelocity / 100 });
        addLog('send', `HAMP velocity → ${hampVelocity}%`);
      }
      setHampPlaying(true);
      toast({ description: 'HAMP iniciado' });
    } catch {
      addLog('error', 'Error al iniciar HAMP');
      toast({ description: 'Error al iniciar HAMP', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [call, appId, connectionKey, hampVelocity, hampStroke, computeStrokeRange, unwrap, addLog, toast]);

  const hampStop = useCallback(async () => {
    setLoading(true);
    addLog('send', 'HAMP → STOP');
    try {
      await call('PUT', 'hamp/stop', appId.trim(), connectionKey.trim());
      setHampPlaying(false);
      addLog('recv', 'HAMP stopped');
    } catch {
      addLog('error', 'Error al detener HAMP');
    } finally {
      setLoading(false);
    }
  }, [call, appId, connectionKey, addLog]);

  const hampSetVelocity = useCallback(async (v: number) => {
    setHampVelocity(v);
    if (!hampPlaying) return;
    addLog('send', `HAMP velocity → ${v}%`);
    try {
      await call('PUT', 'hamp/velocity', appId.trim(), connectionKey.trim(), { velocity: v / 100 });
    } catch {}
  }, [call, appId, connectionKey, hampPlaying, addLog]);

  const hampSetStroke = useCallback(async (v: number) => {
    setHampStroke(v);
    // Only send to device when HAMP is actively playing
    if (!hampPlaying) return;
    addLog('send', `HAMP stroke → ${v}%`);
    try {
      const { min, max, rawMin, rawMax } = computeStrokeRange(v);
      await call('PUT', 'slider/stroke', appId.trim(), connectionKey.trim(), { min, max });
      addLog('recv', `Stroke aplicado: ${min.toFixed(3)}—${max.toFixed(3)} (${rawMin.toFixed(1)}—${rawMax.toFixed(1)} mm)`);
    } catch {}
  }, [call, appId, connectionKey, hampPlaying, computeStrokeRange, addLog]);

  const hampApplyPreset = useCallback(async (velocity: number, stroke: number) => {
    setHampVelocity(velocity);
    setHampStroke(stroke);
    addLog('send', `HAMP preset: vel=${velocity}% stroke=${stroke}%`);
    try {
      if (hampPlaying) {
        await call('PUT', 'hamp/velocity', appId.trim(), connectionKey.trim(), { velocity: velocity / 100 });
        const { min, max, rawMin, rawMax } = computeStrokeRange(stroke);
        await call('PUT', 'slider/stroke', appId.trim(), connectionKey.trim(), { min, max });
        addLog('recv', `Preset aplicado: stroke ${min.toFixed(3)}—${max.toFixed(3)} (${rawMin.toFixed(1)}—${rawMax.toFixed(1)} mm)`);
      }
    } catch {}
  }, [call, appId, connectionKey, hampPlaying, computeStrokeRange, addLog]);

  // =============================================
  // HDSP Functions
  // =============================================

  const hdspMove = useCallback(async (position: number, velocity: number = 80) => {
    // Prevent duplicate sends (debounce same position)
    if (lastHdspSentRef.current === position) return;
    lastHdspSentRef.current = position;

    // position: 0-100 percentage
    setHdspPosition(position);
    // Convert to 0-1 and invert the position before sending to device if needed
    const clampedNorm = Math.max(0, Math.min(1, position / 100));
    const devicePos = invertNormalized(clampedNorm);
    addLog('send', `HDSP → pos=${position.toFixed(0)}%${positionInverted ? ' (inv→' + (devicePos * 100).toFixed(0) + '%)' : ''} vel=${velocity}%`);
    try {
      await call('PUT', 'hdsp/xpvp', appId.trim(), connectionKey.trim(), {
        xp: devicePos,
        vp: velocity / 100,
        stop_on_target: true,  // Always stop at target to prevent oscillation
      });
    } catch {}
  }, [call, appId, connectionKey, addLog, invertNormalized, positionInverted]);

  const hdspStop = useCallback(async () => {
    lastHdspSentRef.current = null; // Reset debounce
    addLog('send', 'HDSP → STOP (centro)');
    try {
      await call('PUT', 'hdsp/xpvp', appId.trim(), connectionKey.trim(), {
        xp: 0.5,  // Center is always 0.5 regardless of inversion
        vp: 0.3,
        stop_on_target: true,
      });
      setHdspPosition(50);
    } catch {}
  }, [call, appId, connectionKey, addLog]);

  // =============================================
  // HVP Functions
  // =============================================

  const hvpSetState = useCallback(async (opts?: { amplitude?: number; frequency?: number; position?: number }) => {
    const amplitude = opts?.amplitude ?? hvpAmplitude;
    const frequency = opts?.frequency ?? hvpFrequency;
    const position = opts?.position ?? hvpPosition;
    try {
      await call('PUT', 'hvp/state', appId.trim(), connectionKey.trim(), {
        amplitude,
        frequency,
        position: position / 100,
      });
    } catch {}
  }, [call, appId, connectionKey, hvpAmplitude, hvpFrequency, hvpPosition]);

  const hvpStart = useCallback(async (amplitude: number) => {
    addLog('send', `HVP START amplitude=${Math.round(amplitude * 100)}% freq=${hvpFrequency}Hz pos=${hvpPosition}%`);
    try {
      await call('PUT', 'hvp/start', appId.trim(), connectionKey.trim());
      setHvpEnabled(true);
      setHvpAmplitude(amplitude);
      // Set full state (amplitude, frequency, position) after start
      await hvpSetState({ amplitude });
      addLog('recv', 'HVP started');
    } catch {
      addLog('error', 'HVP no soportado por el dispositivo');
      toast({ description: 'Vibración no soportada por este modelo', variant: 'destructive' });
    }
  }, [call, appId, connectionKey, hvpFrequency, hvpPosition, hvpSetState, addLog, toast]);

  const hvpStop = useCallback(async () => {
    addLog('send', 'HVP → STOP');
    try {
      await call('PUT', 'hvp/stop', appId.trim(), connectionKey.trim());
      setHvpEnabled(false);
      setHvpAmplitude(0);
    } catch {}
  }, [call, appId, connectionKey, addLog]);

  const hvpSetAmplitude = useCallback(async (amplitude: number) => {
    setHvpAmplitude(amplitude);
    if (amplitude === 0) {
      hvpStop();
    } else if (hvpEnabled) {
      await hvpSetState({ amplitude });
    } else {
      try {
        await call('PUT', 'hvp/start', appId.trim(), connectionKey.trim());
        setHvpEnabled(true);
        await hvpSetState({ amplitude });
      } catch {}
    }
  }, [call, appId, connectionKey, hvpEnabled, hvpStop, hvpSetState]);

  // =============================================
  // HSP Streaming Functions
  // =============================================

  const hspGeneratePosition = useCallback((pattern: string, timeMs: number, speed: number): number => {
    const t = (timeMs / 1000) * speed; // Time in seconds adjusted by speed
    switch (pattern) {
      case 'sine': {
        // Smooth sine wave between 5% and 95% (full range with safety margin)
        const raw = 50 + 45 * Math.sin(t * 2);
        return Math.max(0, Math.min(100, raw));
      }
      case 'ramp': {
        // Linear ramp up and down (triangle wave), period = 2s at 1x speed
        const period = 2 / speed;
        const phase = (t % period) / period;
        return phase < 0.5 ? phase * 2 * 100 : (1 - phase) * 2 * 100;
      }
      case 'pulse': {
        // Quick pulse: fast up, hold top, fast down, hold bottom (balanced)
        const period = 3 / speed;
        const phase = (t % period) / period;
        if (phase < 0.1) return (phase / 0.1) * 100;          // Ramp up (10%)
        if (phase < 0.35) return 100;                          // Hold top (25%)
        if (phase < 0.45) return (1 - (phase - 0.35) / 0.1) * 100; // Ramp down (10%)
        return 0;                                              // Hold bottom (55%)
      }
      case 'sawtooth': {
        // Sawtooth: slow up, fast down, period = 2s at 1x speed
        const period = 2 / speed;
        const phase = (t % period) / period;
        return phase * 100;
      }
      default:
        return 50;
    }
  }, []);

  const hspStartStream = useCallback(async () => {
    addLog('send', `HSP → Iniciar streaming (${hspPattern}, ${hspSpeed}x)`);
    setLoading(true);
    try {
      // Set HSP mode first and lock it to prevent polling override
      modeChangeTimeRef.current = Date.now();
      await call('PUT', 'mode2', appId.trim(), connectionKey.trim(), { mode: 4 });
      setCurrentMode(4); // Ensure UI reflects HSP immediately

      hspStartTimeRef.current = Date.now();
      setHspPlaying(true);

      // Stream positions at ~12fps using hdsp/xpvp for real-time control
      hspIntervalRef.current = setInterval(async () => {
        if (!hspIntervalRef.current) return;
        const elapsed = Date.now() - hspStartTimeRef.current;
        const pos = hspGeneratePosition(hspPattern, elapsed, hspSpeed);
        setHspLivePosition(pos);

        try {
          // Invert position for device if needed
          const devicePos = invertNormalized(pos / 100);
          await call('PUT', 'hdsp/xpvp', appId.trim(), connectionKey.trim(), {
            xp: devicePos,
            vp: 1.0,
            stop_on_target: false, // Continuous streaming, don't stop
          });
        } catch {}
      }, 80); // ~12.5 updates/sec (device limitation)

      addLog('recv', `HSP streaming iniciado: ${hspPattern} @ ${hspSpeed}x${positionInverted ? ' (invertido)' : ''}`);
      toast({ description: `Streaming ${hspPattern} iniciado` });
    } catch {
      addLog('error', 'Error al iniciar HSP');
      toast({ description: 'Error al iniciar streaming', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [call, appId, connectionKey, hspPattern, hspSpeed, hspGeneratePosition, addLog, toast, invertNormalized, positionInverted]);

  // Read current slider position from device
  // The effective position for calibration: manual override takes priority
  const effectiveSliderPos = manualPositionOverride !== '' ? parseFloat(manualPositionOverride) : currentSliderPos;

  const readSliderPosition = useCallback(async () => {
    setReadingPosition(true);
    setManualPositionOverride(''); // Clear override when reading from device
    addLog('send', 'Leyendo posición del slider...');
    try {
      const d = await call('GET', 'slider/state', appId.trim(), connectionKey.trim(), undefined, 5000);
      const r = unwrap(d);
      const normalizedPos = r?.position as number;
      if (normalizedPos !== undefined) {
        // API returns 'position' as normalized 0-1 and 'position_absolute' in mm
        // Apply software inversion on the normalized value, then convert to mm for display
        const displayNormalized = invertPosition(normalizedPos);
        const displayMm = displayNormalized * SLIDER_ABS_MAX;
        setCurrentSliderPos(Math.round(displayMm * 100) / 100);
        addLog('recv', `Posición: dispositivo=${normalizedPos.toFixed(3)} (${(normalizedPos * SLIDER_ABS_MAX).toFixed(1)} mm)${positionInverted ? ` → corregida=${displayNormalized.toFixed(3)} (${displayMm.toFixed(1)} mm)` : ''}`);
      } else {
        addLog('error', 'No se pudo leer la posición');
      }
    } catch {
      addLog('error', 'Error al leer posición');
    } finally {
      setReadingPosition(false);
    }
  }, [call, appId, connectionKey, unwrap, addLog, invertPosition, positionInverted]);

  // Override position manually (when device reading is wrong)
  const applyManualPositionOverride = useCallback((value: string) => {
    setManualPositionOverride(value);
    const num = parseFloat(value);
    if (!isNaN(num)) {
      addLog('info', `Posición manual override: ${num}`);
    }
  }, [addLog]);

  // Quick-set position presets
  const setQuickPosition = useCallback((value: number, label: string) => {
    const str = String(value);
    setManualPositionOverride(str);
    addLog('info', `Posición rápida → ${value} (${label})`);
  }, [addLog]);

  // Reset device stroke to factory defaults (normalized 0 - 1.0)
  const resetDeviceStroke = useCallback(async () => {
    setApplyingStrokeReset(true);
    addLog('send', 'Reset stroke del dispositivo → min=0, max=1.0');
    try {
      // API expects normalized 0-1 values
      await call('PUT', 'slider/stroke', appId.trim(), connectionKey.trim(), { min: 0, max: 1.0 });
      setDeviceMin(0);
      setDeviceMax(SLIDER_ABS_MAX);
      setManualStrokeMin(null);
      setManualStrokeMax(null);
      setManualPositionOverride('');
      addLog('recv', `Stroke reseteado a valores de fábrica (0 — 1.0, ${SLIDER_ABS_MAX} mm)`);
      toast({ description: 'Stroke reseteado a valores de fábrica' });
    } catch {
      addLog('error', 'Error al resetear stroke del dispositivo');
      toast({ description: 'Error al resetear stroke', variant: 'destructive' });
    } finally {
      setApplyingStrokeReset(false);
    }
  }, [call, appId, connectionKey, addLog, toast]);

  const setManualMin = useCallback(async () => {
    const pos = effectiveSliderPos;
    if (pos === null || isNaN(pos)) {
      toast({ description: 'Primero lee o ingresa la posición actual', variant: 'destructive' });
      return;
    }
    const val = Math.round(pos * 100) / 100;
    setManualStrokeMin(val);
    addLog('send', `Stroke mínimo → ${val}`);
    toast({ description: `Mín establecido: ${val}` });
  }, [effectiveSliderPos, toast, addLog]);

  const setManualMax = useCallback(async () => {
    const pos = effectiveSliderPos;
    if (pos === null || isNaN(pos)) {
      toast({ description: 'Primero lee o ingresa la posición actual', variant: 'destructive' });
      return;
    }
    const val = Math.round(pos * 100) / 100;
    setManualStrokeMax(val);
    addLog('send', `Stroke máximo → ${val}`);
    toast({ description: `Máx establecido: ${val}` });
  }, [effectiveSliderPos, toast, addLog]);

  const resetManualStroke = useCallback(() => {
    setManualStrokeMin(null);
    setManualStrokeMax(null);
    setCurrentSliderPos(null);
    setManualPositionOverride('');
    addLog('info', 'Stroke manual reiniciado a rango del dispositivo');
  }, [addLog]);

  const applyManualStroke = useCallback(async () => {
    if (manualStrokeMin === null || manualStrokeMax === null) {
      toast({ description: 'Establece mínimo y máximo primero', variant: 'destructive' });
      return;
    }
    // Normalize mm values to 0-1 for the API
    const normMin = Math.max(0, Math.min(1, manualStrokeMin / SLIDER_ABS_MAX));
    const normMax = Math.max(0, Math.min(1, manualStrokeMax / SLIDER_ABS_MAX));
    addLog('send', `Aplicando stroke manual: min=${manualStrokeMin}mm (${normMin.toFixed(3)}) max=${manualStrokeMax}mm (${normMax.toFixed(3)})`);
    try {
      await call('PUT', 'slider/stroke', appId.trim(), connectionKey.trim(), { min: normMin, max: normMax });
      addLog('recv', `Stroke aplicado: ${normMin.toFixed(3)} — ${normMax.toFixed(3)}`);
      toast({ description: 'Stroke manual aplicado' });
    } catch {
      addLog('error', 'Error al aplicar stroke manual');
    }
  }, [call, appId, connectionKey, manualStrokeMin, manualStrokeMax, addLog, toast]);

  const hspStopStream = useCallback(() => {
    if (hspIntervalRef.current) {
      clearInterval(hspIntervalRef.current);
      hspIntervalRef.current = null;
    }
    setHspPlaying(false);
    setHspLivePosition(50);
    addLog('recv', 'HSP streaming detenido');
  }, [addLog]);

  // Keep ref in sync so setMode can call it
  useEffect(() => { hspStopRef.current = hspStopStream; }, [hspStopStream]);

  // ---- FW status label ----
  const fwStatusLabel = (s?: number) => s === 0 ? 'OK' : s === 1 ? 'Actualizable' : s === 2 ? 'Requiere actualizar' : '?';

  // ---- Computed stroke range for display ----
  const currentStrokeRange = computeStrokeRange(hampStroke);
  const strokeDisplayMin = currentStrokeRange.min.toFixed(3);
  const strokeDisplayMax = currentStrokeRange.max.toFixed(3);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="max-h-[calc(100vh-180px)] overflow-y-auto pr-1 flex flex-col gap-5 pb-6">
      {/* ---- Connection Header ---- */}
      <ConnectionStatusBadge connected={connected} latency={lastLatency} />

      {/* ---- Auth Config (collapsible when connected) ---- */}
      <Card className={cn(
        "transition-all",
        connected && "border-green-200 dark:border-green-900"
      )}>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
            <Fingerprint className="w-3.5 h-3.5" />
            Autenticación
            {connected && <CheckCircle2 className="w-3 h-3 text-green-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {/* App ID */}
          <div className="space-y-1">
            <Label className="text-[11px] flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> App ID
            </Label>
            <div className="relative">
              <Input
                value={appId}
                onChange={(e) => { setAppId(e.target.value); setTestResult('idle'); }}
                type={showAppId ? 'text' : 'password'}
                placeholder="Tu App ID de Handy"
                className="h-8 text-xs font-mono pr-8"
                onKeyDown={(e) => { if (e.key === 'Enter') connectAndDiscover(); }}
              />
              <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-8 w-8 px-0 hover:bg-transparent" onClick={() => setShowAppId(!showAppId)} tabIndex={-1}>
                {showAppId ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* Connection Key */}
          <div className="space-y-1">
            <Label className="text-[11px] flex items-center gap-1">
              <Fingerprint className="w-3 h-3" /> Connection Key
            </Label>
            <Input
              value={connectionKey}
              onChange={(e) => { setConnectionKey(e.target.value); setTestResult('idle'); }}
              placeholder="Ej: Fthxrbhy"
              className="h-8 text-xs font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter') connectAndDiscover(); }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={connectAndDiscover}
              disabled={!hasConfig || connecting || testResult === 'testing'}
              className={cn(
                "flex-1 h-8 text-xs gap-1.5",
                connected
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {connecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : connected ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              {connecting ? 'Conectando...' : connected ? 'Reconectar' : 'Conectar'}
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={saveConfig} disabled={!hasConfig}>
              {configSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Test result message */}
          {testResult === 'error' && testMessage && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600 dark:text-red-400">{testMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Device Info Card ---- */}
      {connected && deviceInfo && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
              <Hexagon className="w-3.5 h-3.5" />
              Información del Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/40 border p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Modelo</p>
                <p className="text-sm font-bold">{deviceInfo.hw_model_name || 'N/A'}</p>
              </div>
              <div className="rounded-md bg-muted/40 border p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Firmware</p>
                <p className="text-sm font-mono font-medium">{deviceInfo.fw_version || 'N/A'}</p>
              </div>
              <div className="rounded-md bg-muted/40 border p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Modo Actual</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">{currentMode}</Badge>
                  <span className="text-sm font-medium">{MODE_NAMES[currentMode] || '?'}</span>
                </div>
              </div>
              <div className="rounded-md bg-muted/40 border p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Rango Físico</p>
                <p className="text-sm font-mono font-medium">{deviceMin} — {deviceMax}</p>
              </div>
            </div>
            {/* Capabilities badges */}
            {capabilities && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {capabilities.slider > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Slider
                  </Badge>
                )}
                {(capabilities.lra > 0 || capabilities.erm > 0) && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Activity className="w-3 h-3" /> Vibración
                  </Badge>
                )}
                {!capabilities.slider && capabilities.lra === 0 && capabilities.erm === 0 && (
                  <Badge variant="outline" className="text-[10px]">Sin accionadores conocidos</Badge>
                )}
                {positionInverted && (
                  <Badge className="text-[10px] gap-1 bg-amber-600 hover:bg-amber-700">
                    <RotateCcw className="w-3 h-3" /> Inversión Activa
                  </Badge>
                )}
              </div>
            )}

            {/* Software inversion toggle */}
            <div className={cn(
              "mt-2.5 flex items-center justify-between rounded-md border p-2",
              positionInverted
                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
                : "border-muted"
            )}>
              <div className="flex items-center gap-2">
                <RotateCcw className={cn("w-3.5 h-3.5", positionInverted ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                <div>
                  <p className="text-[10px] font-medium">Corrección por Software</p>
                  <p className="text-[9px] text-muted-foreground">
                    {positionInverted
                      ? 'Posiciones invertidas (0↔100%)'
                      : 'Posiciones normales'}
                  </p>
                </div>
              </div>
              <Button
                variant={positionInverted ? 'destructive' : 'outline'}
                size="sm"
                className="h-7 px-3 text-[10px]"
                onClick={() => {
                  toggleInversion();
                  addLog('info', positionInverted ? 'Inversión desactivada' : 'Inversión ACTIVADA — las posiciones se corregirán');
                }}
              >
                {positionInverted ? 'Desactivar' : 'Activar'}
              </Button>
            </div>

            {/* Slider hardware diagnostics */}
            {sliderSettings && (
              <div className="mt-2 rounded-md bg-muted/30 border p-2 space-y-1">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Diagnostics (Solo Lectura)</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono">
                  <span className="text-muted-foreground">Hall Sensor:</span>
                  <span className={sliderSettings.x_inverse_hall ? "text-amber-600 dark:text-amber-400 font-bold" : "text-green-600 dark:text-green-400"}>
                    {sliderSettings.x_inverse_hall ? 'Invertido' : 'Normal'}
                  </span>
                  <span className="text-muted-foreground">Motor:</span>
                  <span className={sliderSettings.x_inverse_motor ? "text-amber-600 dark:text-amber-400 font-bold" : "text-green-600 dark:text-green-400"}>
                    {sliderSettings.x_inverse_motor ? 'Invertido' : 'Normal'}
                  </span>
                  <span className="text-muted-foreground">Stroke Min:</span>
                  <span>{sliderSettings.x_stroke_min ?? '—'}</span>
                  <span className="text-muted-foreground">Stroke Max:</span>
                  <span>{sliderSettings.x_stroke_max ?? '—'}</span>
                  <span className="text-muted-foreground">Vel Mín:</span>
                  <span>{sliderSettings.x_min_speed ?? '—'}</span>
                  <span className="text-muted-foreground">Vel Máx:</span>
                  <span>{sliderSettings.x_max_speed ?? '—'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Control Area ---- */}
      {connected && (
        <div className="space-y-4">

            {/* ===== MODE SELECTOR ===== */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  <CircleDot className="w-3.5 h-3.5" />
                  Cambiar Modo de Operación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {([0, 2, 4, 7, 8] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant={currentMode === mode ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        "h-auto py-2 flex flex-col items-center gap-0.5 text-xs",
                        currentMode === mode && "ring-2 ring-primary/30"
                      )}
                      onClick={() => setMode(mode)}
                      disabled={loading}
                    >
                      <span className="font-bold text-xs">{MODE_NAMES[mode]}</span>
                      {MODE_DESCRIPTIONS[mode] && (
                        <span className="text-[9px] opacity-70 leading-tight text-center">{MODE_DESCRIPTIONS[mode]}</span>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ===== HAMP CONTROLS ===== */}
            {currentMode === 0 && (
              <Card className={hampPlaying ? "border-green-300 dark:border-green-800" : ""}>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                      <Zap className="w-3.5 h-3.5" />
                      HAMP — Movimiento Alternativo
                    </CardTitle>
                    {hampPlaying && (
                      <Badge className="bg-green-600 text-[10px] animate-pulse gap-1">
                        <Activity className="w-3 h-3" /> Activo
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Play/Stop */}
                  <Button
                    onClick={hampPlaying ? hampStop : hampStart}
                    disabled={loading}
                    className={cn(
                      "w-full h-10 text-sm font-medium gap-2",
                      hampPlaying
                        ? "bg-destructive hover:bg-destructive/90"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : hampPlaying ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {hampPlaying ? 'Detener Movimiento' : 'Iniciar Movimiento'}
                  </Button>

                  {/* Velocity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1"><Gauge className="w-3 h-3" /> Velocidad</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hampVelocity}%</span>
                    </div>
                    <Slider value={[hampVelocity]} onValueChange={([v]) => hampSetVelocity(v)} min={0} max={100} step={1} disabled={loading} />
                  </div>

                  {/* Stroke */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1"><ArrowUpDown className="w-3 h-3" /> Recorrido</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hampStroke}%</span>
                    </div>
                    <Slider value={[hampStroke]} onValueChange={([v]) => hampSetStroke(v)} min={0} max={100} step={1} disabled={loading} />
                    {/* Show actual stroke range being applied (normalized 0-1) */}
                    <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                      <span>Rango: {strokeDisplayMin}</span>
                      <span>{strokeDisplayMax}</span>
                    </div>
                    {manualStrokeMin !== null && manualStrokeMax !== null && (
                      <p className="text-[9px] text-blue-600 dark:text-blue-400">
                        * Usando rango manual: {manualStrokeMin} — {manualStrokeMax}
                      </p>
                    )}
                    {!hampPlaying && (
                      <p className="text-[9px] text-amber-600 dark:text-amber-400">
                        * Inicia el movimiento para aplicar cambios de recorrido en tiempo real
                      </p>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { l: 'Suave', v: 20, s: 40 },
                      { l: 'Medio', v: 50, s: 65 },
                      { l: 'Fuerte', v: 80, s: 85 },
                      { l: 'Máximo', v: 100, s: 100 },
                    ].map((p) => (
                      <Button key={p.l} variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => hampApplyPreset(p.v, p.s)}>
                        {p.l}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== CALIBRATION SECTION ===== */}
            {(currentMode === 0 || currentMode === 2 || currentMode === 4) && (
              <Card>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                      <Crosshair className="w-3.5 h-3.5" />
                      Calibración de Recorrido
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                      onClick={resetDeviceStroke}
                      disabled={applyingStrokeReset || loading}
                    >
                      {applyingStrokeReset ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Reset Fábrica
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  <p className="text-[10px] text-muted-foreground">
                    Mueve el slider a una posición y captúrala como mínimo o máximo del recorrido. Si la lectura del dispositivo es incorrecta, puedes ingresar el valor manualmente.
                  </p>

                  {/* ---- Device Stroke Reset Warning ---- */}
                  {!positionInverted && currentSliderPos !== null && (currentSliderPos < 0 || currentSliderPos > 110) && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 space-y-1">
                        <p className="font-medium">¡Posición fuera de rango — posible inversión!</p>
                        <p>El valor <span className="font-mono font-bold">{currentSliderPos}</span> está fuera del rango válido (0 — 109.3). Si el slider está físicamente en el máximo, activa la <strong>Corrección por Software</strong> en la tarjeta de información del dispositivo.</p>
                      </div>
                    </div>
                  )}

                  {/* ---- Position Source: Read from device OR manual override ---- */}
                  <div className="space-y-2">
                    {/* Read from device button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs gap-1.5"
                      onClick={readSliderPosition}
                      disabled={readingPosition || loading}
                    >
                      {readingPosition ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                      {readingPosition ? 'Leyendo...' : 'Leer Posición del Dispositivo'}
                    </Button>

                    {/* Device reading display */}
                    {currentSliderPos !== null && (
                      <div className={cn(
                        "rounded-md border p-2",
                        positionInverted
                          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                          : (currentSliderPos < 0 || currentSliderPos > 110)
                            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                            : "bg-muted/40"
                      )}>
                        <p className={cn(
                          "text-[9px] uppercase tracking-wider",
                          positionInverted
                            ? "text-green-600 dark:text-green-400 font-medium"
                            : "text-muted-foreground"
                        )}>
                          {positionInverted ? 'Posición Corregida (Software)' : 'Posición Leída'}
                          {positionInverted && (
                            <span className="ml-1">✓</span>
                          )}
                          {!positionInverted && (currentSliderPos < 0 || currentSliderPos > 110) && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">⚠ Fuera de rango</span>
                          )}
                        </p>
                        <p className={cn(
                          "text-sm font-mono font-bold",
                          positionInverted
                            ? "text-green-700 dark:text-green-400"
                            : (currentSliderPos < 0 || currentSliderPos > 110)
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                        )}>
                          {currentSliderPos}
                        </p>
                      </div>
                    )}

                    {/* Manual position override */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Crosshair className="w-3 h-3" /> Ingresar Posición Manualmente
                      </Label>
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="109.3"
                          placeholder="Ej: 109.3"
                          value={manualPositionOverride}
                          onChange={(e) => applyManualPositionOverride(e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Quick-set position presets */}
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Posición Rápida</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] flex-col gap-0"
                          onClick={() => setQuickPosition(0, 'Retraído')}
                        >
                          <ArrowDown className="w-3 h-3" />
                          <span className="font-mono">0</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] flex-col gap-0"
                          onClick={() => setQuickPosition(54.65, 'Centro')}
                        >
                          <Minus className="w-3 h-3" />
                          <span className="font-mono">54.65</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] flex-col gap-0"
                          onClick={() => setQuickPosition(109.3, 'Extendido')}
                        >
                          <ArrowUp className="w-3 h-3" />
                          <span className="font-mono">109.3</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] flex-col gap-0"
                          onClick={() => {
                            const center = deviceMax > deviceMin ? Math.round(((deviceMin + deviceMax) / 2) * 100) / 100 : 54.65;
                            setQuickPosition(center, 'Centro Device');
                          }}
                        >
                          <Activity className="w-3 h-3" />
                          <span className="font-mono text-[8px]">Centro</span>
                        </Button>
                      </div>
                    </div>

                    {/* Effective position display */}
                    {effectiveSliderPos !== null && !isNaN(effectiveSliderPos) && (
                      <div className={cn(
                        "rounded-md border p-2",
                        manualPositionOverride !== ''
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
                          : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                      )}>
                        <p className={cn(
                          "text-[9px] uppercase tracking-wider font-medium",
                          manualPositionOverride !== ''
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-green-600 dark:text-green-400"
                        )}>
                          {manualPositionOverride !== '' ? 'Posición Manual (Override)' : 'Posición Efectiva (Dispositivo)'}
                        </p>
                        <p className="text-sm font-mono font-bold">{effectiveSliderPos}</p>
                      </div>
                    )}
                  </div>

                  {/* ---- Set min/max buttons ---- */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={setManualMin}
                      disabled={effectiveSliderPos === null || isNaN(effectiveSliderPos!)}
                    >
                      <ArrowDown className="w-3 h-3" /> Establecer como Mín
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={setManualMax}
                      disabled={effectiveSliderPos === null || isNaN(effectiveSliderPos!)}
                    >
                      <ArrowUp className="w-3 h-3" /> Establecer como Máx
                    </Button>
                  </div>

                  {/* ---- Current manual range display ---- */}
                  {(manualStrokeMin !== null || manualStrokeMax !== null) && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-2 space-y-1">
                      <p className="text-[9px] text-blue-600 dark:text-blue-400 uppercase tracking-wider font-medium">
                        Rango Manual Configurado
                      </p>
                      <div className="flex justify-between text-xs font-mono">
                        <span>Mín: {manualStrokeMin ?? '—'}</span>
                        <span>Máx: {manualStrokeMax ?? '—'}</span>
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 h-7 text-[10px]"
                          onClick={applyManualStroke}
                          disabled={manualStrokeMin === null || manualStrokeMax === null}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Aplicar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={resetManualStroke}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Device range info */}
                  <p className="text-[9px] text-muted-foreground">
                    Rango del dispositivo: {deviceMin} — {deviceMax} mm (normalizado: {(deviceMin / SLIDER_ABS_MAX).toFixed(3)} — {(deviceMax / SLIDER_ABS_MAX).toFixed(3)})
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ===== HDSP CONTROLS ===== */}
            {currentMode === 2 && (
              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    HDSP — Control Directo de Posición
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Visual position indicator */}
                  <PositionBar position={hdspPosition} min={0} max={100} label="Posición actual" />

                  {/* Position slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Posición</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hdspPosition}%</span>
                    </div>
                    <Slider
                      value={[hdspPosition]}
                      min={0} max={100} step={1}
                      onValueChange={([v]) => {
                        lastHdspSentRef.current = null; // Allow slider to override debounce
                        hdspMove(v, 80);
                      }}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>0% (abajo)</span>
                      <span>100% (arriba)</span>
                    </div>
                  </div>

                  {/* Quick position buttons */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <Button
                      variant={hdspPosition === 0 ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { lastHdspSentRef.current = null; hdspMove(0, 100); }}
                    >
                      <ArrowDown className="w-3 h-3 mr-1" /> Mín
                    </Button>
                    <Button
                      variant={hdspPosition === 25 ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { lastHdspSentRef.current = null; hdspMove(25, 80); }}
                    >
                      25%
                    </Button>
                    <Button
                      variant={hdspPosition === 50 ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { lastHdspSentRef.current = null; hdspMove(50, 80); }}
                    >
                      <Minus className="w-3 h-3 mr-1" /> 50%
                    </Button>
                    <Button
                      variant={hdspPosition === 75 ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { lastHdspSentRef.current = null; hdspMove(75, 80); }}
                    >
                      75%
                    </Button>
                    <Button
                      variant={hdspPosition === 100 ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { lastHdspSentRef.current = null; hdspMove(100, 100); }}
                    >
                      <ArrowUp className="w-3 h-3 mr-1" /> Máx
                    </Button>
                  </div>

                  {/* Velocity control for manual positioning */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-[11px] flex items-center gap-1"><Gauge className="w-3 h-3" /> Velocidad de movimiento</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">80%</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      La velocidad se aplica automáticamente al mover con los botones.
                    </p>
                  </div>

                  {/* Sweep and stop */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => {
                      // Sweep test: full range sweep (0-100% positions)
                      const positions = [0, 100, 50, 0, 100, 50];
                      positions.forEach((p, i) => setTimeout(() => {
                        lastHdspSentRef.current = null;
                        hdspMove(p, 100);
                      }, i * 500));
                      addLog('info', 'HDSP sweep test iniciado');
                    }}>
                      <Radio className="w-3 h-3 mr-1" /> Sweep Test
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={hdspStop}>
                      <Square className="w-3 h-3 mr-1" /> Centrar y Stop
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== HSP STREAMING CONTROLS ===== */}
            {currentMode === 4 && (
              <Card className={hspPlaying ? "border-green-300 dark:border-green-800" : ""}>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                      <Waves className="w-3.5 h-3.5" />
                      HSP — Streaming en Tiempo Real
                    </CardTitle>
                    {hspPlaying && (
                      <Badge className="bg-green-600 text-[10px] animate-pulse gap-1">
                        <Radio className="w-3 h-3" /> Streaming
                      </Badge>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    Genera patrones de movimiento en tiempo real enviados directamente al dispositivo.
                  </p>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Play/Stop */}
                  <Button
                    onClick={hspPlaying ? () => { hspStopStream(); toast({ description: 'Streaming detenido' }); } : hspStartStream}
                    disabled={loading}
                    className={cn(
                      "w-full h-10 text-sm font-medium gap-2",
                      hspPlaying
                        ? "bg-destructive hover:bg-destructive/90"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : hspPlaying ? <StopCircle className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {hspPlaying ? 'Detener Streaming' : 'Iniciar Streaming'}
                  </Button>

                  {/* Live position indicator */}
                  {hspPlaying && (
                    <PositionBar position={hspLivePosition} min={0} max={100} label="Posición en vivo" />
                  )}

                  {/* Pattern selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Waves className="w-3 h-3" /> Patrón de movimiento
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'sine' as const, label: 'Onda Seno', desc: 'Suave y rítmico' },
                        { key: 'ramp' as const, label: 'Rampa', desc: 'Sube y baja lineal' },
                        { key: 'pulse' as const, label: 'Pulso', desc: 'Sube rápido, espera, baja' },
                        { key: 'sawtooth' as const, label: 'Diente de Sierra', desc: 'Sube lento, baja rápido' },
                      ].map((p) => (
                        <Button
                          key={p.key}
                          variant={hspPattern === p.key ? 'default' : 'outline'}
                          size="sm"
                          className="h-auto py-1.5 flex flex-col items-center gap-0"
                          onClick={() => setHspPattern(p.key)}
                          disabled={hspPlaying}
                        >
                          <span className="text-[11px] font-medium">{p.label}</span>
                          <span className="text-[8px] opacity-60">{p.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Speed control */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1">
                        <Timer className="w-3 h-3" /> Velocidad
                      </Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hspSpeed.toFixed(1)}x</span>
                    </div>
                    <Slider
                      value={[hspSpeed * 10]}
                      onValueChange={([v]) => setHspSpeed(v / 10)}
                      min={1} max={30} step={1}
                      disabled={loading}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>0.1x lento</span>
                      <span>3.0x rápido</span>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="rounded-md bg-muted/40 border p-2 space-y-1">
                    <p className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                      <Info className="w-3 h-3" /> Cómo funciona
                    </p>
                    <ul className="text-[9px] text-muted-foreground space-y-0.5 list-disc pl-3">
                      <li>El patrón se genera localmente y se envía al dispositivo a ~12 actualizaciones/seg</li>
                      <li>Cambia el patrón y velocidad antes de iniciar</li>
                      <li>El dispositivo usará su rango completo (0% — 100%)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== HVP CONTROLS ===== */}
            {currentMode === 8 && (
              <Card>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                      <Activity className="w-3.5 h-3.5" />
                      HVP — Vibración
                    </CardTitle>
                    {hvpEnabled && (
                      <Badge className="bg-purple-600 text-[10px] animate-pulse gap-1">
                        <Activity className="w-3 h-3" /> Activa
                      </Badge>
                    )}
                  </div>
                  {!capabilities?.lra && !capabilities?.erm && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      ⚠ Tu dispositivo puede no soportar vibración (sin LRA/ERM detectado)
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-3">
                  {/* Amplitude */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Intensidad</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">
                        {hvpEnabled ? `${Math.round(hvpAmplitude * 100)}%` : 'Inactiva'}
                      </span>
                    </div>
                    <Slider
                      value={[Math.round(hvpAmplitude * 100)]}
                      min={0} max={100} step={1}
                      onValueChange={([v]) => hvpSetAmplitude(v / 100)}
                    />
                  </div>
                  {/* Frequency */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1"><Timer className="w-3 h-3" /> Frecuencia</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hvpFrequency} Hz</span>
                    </div>
                    <Slider
                      value={[hvpFrequency]}
                      min={20} max={200} step={1}
                      onValueChange={([v]) => { setHvpFrequency(v); if (hvpEnabled) hvpSetState({ frequency: v }); }}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>20 Hz</span>
                      <span>200 Hz</span>
                    </div>
                  </div>
                  {/* Position */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs flex items-center gap-1"><Crosshair className="w-3 h-3" /> Posición</Label>
                      <span className="text-xs font-mono font-bold tabular-nums">{hvpPosition}%</span>
                    </div>
                    <Slider
                      value={[hvpPosition]}
                      min={1} max={100} step={1}
                      onValueChange={([v]) => { setHvpPosition(v); if (hvpEnabled) hvpSetState({ position: v }); }}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>1% (abajo)</span>
                      <span>100% (arriba)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => hvpStart(0.3)}>Suave 30%</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => hvpStart(0.6)}>Medio 60%</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => hvpStart(1.0)}>Máx 100%</Button>
                  </div>
                  <Button variant="destructive" size="sm" className="w-full h-8" onClick={hvpStop} disabled={!hvpEnabled}>
                    <Square className="w-3.5 h-3.5 mr-1.5" /> Detener Vibración
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ===== QUICK COMMAND TESTS ===== */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                  <Cpu className="w-3.5 h-3.5" />
                  Pruebas Rápidas de API
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Envía comandos individuales al dispositivo para verificar la respuesta de cada endpoint.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Server Time', action: async () => { const d = await call('GET', 'servertime', appId.trim(), connectionKey.trim()); addLog('recv', `Server time: ${JSON.stringify(d?.result ?? d).slice(0, 50)}`); }},
                    { label: 'Info', action: async () => { const d = await call('GET', 'info', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `Info: ${JSON.stringify(r).slice(0, 80)}`); }},
                    { label: 'Conectado?', action: async () => { const d = await call('GET', 'connected', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `Connected: ${r?.connected}`); }},
                    { label: 'HAMP State', action: async () => { const d = await call('GET', 'hamp/state', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `HAMP: ${JSON.stringify(r)}`); }},
                    { label: 'Slider Stroke', action: async () => { const d = await call('GET', 'slider/stroke', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `Stroke: min=${(r?.min as number)?.toFixed(3)} max=${(r?.max as number)?.toFixed(3)}`); }},
                    { label: 'Capabilities', action: async () => { const d = await call('GET', 'capabilities', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `Caps: ${JSON.stringify(r)}`); }},
                    { label: 'HDSP State', action: async () => { const d = await call('GET', 'hdsp/state', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `HDSP: ${JSON.stringify(r)}`); }},
                    { label: 'HSP State', action: async () => { const d = await call('GET', 'hsp/state', appId.trim(), connectionKey.trim()); const r = unwrap(d); addLog('recv', `HSP: ${JSON.stringify(r)}`); }},
                  ].map((cmd) => (
                    <Button key={cmd.label} variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => { addLog('send', cmd.label); cmd.action(); }}>
                      <ChevronRight className="w-3 h-3" /> {cmd.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ===== ACTIVITY LOG ===== */}
            {logEntries.length > 0 && (
              <Card>
                <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    Log de Actividad
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">{logEntries.length}</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setLogEntries([])}>
                    Limpiar
                  </Button>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <ActivityLog entries={logEntries} />
                </CardContent>
              </Card>
            )}

          </div>
      )}
    </div>
  );
}
