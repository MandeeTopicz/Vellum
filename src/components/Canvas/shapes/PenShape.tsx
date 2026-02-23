/**
 * Renders pen strokes and pen stroke preview.
 * Pen strokes are selectable, draggable, and resizable like other objects.
 */
import { useRef } from 'react'
import { stageToCanvas } from '../../../utils/coordinates'
import { Group, Line, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { PenObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { getObjectBounds } from '../../../utils/objectBounds'
import type { Bounds } from '../../../utils/objectBounds'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  computeNewBoundsFromSnapshot,
  areShapePropsEqual,
  type ResizeSnapshot,
} from './shared'
import React from 'react'

/** In-progress pen stroke preview while drawing */
export interface CurrentPenStroke {
  points: [number, number][]
  color: string
  strokeWidth: number
  isHighlighter: boolean
  opacity: number
  strokeType?: 'solid' | 'dotted' | 'double'
}

/** Scales pen points from originalBounds to newBounds */
export function resizePenStroke(
  points: [number, number][],
  originalBounds: Bounds,
  newBounds: Bounds
): [number, number][] {
  const origW = originalBounds.right - originalBounds.left || 1
  const origH = originalBounds.bottom - originalBounds.top || 1
  const scaleX = (newBounds.right - newBounds.left) / origW
  const scaleY = (newBounds.bottom - newBounds.top) / origH
  return points.map(([x, y]) => [
    newBounds.left + (x - originalBounds.left) * scaleX,
    newBounds.top + (y - originalBounds.top) * scaleY,
  ])
}

/** Renders a pen stroke with optional solid/dotted/double style */
function renderPenStroke(
  flatPoints: number[],
  color: string,
  strokeWidth: number,
  opacity: number,
  strokeType: 'solid' | 'dotted' | 'double' | undefined,
  hitStrokeWidth?: number
) {
  const baseProps = {
    points: flatPoints,
    stroke: color,
    strokeWidth,
    opacity,
    tension: 0,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    listening: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
    ...(hitStrokeWidth != null && { hitStrokeWidth }),
  }
  if (strokeType === 'dotted') {
    const gap = Math.max(strokeWidth * 0.8, 4)
    const dash = Math.max(strokeWidth * 0.4, 2)
    return <Line {...baseProps} dash={[dash, gap]} />
  }
  if (strokeType === 'double') {
    const offset = strokeWidth * 0.4
    const points: [number, number][] = []
    for (let i = 0; i < flatPoints.length; i += 2) {
      points.push([flatPoints[i], flatPoints[i + 1]])
    }
    const offsetPoints = (delta: number): number[] => {
      if (points.length < 2) return flatPoints
      const result: number[] = []
      for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)]
        const next = points[Math.min(points.length - 1, i + 1)]
        const dx = next[0] - prev[0]
        const dy = next[1] - prev[1]
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        result.push(points[i][0] + nx * delta, points[i][1] + ny * delta)
      }
      return result
    }
    const w = strokeWidth * 0.6
    return (
      <Group>
        <Line {...baseProps} points={offsetPoints(-offset)} strokeWidth={w} />
        <Line {...baseProps} points={offsetPoints(offset)} strokeWidth={w} />
      </Group>
    )
  }
  return <Line {...baseProps} />
}

export function PenStrokePreview({ stroke }: { stroke: CurrentPenStroke }) {
  const flatPoints = stroke.points.flat()
  const strokeType = stroke.strokeType ?? 'solid'
  return (
    <Group listening={false}>
      {renderPenStroke(flatPoints, stroke.color, stroke.strokeWidth, stroke.opacity, strokeType)}
    </Group>
  )
}

/**
 * Imperative pen stroke preview Line. Points are updated via ref + batchDraw,
 * not React state, to avoid flicker during drawing.
 */
export interface ActiveStrokeLineProps {
  lineRef: React.RefObject<Konva.Line | null>
  stroke: string
  strokeWidth: number
  opacity: number
  strokeType?: 'solid' | 'dotted' | 'double'
}

export function ActiveStrokeLine({ lineRef, stroke, strokeWidth, opacity, strokeType = 'solid' }: ActiveStrokeLineProps) {
  const strokeWidthNum = strokeWidth ?? 2
  const baseLineProps = {
    ref: lineRef,
    points: [] as number[],
    stroke,
    strokeWidth: strokeWidthNum,
    opacity,
    tension: 0,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    listening: false,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  }
  if (strokeType === 'dotted') {
    const gap = Math.max(strokeWidthNum * 0.8, 4)
    const dash = Math.max(strokeWidthNum * 0.4, 2)
    return <Line {...baseLineProps} dash={[dash, gap]} />
  }
  return <Line {...baseLineProps} />
}

interface PenShapeProps extends BaseShapeProps {
  obj: PenObject
}

function PenShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  onObjectDragEnd,
  onObjectDragStart,
  isPenStrokeActive,
  onObjectClick,
  onObjectResizeEnd,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  onMultiDragStart,
  onMultiDragMove,
}: PenShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizePointsSnapshotRef = useRef<[number, number][] | null>(null)

  const { objectId, points, color, strokeWidth, opacity = 1, strokeType } = obj
  const flatPoints = points.flat()
  if (flatPoints.length < 4) return null

  const bounds = getObjectBounds(obj)
  const minX = bounds.left
  const minY = bounds.top
  const w = Math.max(MIN_SIZE, bounds.right - bounds.left)
  const h = Math.max(MIN_SIZE, bounds.bottom - bounds.top)

  const relativePoints = flatPoints.map((val, i) =>
    i % 2 === 0 ? val - minX : val - minY
  )

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot) => {
    node.position({ x: b.left, y: b.top })
    node.scaleX(b.width / w)
    node.scaleY(b.height / h)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: minX, top: minY, width: w, height: h }
    resizePointsSnapshotRef.current = points
    const stage = groupRef.current?.getStage()
    const ptr = stage?.getPointerPosition()
    if (ptr && stage) {
      const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
      resizeStartPointerRef.current = { x: canvas.x, y: canvas.y }
    } else {
      resizeStartPointerRef.current = null
    }
  }

  const handleTransform = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = groupRef.current
    const tr = trRef.current
    if (!snap || !start || !node || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const totalDx = canvas.x - start.x
    const totalDy = canvas.y - start.y
    const anchor = tr.getActiveAnchor?.() ?? null
    const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, false)
    applyBoundsToNode(node, newBounds)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const pointsSnap = resizePointsSnapshotRef.current
    const node = groupRef.current
    const tr = trRef.current
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    resizePointsSnapshotRef.current = null
    if (!onObjectResizeEnd || !node || !pointsSnap) return
    if (snap && start && tr) {
      const stage = node.getStage()
      const ptr = stage?.getPointerPosition()
      if (ptr && stage) {
        const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
        const totalDx = canvas.x - start.x
        const totalDy = canvas.y - start.y
        const anchor = tr.getActiveAnchor?.() ?? null
        const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, false)
        const origBounds: Bounds = { left: snap.left, top: snap.top, right: snap.left + snap.width, bottom: snap.top + snap.height }
        const b: Bounds = { left: newBounds.left, top: newBounds.top, right: newBounds.left + newBounds.width, bottom: newBounds.top + newBounds.height }
        const newPoints = resizePenStroke(pointsSnap, origBounds, b)
        node.position({ x: newBounds.left, y: newBounds.top })
        node.scaleX(1)
        node.scaleY(1)
        onObjectResizeEnd(objectId, { points: newPoints })
        return
      }
    }
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const newLeft = node.x() + offsetX * scaleX
    const newTop = node.y() + offsetY * scaleY
    node.scaleX(1)
    node.scaleY(1)
    node.x(minX)
    node.y(minY)
    const newBounds: Bounds = {
      left: newLeft,
      top: newTop,
      right: newLeft + w * scaleX,
      bottom: newTop + h * scaleY,
    }
    const newPoints = resizePenStroke(points, bounds, newBounds)
    onObjectResizeEnd(objectId, { points: newPoints })
  }

  const minHit = 24
  const boxW = Math.max(w, minHit)
  const boxH = Math.max(h, minHit)
  const offsetX = (boxW - w) / 2
  const offsetY = (boxH - h) / 2
  const handlers = shapeHandlers(
    objectId,
    viewportRef,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool,
    isSelecting,
    {
      ...(selectedIds &&
      multiDragStartPositionsRef &&
      onMultiDragStart &&
      onMultiDragMove
        ? {
            selectedIds,
            multiDragStartPositionsRef,
            multiDragStartPointerRef,
            onMultiDragStart,
            onMultiDragMove,
          }
        : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      isPenStrokeActive,
    }
  )

  const groupX = dragPreviewPosition?.x ?? minX
  const groupY = dragPreviewPosition?.y ?? minY

  return (
    <>
      <Group
        ref={groupRef}
        x={groupX}
        y={groupY}
        {...handlers}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          x={-offsetX}
          y={-offsetY}
          width={boxW}
          height={boxH}
          fill="transparent"
          stroke="transparent"
          listening={isPointerTool}
          perfectDrawEnabled={false}
        />
        <Group x={0} y={0}>
          {renderPenStroke(
            relativePoints,
            selected && isPointerTool ? '#8093F1' : color,
            selected && isPointerTool ? Math.max(3, strokeWidth ?? 2) : strokeWidth ?? 2,
            opacity,
            strokeType,
            Math.max(strokeWidth ?? 2, 12)
          )}
        </Group>
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={12}
          anchorStrokeWidth={2}
          boundBoxFunc={boundBoxFunc}
        />
      )}
    </>
  )
}

export const PenShape = React.memo(PenShapeInner, areShapePropsEqual)
