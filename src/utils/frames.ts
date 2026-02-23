/**
 * Frame utilities: position resolution, containment detection.
 * Supports auto-nesting when objects are dropped inside frames.
 */
import type { BoardObject } from '../types'
import type { Bounds } from './objectBounds'

export interface FrameBbox {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface FrameLike {
  objectId: string
  type: 'frame'
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  displayOrder?: number
}

export type FramesByIdMap = Record<string, FrameLike>

/** Position-based object types that support nesting inside frames (not line/pen). */
export const NESTABLE_TYPES = new Set([
  'sticky', 'rectangle', 'circle', 'triangle', 'diamond', 'star', 'pentagon',
  'hexagon', 'octagon', 'arrow', 'plus', 'parallelogram', 'cylinder',
  'tab-shape', 'trapezoid', 'circle-cross', 'text', 'emoji',
  'image', 'document', 'embed', 'link-card',
])

export function isNestableType(type: string): boolean {
  return NESTABLE_TYPES.has(type)
}

/**
 * Gets local x/y from a position-based object (handles legacy position and new localX/localY).
 */
export function getLocalPos(obj: BoardObject): { x: number; y: number } | null {
  if (obj.type === 'line' || obj.type === 'pen') return null
  const o = obj as { position?: { x: number; y: number }; localX?: number; localY?: number }
  if (typeof o.localX === 'number' && typeof o.localY === 'number') {
    return { x: o.localX, y: o.localY }
  }
  if (o.position) return { x: o.position.x, y: o.position.y }
  return null
}

/**
 * Gets parentId from object (default null for legacy).
 */
export function getParentId(obj: BoardObject): string | null {
  const o = obj as { parentId?: string | null }
  return o.parentId ?? null
}

/**
 * Resolves world position for a position-based object.
 * If parentId is null: localX/localY are world coords.
 * If parentId is set: add parent frame position.
 */
export function resolveWorldPos(
  obj: BoardObject,
  framesById: FramesByIdMap
): { x: number; y: number } | null {
  const pos = getLocalPos(obj)
  if (!pos) return null
  const parentId = getParentId(obj)
  if (!parentId) return pos
  const frame = framesById[parentId]
  if (!frame || frame.type !== 'frame') return pos
  return {
    x: frame.position.x + pos.x,
    y: frame.position.y + pos.y,
  }
}

/**
 * Gets world bounds for an object (using resolved position).
 */
export function getWorldBounds(
  obj: BoardObject,
  framesById: FramesByIdMap
): Bounds | null {
  if (obj.type === 'line') {
    const line = obj as { start: { x: number; y: number }; end: { x: number; y: number } }
    const left = Math.min(line.start.x, line.end.x)
    const right = Math.max(line.start.x, line.end.x)
    const top = Math.min(line.start.y, line.end.y)
    const bottom = Math.max(line.start.y, line.end.y)
    return { left, top, right, bottom }
  }
  if (obj.type === 'pen') {
    const pen = obj as { points?: [number, number][] | number[] }
    const pts = pen.points ?? []
    if (pts.length < 2) return { left: 0, top: 0, right: 0, bottom: 0 }
    const pairs: [number, number][] = Array.isArray(pts[0])
      ? (pts as [number, number][])
      : (() => {
          const flat = pts as number[]
          const out: [number, number][] = []
          for (let i = 0; i < flat.length - 1; i += 2) {
            out.push([flat[i], flat[i + 1]])
          }
          return out
        })()
    if (pairs.length === 0) return { left: 0, top: 0, right: 0, bottom: 0 }
    let minX = pairs[0][0]
    let minY = pairs[0][1]
    let maxX = minX
    let maxY = minY
    for (let i = 1; i < pairs.length; i++) {
      const [x, y] = pairs[i]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return { left: minX, top: minY, right: maxX, bottom: maxY }
  }
  const world = resolveWorldPos(obj, framesById)
  if (!world) return null
  const dims = (obj as { dimensions?: { width: number; height: number } }).dimensions ?? { width: 100, height: 100 }
  return {
    left: world.x,
    top: world.y,
    right: world.x + dims.width,
    bottom: world.y + dims.height,
  }
}

/**
 * Center-point containment: is object center inside frame bbox?
 */
export function isInsideFrame(objWorldBBox: Bounds, frameBBox: FrameBbox): boolean {
  const cx = objWorldBBox.left + (objWorldBBox.right - objWorldBBox.left) / 2
  const cy = objWorldBBox.top + (objWorldBBox.bottom - objWorldBBox.top) / 2
  return (
    cx >= frameBBox.left &&
    cx <= frameBBox.right &&
    cy >= frameBBox.top &&
    cy <= frameBBox.bottom
  )
}

/**
 * Builds frame bbox from frame object.
 */
export function getFrameBbox(frame: FrameLike): FrameBbox {
  const { position, dimensions } = frame
  return {
    left: position.x,
    top: position.y,
    right: position.x + dimensions.width,
    bottom: position.y + dimensions.height,
    width: dimensions.width,
    height: dimensions.height,
  }
}

/**
 * Finds the topmost frame containing the object (by center-point).
 * Uses smallest-area frame first, then highest displayOrder.
 * @param objWorldBBox - Object bounds in world coordinates
 * @param framesById - Map of frame id -> frame
 * @returns Frame id if contained, null otherwise
 */
export function findContainingFrame(
  objWorldBBox: Bounds,
  framesById: FramesByIdMap
): string | null {
  const containingFrames: Array<{ id: string; area: number; displayOrder: number }> = []
  for (const [fid, frame] of Object.entries(framesById)) {
    const fb = getFrameBbox(frame)
    if (isInsideFrame(objWorldBBox, fb)) {
      containingFrames.push({
        id: fid,
        area: fb.width * fb.height,
        displayOrder: frame.displayOrder ?? 0,
      })
    }
  }
  if (containingFrames.length === 0) return null
  containingFrames.sort((a, b) => {
    if (a.area !== b.area) return a.area - b.area
    return b.displayOrder - a.displayOrder
  })
  return containingFrames[0].id
}
