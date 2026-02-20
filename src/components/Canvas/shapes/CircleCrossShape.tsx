/**
 * Renders a circle with cross (flowchart decision) shape on the canvas.
 */
import { useRef } from 'react'
import { Group, Ellipse, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { CircleCrossObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

interface CircleCrossShapeProps extends BaseShapeProps {
  obj: CircleCrossObject
}

export function CircleCrossShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: CircleCrossShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2
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
    const nr = Math.min(newWidth, newHeight) / 2
    const ncx = newWidth / 2
    const ncy = newHeight / 2
    const ell = node.findOne('Ellipse') as Konva.Ellipse | undefined
    if (ell) ell.setAttrs({ x: ncx, y: ncy, radiusX: nr, radiusY: nr })
    const lines = node.find('Line')
    if (lines.length >= 2) {
      ;(lines[0] as Konva.Line).points([ncx, 0, ncx, newHeight])
      ;(lines[1] as Konva.Line).points([0, ncy, newWidth, ncy])
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
        x={obj.position?.x ?? 0}
        y={obj.position?.y ?? 0}
        {...handlers}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Ellipse
          x={cx}
          y={cy}
          radiusX={r}
          radiusY={r}
          stroke={stroke}
          strokeWidth={sw}
          fill={obj.fillColor ?? 'transparent'}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[cx, 0, cx, h]}
          stroke={stroke}
          strokeWidth={sw}
          listening={false}
          perfectDrawEnabled={false}
        />
        <Line
          points={[0, cy, w, cy]}
          stroke={stroke}
          strokeWidth={sw}
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
