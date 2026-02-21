/**
 * Renders a plus/cross shape on the canvas (two perpendicular lines).
 */
import { useRef } from 'react'
import { Group, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { PlusObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

interface PlusShapeProps extends BaseShapeProps {
  obj: PlusObject
}

export function PlusShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  displayPosition,
}: PlusShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const cx = w / 2
  const cy = h / 2
  const stroke = selected ? '#8093F1' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

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
    const ncx = newWidth / 2
    const ncy = newHeight / 2
    const lines = node.find('Line')
    if (lines.length >= 2) {
      ;(lines[0] as Konva.Line).points([0, ncy, newWidth, ncy])
      ;(lines[1] as Konva.Line).points([ncx, 0, ncx, newHeight])
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
          points={[0, cy, w, cy]}
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[cx, 0, cx, h]}
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
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
