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
    const pen = obj as { points?: [number, number][] | number[] }
    const pts = pen.points ?? []
    if (pts.length < 2) return { left: 0, top: 0, right: 0, bottom: 0 }
    /** Normalize points: Firestore stores flat [x,y,x,y]; in-memory uses [number,number][] */
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
 * Check if two bounds overlap (AABB intersection).
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/**
 * Compute union of multiple bounds (smallest AABB containing all).
 * @returns Union bounds, or null if array is empty
 */
export function unionBounds(boundsList: Bounds[]): Bounds | null {
  if (boundsList.length === 0) return null
  let left = boundsList[0].left
  let top = boundsList[0].top
  let right = boundsList[0].right
  let bottom = boundsList[0].bottom
  for (let i = 1; i < boundsList.length; i++) {
    const b = boundsList[i]
    left = Math.min(left, b.left)
    top = Math.min(top, b.top)
    right = Math.max(right, b.right)
    bottom = Math.max(bottom, b.bottom)
  }
  return { left, top, right, bottom }
}

/**
 * Get IDs of line objects whose bounds intersect the given bounds.
 * @param objectsMap - Map of objectId -> BoardObject
 * @param bounds - Bounds to test against
 * @param excludeIds - IDs to exclude (e.g. already selected)
 * @returns Array of line object IDs that intersect
 */
export function getLineIdsIntersectingBounds(
  objectsMap: Record<string, BoardObject>,
  bounds: Bounds,
  excludeIds?: Set<string>
): string[] {
  const ids: string[] = []
  for (const [objectId, obj] of Object.entries(objectsMap)) {
    if (obj.type !== 'line') continue
    if (excludeIds?.has(objectId)) continue
    const objBounds = getObjectBounds(obj)
    if (boundsIntersect(objBounds, bounds)) ids.push(objectId)
  }
  return ids
}

/**
 * Compute union bounds of given objects in world coordinates.
 * @param objectsMap - Map of objectId -> BoardObject
 * @param ids - Object IDs to include
 * @param framesById - Map of frames for world-coord resolution
 * @returns Union bounds, or null if no valid objects
 */
export function getUnionBoundsOfObjects(
  objectsMap: Record<string, BoardObject>,
  ids: Iterable<string>,
  framesById: FramesByIdMap
): Bounds | null {
  const boundsList: Bounds[] = []
  for (const objectId of ids) {
    const obj = objectsMap[objectId]
    if (!obj) continue
    const b = getObjectBoundsWorld(obj, framesById)
    boundsList.push(b)
  }
  return unionBounds(boundsList)
}

/**
 * Get bounding box of all objects on the board (world coords).
 * @param objectsMap - Map of objectId -> BoardObject
 * @param framesById - Map of frames for world-coord resolution
 * @returns { minX, minY, maxX, maxY } or null if no objects
 */
export function getBoardContentBounds(
  objectsMap: Record<string, BoardObject>,
  framesById: FramesByIdMap
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const all = Object.values(objectsMap)
  if (all.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const obj of all) {
    const b = getObjectBoundsWorld(obj, framesById)
    minX = Math.min(minX, b.left)
    minY = Math.min(minY, b.top)
    maxX = Math.max(maxX, b.right)
    maxY = Math.max(maxY, b.bottom)
  }
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Ray casting: test if a point is inside a polygon.
 * @param point - Point to test (canvas coords)
 * @param polygon - Polygon vertices in canvas coords (closed loop)
 */
export function isPointInPolygon(
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
): boolean {
  if (polygon.length < 3) return false
  let inside = false
  const { x, y } = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Get object IDs whose center or any corner is inside the lasso polygon.
 * @param objectsMap - Map of objectId -> BoardObject
 * @param polygon - Lasso polygon vertices in canvas coords
 * @param framesById - Optional map of frames for world-coord bounds
 */
export function objectsInLassoPolygon(
  objectsMap: Record<string, BoardObject>,
  polygon: { x: number; y: number }[],
  framesById?: FramesByIdMap
): string[] {
  const ids: string[] = []
  for (const [objectId, obj] of Object.entries(objectsMap)) {
    const bounds = framesById ? getObjectBoundsWorld(obj, framesById) : getObjectBounds(obj)
    const center = {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
    }
    if (isPointInPolygon(center, polygon)) {
      ids.push(objectId)
      continue
    }
    const corners = [
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.top },
      { x: bounds.left, y: bounds.bottom },
      { x: bounds.right, y: bounds.bottom },
    ]
    if (corners.some((c) => isPointInPolygon(c, polygon))) {
      ids.push(objectId)
    }
  }
  return ids
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
