/**
 * Renders a parallelogram shape on the canvas (right or left skew).
 */
import { useRef } from 'react'
import { Group, Rect, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ParallelogramObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

interface ParallelogramShapeProps extends BaseShapeProps {
  obj: ParallelogramObject
}

export function ParallelogramShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: ParallelogramShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const skew = w * 0.2
  const pts =
    obj.shapeKind === 'right'
      ? [0, 0, w - skew, 0, w, h, skew, h]
      : [skew, 0, w, 0, w - skew, h, 0, h]
  const stroke = selected ? '#8093F1' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const newWidth = Math.max(MIN_SIZE, w * scaleX)
    const newHeight = Math.max(MIN_SIZE, h * scaleY)
    const sk = newWidth * 0.2
    const newPts =
      obj.shapeKind === 'right'
        ? [0, 0, newWidth - sk, 0, newWidth, newHeight, sk, newHeight]
        : [sk, 0, newWidth, 0, newWidth - sk, newHeight, 0, newHeight]
    ;(node.findOne('Line') as Konva.Line)?.points(newPts)
    onObjectResizeEnd(obj.objectId, {
      position: { x: node.x(), y: node.y() },
      dimensions: { width: newWidth, height: newHeight },
    })
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

  return (
    <>
      <Group
        ref={groupRef}
        x={obj.position?.x ?? 0}
        y={obj.position?.y ?? 0}
        {...handlers}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={w}
          height={h}
          fill="transparent"
          listening={isPointerTool}
          perfectDrawEnabled={false}
        />
        <Line
          points={pts}
          fill={obj.fillColor ?? 'transparent'}
          stroke={stroke}
          strokeWidth={sw}
          closed
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
