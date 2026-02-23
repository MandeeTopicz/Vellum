/**
 * Renders line/connector shapes: plain line, arrow-straight, arrow-curved, arrow-elbow, arrow-double.
 */
import { useRef } from 'react'
import { Group, Rect, Line, Arrow, Transformer } from 'react-konva'
import { stageToCanvas } from '../../../utils/coordinates'
import type Konva from 'konva'
import type { LineObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  MIN_LINE_HIT,
  computeNewBoundsFromSnapshot,
  areShapePropsEqual,
  type ResizeSnapshot,
} from './shared'
import React from 'react'

interface LineShapeProps extends BaseShapeProps {
  obj: LineObject
  /** Override start/end during multi-drag (e.g. one-anchor line stretching) */
  multiDragLineEndpoints?: Record<string, { start?: { x: number; y: number }; end?: { x: number; y: number } }> | null
}

function LineShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  onObjectResizeEnd,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  multiDragLineEndpoints,
  onMultiDragStart: _onMultiDragStart,
  onMultiDragMove: _onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: LineShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)

  const ep = multiDragLineEndpoints?.[obj.objectId]
  const start = ep?.start ?? obj.start
  const end = ep?.end ?? obj.end

  const { objectId, strokeColor, strokeWidth, connectionType } = obj
  const ct = connectionType ?? 'line'
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lineW = Math.abs(dx) || MIN_SIZE
  const lineH = Math.abs(dy) || MIN_SIZE
  const width = Math.max(lineW, MIN_LINE_HIT)
  const height = Math.max(lineH, MIN_LINE_HIT)
  const lx1 = start.x - minX
  const ly1 = start.y - minY
  const lx2 = end.x - minX
  const ly2 = end.y - minY
  const points = [lx1, ly1, lx2, ly2]
  const isArrow = ct !== 'line'
  const isElbowBidirectional = ct === 'arrow-elbow-bidirectional'
  const elbowX = Math.abs(dx) > Math.abs(dy) ? lx2 : lx1
  const elbowY = Math.abs(dx) > Math.abs(dy) ? ly1 : ly2
  const elbowPoints = [lx1, ly1, elbowX, elbowY, lx2, ly2]
  const curvePoints =
    ct === 'arrow-curved' || ct === 'arrow-curved-cw'
      ? (() => {
          const midX = (lx1 + lx2) / 2
          const midY = (ly1 + ly2) / 2
          const perpX = -(ly2 - ly1) * 0.2
          const perpY = (lx2 - lx1) * 0.2
          /** Clockwise (cw) = bows down/right = positive offset; counter-clockwise = bows up/left = negative */
          const sign = ct === 'arrow-curved-cw' ? 1 : -1
          return [lx1, ly1, midX + sign * perpX, midY + sign * perpY, lx2, ly2]
        })()
      : null

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const applyLineFromBounds = (node: Konva.Group, b: ResizeSnapshot) => {
    const signX = end.x >= start.x ? 1 : -1
    const signY = end.y >= start.y ? 1 : -1
    let newDx = b.width * signX
    let newDy = b.height * signY
    if (Math.abs(newDx) < MIN_SIZE && Math.abs(newDy) < MIN_SIZE) {
      newDx = lineW >= lineH ? signX * MIN_SIZE : 0
      newDy = lineW >= lineH ? 0 : signY * MIN_SIZE
    }
    node.position({ x: b.left, y: b.top })
    node.scaleX(1)
    node.scaleY(1)
    const rect = node.findOne('Rect')
    if (rect) {
      rect.width(Math.max(Math.abs(newDx) || MIN_SIZE, MIN_LINE_HIT))
      rect.height(Math.max(Math.abs(newDy) || MIN_SIZE, MIN_LINE_HIT))
    }
    const line = node.findOne('Line') as Konva.Line | undefined
    const arrow = node.findOne('Arrow') as Konva.Arrow | undefined
    const shapeNode = line ?? arrow
    if (shapeNode) {
      let newPts: number[]
      if (ct === 'arrow-curved' || ct === 'arrow-curved-cw') {
        const midX = newDx / 2
        const midY = newDy / 2
        const perpX = -newDy * 0.2
        const perpY = newDx * 0.2
        const sign = ct === 'arrow-curved-cw' ? 1 : -1
        newPts = [0, 0, midX + sign * perpX, midY + sign * perpY, newDx, newDy]
      } else if (isElbowBidirectional) {
        const ex = Math.abs(newDx) > Math.abs(newDy) ? newDx : 0
        const ey = Math.abs(newDx) > Math.abs(newDy) ? 0 : newDy
        newPts = [0, 0, ex, ey, newDx, newDy]
      } else {
        newPts = [0, 0, newDx, newDy]
      }
      shapeNode.points(newPts)
    }
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: minX, top: minY, width, height }
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
    const startPtr = resizeStartPointerRef.current
    const node = groupRef.current
    const tr = trRef.current
    if (!snap || !startPtr || !node || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const totalDx = canvas.x - startPtr.x
    const totalDy = canvas.y - startPtr.y
    const anchor = tr.getActiveAnchor?.() ?? null
    const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, false)
    applyLineFromBounds(node, newBounds)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const startPtr = resizeStartPointerRef.current
    const node = groupRef.current
    const tr = trRef.current
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    if (!onObjectResizeEnd || !node) return
    if (snap && startPtr && tr) {
      const stage = node.getStage()
      const ptr = stage?.getPointerPosition()
      if (ptr && stage) {
        const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
        const totalDx = canvas.x - startPtr.x
        const totalDy = canvas.y - startPtr.y
        const anchor = tr.getActiveAnchor?.() ?? null
        const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, false)
        applyLineFromBounds(node, newBounds)
        const signX = end.x >= start.x ? 1 : -1
        const signY = end.y >= start.y ? 1 : -1
        let newDx = newBounds.width * signX
        let newDy = newBounds.height * signY
        if (Math.abs(newDx) < MIN_SIZE && Math.abs(newDy) < MIN_SIZE) {
          newDx = lineW >= lineH ? signX * MIN_SIZE : 0
          newDy = lineW >= lineH ? 0 : signY * MIN_SIZE
        }
        const newStart = { x: newBounds.left, y: newBounds.top }
        const newEnd = { x: newBounds.left + newDx, y: newBounds.top + newDy }
        onObjectResizeEnd(objectId, { start: newStart, end: newEnd })
        return
      }
    }
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const newStart = { x: node.x(), y: node.y() }
    let newDx = width * scaleX * (end.x >= start.x ? 1 : -1)
    let newDy = height * scaleY * (end.y >= start.y ? 1 : -1)
    if (Math.abs(newDx) < MIN_SIZE && Math.abs(newDy) < MIN_SIZE) {
      newDx = lineW >= lineH ? (end.x >= start.x ? 1 : -1) * MIN_SIZE : 0
      newDy = lineW >= lineH ? 0 : (end.y >= start.y ? 1 : -1) * MIN_SIZE
    }
    const newEnd = { x: newStart.x + newDx, y: newStart.y + newDy }
    const rect = node.findOne('Rect')
    if (rect) {
      rect.width(Math.max(Math.abs(newDx) || MIN_SIZE, MIN_LINE_HIT))
      rect.height(Math.max(Math.abs(newDy) || MIN_SIZE, MIN_LINE_HIT))
    }
    const line = node.findOne('Line') as Konva.Line | undefined
    const arrow = node.findOne('Arrow') as Konva.Arrow | undefined
    const shapeNode = line ?? arrow
    if (shapeNode) {
      let newPts: number[]
      if (ct === 'arrow-curved' || ct === 'arrow-curved-cw') {
        const midX = newDx / 2
        const midY = newDy / 2
        const perpX = -newDy * 0.2
        const perpY = newDx * 0.2
        const sign = ct === 'arrow-curved-cw' ? 1 : -1
        newPts = [0, 0, midX + sign * perpX, midY + sign * perpY, newDx, newDy]
      } else if (isElbowBidirectional) {
        const ex = Math.abs(newDx) > Math.abs(newDy) ? newDx : 0
        const ey = Math.abs(newDx) > Math.abs(newDy) ? 0 : newDy
        newPts = [0, 0, ex, ey, newDx, newDy]
      } else {
        newPts = [0, 0, newDx, newDy]
      }
      shapeNode.points(newPts)
      onObjectResizeEnd(objectId, { start: newStart, end: newEnd })
    }
  }

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
      ...(selectedIds && multiDragStartPositionsRef && _onMultiDragStart && _onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart: _onMultiDragStart, onMultiDragMove: _onMultiDragMove } : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      ...(connectorToolActive && onConnectorHover && { connectorToolActive, onConnectorHover }),
      isPenStrokeActive,
    }
  )

  return (
    <>
      <Group
        ref={groupRef}
        x={dragPreviewPosition?.x ?? minX}
        y={dragPreviewPosition?.y ?? minY}
        opacity={opacity}
        {...handlers}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={width}
          height={height}
          fill="transparent"
          stroke="transparent"
          listening={isPointerTool}
          perfectDrawEnabled={false}
        />
        {isArrow ? (
          <Arrow
            points={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? curvePoints! : isElbowBidirectional ? elbowPoints : points}
            tension={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? 0.5 : 0}
            pointerLength={10}
            pointerWidth={10}
            pointerAtBeginning={ct === 'arrow-double' || isElbowBidirectional}
            pointerAtEnd
            fill={selected && isPointerTool ? '#8093F1' : strokeColor ?? '#000'}
            stroke={selected && isPointerTool ? '#8093F1' : strokeColor ?? '#000'}
            strokeWidth={selected && isPointerTool ? 3 : strokeWidth ?? 2}
            dash={dash}
            perfectDrawEnabled={false}
            listening={false}
          />
        ) : (
          <Line
            points={points}
            stroke={selected && isPointerTool ? '#8093F1' : strokeColor ?? '#000'}
            strokeWidth={selected && isPointerTool ? 3 : strokeWidth ?? 2}
            dash={dash}
            perfectDrawEnabled={false}
            listening={false}
          />
        )}
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

export const LineShape = React.memo(LineShapeInner, areShapePropsEqual)
