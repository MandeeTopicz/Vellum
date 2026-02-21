/**
 * Renders pen strokes and pen stroke preview.
 */
import { Group, Line } from 'react-konva'
import type { PenObject } from '../../../types/objects'

/** In-progress pen stroke preview while drawing */
export interface CurrentPenStroke {
  points: [number, number][]
  color: string
  strokeWidth: number
  isHighlighter: boolean
  opacity: number
  strokeType?: 'solid' | 'dotted' | 'double'
}

/** Renders a pen stroke with optional solid/dotted/double style */
function renderPenStroke(
  flatPoints: number[],
  color: string,
  strokeWidth: number,
  opacity: number,
  strokeType: 'solid' | 'dotted' | 'double' | undefined
) {
  const baseProps = {
    points: flatPoints,
    stroke: color,
    strokeWidth,
    opacity,
    tension: 0.5,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    listening: false,
    perfectDrawEnabled: false,
  }
  if (strokeType === 'dotted') {
    const gap = Math.max(strokeWidth * 0.8, 4)
    const dash = Math.max(strokeWidth * 0.4, 2)
    return <Line {...baseProps} dash={[dash, gap]} />
  }
  if (strokeType === 'double') {
    const offset = strokeWidth * 0.4
    const points: [number, number][] = []
    for (let i = 0; i < flatPoints.length; i += 2) {
      points.push([flatPoints[i], flatPoints[i + 1]])
    }
    const offsetPoints = (delta: number): number[] => {
      if (points.length < 2) return flatPoints
      const result: number[] = []
      for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)]
        const next = points[Math.min(points.length - 1, i + 1)]
        const dx = next[0] - prev[0]
        const dy = next[1] - prev[1]
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        result.push(points[i][0] + nx * delta, points[i][1] + ny * delta)
      }
      return result
    }
    const w = strokeWidth * 0.6
    return (
      <Group>
        <Line {...baseProps} points={offsetPoints(-offset)} strokeWidth={w} />
        <Line {...baseProps} points={offsetPoints(offset)} strokeWidth={w} />
      </Group>
    )
  }
  return <Line {...baseProps} />
}

export function PenStrokePreview({ stroke }: { stroke: CurrentPenStroke }) {
  const flatPoints = stroke.points.flat()
  const strokeType = stroke.strokeType ?? 'solid'
  return (
    <Group listening={false}>
      {renderPenStroke(flatPoints, stroke.color, stroke.strokeWidth, stroke.opacity, strokeType)}
    </Group>
  )
}

interface PenShapeProps {
  obj: PenObject
  isPointerTool: boolean
  onObjectClick: (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }) => void
}

export function PenShape({ obj, isPointerTool, onObjectClick }: PenShapeProps) {
  const { objectId, points, color, strokeWidth, opacity = 1, strokeType } = obj
  const flatPoints = points.flat()
  if (flatPoints.length < 4) return null
  return (
    <Group
      listening={isPointerTool}
      onClick={(e) => isPointerTool && onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey, metaKey: e.evt.metaKey })}
    >
      {renderPenStroke(flatPoints, color, strokeWidth, opacity, strokeType)}
    </Group>
  )
}
