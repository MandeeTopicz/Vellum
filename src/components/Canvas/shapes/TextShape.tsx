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
} from './shared'

export interface TextShapeProps extends BaseShapeProps {
  obj: TextObject
  onTextDoubleClick: (objectId: string) => void
  /** Play scale-in animation (0.95 → 1) when text was just created from handwriting conversion */
  animateInFromConversion?: boolean
}

export function TextShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  onObjectResizeEnd,
  onTextDoubleClick,
  displayPosition,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  multiDragPositions,
  onMultiDragStart,
  onMultiDragMove,
  animateInFromConversion = false,
}: TextShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
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

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const rot = node.rotation()
    node.scaleX(1)
    node.scaleY(1)
    node.rotation(0)
    const rect = node.findOne('Rect')
    if (rect) {
      const nw = Math.max(MIN_SIZE, rect.width() * scaleX)
      const nh = Math.max(MIN_SIZE, rect.height() * scaleY)
      rect.width(nw)
      rect.height(nh)
      const text = node.findOne('Text')
      if (text) {
        text.width(nw - 8)
        text.height(nh - 8)
      }
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
  }

  const { width: w, height: h } = dimensions
  /** When rotated, use center-based positioning so Konva rotates around center (offset pivots) */
  const useCenter = rotation !== 0
  const groupX = useCenter ? pos.x + w / 2 : pos.x
  const groupY = useCenter ? pos.y + h / 2 : pos.y
  const handlers = {
    ...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
    }),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
      const topLeftX = useCenter ? canvasPos.x - w / 2 : canvasPos.x
      const topLeftY = useCenter ? canvasPos.y - h / 2 : canvasPos.y
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position(useCenter ? { x: topLeftX + w / 2, y: topLeftY + h / 2 } : { x: topLeftX, y: topLeftY })
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
        x={multiDragPositions?.[objectId]?.x ?? groupX}
        y={multiDragPositions?.[objectId]?.y ?? groupY}
        scaleX={animateInFromConversion && !hasStartedScaleAnimRef.current ? 0.95 : 1}
        scaleY={animateInFromConversion && !hasStartedScaleAnimRef.current ? 0.95 : 1}
        {...(useCenter && { offsetX: w / 2, offsetY: h / 2 })}
        rotation={rotation}
        {...handlers}
        onDblClick={canEdit ? () => onTextDoubleClick(objectId) : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          stroke={selected ? '#8093F1' : 'transparent'}
          strokeWidth={selected ? 3 : 1}
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
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
