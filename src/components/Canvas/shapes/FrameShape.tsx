/**
 * Renders a frame container on the canvas.
 * Frames sit on a bottom layer and group nested objects.
 * Draggable and resizable.
 */
import { useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { FrameObject } from '../../../types'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  type BaseShapeProps,
} from './shared'

export interface FrameShapeProps extends BaseShapeProps {
  obj: FrameObject
}

/** Default frame fill - light translucent */
const FRAME_FILL = 'rgba(240, 240, 245, 0.9)'
const FRAME_STROKE = '#9ca3af'
const FRAME_STROKE_SELECTED = '#6366f1'

export function FrameShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: FrameShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions, title } = obj

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
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill={FRAME_FILL}
          stroke={selected ? FRAME_STROKE_SELECTED : FRAME_STROKE}
          strokeWidth={selected ? 2.5 : 1.5}
          cornerRadius={8}
          perfectDrawEnabled={false}
          listening={true}
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
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
