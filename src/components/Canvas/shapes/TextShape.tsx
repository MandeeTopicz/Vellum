/**
 * Renders a text box on the canvas with formatting support.
 * Supports 360° rotation via Transformer.
 */
import { useRef, useEffect } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TextObject } from '../../../types/objects'
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

export interface TextShapeProps extends BaseShapeProps {
  obj: TextObject
  onTextDoubleClick: (objectId: string) => void
  /** Play scale-in animation (0.95 → 1) when text was just created from handwriting conversion */
  animateInFromConversion?: boolean
}

function TextShapeInner({
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
  onTextDoubleClick,
  displayPosition,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  onMultiDragStart,
  onMultiDragMove,
  animateInFromConversion = false,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: TextShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)
  const pos = displayPosition ?? obj.position

  const { objectId, dimensions, content, textStyle } = obj
  const rotation = (obj as { rotation?: number }).rotation ?? 0
  const fontSize = textStyle?.fontSize ?? 16

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const hasStartedScaleAnimRef = useRef(false)
  useEffect(() => {
    if (!animateInFromConversion || !groupRef.current || hasStartedScaleAnimRef.current) return
    hasStartedScaleAnimRef.current = true
    const node = groupRef.current
    node.scaleX(0.95)
    node.scaleY(0.95)
    node.to({ scaleX: 1, scaleY: 1, duration: 0.15 })
  }, [animateInFromConversion])

  const useCenter = rotation !== 0

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, rect: Konva.Rect) => {
    const nw = b.width
    const nh = b.height
    rect.width(nw)
    rect.height(nh)
    const text = node.findOne('Text') as Konva.Text | undefined
    if (text) {
      text.width(nw - 8)
      text.height(nh - 8)
    }
    if (useCenter) {
      node.position({ x: b.left + nw / 2, y: b.top + nh / 2 })
      node.offsetX(nw / 2)
      node.offsetY(nh / 2)
    } else {
      node.position({ x: b.left, y: b.top })
      node.offsetX(0)
      node.offsetY(0)
    }
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: dimensions.width, height: dimensions.height }
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
        const nw = newBounds.width
        const nh = newBounds.height
        onObjectResizeEnd(objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: nw, height: nh },
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
    const text = node.findOne('Text') as Konva.Text | undefined
    if (text) {
      text.width(nw - 8)
      text.height(nh - 8)
    }
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    node.rotation(rot)
    onObjectResizeEnd(objectId, {
      position: { x: node.x() - nw / 2, y: node.y() - nh / 2 },
      dimensions: { width: nw, height: nh },
      rotation: ((rot % 360) + 360) % 360,
    })
  }

  const { width: w, height: h } = dimensions
  /** When rotated, use center-based positioning so Konva rotates around center (offset pivots) */
  const useCenterForPos = rotation !== 0
  const groupX = useCenterForPos ? pos.x + w / 2 : pos.x
  const groupY = useCenterForPos ? pos.y + h / 2 : pos.y
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
      const topLeftX = useCenterForPos ? canvasPos.x - w / 2 : canvasPos.x
      const topLeftY = useCenterForPos ? canvasPos.y - h / 2 : canvasPos.y
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position(useCenterForPos ? { x: topLeftX + w / 2, y: topLeftY + h / 2 } : { x: topLeftX, y: topLeftY })
    },
  }

  const displayText =
    textStyle?.bulletList && content
      ? content
          .split('\n')
          .map((line) => (line.trim() ? `• ${line.trim()}` : ''))
          .filter(Boolean)
          .join('\n')
      : content || ''

  return (
    <>
      <Group
        ref={groupRef}
        x={dragPreviewPosition?.x ?? groupX}
        y={dragPreviewPosition?.y ?? groupY}
        scaleX={animateInFromConversion && !hasStartedScaleAnimRef.current ? 0.95 : 1}
        scaleY={animateInFromConversion && !hasStartedScaleAnimRef.current ? 0.95 : 1}
        {...(useCenterForPos && { offsetX: w / 2, offsetY: h / 2 })}
        rotation={rotation}
        {...handlers}
        onDblClick={canEdit ? () => onTextDoubleClick(objectId) : undefined}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          stroke={selected && isPointerTool ? '#8093F1' : 'transparent'}
          strokeWidth={selected && isPointerTool ? 3 : 1}
          perfectDrawEnabled={false}
        />
        <Text
          x={4}
          y={4}
          width={dimensions.width - 8}
          height={dimensions.height - 8}
          text={displayText}
          fontSize={fontSize}
          fontFamily={textStyle?.fontFamily ?? 'Arial'}
          fontStyle={
            textStyle?.bold && textStyle?.italic
              ? 'bold italic'
              : textStyle?.bold
                ? 'bold'
                : textStyle?.italic
                  ? 'italic'
                  : 'normal'
          }
          fill={content ? (textStyle?.fontColor ?? '#1a1a1a') : '#9ca3af'}
          align={textStyle?.textAlign ?? 'left'}
          verticalAlign="top"
          padding={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const TextShape = React.memo(TextShapeInner, areShapePropsEqual)
