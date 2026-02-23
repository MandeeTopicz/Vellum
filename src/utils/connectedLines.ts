/**
 * Anchor-based line connection utilities.
 * Used to determine which lines are connected to objects and should move with them.
 */
import type { BoardObject } from '../types'
import type { LineObject } from '../types/objects'
import { getObjectBoundsWorld, type Bounds } from './objectBounds'
import type { FramesByIdMap } from './frames'

/** Tolerance for point-in-bounds (handles lines touching object edges) */
const ANCHOR_TOLERANCE = 2

/**
 * Check if a point is inside or on the bounds (with tolerance).
 * @param point - Point in canvas coordinates
 * @param bounds - Bounding box
 * @param tolerance - Pixels to expand bounds for edge snapping
 */
export function isPointInOrOnBounds(
  point: { x: number; y: number },
  bounds: Bounds,
  tolerance = ANCHOR_TOLERANCE
): boolean {
  return (
    point.x >= bounds.left - tolerance &&
    point.x <= bounds.right + tolerance &&
    point.y >= bounds.top - tolerance &&
    point.y <= bounds.bottom + tolerance
  )
}

/**
 * Find object IDs (from candidateIds) whose bounds contain the given point.
 * @param objectsMap - All objects
 * @param point - Point in canvas coordinates
 * @param candidateIds - Object IDs to check
 * @param framesById - For world-coord bounds
 * @returns Object IDs that contain the point (excluding lines/pens)
 */
export function findObjectIdsContainingPoint(
  objectsMap: Record<string, BoardObject>,
  point: { x: number; y: number },
  candidateIds: Set<string>,
  framesById: FramesByIdMap
): string[] {
  const result: string[] = []
  for (const oid of candidateIds) {
    const obj = objectsMap[oid]
    if (!obj || obj.type === 'line' || obj.type === 'pen') continue
    const bounds = getObjectBoundsWorld(obj, framesById)
    if (isPointInOrOnBounds(point, bounds)) result.push(oid)
  }
  return result
}

export type LineAnchorStatus = {
  startConnected: boolean
  endConnected: boolean
}

/**
 * Get which endpoints of a line are connected to objects in movingIds.
 * Uses startObjectId/endObjectId if present, else point-in-bounds inference.
 * @param line - Line object
 * @param lineId - Line object ID
 * @param objectsMap - All objects
 * @param movingIds - Object IDs that are moving
 * @param framesById - For world-coord bounds
 */
export function getLineAnchorStatus(
  line: LineObject,
  _lineId: string,
  objectsMap: Record<string, BoardObject>,
  movingIds: Set<string>,
  framesById: FramesByIdMap
): LineAnchorStatus {
  let startConnected = false
  let endConnected = false

  if (typeof line.startObjectId === 'string' && line.startObjectId) {
    startConnected = movingIds.has(line.startObjectId)
  } else {
    const atStart = findObjectIdsContainingPoint(objectsMap, line.start, movingIds, framesById)
    startConnected = atStart.length > 0
  }
  if (typeof line.endObjectId === 'string' && line.endObjectId) {
    endConnected = movingIds.has(line.endObjectId)
  } else {
    const atEnd = findObjectIdsContainingPoint(objectsMap, line.end, movingIds, framesById)
    endConnected = atEnd.length > 0
  }

  return { startConnected, endConnected }
}

/**
 * Get line IDs whose start or end is anchored to any object in movingIds.
 * @param objectsMap - All objects
 * @param movingIds - Object IDs that are moving (selection)
 * @param framesById - Map of frames for world-coord bounds
 * @returns Set of line object IDs that are connected to the moving objects
 */
export function getConnectedLineIds(
  objectsMap: Record<string, BoardObject>,
  movingIds: Set<string>,
  framesById: FramesByIdMap
): Set<string> {
  const result = new Set<string>()
  for (const [lineId, obj] of Object.entries(objectsMap)) {
    if (obj.type !== 'line') continue
    const line = obj as LineObject
    const status = getLineAnchorStatus(line, lineId, objectsMap, movingIds, framesById)
    if (status.startConnected || status.endConnected) {
      result.add(lineId)
    }
  }
  return result
}
