/**
 * Renders a sticky note shape on the canvas.
 * Supports fill, text content, and resize via Transformer.
 * Double-click enters edit mode via onStickyDoubleClick.
 */
import { useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { StickyObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { stageToCanvas } from '../../../utils/coordinates'
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

export interface StickyShapeProps extends BaseShapeProps {
  obj: StickyObject
  onStickyDoubleClick: (objectId: string) => void
  showEffects?: boolean
}

function StickyShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  showEffects = true,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  onObjectResizeEnd,
  onStickyDoubleClick,
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
}: StickyShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)
  const pos = displayPosition ?? obj.position
  const { dimensions, content, fillColor, textStyle } = obj
  const w = dimensions.width
  const h = dimensions.height
  const rotation = (obj as { rotation?: number }).rotation ?? 0

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, rect: Konva.Rect) => {
    const nw = b.width
    const nh = b.height
    rect.width(nw)
    rect.height(nh)
    const text = node.findOne('Text') as Konva.Text | undefined
    if (text) text.width(nw - 8)
    if (text) text.height(nh - 8)
    node.position({ x: b.left + nw / 2, y: b.top + nh / 2 })
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: w, height: h }
    const stage = groupRef.current?.getStage()
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
    const node = groupRef.current
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
    const node = groupRef.current
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
        onObjectResizeEnd(obj.objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: newBounds.width, height: newBounds.height },
          rotation: ((rot % 360) + 360) % 360,
        })
        return
      }
    }
    node.scaleX(1)
    node.scaleY(1)
    const nw = Math.max(MIN_SIZE, rect.width() * node.scaleX())
    const nh = Math.max(MIN_SIZE, rect.height() * node.scaleY())
    rect.width(nw)
    rect.height(nh)
    const text = node.findOne('Text') as Konva.Text | undefined
    if (text) {
      text.width(nw - 8)
      text.height(nh - 8)
    }
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    const topLeftX = node.x() - nw / 2
    const topLeftY = node.y() - nh / 2
    onObjectResizeEnd(obj.objectId, {
      position: { x: topLeftX, y: topLeftY },
      dimensions: { width: nw, height: nh },
      rotation: ((rot % 360) + 360) % 360,
    })
  }

  const handlers = {
    ...shapeHandlers(obj.objectId, viewportRef, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, isSelecting, {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      ...(connectorToolActive && onConnectorHover && { connectorToolActive, onConnectorHover }),
      isPenStrokeActive,
    }),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
      const topLeftX = canvasPos.x - dimensions.width / 2
      const topLeftY = canvasPos.y - dimensions.height / 2
      onObjectDragEnd(obj.objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + dimensions.width / 2, y: topLeftY + dimensions.height / 2 })
    },
  }
  const opacity = (obj as { opacity?: number }).opacity ?? 1

  return (
    <>
      <Group
        ref={groupRef}
        x={dragPreviewPosition?.x ?? (pos.x + w / 2)}
        y={dragPreviewPosition?.y ?? (pos.y + h / 2)}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        opacity={opacity}
        {...handlers}
        onDblClick={canEdit ? () => onStickyDoubleClick(obj.objectId) : undefined}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={fillColor}
          stroke={selected && isPointerTool ? '#8093F1' : '#d1d5db'}
          strokeWidth={selected && isPointerTool ? 3 : 1}
          cornerRadius={obj.cornerRadius ?? 12}
          shadowColor={showEffects && !isPenStrokeActive ? 'black' : undefined}
          shadowBlur={showEffects && !isPenStrokeActive ? 6 : 0}
          shadowOffset={showEffects && !isPenStrokeActive ? { x: 1, y: 2 } : undefined}
          shadowOpacity={showEffects && !isPenStrokeActive ? 0.12 : 0}
          perfectDrawEnabled={false}
        />
        <Text
          x={4}
          y={4}
          width={dimensions.width - 8}
          height={dimensions.height - 8}
          text={content || ''}
          fontSize={textStyle.fontSize}
          fontFamily={textStyle.fontFamily}
          fill={textStyle.fontColor}
          fontStyle={
            textStyle.bold && textStyle.italic
              ? 'bold italic'
              : textStyle.bold
                ? 'bold'
                : textStyle.italic
                  ? 'italic'
                  : 'normal'
          }
          align={textStyle.textAlign}
          verticalAlign="top"
          padding={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={true} rotateAnchorOffset={16} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const StickyShape = React.memo(StickyShapeInner, areShapePropsEqual)
