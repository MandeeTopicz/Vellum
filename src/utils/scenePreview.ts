/**
 * Scene preview utilities: bounding box and fit-to-rect transform.
 * Used by BoardCanvasThumbnail and ScenePreviewSVG.
 */
import { getObjectBounds } from './objectBounds'
import type { BoardObject } from '../types'

export interface Bbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Compute bounding box of all objects. Uses getObjectBounds for each.
 * For line/pen: uses points; for others: x,y,width,height.
 * @param objects - Array of board objects
 * @returns Bbox with minX, minY, maxX, maxY, width, height
 */
export function getBbox(objects: BoardObject[]): Bbox | null {
  if (objects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const obj of objects) {
    const b = getObjectBounds(obj)
    minX = Math.min(minX, b.left)
    minY = Math.min(minY, b.top)
    maxX = Math.max(maxX, b.right)
    maxY = Math.max(maxY, b.bottom)
  }
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  return { minX, minY, maxX, maxY, width, height }
}

export interface FitResult {
  scale: number
  tx: number
  ty: number
  sceneW: number
  sceneH: number
}

/**
 * Compute scale and translation to fit bbox into thumbnail rect.
 * scale = min((width - 2*padding)/sceneW, (height - 2*padding)/sceneH, 2)
 * tx = width/2 - (minX + sceneW/2)*scale
 * ty = height/2 - (minY + sceneH/2)*scale
 * @param width - Target width
 * @param height - Target height
 * @param bbox - Bounding box of scene
 * @param padding - Padding around content (default 16)
 */
export function fitToRect(
  width: number,
  height: number,
  bbox: Bbox,
  padding = 16
): FitResult {
  const sceneW = Math.max(1, bbox.width)
  const sceneH = Math.max(1, bbox.height)
  const availW = Math.max(1, width - padding * 2)
  const availH = Math.max(1, height - padding * 2)
  const scaleX = availW / sceneW
  const scaleY = availH / sceneH
  let scale = Math.min(scaleX, scaleY, 2)
  scale = Math.max(0.02, scale)
  const cx = bbox.minX + sceneW / 2
  const cy = bbox.minY + sceneH / 2
  const tx = width / 2 - cx * scale
  const ty = height / 2 - cy * scale
  return { scale, tx, ty, sceneW, sceneH }
}
