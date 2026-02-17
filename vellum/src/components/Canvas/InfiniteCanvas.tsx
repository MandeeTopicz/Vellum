import { useRef, useCallback } from 'react'
import { Stage, Layer, Group, Rect } from 'react-konva'
import type Konva from 'konva'

export interface Viewport {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.25
const MAX_SCALE = 3
const ZOOM_SENSITIVITY = 0.001

interface InfiniteCanvasProps {
  width: number
  height: number
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  onMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void
  children: React.ReactNode
  cursorLayer: React.ReactNode
}

export default function InfiniteCanvas({
  width,
  height,
  viewport,
  onViewportChange,
  onMouseMove,
  children,
  cursorLayer,
}: InfiniteCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const scaleBy = 1 - e.evt.deltaY * ZOOM_SENSITIVITY
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, viewport.scale * scaleBy)
      )

      const mousePointTo = {
        x: (pointer.x - viewport.x) / viewport.scale,
        y: (pointer.y - viewport.y) / viewport.scale,
      }
      const newX = pointer.x - mousePointTo.x * newScale
      const newY = pointer.y - mousePointTo.y * newScale

      onViewportChange({
        x: newX,
        y: newY,
        scale: newScale,
      })
    },
    [viewport, onViewportChange]
  )

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      onViewportChange({
        ...viewport,
        x: viewport.x + node.x(),
        y: viewport.y + node.y(),
      })
      node.position({ x: 0, y: 0 })
    },
    [viewport, onViewportChange]
  )

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onWheel={handleWheel}
      onMouseMove={onMouseMove}
      style={{ cursor: 'grab' }}
    >
      <Layer>
        <Group
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable
          onDragMove={handleDragMove}
          onDragEnd={handleDragMove}
        >
          <Rect
            x={-5000}
            y={-5000}
            width={20000}
            height={20000}
            fill="#f5f5f0"
            listening={true}
            name="background"
          />
          {children}
        </Group>
      </Layer>
      {cursorLayer}
    </Stage>
  )
}
