/**
 * Renders polygon shapes on the canvas: diamond, pentagon, hexagon, octagon.
 * Diamond uses Path; others use RegularPolygon with different side counts.
 */
import { useRef } from 'react'
import { Group, Rect, Path, RegularPolygon, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { PolygonObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

const POLYGON_SIDES: Record<PolygonObject['type'], number> = {
  diamond: 4,
  pentagon: 5,
  hexagon: 6,
  octagon: 8,
}

interface PolygonShapeProps extends BaseShapeProps {
  obj: PolygonObject
}

export function PolygonShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: PolygonShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) / 2
  const sides = POLYGON_SIDES[obj.type]
  const isDiamond = obj.type === 'diamond'
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
    if (isDiamond) {
      const path = node.findOne('Path')
      if (path) path.setAttrs({ scaleX: newWidth / 100, scaleY: newHeight / 100 })
    } else {
      const poly = node.findOne('RegularPolygon')
      if (poly) {
        const r = Math.min(newWidth, newHeight) / 2
        poly.setAttrs({ x: newWidth / 2, y: newHeight / 2, radius: r })
      }
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
        opacity={opacity}
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
        {isDiamond ? (
          <Path
            data="M50 0 L100 50 L50 100 L0 50 Z"
            scaleX={w / 100}
            scaleY={h / 100}
            fill={obj.fillColor ?? 'transparent'}
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <RegularPolygon
            x={cx}
            y={cy}
            sides={sides}
            radius={radius}
            rotation={0}
            fill={obj.fillColor ?? 'transparent'}
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
