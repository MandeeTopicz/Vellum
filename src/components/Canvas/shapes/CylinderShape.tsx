/**
 * Renders a cylinder shape on the canvas (vertical or horizontal orientation).
 * Uses Ellipse for caps and Line for sides.
 */
import { useRef } from 'react'
import { Group, Rect, Ellipse, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { CylinderObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  areShapePropsEqual,
} from './shared'
import React from 'react'

interface CylinderShapeProps extends BaseShapeProps {
  obj: CylinderObject
}

function CylinderShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  onObjectResizeEnd,
  displayPosition,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  onMultiDragStart,
  onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: CylinderShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const isVert = obj.shapeKind === 'vertical'
  const stroke = selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')
  const sw = selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined
  const rx = isVert ? w / 2 : h / 2
  const ry = isVert ? 0.15 * h : w / 8

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
    const r2 = isVert ? newHeight * 0.15 : newWidth / 8

    const ellipses = node.find('Ellipse')
    if (ellipses.length >= 2) {
      if (isVert) {
        ellipses[0].setAttrs({ x: newWidth / 2, y: r2, radiusX: newWidth / 2, radiusY: r2 })
        ellipses[1].setAttrs({ x: newWidth / 2, y: newHeight - r2, radiusX: newWidth / 2, radiusY: r2 })
      } else {
        ellipses[0].setAttrs({ x: newHeight / 2, y: r2, radiusX: newHeight / 2, radiusY: r2 })
        ellipses[1].setAttrs({ x: newHeight / 2, y: newWidth - r2, radiusX: newHeight / 2, radiusY: r2 })
      }
    }

    const lines = node.find('Line')
    if (lines.length >= 2) {
      if (isVert) {
        ;(lines[0] as Konva.Line).points([0, r2, 0, newHeight - r2])
        ;(lines[1] as Konva.Line).points([newWidth, r2, newWidth, newHeight - r2])
      } else {
        ;(lines[0] as Konva.Line).points([0, r2, 0, newWidth - r2])
        ;(lines[1] as Konva.Line).points([newHeight, r2, newHeight, newWidth - r2])
        const innerGroup = node.children?.[1]
        if (innerGroup) innerGroup.setAttrs({ offsetY: newWidth })
      }
    }

    onObjectResizeEnd(obj.objectId, {
      position: { x: node.x(), y: node.y() },
      dimensions: { width: newWidth, height: newHeight },
    })
  }

  const handlers = shapeHandlers(
    obj.objectId,
    viewportRef,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool,
    isSelecting,
    {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      ...(connectorToolActive && onConnectorHover && { connectorToolActive, onConnectorHover }),
      isPenStrokeActive,
    }
  )

  return (
    <>
      <Group
        ref={groupRef}
        x={dragPreviewPosition?.x ?? pos.x}
        y={dragPreviewPosition?.y ?? pos.y}
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
        {isVert ? (
          <>
            <Ellipse
              x={rx}
              y={ry}
              radiusX={rx}
              radiusY={ry}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              fill={obj.fillColor ?? 'transparent'}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[0, ry, 0, h - ry]}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[w, ry, w, h - ry]}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Ellipse
              x={rx}
              y={h - ry}
              radiusX={rx}
              radiusY={ry}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              fill={obj.fillColor ?? 'transparent'}
              listening={false}
              perfectDrawEnabled={false}
            />
          </>
        ) : (
          <Group rotation={-90} offsetX={0} offsetY={w}>
            <Ellipse
              x={rx}
              y={ry}
              radiusX={rx}
              radiusY={ry}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              fill={obj.fillColor ?? 'transparent'}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[0, ry, 0, w - ry]}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[h, ry, h, w - ry]}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Ellipse
              x={rx}
              y={w - ry}
              radiusX={rx}
              radiusY={ry}
              stroke={stroke}
              strokeWidth={sw}
              dash={dash}
              fill={obj.fillColor ?? 'transparent'}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        )}
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const CylinderShape = React.memo(CylinderShapeInner, areShapePropsEqual)
