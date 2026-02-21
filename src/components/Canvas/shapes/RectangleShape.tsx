/**
 * Renders a rectangle shape on the canvas.
 * Supports fill, stroke, rounded corners, and resize via Transformer.
 */
import { useRef } from 'react'
import { Group, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { RectangleObject } from '../../../types'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  type BaseShapeProps,
} from './shared'

export interface RectangleShapeProps extends BaseShapeProps {
  obj: RectangleObject
}

export function RectangleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: RectangleShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions } = obj
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
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
      onObjectResizeEnd(objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        opacity={opacity}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          cornerRadius={obj.cornerRadius ?? 12}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
