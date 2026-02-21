/**
 * Renders line/connector shapes: plain line, arrow-straight, arrow-curved, arrow-elbow, arrow-double.
 */
import { useRef } from 'react'
import { Group, Rect, Line, Arrow, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { LineObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  MIN_LINE_HIT,
} from './shared'

interface LineShapeProps extends BaseShapeProps {
  obj: LineObject
}

export function LineShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: LineShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const { objectId, start, end, strokeColor, strokeWidth, connectionType } = obj
  const ct = connectionType ?? 'line'
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lineW = Math.abs(dx) || MIN_SIZE
  const lineH = Math.abs(dy) || MIN_SIZE
  const width = Math.max(lineW, MIN_LINE_HIT)
  const height = Math.max(lineH, MIN_LINE_HIT)
  const lx1 = start.x - minX
  const ly1 = start.y - minY
  const lx2 = end.x - minX
  const ly2 = end.y - minY
  const points = [lx1, ly1, lx2, ly2]
  const isArrow = ct !== 'line'
  const isElbowBidirectional = ct === 'arrow-elbow-bidirectional'
  const elbowX = Math.abs(dx) > Math.abs(dy) ? lx2 : lx1
  const elbowY = Math.abs(dx) > Math.abs(dy) ? ly1 : ly2
  const elbowPoints = [lx1, ly1, elbowX, elbowY, lx2, ly2]
  const curvePoints =
    ct === 'arrow-curved' || ct === 'arrow-curved-cw'
      ? (() => {
          const midX = (lx1 + lx2) / 2
          const midY = (ly1 + ly2) / 2
          const perpX = -(ly2 - ly1) * 0.2
          const perpY = (lx2 - lx1) * 0.2
          const sign = ct === 'arrow-curved-cw' ? -1 : 1
          return [lx1, ly1, midX + sign * perpX, midY + sign * perpY, lx2, ly2]
        })()
      : null

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const newStart = { x: node.x(), y: node.y() }
    const signX = end.x >= start.x ? 1 : -1
    const signY = end.y >= start.y ? 1 : -1
    let newDx = width * scaleX * signX
    let newDy = height * scaleY * signY
    if (Math.abs(newDx) < MIN_SIZE && Math.abs(newDy) < MIN_SIZE) {
      newDx = lineW >= lineH ? signX * MIN_SIZE : 0
      newDy = lineW >= lineH ? 0 : signY * MIN_SIZE
    }
    const newEnd = { x: newStart.x + newDx, y: newStart.y + newDy }
    const newLineW = Math.abs(newDx) || MIN_SIZE
    const newLineH = Math.abs(newDy) || MIN_SIZE
    const rect = node.findOne('Rect')
    if (rect) {
      rect.width(Math.max(newLineW, MIN_LINE_HIT))
      rect.height(Math.max(newLineH, MIN_LINE_HIT))
    }
    const line = node.findOne('Line') as Konva.Line | undefined
    const arrow = node.findOne('Arrow') as Konva.Arrow | undefined
    const shapeNode = line ?? arrow
    if (shapeNode) {
      let newPts: number[]
      if (ct === 'arrow-curved' || ct === 'arrow-curved-cw') {
        const midX = newDx / 2
        const midY = newDy / 2
        const perpX = -newDy * 0.2
        const perpY = newDx * 0.2
        const sign = ct === 'arrow-curved-cw' ? -1 : 1
        newPts = [0, 0, midX + sign * perpX, midY + sign * perpY, newDx, newDy]
      } else if (isElbowBidirectional) {
        const ex = Math.abs(newDx) > Math.abs(newDy) ? newDx : 0
        const ey = Math.abs(newDx) > Math.abs(newDy) ? 0 : newDy
        newPts = [0, 0, ex, ey, newDx, newDy]
      } else {
        newPts = [0, 0, newDx, newDy]
      }
      shapeNode.points(newPts)
      onObjectResizeEnd(objectId, { start: newStart, end: newEnd })
    }
  }

  const handlers = shapeHandlers(
    objectId,
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
        x={minX}
        y={minY}
        opacity={opacity}
        {...handlers}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={width}
          height={height}
          fill="transparent"
          stroke="transparent"
          listening={isPointerTool}
          perfectDrawEnabled={false}
        />
        {isArrow ? (
          <Arrow
            points={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? curvePoints! : isElbowBidirectional ? elbowPoints : points}
            tension={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? 0.5 : 0}
            pointerLength={10}
            pointerWidth={10}
            pointerAtBeginning={ct === 'arrow-double' || isElbowBidirectional}
            pointerAtEnd
            fill={selected ? '#8093F1' : strokeColor ?? '#000'}
            stroke={selected ? '#8093F1' : strokeColor ?? '#000'}
            strokeWidth={selected ? 3 : strokeWidth ?? 2}
            dash={dash}
            perfectDrawEnabled={false}
            listening={false}
          />
        ) : (
          <Line
            points={points}
            stroke={selected ? '#8093F1' : strokeColor ?? '#000'}
            strokeWidth={selected ? 3 : strokeWidth ?? 2}
            dash={dash}
            perfectDrawEnabled={false}
            listening={false}
          />
        )}
      </Group>
      {selected && hasResizeHandler && canEdit && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={12}
          anchorStrokeWidth={2}
          boundBoxFunc={boundBoxFunc}
        />
      )}
    </>
  )
}
