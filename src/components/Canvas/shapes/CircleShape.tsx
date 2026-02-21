import { useRef } from 'react'
import { Group, Ellipse, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { CircleObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { stageToCanvas } from '../../../utils/coordinates'
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
  displayPosition,
}: CircleShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const pos = displayPosition ?? obj.position
  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
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
    node.rotation(0)

    const newWidth = Math.max(MIN_SIZE, w * scaleX)
    const newHeight = Math.max(MIN_SIZE, h * scaleY)
    const nrx = newWidth / 2
    const nry = newHeight / 2

    const ellipse = node.findOne('Ellipse')
    if (ellipse) {
      ellipse.setAttrs({ x: nrx, y: nry, radiusX: nrx, radiusY: nry })
    }
    node.offsetX(nrx)
    node.offsetY(nry)
    node.rotation(rot)
    const cx = node.x()
    const cy = node.y()
    const topLeftX = cx - nrx
    const topLeftY = cy - nry

    onObjectResizeEnd(obj.objectId, {
      position: { x: topLeftX, y: topLeftY },
      dimensions: { width: newWidth, height: newHeight },
      rotation: ((rot % 360) + 360) % 360,
    })
  }

  const handlers = {
    ...shapeHandlers(obj.objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
      const topLeftX = canvasPos.x - w / 2
      const topLeftY = canvasPos.y - h / 2
      onObjectDragEnd(obj.objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + w / 2, y: topLeftY + h / 2 })
    },
  }

  const rx = w / 2
  const ry = h / 2
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

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
        <Transformer ref={trRef} rotateEnabled={true} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}