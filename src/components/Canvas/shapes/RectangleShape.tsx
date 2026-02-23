/**
 * Renders a rectangle shape on the canvas.
 * Supports fill, stroke, rounded corners, resize via Transformer, and 360° rotation.
 * Resize uses snapshot + total-delta to avoid accumulation bug (object shooting on release).
 */
import { useRef } from 'react'
import { Group, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { RectangleObject } from '../../../types'
import { stageToCanvas } from '../../../utils/coordinates'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  computeNewBoundsFromSnapshot,
  areShapePropsEqual,
  type BaseShapeProps,
  type ResizeSnapshot,
} from './shared'
import React from 'react'

export interface RectangleShapeProps extends BaseShapeProps {
  obj: RectangleObject
}

function RectangleShapeInner({
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
  displayPosition,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  onMultiDragStart,
  onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: RectangleShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)

  const { objectId, dimensions } = obj
  const pos = displayPosition ?? obj.position
  const w = dimensions.width
  const h = dimensions.height
  const rotation = (obj as { rotation?: number }).rotation ?? 0
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, rect: Konva.Rect) => {
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    rect.width(b.width)
    rect.height(b.height)
    node.position({ x: cx, y: cy })
    node.offsetX(b.width / 2)
    node.offsetY(b.height / 2)
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: w, height: h }
    const stage = shapeRef.current?.getStage()
    const ptr = stage?.getPointerPosition()
    if (ptr && stage) {
      const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
      resizeStartPointerRef.current = { x: canvas.x, y: canvas.y }
    } else {
      resizeStartPointerRef.current = null
    }
  }

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    resizeShiftKeyRef.current = (e.evt as MouseEvent)?.shiftKey ?? false
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const tr = trRef.current
    const rect = node?.findOne('Rect') as Konva.Rect | undefined
    if (!snap || !start || !node || !rect || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const totalDx = canvas.x - start.x
    const totalDy = canvas.y - start.y
    const anchor = tr.getActiveAnchor?.() ?? null
    const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, resizeShiftKeyRef.current)
    applyBoundsToNode(node, newBounds, rect)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const tr = trRef.current
    const rect = node?.findOne('Rect') as Konva.Rect | undefined
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    if (!node || !onObjectResizeEnd || !rect) return
    const rot = node.rotation()
    if (snap && start && tr) {
      const stage = node.getStage()
      const ptr = stage?.getPointerPosition()
      if (ptr && stage) {
        const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
        const totalDx = canvas.x - start.x
        const totalDy = canvas.y - start.y
        const anchor = tr.getActiveAnchor?.() ?? null
        const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, resizeShiftKeyRef.current)
        applyBoundsToNode(node, newBounds, rect)
        node.rotation(rot)
        onObjectResizeEnd(objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: newBounds.width, height: newBounds.height },
          rotation: ((rot % 360) + 360) % 360,
        })
        return
      }
    }
    node.scaleX(1)
    node.scaleY(1)
    node.rotation(0)
    const nw = Math.max(MIN_SIZE, rect.width() * node.scaleX())
    const nh = Math.max(MIN_SIZE, rect.height() * node.scaleY())
    rect.width(nw)
    rect.height(nh)
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    node.rotation(rot)
    const cx = node.x()
    const cy = node.y()
    onObjectResizeEnd(objectId, {
      position: { x: cx - nw / 2, y: cy - nh / 2 },
      dimensions: { width: nw, height: nh },
      rotation: ((rot % 360) + 360) % 360,
    })
  }

  const handlers = {
    ...shapeHandlers(objectId, viewportRef, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, isSelecting, {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      ...(connectorToolActive && onConnectorHover && { connectorToolActive, onConnectorHover }),
      isPenStrokeActive,
    }),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
      const topLeftX = canvasPos.x - w / 2
      const topLeftY = canvasPos.y - h / 2
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + w / 2, y: topLeftY + h / 2 })
    },
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={dragPreviewPosition?.x ?? (pos.x + w / 2)}
        y={dragPreviewPosition?.y ?? (pos.y + h / 2)}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        opacity={opacity}
        {...handlers}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          cornerRadius={obj.cornerRadius ?? 12}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={true} rotateAnchorOffset={16} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const RectangleShape = React.memo(RectangleShapeInner, areShapePropsEqual)
