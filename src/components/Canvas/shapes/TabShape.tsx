/**
 * Renders a tab (document tab) shape on the canvas.
 */
import { useRef } from 'react'
import { Group, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TabShapeObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  areShapePropsEqual,
} from './shared'
import React from 'react'

interface TabShapeProps extends BaseShapeProps {
  obj: TabShapeObject
}

function TabShapeInner({
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
}: TabShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const tabH = Math.min(h * 0.2, 20)
  const pts = [0, tabH, w * 0.2, tabH, w * 0.3, 0, w * 0.7, 0, w * 0.8, tabH, w, tabH, w, h, 0, h]
  const stroke = selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')
  const sw = selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)
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
    const th = Math.min(newHeight * 0.2, 20)
    const newPts = [0, th, newWidth * 0.2, th, newWidth * 0.3, 0, newWidth * 0.7, 0, newWidth * 0.8, th, newWidth, th, newWidth, newHeight, 0, newHeight]
    ;(node.findOne('Line') as Konva.Line)?.points(newPts)
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
        <Line
          points={pts}
          fill={obj.fillColor ?? 'transparent'}
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
          closed
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const TabShape = React.memo(TabShapeInner, areShapePropsEqual)
