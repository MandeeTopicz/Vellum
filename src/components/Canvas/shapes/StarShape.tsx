/**
 * Renders a 5-point star shape on the canvas.
 */
import { useRef } from 'react'
import { Group, Star, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { StarObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  areShapePropsEqual,
} from './shared'
import React from 'react'

interface StarShapeProps extends BaseShapeProps {
  obj: StarObject
}

function StarShapeInner({
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
  onMultiDragStart: _onMultiDragStart,
  onMultiDragMove: _onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: StarShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const cx = w / 2
  const cy = h / 2
  const outerRadius = Math.min(w, h) / 2
  const innerRadius = outerRadius * 0.4

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const star = node.findOne('Star')
    if (star) {
      const newWidth = Math.max(MIN_SIZE, w * scaleX)
      const newHeight = Math.max(MIN_SIZE, h * scaleY)
      const or = Math.min(newWidth, newHeight) / 2
      const ir = or * 0.4
      star.setAttrs({ x: newWidth / 2, y: newHeight / 2, outerRadius: or, innerRadius: ir })
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
    viewportRef,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool,
    isSelecting,
    {
      ...(selectedIds && multiDragStartPositionsRef && _onMultiDragStart && _onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart: _onMultiDragStart, onMultiDragMove: _onMultiDragMove } : {}),
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
        <Star
          x={cx}
          y={cy}
          numPoints={5}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const StarShape = React.memo(StarShapeInner, areShapePropsEqual)
