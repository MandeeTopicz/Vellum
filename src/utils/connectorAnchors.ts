/**
 * Anchor points for smart connectors.
 * Supports any point along object edges (free edge snapping).
 */
import type { BoardObject } from '../types'
import { getObjectBounds, getObjectBoundsWorld, type Bounds } from './objectBounds'
import type { FramesByIdMap } from './frames'

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'

export interface AnchorPoint {
  x: number
  y: number
  side: AnchorSide
  /** Normalized position along edge (0–1) for resize-invariant attachment */
  t: number
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function boundsFromObj(obj: BoardObject, framesById?: FramesByIdMap): Bounds | null {
  try {
    return framesById ? getObjectBoundsWorld(obj, framesById) : getObjectBounds(obj)
  } catch {
    return null
  }
}

/**
 * Get the closest point on any edge of the object to the cursor.
 * Allows connection at any point along edges, not just centers.
 * @param obj - Board object
 * @param cursorPos - Canvas coordinates of cursor/click
 * @param framesById - Optional; for world-coord bounds when object may be in a frame
 * @returns { x, y, edge, t } or null if bounds invalid
 */
export function getNearestEdgePoint(
  obj: BoardObject,
  cursorPos: { x: number; y: number },
  framesById?: FramesByIdMap
): { x: number; y: number; edge: AnchorSide; t: number } | null {
  const b = boundsFromObj(obj, framesById)
  if (!b) return null
  const w = b.right - b.left
  const h = b.bottom - b.top
  if (w <= 0 || h <= 0) return null
  const candidates: { x: number; y: number; edge: AnchorSide; t: number }[] = [
    {
      x: Math.max(b.left, Math.min(b.right, cursorPos.x)),
      y: b.top,
      edge: 'top',
      t: (Math.max(b.left, Math.min(b.right, cursorPos.x)) - b.left) / w,
    },
    {
      x: Math.max(b.left, Math.min(b.right, cursorPos.x)),
      y: b.bottom,
      edge: 'bottom',
      t: (Math.max(b.left, Math.min(b.right, cursorPos.x)) - b.left) / w,
    },
    {
      x: b.left,
      y: Math.max(b.top, Math.min(b.bottom, cursorPos.y)),
      edge: 'left',
      t: (Math.max(b.top, Math.min(b.bottom, cursorPos.y)) - b.top) / h,
    },
    {
      x: b.right,
      y: Math.max(b.top, Math.min(b.bottom, cursorPos.y)),
      edge: 'right',
      t: (Math.max(b.top, Math.min(b.bottom, cursorPos.y)) - b.top) / h,
    },
  ]
  const sorted = candidates.sort((a, b) => distance(a, cursorPos) - distance(b, cursorPos))
  return sorted[0] ?? null
}

/**
 * Resolve absolute position from normalized anchor (edge + t).
 * @param obj - Board object
 * @param edge - Which edge (top, right, bottom, left)
 * @param t - Position along edge 0–1 (clamped)
 * @param framesById - Optional; for world-coord bounds
 */
export function resolveAnchorPoint(
  obj: BoardObject,
  edge: AnchorSide,
  t: number,
  framesById?: FramesByIdMap
): { x: number; y: number } {
  const b = boundsFromObj(obj, framesById)
  if (!b) return { x: 0, y: 0 }
  const w = b.right - b.left
  const h = b.bottom - b.top
  const tt = Math.max(0, Math.min(1, t))
  switch (edge) {
    case 'top':
      return { x: b.left + w * tt, y: b.top }
    case 'bottom':
      return { x: b.left + w * tt, y: b.bottom }
    case 'left':
      return { x: b.left, y: b.top + h * tt }
    case 'right':
      return { x: b.right, y: b.top + h * tt }
    default:
      return { x: b.left + w / 2, y: b.top + h / 2 }
  }
}

/**
 * Get the 4 center anchor points for an object (legacy / fallback).
 * @param obj - Board object
 * @param framesById - Optional; use for world-coord bounds when object may be in a frame
 * @returns Record of side -> { x, y, side, t: 0.5 }
 */
export function getAnchorPoints(
  obj: BoardObject,
  framesById?: FramesByIdMap
): Record<AnchorSide, AnchorPoint> {
  const b = boundsFromObj(obj, framesById)
  if (!b) {
    const empty: AnchorPoint = { x: 0, y: 0, side: 'top', t: 0.5 }
    return { top: { ...empty }, right: { ...empty }, bottom: { ...empty }, left: { ...empty } }
  }
  const cx = b.left + (b.right - b.left) / 2
  const cy = b.top + (b.bottom - b.top) / 2
  return {
    top: { x: cx, y: b.top, side: 'top', t: 0.5 },
    right: { x: b.right, y: cy, side: 'right', t: 0.5 },
    bottom: { x: cx, y: b.bottom, side: 'bottom', t: 0.5 },
    left: { x: b.left, y: cy, side: 'left', t: 0.5 },
  }
}

/**
 * Get the anchor point closest to the cursor (uses edge snapping, any point on edge).
 * @param obj - Board object
 * @param cursorPos - Canvas coordinates of cursor/click
 * @param framesById - Optional; for world-coord bounds
 * @returns [side, anchorPoint with x, y, side, t] or null if bounds invalid
 */
export function getNearestAnchor(
  obj: BoardObject,
  cursorPos: { x: number; y: number },
  framesById?: FramesByIdMap
): [AnchorSide, AnchorPoint] | null {
  const pt = getNearestEdgePoint(obj, cursorPos, framesById)
  if (!pt) return null
  const anchor: AnchorPoint = { x: pt.x, y: pt.y, side: pt.edge, t: pt.t }
  return [pt.edge, anchor]
}
