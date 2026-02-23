/**
 * AI tool: convertPenStrokesToText.
 * Converts handwritten pen strokes to typed text via handwriting recognition API.
 * Clusters nearby strokes, recognizes each cluster, creates text boxes, deletes original strokes.
 */
import { createObject, batchDeleteObjects } from '../objects'
import {
  penStrokesToImageBlob,
  recognizeHandwriting,
  getIdToken,
} from '../handwritingRecognition'
import { getObjectBounds, unionBounds } from '../../utils/objectBounds'
import { measureTextDimensions } from '../../utils/textMeasurement'
import { DEFAULT_TEXT_STYLE } from '../../types/objects'
import type { PenObject } from '../../types/objects'
import type { BoardObject } from '../../types'
import type { ToolExecutionContext } from './types'

const CLUSTER_THRESHOLD = 150

type Bounds = { left: number; top: number; right: number; bottom: number }

/**
 * Minimum distance between two bounding boxes (0 if overlapping).
 */
function distanceBetweenBounds(a: Bounds, b: Bounds): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right))
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom))
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Get bounds for a pen stroke.
 */
function getStrokeBounds(stroke: BoardObject): Bounds {
  return getObjectBounds(stroke)
}

/**
 * Cluster pen strokes by proximity. Strokes within threshold of any stroke
 * in a cluster are added to that cluster (transitive proximity).
 */
function clusterStrokes(
  strokes: PenObject[],
  threshold: number = CLUSTER_THRESHOLD
): PenObject[][] {
  const clusters: PenObject[][] = []
  const assigned = new Set<string>()

  for (const stroke of strokes) {
    if (assigned.has(stroke.objectId)) continue
    const cluster: PenObject[] = [stroke]
    assigned.add(stroke.objectId)

    let changed = true
    while (changed) {
      changed = false
      for (const other of strokes) {
        if (assigned.has(other.objectId)) continue
        for (const inCluster of cluster) {
          const d = distanceBetweenBounds(
            getStrokeBounds(inCluster),
            getStrokeBounds(other)
          )
          if (d < threshold) {
            cluster.push(other)
            assigned.add(other.objectId)
            changed = true
            break
          }
        }
      }
    }
    clusters.push(cluster)
  }
  return clusters
}

/**
 * Convert clustered pen strokes to text boxes via handwriting recognition.
 * @param ctx - Tool execution context
 */
export async function executeConvertPenStrokesToText(
  ctx: ToolExecutionContext
): Promise<void> {
  const { boardId, args, objectsMap, objectsList, createdItems, actions } = ctx
  ctx.skipWrap = true

  const strokeIds = Array.isArray(args.strokeIds) ? (args.strokeIds as string[]) : []
  const allStrokes = (
    strokeIds.length > 0
      ? strokeIds
          .map((id) => objectsMap.get(id))
          .filter((o): o is PenObject => o != null && o.type === 'pen')
      : objectsList.filter((o): o is PenObject => o.type === 'pen')
  ) as PenObject[]

  if (allStrokes.length === 0) {
    actions.push('No pen strokes found to convert')
    return
  }

  const token = await getIdToken()
  if (!token) {
    console.warn('[convertPenStrokes] No auth token — handwriting API will return 401')
    actions.push('You must be signed in to use handwriting recognition')
    throw new Error('Authentication required for handwriting recognition')
  }

  const clusters = clusterStrokes(allStrokes)
  let successCount = 0
  let failCount = 0

  for (let index = 0; index < clusters.length; index++) {
    const cluster = clusters[index]
    try {
      const blob = await penStrokesToImageBlob(cluster)
      const result = await recognizeHandwriting(blob, token)
      const recognizedText = typeof result.text === 'string' ? result.text.trim() : ''
      console.log('[convertPenStrokes] Cluster', index, 'recognized text:', recognizedText || '(empty)')

      if (!recognizedText) {
        failCount++
        continue
      }

      const boundsList = cluster.map((obj) => getObjectBounds(obj))
      const union = unionBounds(boundsList)
      if (!union) {
        failCount++
        continue
      }

      const penW = union.right - union.left
      const penH = union.bottom - union.top

      const strokeColorCounts = cluster.reduce((acc, s) => {
        const c =
          (s as { color?: string }).color ??
          (s as { stroke?: string }).stroke ??
          (s as { strokeColor?: string }).strokeColor ??
          (s as { fill?: string }).fill ??
          '#000000'
        acc[c] = (acc[c] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
      const fontColor =
        Object.entries(strokeColorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        '#000000'

      const isLikelySingleLine = penH / penW < 0.25
      const estimatedLines = isLikelySingleLine
        ? 1
        : Math.max(1, Math.round(penH / (penW * 0.15)))
      const rawFontSize = Math.round(penH / estimatedLines)
      const fontSize = Math.min(300, Math.max(12, rawFontSize))

      const textStyle = { ...DEFAULT_TEXT_STYLE, fontColor, fontSize }
      const scaledMaxWidth = Math.max(800, fontSize * 20)
      const { width: textW, height: textH } = measureTextDimensions(
        recognizedText,
        fontSize,
        textStyle.fontFamily,
        scaledMaxWidth
      )
      const textX = union.left + penW / 2 - textW / 2
      const textY = union.top + penH / 2 - textH / 2

      const createInput = {
        type: 'text' as const,
        position: { x: textX, y: textY },
        dimensions: { width: textW, height: textH },
        content: recognizedText,
        textStyle,
      }
      const newId = await createObject(boardId, createInput)
      createdItems.push({ objectId: newId, createInput })

      const penIds = cluster.map((p) => p.objectId)
      await batchDeleteObjects(boardId, penIds)

      successCount++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      actions.push(`[convertPenStrokesToText] Cluster failed: ${msg}`)
      failCount++
    }
  }

  if (successCount > 0) {
    actions.push(
      `Converted ${successCount} cluster(s) of pen strokes to text` +
        (failCount > 0 ? ` (${failCount} cluster(s) failed)` : '')
    )
  }
  if (failCount > 0 && successCount === 0) {
    throw new Error(
      `Handwriting recognition failed for all clusters. ${failCount} cluster(s) could not be converted.`
    )
  }
}
