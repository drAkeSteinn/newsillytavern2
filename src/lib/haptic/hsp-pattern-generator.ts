// ============================================
// HSP Pattern Generator
// ============================================
//
// Converts timeline keyframes into HSP (Handy Server Pattern) points.
//
// HSP Point format:
//   { t: number, x: number }
//   - t: time in milliseconds from pattern start
//   - x: position 0-100 (percentage of stroke range)
//
// The device interpolates LINEARLY between points.
// For smooth curves (ease-in, ease-out, etc.), we must generate
// intermediate points at regular intervals with the curve applied.
//
// For looping: The device handles loop natively. When it reaches the
// last point, it wraps back to t=0 and continues. This means the
// transition from the last keyframe back to the first keyframe
// is automatically interpolated by the device.
//
// ============================================

import type { HspPoint } from '@/hooks/use-haptic-playback';
import type { HapticKeyframeValue } from '@/types';

export interface TimelineKeyframe {
  time: number; // ms from start
  value: HapticKeyframeValue;
  interpolation?: string; // 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold'
}

/** Interval between generated points in ms (higher = fewer points, lower = smoother) */
const POINT_INTERVAL_MS = 50; // 50ms = 20 points/second (smooth enough for linear interpolation)

/**
 * Apply an easing curve to a normalized time value (0-1).
 * Returns the eased position (0-1).
 */
function applyEasing(t: number, interpolation: string): number {
  switch (interpolation) {
    case 'hold':
      return 0;

    case 'ease-in':
      return t * t;

    case 'ease-out':
      return 1 - (1 - t) * (1 - t);

    case 'ease-in-out':
      if (t < 0.5) {
        return 2 * t * t;
      } else {
        return 1 - Math.pow(-2 * t + 2, 2) / 2;
      }

    case 'linear':
    default:
      return t;
  }
}

/**
 * Generate interpolated points between two keyframes.
 * 
 * @returns Array of HspPoint (does NOT include the start point to avoid duplicates)
 */
function generateSegmentPoints(
  startTime: number,
  endTime: number,
  startPos: number,
  endPos: number,
  interpolation: string,
  intervalMs: number = POINT_INTERVAL_MS,
): HspPoint[] {
  const points: HspPoint[] = [];
  const dt = endTime - startTime;

  if (dt <= 0) return points;

  const dp = endPos - startPos;

  // Generate points at regular intervals
  let t = intervalMs;
  while (t < dt) {
    const normalizedT = t / dt;
    const easedT = applyEasing(normalizedT, interpolation);
    const position = startPos + dp * easedT;

    points.push({
      t: Math.round(startTime + t),
      x: Math.round(Math.max(0, Math.min(100, position))),
    });

    t += intervalMs;
  }

  return points;
}

/**
 * Convert timeline keyframes to HSP points for pattern playback.
 *
 * This function:
 * 1. Sorts keyframes by time
 * 2. Generates interpolated points between consecutive keyframes
 * 3. For looping timelines, adds a smooth loop-back transition
 *    from the last keyframe back to the first keyframe
 *
 * @param keyframes - Array of timeline keyframes with time, value, and interpolation
 * @param duration - Total timeline duration in ms
 * @param loop - Whether the timeline loops
 * @param intervalMs - Interval between generated points (default 50ms)
 * @returns Array of HspPoint ready for HSP playback
 */
export function generateHspPattern(
  keyframes: TimelineKeyframe[],
  duration: number,
  loop: boolean = true,
  intervalMs: number = POINT_INTERVAL_MS,
): HspPoint[] {
  if (keyframes.length === 0) return [];

  // Sort keyframes by time
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  const points: HspPoint[] = [];

  // Add the first keyframe
  const firstKf = sorted[0];
  points.push({
    t: Math.round(firstKf.time),
    x: Math.round(Math.max(0, Math.min(100, firstKf.value.position))),
  });

  // Generate points between consecutive keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const next = sorted[i + 1];
    const interpolation = prev.interpolation || 'linear';

    const segmentPoints = generateSegmentPoints(
      prev.time,
      next.time,
      prev.value.position,
      next.value.position,
      interpolation,
      intervalMs,
    );

    points.push(...segmentPoints);

    // Add the end keyframe of this segment
    points.push({
      t: Math.round(next.time),
      x: Math.round(Math.max(0, Math.min(100, next.value.position))),
    });
  }

  // Handle the gap between the last keyframe and the end of the timeline
  const lastKf = sorted[sorted.length - 1];

  if (loop) {
    // For looping: add a smooth loop-back transition
    const lastPos = lastKf.value.position;
    const firstPos = firstKf.value.position;
    const loopDelta = firstPos - lastPos;

    if (lastKf.time < duration) {
      // Add hold points from last keyframe to near the end
      const transitionDuration = Math.min(duration * 0.1, 200); // 10% or max 200ms
      const transitionStart = duration - transitionDuration;

      // Add hold points until the transition zone
      if (lastKf.time < transitionStart) {
        const holdPoints = generateSegmentPoints(
          lastKf.time,
          transitionStart,
          lastPos,
          lastPos, // Hold position
          'hold',
          intervalMs,
        );
        points.push(...holdPoints);
      }

      // Add transition points: smooth ease from lastPos to firstPos
      if (Math.abs(loopDelta) > 2) {
        const transitionPoints = generateSegmentPoints(
          transitionStart,
          duration,
          lastPos,
          firstPos,
          'ease-in-out',
          intervalMs,
        );
        points.push(...transitionPoints);
      }

      // Final point at timeline end, at first keyframe position
      // This ensures the device loops seamlessly
      points.push({
        t: duration,
        x: Math.round(Math.max(0, Math.min(100, firstPos))),
      });
    } else if (Math.abs(loopDelta) > 2) {
      // Last keyframe is at the end of timeline, but positions differ
      // We need to add a small transition to smooth the loop
      // Add a few points just before the end that ease toward the first position
      const transitionDuration = Math.min(duration * 0.1, 200);
      const transitionStart = duration - transitionDuration;

      // Remove points in the transition zone and re-add with easing
      const filteredPoints = points.filter(p => p.t < transitionStart);

      const transitionPoints = generateSegmentPoints(
        transitionStart,
        duration,
        lastPos,
        firstPos,
        'ease-in-out',
        intervalMs,
      );
      filteredPoints.push(...transitionPoints);

      // Final point
      filteredPoints.push({
        t: duration,
        x: Math.round(Math.max(0, Math.min(100, firstPos))),
      });

      // Remove duplicates and return
      return deduplicatePoints(filteredPoints);
    }
  } else {
    // Non-looping: add hold point at end of timeline
    if (lastKf.time < duration) {
      // Hold at last position until end
      points.push({
        t: duration,
        x: Math.round(Math.max(0, Math.min(100, lastKf.value.position))),
      });
    }
  }

  return deduplicatePoints(points);
}

/** Remove duplicate points at the same time */
function deduplicatePoints(points: HspPoint[]): HspPoint[] {
  const uniquePoints: HspPoint[] = [];
  let lastT = -1;
  for (const p of points) {
    if (p.t !== lastT) {
      uniquePoints.push(p);
      lastT = p.t;
    }
  }
  return uniquePoints;
}

/**
 * Validate that HSP points are well-formed for the device.
 */
export function validateHspPoints(points: HspPoint[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.t < 0) errors.push(`Point ${i}: negative time ${p.t}`);
    if (p.x < 0 || p.x > 100) errors.push(`Point ${i}: position ${p.x} out of range 0-100`);
    if (i > 0 && p.t <= points[i - 1].t) {
      errors.push(`Point ${i}: time ${p.t} not strictly greater than previous ${points[i - 1].t}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
