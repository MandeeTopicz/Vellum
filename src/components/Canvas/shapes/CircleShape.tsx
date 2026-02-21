import { useRef } from 'react'
import { Group, Ellipse, Transformer } from 'react-konva'
import Konva from 'konva'
import type { CircleObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

interface CircleShapeProps extends BaseShapeProps {
  obj: CircleObject
}

export function CircleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: CircleShapeProps) {
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

    const w = obj.dimensions?.width ?? 100
    const h = obj.dimensions?.height ?? 100
    const newWidth = Math.max(MIN_SIZE, w * scaleX)
    const newHeight = Math.max(MIN_SIZE, h * scaleY)
    const nrx = newWidth / 2
    const nry = newHeight / 2

    const ellipse = node.findOne('Ellipse')
    if (ellipse) {
      ellipse.setAttrs({ x: nrx, y: nry, radiusX: nrx, radiusY: nry })
    }

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

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const rx = w / 2
  const ry = h / 2
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  return (
    <>
      <Group
        ref={groupRef}
        x={obj.position?.x ?? 0}
        y={obj.position?.y ?? 0}
        opacity={opacity}
        {...handlers}
        onTransformEnd={handleTransformEnd}
      >
        <Ellipse
          x={rx}
          y={ry}
          radiusX={rx}
          radiusY={ry}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}