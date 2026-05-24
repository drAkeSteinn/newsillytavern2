// ============================================
// HSP Pattern Generator
// ============================================
//
// Converts timeline keyframes into HSP (Handy Server Pattern) points.
//
// HSP Point format (per Handy REST API v3 docs):
//   { t: number, x: number }
//   - t: time in milliseconds from pattern start (MUST be strictly increasing)
//   - x: position 0-100 (percentage of stroke range)
//
// The device interpolates LINEARLY between points.
// For smooth curves (ease-in, ease-out, etc.), we must generate
// intermediate points at regular intervals with the curve applied.
//
// IMPORTANT: The first point MUST be at t=0. If no keyframe exists at t=0,
// we add one with the first keyframe's position. The device has undefined
// behavior when there's no data at the start of the pattern.
//
// For looping: The device wraps from the last point back to t=0 instantly.
// There is NO automatic interpolation between the last point and the first
// point on loop — it's a hard wrap. To ensure smooth loops, we add explicit
// transition points near the end of the pattern that ease from the last
// keyframe's position back to the first keyframe's position.
//
// Reference: handy-rest-api-v3/hsp/patterns/
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

/** Maximum position value for HSP (percentage of stroke range) */
const POSITION_MAX = 100;

/** Minimum position value for HSP */
const POSITION_MIN = 0;

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
 * Clamp a position value to the valid HSP range (0-100).
 */
function clampPosition(pos: number): number {
  return Math.round(Math.max(POSITION_MIN, Math.min(POSITION_MAX, pos)));
}

/**
 * Generate interpolated points between two keyframes.
 *
 * @param includeStart - If true, includes a point at startTime (default: false to avoid duplicates)
 * @returns Array of HspPoint
 */
function generateSegmentPoints(
  startTime: number,
  endTime: number,
  startPos: number,
  endPos: number,
  interpolation: string,
  intervalMs: number = POINT_INTERVAL_MS,
  includeStart: boolean = false,
): HspPoint[] {
  const points: HspPoint[] = [];
  const dt = endTime - startTime;

  if (dt <= 0) return points;

  const dp = endPos - startPos;

  // Include start point if requested (needed at segment boundaries)
  if (includeStart) {
    points.push({
      t: Math.round(startTime),
      x: clampPosition(startPos),
    });
  }

  // Generate points at regular intervals
  let t = intervalMs;
  while (t < dt) {
    const normalizedT = t / dt;
    const easedT = applyEasing(normalizedT, interpolation);
    const position = startPos + dp * easedT;

    points.push({
      t: Math.round(startTime + t),
      x: clampPosition(position),
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

  // CRITICAL: The first point MUST be at t=0 for HSP.
  // If the first keyframe is not at t=0, add a point at t=0
  // with the first keyframe's position to avoid undefined device behavior.
  const firstKf = sorted[0];
  if (firstKf.time > 0) {
    points.push({
      t: 0,
      x: clampPosition(firstKf.value.position),
    });
  }

  // Add the first keyframe
  points.push({
    t: Math.round(firstKf.time),
    x: clampPosition(firstKf.value.position),
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
      x: clampPosition(next.value.position),
    });
  }

  // Handle the gap between the last keyframe and the end of the timeline
  const lastKf = sorted[sorted.length - 1];
  const lastPos = lastKf.value.position;
  const firstPos = firstKf.value.position;
  const loopDelta = Math.abs(firstPos - lastPos);

  if (loop) {
    // For looping: HSP does NOT interpolate between the last point and the first
    // point on loop — it wraps instantly. To ensure smooth loops, we add explicit
    // transition points near the end of the pattern that ease from lastPos to firstPos.
    //
    // This ensures that when the device wraps from t=duration back to t=0,
    // the position is the same (firstPos), so there's no jarring jump.

    if (lastKf.time < duration) {
      // Calculate transition duration: 10% of duration or max 200ms
      const transitionDuration = Math.min(duration * 0.1, 200);
      const transitionStart = duration - transitionDuration;

      if (lastKf.time < transitionStart) {
        // Add hold points from last keyframe to the transition zone
        // Include start point at transitionStart to ensure no gap
        const holdPoints = generateSegmentPoints(
          lastKf.time,
          transitionStart,
          lastPos,
          lastPos, // Hold position
          'hold',
          intervalMs,
        );
        points.push(...holdPoints);

        // Explicit boundary point at transitionStart
        points.push({
          t: Math.round(transitionStart),
          x: clampPosition(lastPos),
        });
      }

      // Add transition points: smooth ease-in-out from lastPos to firstPos
      if (loopDelta > 2) {
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
      // This ensures the device loops seamlessly (lastPos == firstPos at wrap)
      points.push({
        t: Math.round(duration),
        x: clampPosition(firstPos),
      });
    } else if (loopDelta > 2) {
      // Last keyframe is at the end of timeline, but positions differ
      // We need to add a small transition to smooth the loop
      const transitionDuration = Math.min(duration * 0.1, 200);
      const transitionStart = Math.round(duration - transitionDuration);

      // Remove points in the transition zone and re-add with easing
      const filteredPoints = points.filter(p => p.t < transitionStart);

      // Explicit boundary point at transitionStart
      // We need to find the position at transitionStart by looking at the keyframe
      const posAtTransitionStart = findPositionAtTime(sorted, transitionStart);
      filteredPoints.push({
        t: transitionStart,
        x: clampPosition(posAtTransitionStart),
      });

      const transitionPoints = generateSegmentPoints(
        transitionStart,
        duration,
        posAtTransitionStart,
        firstPos,
        'ease-in-out',
        intervalMs,
      );
      filteredPoints.push(...transitionPoints);

      // Final point
      filteredPoints.push({
        t: Math.round(duration),
        x: clampPosition(firstPos),
      });

      // Remove duplicates and return
      return deduplicatePoints(filteredPoints);
    } else {
      // Last keyframe is at the end and positions match — no transition needed
      // The device will loop seamlessly since lastPos ≈ firstPos
    }
  } else {
    // Non-looping: add hold point at end of timeline
    if (lastKf.time < duration) {
      // Add hold points from last keyframe to end
      const holdPoints = generateSegmentPoints(
        lastKf.time,
        duration,
        lastPos,
        lastPos,
        'hold',
        intervalMs,
      );
      points.push(...holdPoints);

      // Final point at end of timeline
      points.push({
        t: Math.round(duration),
        x: clampPosition(lastKf.value.position),
      });
    }
  }

  return deduplicatePoints(points);
}

/**
 * Find the position at a given time by interpolating between keyframes.
 * Uses linear interpolation between the two surrounding keyframes.
 */
function findPositionAtTime(keyframes: TimelineKeyframe[], time: number): number {
  if (keyframes.length === 0) return 50; // Default center

  // Before first keyframe
  if (time <= keyframes[0].time) return keyframes[0].value.position;

  // After last keyframe
  if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value.position;

  // Find surrounding keyframes
  for (let i = 0; i < keyframes.length - 1; i++) {
    const prev = keyframes[i];
    const next = keyframes[i + 1];
    if (time >= prev.time && time <= next.time) {
      const dt = next.time - prev.time;
      if (dt <= 0) return prev.value.position;
      const normalizedT = (time - prev.time) / dt;
      const interpolation = prev.interpolation || 'linear';
      const easedT = applyEasing(normalizedT, interpolation);
      return prev.value.position + (next.value.position - prev.value.position) * easedT;
    }
  }

  return keyframes[keyframes.length - 1].value.position;
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
