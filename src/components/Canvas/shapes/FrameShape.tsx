/**
 * Renders a frame container on the canvas.
 * Frames sit on a bottom layer and group nested objects.
 * Draggable and resizable.
 */
import { useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import { stageToCanvas } from '../../../utils/coordinates'
import type Konva from 'konva'
import type { FrameObject } from '../../../types'
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

export interface FrameShapeProps extends BaseShapeProps {
  obj: FrameObject
}

/** Default frame fill - light translucent */
const FRAME_FILL = 'rgba(240, 240, 245, 0.9)'
const FRAME_STROKE = '#9ca3af'
const FRAME_STROKE_SELECTED = '#6366f1'

function FrameShapeInner({
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
  onMultiDragStart,
  onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: FrameShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)
  const { objectId, position, dimensions, title } = obj

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, rect: Konva.Rect) => {
    rect.width(b.width)
    rect.height(b.height)
    node.position({ x: b.left, y: b.top })
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: position.x, top: position.y, width: dimensions.width, height: dimensions.height }
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
        onObjectResizeEnd(objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: newBounds.width, height: newBounds.height },
        })
        return
      }
    }
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, rect.width() * node.scaleX())
    const h = Math.max(MIN_SIZE, rect.height() * node.scaleY())
    rect.width(w)
    rect.height(h)
    onObjectResizeEnd(objectId, {
      position: { x: node.x(), y: node.y() },
      dimensions: { width: w, height: h },
    })
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={dragPreviewPosition?.x ?? position.x}
        y={dragPreviewPosition?.y ?? position.y}
        {...shapeHandlers(objectId, viewportRef, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, isSelecting, {
          ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
          ...(onObjectDragStart && { onObjectDragStart }),
          ...(connectorToolActive && onConnectorHover ? { connectorToolActive, onConnectorHover } : {}),
          isPenStrokeActive,
        })}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={FRAME_FILL}
          stroke={selected && isPointerTool ? FRAME_STROKE_SELECTED : FRAME_STROKE}
          strokeWidth={selected && isPointerTool ? 2.5 : 1.5}
          cornerRadius={8}
          perfectDrawEnabled={false}
          listening={!isSelecting && isPointerTool}
        />
        {title && (
          <Text
            x={12}
            y={8}
            text={title}
            fontSize={14}
            fontFamily="Inter, system-ui, sans-serif"
            fill="#374151"
            width={dimensions.width - 24}
            ellipsis
            listening={false}
          />
        )}
      </Group>
      {selected && isPointerTool && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const FrameShape = React.memo(FrameShapeInner, areShapePropsEqual)
