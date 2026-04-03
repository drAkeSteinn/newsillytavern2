'use client';

/**
 * HUDDisplay Component
 * 
 * Displays a HUD (Heads-Up Display) overlay in the chat interface.
 * Shows field values from the active HUD template AND character attributes with showInHUD=true.
 * 
 * Features:
 * - Multiple display styles (default, progress, badge, icon, chip, status, gauge, etc.)
 * - Positionable (top-left, top-right, bottom-left, bottom-right)
 * - Real-time updates from trigger detection
 * - Progress bars for gauges for numeric fields
 * - Color-coded badges for enum fields
 * - Automatic integration with character stats system
 * - Group chat support: shows attributes for all group members
 * - Animated visual effects (value change, shine, glow, particles)
 */

import { useTavernStore } from '@/store';
import type { HUDTemplate, HUDField, HUDPosition, HUDStyle, HUDFieldStyle, AttributeDefinition, CharacterCard } from '@/types';
import { cn } from '@/lib/utils';
import {
  AnimatedProgress,
  AnimatedGauge,
  AnimatedMeter,
  AnimatedDots,
  AnimatedBadge,
} from './hud-effects';

interface HUDDisplayProps {
  position?: HUDPosition;
  className?: string;
}

// Position classes
const positionClasses: Record<HUDPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
};

// Color classes
const colorClasses: Record<string, string> = {
  red: 'text-red-400',
  green: 'text-green-400',
  blue: 'text-blue-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  pink: 'text-pink-400',
  cyan: 'text-cyan-400',
  default: 'text-white/80',
};

const bgColorClasses: Record<string, string> = {
  red: 'bg-red-500/20 border-red-500/30',
  green: 'bg-green-500/20 border-green-500/30',
  blue: 'bg-blue-500/20 border-blue-500/30',
  yellow: 'bg-yellow-500/20 border-yellow-500/30',
  purple: 'bg-purple-500/20 border-purple-500/30',
  orange: 'bg-orange-500/20 border-orange-500/30',
  pink: 'bg-pink-500/20 border-pink-500/30',
  cyan: 'bg-cyan-500/20 border-cyan-500/30',
  default: 'bg-white/10 border-white/20',
};

const progressColorClasses: Record<string, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
  default: 'bg-white/50',
};

export function HUDDisplay({ className }: HUDDisplayProps) {
  const hudTemplates = useTavernStore((state) => state.hudTemplates);
  const hudSessionState = useTavernStore((state) => state.hudSessionState);
  const activeCharacterId = useTavernStore((state) => state.activeCharacterId);
  const activeGroupId = useTavernStore((state) => state.activeGroupId);
  const groups = useTavernStore((state) => state.groups);
  const characters = useTavernStore((state) => state.characters);
  const sessions = useTavernStore((state) => state.sessions);
  const activeSessionId = useTavernStore((state) => state.activeSessionId);

  // Get derived values from subscribed state
  const activeCharacter = characters.find((c) => c.id === activeCharacterId);
  const activeGroup = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;

  // Get active template
  const activeTemplate = hudTemplates.find(
    (t) => t.id === hudSessionState.activeTemplateId
  );

  // Use template's position setting (defaults to top-right if no template)
  const position = activeTemplate?.position || 'top-right';
  
  // Get current session for stats values
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionStats = activeSession?.sessionStats;
  
  // Determine if this is a group chat
  const isGroupChat = !!activeGroup;
  
  // Get all characters with their attributes
  let charactersWithAttributes: Array<{
    character: CharacterCard;
    attributes: AttributeDefinition[];
    values: Record<string, number | string>;
  }> = [];
  
  if (isGroupChat && activeGroup?.members) {
    // Group chat: get all group members with their attributes
    charactersWithAttributes = activeGroup.members
      .map((member) => {
        const char = characters.find((c) => c.id === member.characterId);
        if (!char) return null;

        const attributes = char.statsConfig?.enabled
          ? char.statsConfig.attributes.filter((attr) => attr.showInHUD !== false)
          : [];

        // Get values from sessionStats, or use defaults if not initialized
        // IMPORTANT: Always use defaults as base, then override with stored values
        // This ensures new attributes added after session creation are shown
        const storedValues = sessionStats?.characterStats?.[char.id]?.attributeValues;
        const values: Record<string, number | string> = {};

        // Start with default values for ALL attributes
        for (const attr of attributes) {
          values[attr.key] = attr.defaultValue;
        }

        // Override with stored values if available
        if (storedValues) {
          Object.assign(values, storedValues);
        }

        return { character: char, attributes, values };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => item.attributes.length > 0);
  } else if (activeCharacter) {
    // Single character chat
    const attributes = activeCharacter.statsConfig?.enabled
      ? activeCharacter.statsConfig.attributes.filter((attr) => attr.showInHUD !== false)
      : [];

    // Get values from sessionStats, or use defaults if not initialized
    // IMPORTANT: Always use defaults as base, then override with stored values
    // This ensures new attributes added after session creation are shown
    const storedValues = sessionStats?.characterStats?.[activeCharacter.id]?.attributeValues;
    const values: Record<string, number | string> = {};

    // Start with default values for ALL attributes
    for (const attr of attributes) {
      values[attr.key] = attr.defaultValue;
    }

    // Override with stored values if available
    if (storedValues) {
      Object.assign(values, storedValues);
    }

    if (attributes.length > 0) {
      charactersWithAttributes = [{ character: activeCharacter, attributes, values }];
    }
  }
  
  // No active HUD and no character attributes
  const hasTemplate = activeTemplate && activeTemplate.fields.length > 0;
  const hasAttributes = charactersWithAttributes.length > 0;

  if (!hasTemplate && !hasAttributes) {
    return null;
  }

  // Get style from template
  const hudStyle = activeTemplate?.style || 'card';

  return (
    <div
      className={cn(
        'absolute z-30 pointer-events-none',
        positionClasses[position],
        className
      )}
      style={{ opacity: activeTemplate?.opacity ?? 0.9 }}
    >
      {/* HUD Template Fields */}
      {hasTemplate && (
        <HUDContainer template={activeTemplate} values={hudSessionState.fieldValues} />
      )}

      {/* Character Attributes HUD */}
      {hasAttributes && (
        <MultiCharacterAttributesHUD
          charactersWithAttributes={charactersWithAttributes}
          compact={activeTemplate?.compact}
          isGroupChat={isGroupChat}
          style={hudStyle}
        />
      )}
    </div>
  );
}

// ============================================
// Multi-Character Attributes HUD Component
// ============================================

interface CharacterWithAttributes {
  character: CharacterCard;
  attributes: AttributeDefinition[];
  values: Record<string, number | string>;
}

interface MultiCharacterAttributesHUDProps {
  charactersWithAttributes: CharacterWithAttributes[];
  compact?: boolean;
  isGroupChat: boolean;
  style?: HUDStyle;
}

function MultiCharacterAttributesHUD({ charactersWithAttributes, compact, isGroupChat, style = 'card' }: MultiCharacterAttributesHUDProps) {
  // Get container classes based on style
  const getStyleClasses = () => {
    switch (style) {
      case 'glass':
        return 'backdrop-blur-xl bg-white/5 border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]';
      case 'neon':
        return 'backdrop-blur-md bg-slate-900/80 border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]';
      case 'holographic':
        return 'backdrop-blur-lg bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-cyan-400/30';
      case 'fantasy':
        return 'bg-gradient-to-br from-amber-950/80 via-stone-900/80 to-amber-950/80 border-2 border-amber-600/40';
      case 'retro':
        return 'bg-black/90 border-4 border-green-500/70 font-mono shadow-[0_0_10px_rgba(34,197,94,0.5)]';
      case 'panel':
        return 'backdrop-blur-lg bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 border-2 border-white/20';
      case 'minimal':
        return 'bg-transparent border-transparent';
      default:
        return 'backdrop-blur-md bg-gradient-to-br from-slate-900/80 to-slate-800/60 border border-white/10';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {charactersWithAttributes.map(({ character, attributes, values }) => (
        <div
          key={character.id}
          className={cn(
            'pointer-events-auto rounded-xl border transition-all duration-300',
            getStyleClasses(),
            compact ? 'p-2' : 'p-4',
            'shadow-xl'
          )}
        >
          {/* Character Name Header (only in group chats) */}
          {isGroupChat && (
            <div className={cn(
              'font-medium mb-2 pb-1 border-b border-white/10',
              compact ? 'text-[10px]' : 'text-xs',
              style === 'neon' && 'text-cyan-400 uppercase tracking-wider',
              style === 'fantasy' && 'text-amber-400',
              style === 'retro' && 'text-green-400',
              style === 'holographic' && 'text-cyan-300',
              (!['neon', 'fantasy', 'retro', 'holographic'].includes(style)) && 'text-white/80'
            )}>
              {style === 'fantasy' && <span className="mr-1">⚔</span>}
              {style === 'retro' && <span className="mr-1">&gt;</span>}
              {character.name}
            </div>
          )}

          {/* Attributes - Ensure all are visible */}
          <div className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2.5')}>
            {attributes.map((attr) => (
              <AttributeHUDField
                key={attr.id}
                attribute={attr}
                value={values[attr.key] ?? attr.defaultValue}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Attribute HUD Field Component
// ============================================

interface AttributeHUDFieldProps {
  attribute: AttributeDefinition;
  value: number | string;
  compact?: boolean;
}

function AttributeHUDField({ attribute, value, compact }: AttributeHUDFieldProps) {
  const style = attribute.hudStyle || 'default';
  const color = attribute.color || 'default';
  const icon = attribute.icon;
  const unit = attribute.hudUnit;
  const min = attribute.min ?? 0;
  const max = attribute.max ?? 100;
  
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  // Convert AttributeDefinition style to HUD style format
  const hudStyle: HUDFieldStyle = style as HUDFieldStyle;
  const fieldStyle: HUDStyle = 'card';
  
  // Render based on style
  switch (hudStyle) {
    case 'progress':
      return (
        <ProgressField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: 'number',
            style: 'progress',
            defaultValue: attribute.defaultValue as number,
            min,
            max,
            unit,
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={Number(value)}
          color={color}
          compact={compact}
        />
      );
    
    case 'gauge':
      return (
        <GaugeField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: 'number',
            style: 'gauge',
            defaultValue: attribute.defaultValue as number,
            min,
            max,
            unit,
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={Number(value)}
          color={color}
          compact={compact}
        />
      );
    
    case 'badge':
      return (
        <BadgeField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: attribute.type === 'number' ? 'number' : 'string',
            style: 'badge',
            defaultValue: String(value),
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={String(value)}
          color={color}
          compact={compact}
        />
      );
    
    case 'pill':
      return (
        <PillField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: attribute.type === 'number' ? 'number' : 'string',
            style: 'pill',
            defaultValue: String(value),
            unit,
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={String(value)}
          color={color}
          compact={compact}
        />
      );
    
    case 'status':
      return (
        <StatusField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: attribute.type === 'keyword' ? 'enum' : 'string',
            style: 'status',
            defaultValue: String(value),
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={value}
          color={color}
          compact={compact}
        />
      );
    
    case 'dots':
      return (
        <DotsField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: 'number',
            style: 'dots',
            defaultValue: Number(value),
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={Number(value)}
          color={color}
          compact={compact}
        />
      );
    
    case 'meter':
      return (
        <MeterField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: 'number',
            style: 'meter',
            defaultValue: Number(value),
            min,
            max,
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={Number(value)}
          color={color}
          compact={compact}
        />
      );
    
    default:
      return (
        <DefaultField 
          field={{
            id: attribute.id,
            name: attribute.name,
            key: attribute.key,
            type: attribute.type === 'number' ? 'number' : 'string',
            style: 'default',
            defaultValue: value,
            unit,
            icon,
            color,
            showLabel: true,
            showValue: true,
          }}
          value={value}
          color={color}
          compact={compact}
          style={fieldStyle}
        />
      );
  }
}

// ============================================
// HUD Container
// ============================================

interface HUDContainerProps {
  template: HUDTemplate;
  values: Record<string, string | number | boolean>;
}

function HUDContainer({ template, values }: HUDContainerProps) {
  const style = template.style;
  const compact = template.compact;

  // Style configurations with animations and effects
  const getContainerClasses = () => {
    const baseClasses = 'pointer-events-auto transition-all duration-300';

    switch (style) {
      case 'minimal':
        return cn(
          baseClasses,
          'bg-transparent p-2',
          'text-white/90'
        );

      case 'card':
        return cn(
          baseClasses,
          'backdrop-blur-md rounded-xl border',
          'bg-gradient-to-br from-slate-900/80 to-slate-800/60',
          'border-white/10 shadow-xl shadow-black/20',
          compact ? 'p-2' : 'p-4'
        );

      case 'panel':
        return cn(
          baseClasses,
          'backdrop-blur-lg rounded-2xl border-2',
          'bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90',
          'border-white/20 shadow-2xl shadow-black/30',
          'before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-r before:from-white/5 before:to-transparent before:pointer-events-none',
          compact ? 'p-2.5' : 'p-5'
        );

      case 'glass':
        return cn(
          baseClasses,
          'backdrop-blur-xl rounded-2xl border',
          'bg-white/5 border-white/20',
          'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
          'relative overflow-hidden',
          'before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-white/5 before:pointer-events-none',
          compact ? 'p-2.5' : 'p-5',
          'animate-[shimmer_3s_ease-in-out_infinite]'
        );

      case 'neon':
        return cn(
          baseClasses,
          'backdrop-blur-md rounded-xl',
          'bg-slate-900/80 p-4',
          'border-2 border-cyan-500/50',
          'shadow-[0_0_20px_rgba(6,182,212,0.3),inset_0_0_20px_rgba(6,182,212,0.1)]',
          'animate-[neonPulse_2s_ease-in-out_infinite]',
          compact ? 'p-2' : 'p-4'
        );

      case 'holographic':
        return cn(
          baseClasses,
          'backdrop-blur-lg rounded-xl border',
          'bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10',
          'border-cyan-400/30',
          'shadow-[0_0_30px_rgba(6,182,212,0.2)]',
          'relative overflow-hidden',
          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:animate-[holoScan_2s_linear_infinite] before:pointer-events-none',
          compact ? 'p-2.5' : 'p-5'
        );

      case 'fantasy':
        return cn(
          baseClasses,
          'rounded-xl border-2',
          'bg-gradient-to-br from-amber-950/80 via-stone-900/80 to-amber-950/80',
          'border-amber-600/40',
          'shadow-[inset_0_0_20px_rgba(217,119,6,0.1),0_0_15px_rgba(217,119,6,0.2)]',
          'before:absolute before:inset-0 before:rounded-xl before:border before:border-amber-500/20 before:pointer-events-none',
          compact ? 'p-2.5' : 'p-5'
        );

      case 'retro':
        return cn(
          baseClasses,
          'rounded-none border-4',
          'bg-black/90',
          'border-green-500/70',
          'shadow-[0_0_10px_rgba(34,197,94,0.5),inset_0_0_10px_rgba(34,197,94,0.1)]',
          'font-mono',
          compact ? 'p-2' : 'p-4',
          'animate-[retroFlicker_4s_ease-in-out_infinite]'
        );

      default:
        return cn(
          baseClasses,
          'backdrop-blur-sm rounded-lg border',
          'bg-black/50 border-white/20',
          compact ? 'p-2' : 'p-3'
        );
    }
  };

  const getHeaderClasses = () => {
    switch (style) {
      case 'minimal':
        return 'text-xs font-medium text-white/60 mb-2 pb-1 border-b border-white/10';

      case 'neon':
        return 'text-xs font-bold text-cyan-400 mb-3 pb-2 border-b border-cyan-500/50 uppercase tracking-wider [text-shadow:0_0_10px_rgba(6,182,212,0.8)]';

      case 'holographic':
        return 'text-xs font-medium text-cyan-300 mb-3 pb-2 border-b border-cyan-400/40 uppercase tracking-widest [text-shadow:0_0_8px_rgba(6,182,212,0.6)]';

      case 'fantasy':
        return 'text-sm font-bold text-amber-400 mb-3 pb-2 border-b border-amber-600/40 uppercase tracking-wide [text-shadow:0_0_8px_rgba(217,119,6,0.5)]';

      case 'retro':
        return 'text-xs font-bold text-green-400 mb-3 pb-2 border-b-2 border-green-500 uppercase [text-shadow:2px_2px_0_rgba(0,0,0,0.8)]';

      default:
        return 'text-xs font-medium text-white/60 mb-2 pb-1 border-b border-white/10';
    }
  };

  return (
    <div className={cn(getContainerClasses(), compact && 'gap-1', !compact && 'gap-2')}>
      {/* Animated background particles for certain styles */}
      {style === 'holographic' && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute w-full h-full bg-gradient-to-t from-cyan-500/5 via-transparent to-purple-500/5 animate-[holoShift_3s_ease-in-out_infinite]" />
        </div>
      )}

      {style === 'fantasy' && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyMTcsMTE5LDYsMC4xKSIvPjwvc3ZnPg==')] opacity-50" />
        </div>
      )}

      {/* Header */}
      {style !== 'minimal' && !compact && (
        <div className={cn(getHeaderClasses(), 'relative z-10')}>
          {style === 'fantasy' && <span className="mr-2">⚔</span>}
          {style === 'retro' && <span className="mr-2">&gt;</span>}
          {template.name}
          {style === 'fantasy' && <span className="ml-2">⚔</span>}
          {style === 'retro' && <span className="ml-2">&lt;</span>}
        </div>
      )}

      {/* Fields */}
      <div className={cn('flex flex-col relative z-10', compact ? 'gap-1' : 'gap-2')}>
        {template.fields.map((field) => (
          <HUDFieldDisplay
            key={field.id}
            field={field}
            value={values[field.id] ?? field.defaultValue}
            compact={compact}
            style={style}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Individual Field Display
// ============================================

interface HUDFieldDisplayProps {
  field: HUDField;
  value: string | number | boolean;
  compact?: boolean;
  style: HUDStyle;
}

function HUDFieldDisplay({ field, value, compact, style }: HUDFieldDisplayProps) {
  const fieldStyle = field.style || 'default';
  const color = field.color || 'default';
  
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  // Format value
  const formatValue = (): string => {
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return String(value);
    return String(value);
  };
  
  // Render based on style
  switch (fieldStyle) {
    case 'progress':
      return (
        <ProgressField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'badge':
      return (
        <BadgeField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'icon':
      return (
        <IconField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'chip':
      return (
        <ChipField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'status':
      return (
        <StatusField field={field} value={value} color={color} compact={compact} />
      );
    
    case 'gauge':
      return (
        <GaugeField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'separator':
      return (
        <SeparatorField field={field} compact={compact} />
      );
    
    case 'label-only':
      return (
        <LabelOnlyField field={field} color={color} compact={compact} />
      );
    
    case 'pill':
      return (
        <PillField field={field} value={String(value)} color={color} compact={compact} />
      );
    
    case 'meter':
      return (
        <MeterField field={field} value={Number(value)} color={color} compact={compact} />
      );
    
    case 'dots':
      return (
        <DotsField field={field} value={value} color={color} compact={compact} />
      );
    
    default:
      return (
        <DefaultField field={field} value={value} color={color} compact={compact} style={style} />
      );
  }
}

// ============================================
// Field Style Components
// ============================================

interface FieldProps {
  field: HUDField;
  value: string | number | boolean;
  color: string;
  compact?: boolean;
}

function DefaultField({ field, value, color, compact, style }: FieldProps & { style: HUDStyle }) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  const displayValue = typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value);
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      {field.icon && (
        <span className={cn('text-sm', compact && 'text-xs')} title={field.name}>
          {field.icon}
        </span>
      )}
      {/* Always show label in both modes for clarity */}
      {field.showLabel !== false && (
        <span className={cn(
          'text-xs text-white/50',
          compact ? 'text-[10px] min-w-[50px]' : 'min-w-[60px]'
        )}>
          {field.name}:
        </span>
      )}
      <span
        className={cn(
          'font-medium rounded border',
          compact ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5',
          bgColor,
          textColor
        )}
      >
        {displayValue}
        {field.unit && <span className="text-white/40 ml-0.5">{field.unit}</span>}
      </span>
    </div>
  );
}

function ProgressField({ field, value, color, compact }: FieldProps) {
  return (
    <AnimatedProgress
      value={Number(value)}
      min={field.min ?? 0}
      max={field.max ?? 100}
      color={color}
      label={field.showLabel !== false ? field.name : undefined}
      icon={field.icon}
      unit={field.unit}
      showValue={field.showValue !== false}
      compact={compact}
      height={compact ? 'sm' : 'md'}
      animated={true}
    />
  );
}

function BadgeField({ field, value, color, compact }: FieldProps) {
  return (
    <AnimatedBadge
      value={String(value)}
      color={color}
      label={field.showLabel !== false ? field.name : undefined}
      icon={field.icon}
      compact={compact}
      animated={true}
    />
  );
}

function IconField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border',
        compact ? 'p-1' : 'p-2',
        bgColor
      )}
      title={`${field.name}: ${value}`}
    >
      {field.icon && (
        <span className={cn(compact ? 'text-base' : 'text-lg')}>
          {field.icon}
        </span>
      )}
      {!compact && (
        <span className={cn('text-sm font-medium', textColor)}>
          {value}
        </span>
      )}
    </div>
  );
}

function ChipField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div className="flex items-center gap-1.5">
      {field.icon && <span className={cn('text-xs', compact && 'text-[10px]')}>{field.icon}</span>}
      <span
        className={cn(
          'inline-flex items-center rounded border font-medium',
          compact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
          bgColor,
          textColor
        )}
      >
        {field.showLabel !== false && <span className="mr-1 opacity-60">{field.name}:</span>}
        {value}
      </span>
    </div>
  );
}

function StatusField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const progressColor = progressColorClasses[color] || progressColorClasses.default;
  
  const statusColor = typeof value === 'boolean' 
    ? (value ? 'bg-green-500' : 'bg-red-500')
    : progressColor;
  
  const displayValue = typeof value === 'boolean' ? (value ? 'Activo' : 'Inactivo') : String(value);
  
  return (
    <div className={cn('flex items-center gap-2', compact && 'gap-1')}>
      <div className={cn('w-2 h-2 rounded-full', statusColor, 'animate-pulse')} />
      {field.showLabel !== false && (
        <span className={cn('text-xs text-white/50', compact && 'text-[10px]')}>{field.name}:</span>
      )}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {displayValue}
      </span>
    </div>
  );
}

function GaugeField({ field, value, color, compact }: FieldProps) {
  return (
    <AnimatedGauge
      value={Number(value)}
      min={field.min ?? 0}
      max={field.max ?? 100}
      color={color}
      label={field.showLabel !== false ? field.name : undefined}
      unit={field.unit}
      showValue={true}
      compact={compact}
      size={compact ? 'sm' : 'md'}
      animated={true}
      showParticles={false}
    />
  );
}

function SeparatorField({ field, compact }: Omit<FieldProps, 'value' | 'color'>) {
  return (
    <div className="flex items-center gap-2 w-full">
      {field.icon && <span className="text-sm">{field.icon}</span>}
      {field.name && <span className="text-xs text-white/40">{field.name}</span>}
      <div className="flex-1 h-px bg-white/20" />
    </div>
  );
}

function LabelOnlyField({ field, color, compact }: Omit<FieldProps, 'value'>) {
  const textColor = colorClasses[color] || colorClasses.default;
  
  return (
    <div className="flex items-center gap-2">
      {field.icon && <span className="text-sm">{field.icon}</span>}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {field.name}
      </span>
    </div>
  );
}

function PillField({ field, value, color, compact }: FieldProps) {
  const textColor = colorClasses[color] || colorClasses.default;
  const bgColor = bgColorClasses[color] || bgColorClasses.default;
  
  return (
    <div className={cn('flex items-center gap-2 rounded-full', compact ? 'px-3 py-1' : 'px-4 py-2', bgColor)}>
      {field.icon && <span className="text-sm">{field.icon}</span>}
      {field.showLabel !== false && (
        <span className={cn('text-xs text-white/60', compact && 'text-[10px]')}>{field.name}:</span>
      )}
      <span className={cn('text-sm font-medium', textColor, compact && 'text-xs')}>
        {value}
      </span>
    </div>
  );
}

function MeterField({ field, value, color, compact }: FieldProps) {
  return (
    <AnimatedMeter
      value={Number(value)}
      min={field.min ?? 0}
      max={field.max ?? 100}
      color={color}
      label={field.showLabel !== false ? field.name : undefined}
      showValue={true}
      compact={compact}
      height={compact ? 32 : 48}
      animated={true}
    />
  );
}

function DotsField({ field, value, color, compact }: FieldProps) {
  const numDots = typeof value === 'boolean' 
    ? (value ? 5 : 0) 
    : Math.min(5, Math.max(0, Number(value)));
  
  return (
    <AnimatedDots
      value={numDots}
      max={5}
      color={color}
      label={field.showLabel !== false ? field.name : undefined}
      icon={field.icon}
      compact={compact}
      animated={true}
    />
  );
}

export default HUDDisplay;
