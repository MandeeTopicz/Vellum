/**
 * Renders arrow preview during click-and-drag (connector tool).
 * Uses shared connector path logic — strict fixed rules, no conditional adaptation.
 */
import { Arrow, Line } from 'react-konva'
import { getConnectorPath, isCurvedPath, pointerAtBeginning, pointerAtEnd, type ConnectionType } from '../../../utils/connectorPaths'

const PREVIEW_STROKE = '#3b82f6'
const PREVIEW_PROPS = {
  stroke: PREVIEW_STROKE,
  strokeWidth: 2,
  opacity: 0.6,
  dash: [5, 5] as [number, number],
  listening: false,
  perfectDrawEnabled: false,
}

export interface ArrowPreviewProps {
  startX: number
  startY: number
  endX: number
  endY: number
  type: string
}

export function ArrowPreview({ startX, startY, endX, endY, type }: ArrowPreviewProps) {
  const ct = type as ConnectionType
  const points = getConnectorPath(ct, startX, startY, endX, endY)

  if (ct === 'line') {
    return <Line points={points} {...PREVIEW_PROPS} />
  }
  return (
    <Arrow
      points={points}
      tension={isCurvedPath(ct) ? 0.5 : 0}
      pointerLength={10}
      pointerWidth={10}
      pointerAtBeginning={pointerAtBeginning(ct)}
      pointerAtEnd={pointerAtEnd(ct)}
      fill={PREVIEW_STROKE}
      {...PREVIEW_PROPS}
    />
  )
}
