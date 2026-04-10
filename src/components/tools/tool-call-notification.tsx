'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dices,
  Brain,
  CloudSun,
  Globe,
  Bell,
  Wrench,
  Check,
  X,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallResult {
  success: boolean;
  displayMessage: string;
  duration: number;
}

export type ToolCallPhase = 'idle' | 'executing' | 'done' | 'error';

export interface ToolCallNotificationProps {
  /** Whether a tool call is in progress or just finished */
  active: boolean;
  /** Tool function name (e.g. "roll_dice") */
  toolName?: string;
  /** Human-readable label (e.g. "Tirar Dados", "Buscar en Internet") */
  toolLabel?: string;
  /** Lucide icon name string mapped to a component */
  toolIcon?: string;
  /** Parameters sent to the tool */
  params?: Record<string, unknown>;
  /** Result info after completion */
  result?: ToolCallResult;
  /** Current phase */
  phase: ToolCallPhase;
  /** Unique call ID for this specific tool execution */
  callId?: string;
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Dices,
  Brain,
  CloudSun,
  Globe,
  Bell,
  Wrench,
  Search: Globe,
  WebSearch: Globe,
  Calculator: Brain,
  Weather: CloudSun,
  Timer: Bell,
};

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Wrench;
  return ICON_MAP[name] ?? Wrench;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncate(value: unknown, maxLen = 28): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

/** Show up to 3 meaningful key-value pairs */
function formatParams(params?: Record<string, unknown>): [string, string][] {
  if (!params) return [];
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  return entries.slice(0, 3).map(([k, v]) => [k, truncate(v)]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PhaseIcon({
  phase,
  icon,
}: {
  phase: ToolCallPhase;
  icon: LucideIcon;
}) {
  const base =
    'w-5 h-5 shrink-0 rounded-md flex items-center justify-center';

  switch (phase) {
    case 'executing':
      return (
        <div className={cn(base, 'bg-amber-500/20')}>
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        </div>
      );
    case 'done':
      return (
        <div className={cn(base, 'bg-emerald-500/20')}>
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
      );
    case 'error':
      return (
        <div className={cn(base, 'bg-red-500/20')}>
          <X className="w-4 h-4 text-red-400" />
        </div>
      );
    default:
      return (
        <div className={cn(base, 'bg-amber-500/20')}>
          <icon className="w-4 h-4 text-amber-400" />
        </div>
      );
  }
}

function ParamsList({ params }: { params: [string, string][] }) {
  if (params.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-tight">
      {params.map(([key, val]) => (
        <span key={key} className="text-muted-foreground">
          <span className="text-foreground/70 font-medium">{key}:</span>{' '}
          <span className="text-muted-foreground/90">{val}</span>
        </span>
      ))}
    </div>
  );
}

function ResultLine({ result }: { result?: ToolCallResult }) {
  if (!result) return null;
  const msg = result.displayMessage;
  const duration = result.duration > 0 ? ` · ${formatDuration(result.duration)}` : '';
  return (
    <p className="text-[11px] leading-snug text-muted-foreground truncate">
      {msg}{duration}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const overlayVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    transition: { duration: 0.25 },
  },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolCallNotification({
  active,
  toolName,
  toolLabel,
  toolIcon,
  params,
  result,
  phase,
  callId: callIdProp,
}: ToolCallNotificationProps) {
  // -----------------------------------------------------------------------
  // Auto-dismiss logic (no synchronous setState in effects)
  // -----------------------------------------------------------------------
  // We track the *id* of the dismissed notification rather than a boolean.
  // When a new tool call starts (different callId), the old dismissedId
  // no longer matches, so the notification becomes visible again automatically.
  //
  // setDismissedId is ONLY called from inside setTimeout callbacks, which
  // the linter treats as external system responses (not synchronous).

  // Use provided callId or generate from toolName+phase+active for uniqueness
  const callId = callIdProp || `${toolName || 'tool'}::${phase}::${active ? 'active' : 'inactive'}`;
  const shouldShow = active && phase !== 'idle';

  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = shouldShow && dismissedId !== callId;

  // Schedule auto-dismiss for terminal phases (done / error)
  useEffect(() => {
    if (shouldShow && (phase === 'done' || phase === 'error')) {
      const id = callId; // capture current
      dismissTimer.current = setTimeout(() => {
        setDismissedId(id);
      }, 4000);
      return () => {
        if (dismissTimer.current) {
          clearTimeout(dismissTimer.current);
          dismissTimer.current = null;
        }
      };
    }

    // Clear pending timer when phase is not terminal
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, [shouldShow, phase, callId]);

  // Don't render the AnimatePresence wrapper at all when idle
  if (!shouldShow && dismissedId === null) return null;

  const Icon = resolveIcon(toolIcon);
  const label = toolLabel || toolName || 'Herramienta';
  const paramEntries = formatParams(params);

  // Phase-based accent colours
  const accentBorder =
    phase === 'done'
      ? 'border-emerald-500/40'
      : phase === 'error'
        ? 'border-red-500/40'
        : 'border-amber-500/40';

  const accentGlow =
    phase === 'done'
      ? 'shadow-emerald-500/10 shadow-lg'
      : phase === 'error'
        ? 'shadow-red-500/10 shadow-lg'
        : 'shadow-amber-500/10 shadow-lg';

  // Pulse ring for executing phase
  const pulseRing =
    phase === 'executing' ? (
      <span className="absolute inset-0 rounded-xl animate-ping bg-amber-500/10 pointer-events-none" />
    ) : null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
          <motion.div
            key={`${toolName}-${phase}`}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative pointer-events-auto',
              'max-w-sm w-auto min-w-[240px]',
            )}
          >
            {pulseRing}

            <div
              className={cn(
                'relative rounded-xl border backdrop-blur-xl',
                'bg-background/80',
                accentBorder,
                accentGlow,
                'px-4 py-3',
              )}
            >
              {/* Top row: icon + label + phase badge */}
              <div className="flex items-center gap-3">
                <PhaseIcon phase={phase} icon={Icon} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {label}
                    </span>

                    {toolName && toolName !== toolLabel && (
                      <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                        {toolName}
                      </span>
                    )}
                  </div>

                  {/* Parameters */}
                  {phase === 'executing' && (
                    <ParamsList params={paramEntries} />
                  )}

                  {/* Result / error */}
                  {(phase === 'done' || phase === 'error') && (
                    <ResultLine result={result} />
                  )}
                </div>

                {/* Phase badge */}
                <span
                  className={cn(
                    'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    phase === 'executing' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                    phase === 'done' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                    phase === 'error' && 'bg-red-500/15 text-red-600 dark:text-red-400',
                  )}
                >
                  {phase === 'executing' && 'ejecutando…'}
                  {phase === 'done' && 'listo'}
                  {phase === 'error' && 'error'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
