/**
 * Renders a triangle shape on the canvas.
 * Supports point-up (default) and point-down (inverted) variants.
 */
import { useRef } from 'react'
import { Group, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TriangleObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

interface TriangleShapeProps extends BaseShapeProps {
  obj: TriangleObject
}

export function TriangleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  displayPosition,
}: TriangleShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }

  const inverted = obj.inverted ?? false
  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const points = inverted
    ? [0, 0, w / 2, h, w, 0]
    : [0, h, w / 2, 0, w, h]

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const line = node.findOne('Line') as Konva.Line | undefined
    if (line) {
      const newWidth = Math.max(MIN_SIZE, w * scaleX)
      const newHeight = Math.max(MIN_SIZE, h * scaleY)
      const newPoints = inverted
        ? [0, 0, newWidth / 2, newHeight, newWidth, 0]
        : [0, newHeight, newWidth / 2, 0, newWidth, newHeight]
      line.points(newPoints)
      onObjectResizeEnd(obj.objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: newWidth, height: newHeight },
      })
    }
  }

  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  const handlers = shapeHandlers(
    obj.objectId,
    viewport,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool
  )

  return (
    <>
      <Group
        ref={groupRef}
        x={pos.x}
        y={pos.y}
        opacity={opacity}
        {...handlers}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Line
          points={points}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          closed
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
