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
  areShapePropsEqual,
} from './shared'
import React from 'react'

interface CircleCrossShapeProps extends BaseShapeProps {
  obj: CircleCrossObject
}

function CircleCrossShapeInner({
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
}: CircleCrossShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const pos = displayPosition ?? obj.position ?? { x: 0, y: 0 }
  const trRef = useRef<Konva.Transformer>(null)

  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) / 2
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
        <Ellipse
          x={cx}
          y={cy}
          radiusX={r}
          radiusY={r}
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
          fill={obj.fillColor ?? 'transparent'}
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
        <Line
          points={[0, cy, w, cy]}
          stroke={stroke}
          strokeWidth={sw}
          dash={dash}
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

export const CircleCrossShape = React.memo(CircleCrossShapeInner, areShapePropsEqual)
