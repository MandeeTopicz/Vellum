/**
 * Renders a rectangle shape on the canvas.
 * Supports fill, stroke, rounded corners, resize via Transformer, and 360° rotation.
 */
import { useRef } from 'react'
import { Group, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { RectangleObject } from '../../../types'
import { stageToCanvas } from '../../../utils/coordinates'
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
  displayPosition,
}: RectangleShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, dimensions } = obj
  const pos = displayPosition ?? obj.position
  const w = dimensions.width
  const h = dimensions.height
  const rotation = (obj as { rotation?: number }).rotation ?? 0
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
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
      node.offsetX(nw / 2)
      node.offsetY(nh / 2)
      node.rotation(rot)
      const cx = node.x()
      const cy = node.y()
      const topLeftX = cx - nw / 2
      const topLeftY = cy - nh / 2
      onObjectResizeEnd(objectId, {
        position: { x: topLeftX, y: topLeftY },
        dimensions: { width: nw, height: nh },
        rotation: ((rot % 360) + 360) % 360,
      })
    }
  }

  const handlers = {
    ...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
      const topLeftX = canvasPos.x - w / 2
      const topLeftY = canvasPos.y - h / 2
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + w / 2, y: topLeftY + h / 2 })
    },
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={pos.x + w / 2}
        y={pos.y + h / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        opacity={opacity}
        {...handlers}
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
        <Transformer ref={trRef} rotateEnabled={true} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
