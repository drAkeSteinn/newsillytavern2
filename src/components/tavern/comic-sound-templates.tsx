// ============================================
// Comic Sound Effect SVG Templates (v5 - Manga Pack)
// ============================================
//
// v5: Fixed animation restart flickering by using ref-based innerHTML
// instead of dangerouslySetInnerHTML. When multiple effects are in the
// DOM and React re-renders the parent, existing SVGs with CSS animations
// would get their innerHTML reapplied, destroying and restarting the
// animations from 0%. Now we use a ref + useEffect to set innerHTML
// only once on mount, and React.memo to prevent unnecessary re-renders.
//
// Based on the comic_sfx_manga_pack_v4 reference:
// - Boiling line effect (3 alternating outline paths)
// - SVG filters for ink wobble and text rattle
// - Single CSS keyframe animation (pop → stabilize → rise → disappear)
// - textLength/lengthAdjust for dynamic text fitting
// - Side marks, dots, hearts, arrows as decorative elements
// - 4 manga presets: vertical, oval, wail, tall
// - Dynamic text sizing that adjusts to content
//
// Uses KOMIKAHB font for the comic book aesthetic.

'use client';

import React, { useRef, useEffect } from 'react';
import type { ComicTemplateType } from '@/types';
import { COMIC_TEMPLATE_TYPES } from '@/types';

// Re-export for backward compatibility
export type { ComicTemplateType } from '@/types';
export { COMIC_TEMPLATE_TYPES } from '@/types';

// ============================================
// Types
// ============================================

export interface ComicTemplateProps {
  text: string;
  /** Scale factor 0.5 - 2.0 */
  scale?: number;
  /** Template preset */
  preset?: ComicTemplateType;
  /** Animation duration in ms */
  duration?: number;
}

export interface ComicSoundTemplateProps {
  text: string;
  templateType: ComicTemplateType;
  scale: number;
  duration?: number;
  /** Unique instance ID for SVG filter scoping */
  instanceId?: string;
}

// ============================================
// SVG Shape Paths (from reference pack)
// ============================================
// Each preset has 3 slightly-different paths for the "boiling line" effect

const SHAPES = {
  vertical: [
    'M118 13 C105 30 96 58 90 88 C94 116 94 141 83 166 C94 193 104 224 121 252 C139 223 150 193 153 164 C143 139 144 115 158 88 C151 58 138 28 118 13 Z',
    'M116 15 C103 31 97 60 88 90 C96 114 91 143 82 165 C95 195 103 221 120 254 C137 226 151 195 154 164 C145 139 145 115 160 89 C151 56 136 29 116 15 Z',
    'M119 12 C107 28 98 57 91 87 C96 116 93 140 84 168 C93 192 105 225 122 251 C139 222 149 191 152 164 C144 140 145 114 157 86 C150 59 139 27 119 12 Z',
  ],
  oval: [
    'M119 24 C82 32 64 72 66 118 C68 161 88 210 120 227 C154 209 174 161 172 118 C170 72 154 31 119 24 Z',
    'M117 22 C84 33 62 74 66 119 C69 163 87 211 119 229 C156 208 176 160 171 116 C168 72 153 32 117 22 Z',
    'M121 25 C83 31 65 71 67 117 C69 162 91 211 121 226 C153 210 172 163 173 119 C171 73 155 30 121 25 Z',
  ],
  wail: [
    'M131 9 C121 38 111 61 95 78 C104 112 88 142 97 174 C84 205 94 242 123 308 C147 250 165 208 151 176 C167 139 151 112 160 78 C146 58 143 28 131 9 Z',
    'M130 7 C119 38 113 62 93 77 C106 111 87 142 96 176 C83 206 96 244 123 311 C149 251 164 207 153 175 C167 140 149 111 162 78 C144 57 141 29 130 7 Z',
    'M133 10 C123 39 112 60 96 79 C103 113 90 143 98 173 C86 204 93 241 124 307 C146 252 166 209 150 177 C164 139 152 113 158 76 C148 59 143 30 133 10 Z',
  ],
  tall: [
    'M117 17 C91 49 78 91 78 135 C79 179 93 229 122 275 C153 226 165 180 165 136 C164 91 145 45 117 17 Z',
    'M116 18 C90 48 77 93 79 135 C80 181 91 230 121 277 C154 226 166 179 164 134 C163 91 147 46 116 18 Z',
    'M119 16 C92 50 80 90 78 137 C80 178 94 231 124 274 C152 228 164 180 166 136 C163 92 145 43 119 16 Z',
  ],
};

// ============================================
// SVG Inline CSS (from reference - core animation system)
// ============================================
// v4+: Instance-unique filter IDs to prevent collisions

function generateStyle(duration: number, instanceId: string): string {
  const inkId = `inkWobble_${instanceId}`;
  const rattleId = `textRattle_${instanceId}`;
  return `<style><![CDATA[
    :root { --dur: ${duration}ms; --font: KOMIKAHB, "Komika Hand", "Comic Sans MS", cursive; }
    svg { overflow: visible; background: transparent; }
    .sfx-root { transform-box: fill-box; transform-origin: center; animation: sfx-pop var(--dur) cubic-bezier(.16,.96,.2,1) forwards; pointer-events:none; }
    .ink { filter:url(#${inkId}); }
    .boil-a,.boil-b,.boil-c { fill:#fffef8; stroke:#0b0b0b; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
    .boil-a { stroke-width:3.05; animation: boilA .18s steps(1,end) infinite; }
    .boil-b { stroke-width:2.65; animation: boilB .18s steps(1,end) infinite; opacity:0; }
    .boil-c { stroke-width:2.3; animation: boilC .18s steps(1,end) infinite; opacity:0; }
    .inner-scratch { fill:none; stroke:#0b0b0b; stroke-width:1.15; stroke-linecap:round; stroke-linejoin:round; opacity:.72; vector-effect:non-scaling-stroke; }
    .side-mark { fill:none; stroke:#0b0b0b; stroke-width:1.35; stroke-linecap:round; stroke-linejoin:round; opacity:1; vector-effect:non-scaling-stroke; animation: mark-in calc(var(--dur) * .72) ease-out forwards; }
    .mark-1 { animation-delay:70ms; } .mark-2 { animation-delay:115ms; } .mark-3 { animation-delay:155ms; } .mark-4 { animation-delay:190ms; }
    .dot { fill:#0b0b0b; opacity:1; animation: dot-pop calc(var(--dur) * .7) ease-out forwards; }
    .heart { fill:none; stroke:#0b0b0b; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; opacity:1; animation: heart-pop calc(var(--dur) * .78) cubic-bezier(.13,1.06,.32,1) forwards; vector-effect:non-scaling-stroke; }
    .arrow { fill:none; stroke:#0b0b0b; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; opacity:1; animation: arrow-drop calc(var(--dur) * .72) ease-out forwards; animation-delay:120ms; }
    .sfx-text { font-family:var(--font); fill:#0b0b0b; font-weight:700; paint-order:stroke; stroke:#ffffff; stroke-width:3.5; stroke-linejoin:round; filter:url(#${rattleId}); }
    .ghost-text { font-family:var(--font); fill:#0b0b0b; opacity:.14; paint-order:stroke; stroke:#ffffff; stroke-width:4.2; stroke-linejoin:round; filter:none; }
    .text-pop { transform-box: fill-box; transform-origin:center; animation: text-pop var(--dur) cubic-bezier(.14,.88,.18,1) forwards; }
    .stack-char { font-family:var(--font); fill:#0b0b0b; font-weight:700; text-anchor:middle; dominant-baseline:middle; paint-order:stroke; stroke:#ffffff; stroke-width:3.2; stroke-linejoin:round; filter:url(#${rattleId}); }
    @keyframes sfx-pop {
      0% { opacity:0; transform:translateY(8px) scale(.06,.1) rotate(-7deg); }
      10% { opacity:1; transform:translateY(-3px) scale(1.12,.88) rotate(3deg); }
      20% { transform:translateY(1px) scale(.94,1.08) rotate(-2deg); }
      31% { transform:translateY(0) scale(1) rotate(.6deg); }
      68% { opacity:1; transform:translateY(0) scale(1) rotate(.2deg); }
      82% { opacity:1; transform:translateY(-3px) scale(1.04,.98) rotate(-1deg); }
      100% { opacity:0; transform:translateY(-10px) scale(.94,1.08) rotate(2.5deg); }
    }
    @keyframes text-pop {
      0% { opacity:0; transform:scale(.2) rotate(-6deg); }
      13% { opacity:1; transform:scale(1.12) rotate(3deg); }
      26% { transform:scale(.97) rotate(-1.5deg); }
      42%,78% { opacity:1; transform:scale(1) rotate(0deg); }
      100% { opacity:0; transform:scale(1.02) rotate(2deg); }
    }
    @keyframes boilA { 0%,32%{opacity:1} 33%,100%{opacity:0} }
    @keyframes boilB { 0%,32%{opacity:0} 33%,65%{opacity:1} 66%,100%{opacity:0} }
    @keyframes boilC { 0%,65%{opacity:0} 66%,100%{opacity:1} }
    @keyframes mark-in { 0%{opacity:0; stroke-dasharray:0 50; transform:scale(.8)} 18%{opacity:1; stroke-dasharray:18 50; transform:scale(1.02)} 72%{opacity:1} 100%{opacity:0; stroke-dasharray:18 50; transform:translateY(-4px)} }
    @keyframes dot-pop { 0%{opacity:0; transform:scale(.3)} 15%{opacity:1; transform:scale(1.35)} 35%{transform:scale(1)} 85%{opacity:1} 100%{opacity:0; transform:scale(.65) translateY(-4px)} }
    @keyframes heart-pop { 0%{opacity:0; transform:scale(.2) rotate(-8deg)} 20%{opacity:1; transform:scale(1.25) rotate(5deg)} 42%{transform:scale(1) rotate(-2deg)} 85%{opacity:1} 100%{opacity:0; transform:scale(.8) translateY(-7px)} }
    @keyframes arrow-drop { 0%{opacity:0; transform:translateY(-5px) scale(.75)} 23%{opacity:1; transform:translateY(0) scale(1.08)} 80%{opacity:1} 100%{opacity:0; transform:translateY(4px) scale(.92)} }
    @media (prefers-reduced-motion: reduce) { .sfx-root,.boil-a,.boil-b,.boil-c,.side-mark,.dot,.heart,.arrow,.text-pop { animation:none!important; opacity:1!important; } }
  ]]></style>`;
}

// ============================================
// SVG Defs (filters for ink wobble + text rattle)
// ============================================
// v4+: Instance-unique filter IDs to prevent DOM ID collisions

function generateSVGDefs(instanceId: string): string {
  const inkId = `inkWobble_${instanceId}`;
  const rattleId = `textRattle_${instanceId}`;
  return `<defs>
  <filter id="${inkId}" x="-12%" y="-12%" width="124%" height="124%">
    <feTurbulence type="fractalNoise" baseFrequency="0.018 0.072" numOctaves="1" seed="4" result="noise">
      <animate attributeName="seed" values="2;5;9;3;7;2" dur="0.22s" repeatCount="indefinite" />
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
  </filter>
  <filter id="${rattleId}" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="0.026 0.09" numOctaves="1" seed="6" result="noise">
      <animate attributeName="seed" values="1;3;8;4;1" dur="0.18s" repeatCount="indefinite" />
    </feTurbulence>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.45" />
  </filter>
</defs>`;
}

// ============================================
// SVG Body Generators
// ============================================

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]!));

/** Generate boiling-line shape group (3 alternating paths) */
function shapeGroup(key: ComicTemplateType): string {
  const p = SHAPES[key] || SHAPES.vertical;
  // Inner scratch lines for hand-drawn feel
  const scratches: Record<string, string> = {
    vertical: 'M97 67 q9 4 20 0 M96 78 q9 5 22 1',
    oval: 'M73 95 q16 -8 38 -5 M72 151 q19 11 44 7',
    wail: 'M104 52 q12 2 23 -1 M99 66 q13 3 28 -1 M98 88 q10 3 24 0',
    tall: 'M88 91 q13 4 28 0 M88 107 q15 5 32 0',
  };
  return `<g class="ink">
    <path class="boil-a" d="${p[0]}"/>
    <path class="boil-b" d="${p[1]}"/>
    <path class="boil-c" d="${p[2]}"/>
    <path class="inner-scratch" d="${scratches[key] || scratches.vertical}"/>
  </g>`;
}

/** Side marks + decorative elements per preset */
function decorations(key: ComicTemplateType): string {
  if (key === 'oval') {
    return `<path class="side-mark mark-1" d="M67 86 l-12 -4 M66 101 l-14 0 M70 116 l-11 5"/>
      <path class="side-mark mark-2" d="M172 88 l13 -3 M173 104 l15 1 M169 122 l12 5"/>
      <circle class="dot" cx="148" cy="83" r="3.2" style="animation-delay:100ms"/>`;
  }
  if (key === 'wail') {
    return `<path class="side-mark mark-1" d="M96 61 l-15 -2 M93 75 l-18 1 M95 89 l-13 4"/>
      <path class="side-mark mark-2" d="M160 75 l15 -5 M160 91 l17 1 M154 108 l14 6"/>
      <path class="heart" style="animation-delay:170ms" d="M95 232 C84 218 72 232 88 248 C102 235 106 225 95 232 Z"/>
      <path class="heart" style="animation-delay:215ms" d="M143 253 C134 241 122 253 137 268 C150 253 154 244 143 253 Z"/>`;
  }
  if (key === 'tall') {
    return `<path class="side-mark mark-1" d="M79 91 l-13 -3 M78 112 l-16 1 M81 134 l-14 6"/>
      <path class="side-mark mark-3" d="M165 94 l13 -4 M166 116 l15 2 M162 139 l12 6"/>`;
  }
  // vertical
  return `<path class="side-mark mark-1" d="M81 79 l-9 -2 M82 90 l-12 0 M84 102 l-10 3"/>
    <path class="side-mark mark-2" d="M156 79 l9 -3 M156 93 l12 0 M153 106 l9 4"/>`;
}

/** Arrow pointing down below the shape */
function arrow(x: number = 121, y: number = 205, s: number = 0.75): string {
  return `<path class="arrow" d="M${(x - 15 * s).toFixed(1)} ${y} C${(x - 8 * s).toFixed(1)} ${(y + 10 * s).toFixed(1)} ${(x - 4 * s).toFixed(1)} ${(y + 16 * s).toFixed(1)} ${x} ${(y + 24 * s).toFixed(1)} C${(x + 5 * s).toFixed(1)} ${(y + 15 * s).toFixed(1)} ${(x + 9 * s).toFixed(1)} ${(y + 10 * s).toFixed(1)} ${(x + 16 * s).toFixed(1)} ${y}"/>`;
}

/** Horizontal text with textLength for dynamic fitting */
function horizontalText(text: string, opt: { x?: number; y?: number; width?: number; size?: number; rotate?: number }): string {
  const x = opt.x ?? 121;
  const y = opt.y ?? 122;
  const maxW = opt.width ?? Math.max(50, Math.min(120, text.length * 22));
  const size = opt.size ?? Math.max(20, Math.min(38, maxW / Math.max(2.4, text.length * 0.58)));
  const rot = opt.rotate ?? 0;
  return `<g class="text-pop" transform="rotate(${rot} ${x} ${y})">
    <text class="ghost-text" x="${x + 1.4}" y="${y + 1.8}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" textLength="${maxW}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>
    <text class="sfx-text" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" textLength="${maxW}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>
  </g>`;
}

/** Vertical stacked text with per-character rotation for organic feel */
function verticalText(text: string, opt: { x?: number; y?: number; spacing?: number; size?: number; rotateLetters?: number[] }): string {
  const chars = Array.from(String(text));
  const x = opt.x ?? 121;
  const start = opt.y ?? (chars.length <= 3 ? 70 : 80);
  const spacing = opt.spacing ?? Math.max(24, Math.min(38, 130 / Math.max(chars.length, 3)));
  const size = opt.size ?? Math.max(24, Math.min(46, 120 / Math.max(chars.length, 3)));
  const rots = opt.rotateLetters ?? [-6, 3, -3, 5, -4, 2];
  let out = '<g class="text-pop">';
  chars.forEach((ch, i) => {
    const yy = start + i * spacing;
    const dx = [-1.5, 1.1, -0.5, 1.8, -1, 0.9][i % 6]!;
    const r = rots[i % rots.length]!;
    out += `<text class="stack-char" x="${(x + dx).toFixed(1)}" y="${yy.toFixed(1)}" font-size="${size}" transform="rotate(${r} ${(x + dx).toFixed(1)} ${yy.toFixed(1)})">${esc(ch)}</text>`;
  });
  return out + '</g>';
}

// ============================================
// Main SVG Generator (creates the full SVG string)
// ============================================

/**
 * Generate a complete comic SFX SVG string based on the reference pack.
 * This creates a self-contained SVG with inline CSS animations that plays
 * through its entire lifecycle (pop-in → stabilize → rise → disappear) once.
 *
 * v4+: Each SVG instance uses unique filter IDs to prevent DOM ID collisions
 * when multiple effects are rendered simultaneously.
 */
export function createComicSFX(options: {
  text: string;
  preset?: ComicTemplateType;
  duration?: number;
  /** Unique instance ID to scope SVG filter IDs (prevents DOM collisions) */
  instanceId?: string;
}): string {
  const text = options.text || 'sfx';
  const preset = options.preset || 'vertical';
  const duration = options.duration || 880;
  const instanceId = options.instanceId || `sfx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let body = '';

  switch (preset) {
    case 'oval':
      body = horizontalText(text, {
        x: 124, y: 119,
        width: Math.max(60, Math.min(120, text.length * 22)),
        size: Math.max(22, Math.min(36, 108 / Math.max(2.4, text.length * 0.58))),
        rotate: -2,
      }) + arrow(124, 186, 0.72);
      break;

    case 'wail':
      body = verticalText(text, {
        x: 125, y: 88,
        spacing: Math.max(28, Math.min(38, 130 / Math.max(text.length, 3))),
        size: Math.max(30, Math.min(46, 130 / Math.max(text.length, 3))),
        rotateLetters: [-86, -84, -88, -83],
      });
      break;

    case 'tall':
      body = verticalText(text, {
        x: 122, y: 102,
        spacing: Math.max(30, Math.min(42, 150 / Math.max(text.length, 3))),
        size: Math.max(28, Math.min(40, 120 / Math.max(text.length, 3))),
      }) + arrow(122, 228, 0.72);
      break;

    case 'vertical':
    default: {
      // Short words: horizontal text; longer: vertical stacked
      const useVertical = text.length <= 3 && Math.random() > 0.4;
      if (useVertical) {
        body = verticalText(text, {
          x: 121, y: 70,
          spacing: Math.max(22, Math.min(30, 100 / Math.max(text.length, 2))),
          size: Math.max(24, Math.min(32, 90 / Math.max(text.length, 2))),
        }) + arrow(121, 204, 0.74);
      } else {
        body = horizontalText(text, {
          x: 121, y: 123,
          width: Math.max(50, Math.min(90, text.length * 20)),
          size: Math.max(22, Math.min(34, 80 / Math.max(2.4, text.length * 0.58))),
          rotate: -3,
        }) + arrow(121, 204, 0.74);
      }
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" style="--dur:${duration}ms" role="img" aria-label="${esc(text)} comic sound effect">${generateSVGDefs(instanceId)}${generateStyle(duration, instanceId)}<g class="sfx-root">${shapeGroup(preset)}${decorations(preset)}${body}</g></svg>`;
}

// ============================================
// Utility Functions
// ============================================

export function getRandomTemplateType(allowedTypes?: ComicTemplateType[]): ComicTemplateType {
  const pool = allowedTypes && allowedTypes.length > 0 ? allowedTypes : COMIC_TEMPLATE_TYPES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function getRandomScale(min: number = 0.7, max: number = 1.4): number {
  return min + Math.random() * (max - min);
}

/**
 * Auto-select the best preset for a given text
 */
export function autoSelectPreset(text: string): ComicTemplateType {
  const len = text.length;
  // Very short sounds (mhi, egh) → vertical
  if (len <= 3) return 'vertical';
  // Medium words (movah, obgh) → oval
  if (len <= 5) return 'oval';
  // Longer sounds that feel like exclamation → wail
  if (len <= 7 && /[!?$]/.test(text)) return 'wail';
  // Default: tall for medium-long, oval otherwise
  return len <= 5 ? 'oval' : 'tall';
}

// ============================================
// React Component (renders the SVG via ref-based innerHTML)
// ============================================

/**
 * Renders a specific comic template type with the given props.
 *
 * v5 CRITICAL FIX: Uses ref-based innerHTML instead of dangerouslySetInnerHTML.
 *
 * The problem: When a new effect is added to the overlay, React re-renders ALL
 * effect items. With dangerouslySetInnerHTML, React would re-apply innerHTML
 * even when the SVG string hasn't changed, destroying the existing SVG DOM and
 * restarting all CSS animations from 0%. This caused visible flickering on
 * earlier effects when later effects were added.
 *
 * The solution: Set innerHTML only once via a ref + useEffect on mount.
 * Combined with React.memo, this ensures existing animations are never
 * interrupted when new effects are added.
 */
export const ComicSoundTemplate = React.memo(function ComicSoundTemplate({
  text,
  templateType,
  scale,
  duration,
  instanceId,
}: ComicSoundTemplateProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Generate the SVG string once (memoized by all inputs)
  const svgString = React.useMemo(() =>
    createComicSFX({ text, preset: templateType, duration, instanceId }),
    [text, templateType, duration, instanceId]
  );

  // Set innerHTML ONLY on mount — never re-apply to avoid restarting CSS animations
  useEffect(() => {
    if (hostRef.current && !mountedRef.current) {
      hostRef.current.innerHTML = svgString;
      mountedRef.current = true;
    }
  }, [svgString]);

  return (
    <div
      ref={hostRef}
      className="comic-sfx-host"
      style={{
        width: `${150 * (scale || 1)}px`,
        pointerEvents: 'none',
        // Hint browser to composite this element independently
        // so reflows in siblings don't affect this animation
        contain: 'layout style',
      }}
    />
  );
}, function areEqual(prevProps: ComicSoundTemplateProps, nextProps: ComicSoundTemplateProps) {
  // Custom comparison: these props are set once at creation and never change
  // for an existing effect, so this should always return true for existing items
  return (
    prevProps.text === nextProps.text &&
    prevProps.templateType === nextProps.templateType &&
    prevProps.scale === nextProps.scale &&
    prevProps.duration === nextProps.duration &&
    prevProps.instanceId === nextProps.instanceId
  );
});

// ============================================
// Preview Component (for settings UI - static, no animation)
// ============================================

/**
 * Preview of a comic template for the settings UI.
 * Uses dangerouslySetInnerHTML with a key to force remount on replay.
 */
export function ComicTemplatePreview({
  text,
  preset,
  duration = 900,
  onReplay,
}: {
  text: string;
  preset: ComicTemplateType;
  duration?: number;
  onReplay?: () => void;
}) {
  const [key, setKey] = React.useState(0);
  const previewId = React.useMemo(() => `preview_${key}`, [key]);
  const svgString = React.useMemo(() =>
    createComicSFX({ text, preset, duration, instanceId: previewId }),
    [text, preset, duration, previewId]
  );

  const handleReplay = () => {
    setKey(k => k + 1);
    onReplay?.();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        key={key}
        className="comic-sfx-preview"
        style={{
          width: '120px',
          height: '160px',
          display: 'grid',
          placeItems: 'center',
          overflow: 'visible',
        }}
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
      <button
        onClick={handleReplay}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
        type="button"
      >
        Reproducir
      </button>
    </div>
  );
}
