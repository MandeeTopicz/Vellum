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
} from './shared'

export interface StickyShapeProps extends BaseShapeProps {
  obj: StickyObject
  onStickyDoubleClick: (objectId: string) => void
  showEffects?: boolean
}

export function StickyShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  showEffects = true,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  onStickyDoubleClick,
  displayPosition,
}: StickyShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const pos = displayPosition ?? obj.position
  const rotation = (obj as { rotation?: number }).rotation ?? 0

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const rot = node.rotation()
    node.scaleX(1)
    node.scaleY(1)
    const rect = node.findOne('Rect')
    if (rect) {
      const w = Math.max(MIN_SIZE, rect.width() * scaleX)
      const h = Math.max(MIN_SIZE, rect.height() * scaleY)
      rect.width(w)
      rect.height(h)
      const text = node.findOne('Text')
      if (text) {
        text.width(w - 8)
        text.height(h - 8)
      }
      node.offsetX(w / 2)
      node.offsetY(h / 2)
      const topLeftX = node.x() - w / 2
      const topLeftY = node.y() - h / 2
      onObjectResizeEnd(obj.objectId, {
        position: { x: topLeftX, y: topLeftY },
        dimensions: { width: w, height: h },
        rotation: ((rot % 360) + 360) % 360,
      })
    }
  }

  const { dimensions, content, fillColor, textStyle } = obj
  const handlers = {
    ...shapeHandlers(obj.objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
      const topLeftX = canvasPos.x - dimensions.width / 2
      const topLeftY = canvasPos.y - dimensions.height / 2
      onObjectDragEnd(obj.objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + dimensions.width / 2, y: topLeftY + dimensions.height / 2 })
    },
  }
  const opacity = (obj as { opacity?: number }).opacity ?? 1

  const w = dimensions.width
  const h = dimensions.height
  return (
    <>
      <Group
        ref={groupRef}
        x={pos.x + w / 2}
        y={pos.y + h / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        opacity={opacity}
        {...handlers}
        onDblClick={canEdit ? () => onStickyDoubleClick(obj.objectId) : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={fillColor}
          stroke={selected ? '#8093F1' : '#d1d5db'}
          strokeWidth={selected ? 3 : 1}
          cornerRadius={obj.cornerRadius ?? 12}
          shadowColor={showEffects ? 'black' : undefined}
          shadowBlur={showEffects ? 6 : 0}
          shadowOffset={showEffects ? { x: 1, y: 2 } : undefined}
          shadowOpacity={showEffects ? 0.12 : 0}
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
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={true} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
