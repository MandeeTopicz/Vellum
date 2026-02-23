/**
 * Renders an arrow shape on the canvas (solid arrow outlines, left or right direction).
 * Uses Path for outline arrows.
 */
import { useRef } from 'react'
import { Group, Path, Arrow, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ArrowObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  areShapePropsEqual,
} from './shared'
import React from 'react'

const PATH_DATA_LEFT = 'M8 12 L2 12 L6 8 L6 10 L20 10 L20 14 L6 14 L6 16 Z'
const PATH_DATA_RIGHT = 'M16 12 L22 12 L18 8 L18 10 L4 10 L4 14 L18 14 L18 16 Z'

interface ArrowShapeProps extends BaseShapeProps {
  obj: ArrowObject
}

function ArrowShapeInner({
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
}: ArrowShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const direction = obj.direction ?? 'right'
  const cy = h / 2
  const stroke = selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')
  const sw = selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined
  const isOutline = direction === 'left' || direction === 'right'
  const points = direction === 'left' ? [w, cy, 0, cy] : [0, cy, w, cy]

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
    if (isOutline) {
      const path = node.findOne('Path')
      if (path) path.setAttrs({ scaleX: newWidth / 24, scaleY: newHeight / 24 })
    } else {
      const arrow = node.findOne('Arrow')
      if (arrow) {
        const ncy = newHeight / 2
        arrow.setAttrs({ points: direction === 'left' ? [newWidth, ncy, 0, ncy] : [0, ncy, newWidth, ncy] })
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
        {isOutline ? (
          <Path
            data={direction === 'left' ? PATH_DATA_LEFT : PATH_DATA_RIGHT}
            scaleX={w / 24}
            scaleY={h / 24}
            stroke={stroke}
            fill="transparent"
            strokeWidth={sw}
            dash={dash}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Arrow
            points={points}
            pointerLength={10}
            pointerWidth={10}
            fill={stroke}
            stroke={stroke}
            strokeWidth={sw}
            dash={dash}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const ArrowShape = React.memo(ArrowShapeInner, areShapePropsEqual)
