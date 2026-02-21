/**
 * Object bounds utilities for canvas objects.
 * Used for viewport culling, selection box intersection, etc.
 */
import type { BoardObject } from '../types'
import { getWorldBounds, type FramesByIdMap } from './frames'

/**
 * Bounding box for an object in canvas coordinates.
 */
export interface Bounds {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Get bounding box for any board object (position+dimensions, line start/end, or pen points).
 * @param obj - Board object
 * @returns Bounding box in canvas coordinates
 */
export function getObjectBounds(obj: BoardObject): Bounds {
  if (obj.type === 'line') {
    const line = obj as { start: { x: number; y: number }; end: { x: number; y: number } }
    const left = Math.min(line.start.x, line.end.x)
    const right = Math.max(line.start.x, line.end.x)
    const top = Math.min(line.start.y, line.end.y)
    const bottom = Math.max(line.start.y, line.end.y)
    return { left, top, right, bottom }
  }
  if (obj.type === 'pen') {
    const pen = obj as { points: [number, number][] }
    if (pen.points.length === 0) return { left: 0, top: 0, right: 0, bottom: 0 }
    let minX = pen.points[0][0]
    let minY = pen.points[0][1]
    let maxX = minX
    let maxY = minY
    for (let i = 1; i < pen.points.length; i++) {
      const [x, y] = pen.points[i]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    return { left: minX, top: minY, right: maxX, bottom: maxY }
  }
  const pos = (obj as { position: { x: number; y: number } }).position
  const dims = (obj as { dimensions?: { width: number; height: number } }).dimensions ?? { width: 100, height: 100 }
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + dims.width,
    bottom: pos.y + dims.height,
  }
}

/**
 * Get bounding box in world coordinates (accounts for frame nesting).
 * @param obj - Board object
 * @param framesById - Map of frame id -> frame for resolving parent positions
 * @returns Bounding box in world canvas coordinates
 */
export function getObjectBoundsWorld(obj: BoardObject, framesById: FramesByIdMap): Bounds {
  const wb = getWorldBounds(obj, framesById)
  if (wb) return wb
  return getObjectBounds(obj)
}

/**
 * Selection rectangle in canvas coordinates (left <= right, top <= bottom).
 */
export interface SelectionRect {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Check if object bounds intersect the selection rectangle.
 * Uses AABB overlap: rects intersect if they overlap in both x and y.
 */
function boundsIntersectRect(bounds: Bounds, rect: SelectionRect): boolean {
  return bounds.left < rect.right && bounds.right > rect.left && bounds.top < rect.bottom && bounds.bottom > rect.top
}

/**
 * Get object IDs that intersect the selection rectangle.
 * @param objectsMap - Map of objectId -> BoardObject
 * @param rect - Selection rectangle in canvas coordinates
 * @param framesById - Optional map of frames for world-coord bounds
 * @returns Array of object IDs that intersect the rect
 */
export function objectsInSelectionRect(
  objectsMap: Record<string, BoardObject>,
  rect: SelectionRect,
  framesById?: FramesByIdMap
): string[] {
  const ids: string[] = []
  for (const [objectId, obj] of Object.entries(objectsMap)) {
    const bounds = framesById ? getObjectBoundsWorld(obj, framesById) : getObjectBounds(obj)
    if (boundsIntersectRect(bounds, rect)) {
      ids.push(objectId)
    }
  }
  return ids
}
