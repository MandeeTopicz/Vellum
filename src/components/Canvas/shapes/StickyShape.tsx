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
}: StickyShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
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
      onObjectResizeEnd(obj.objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  const handlers = shapeHandlers(
    obj.objectId,
    viewport,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool
  )

  const { position, dimensions, content, fillColor, textStyle } = obj

  return (
    <>
      <Group
        ref={groupRef}
        x={position.x}
        y={position.y}
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
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
