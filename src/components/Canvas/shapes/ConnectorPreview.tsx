/**
 * Renders live preview connector during smart connector flow (source anchor → cursor).
 * Uses shared connector path logic — strict fixed rules, no conditional adaptation.
 */
import { Arrow, Line } from 'react-konva'
import { getConnectorPath, isCurvedPath, pointerAtBeginning, pointerAtEnd, type ConnectionType } from '../../../utils/connectorPaths'

const PREVIEW_STROKE = '#4A90D9'

export interface ConnectorPreviewProps {
  startX: number
  startY: number
  endX: number
  endY: number
  type: string
  viewportScale: number
}

export function ConnectorPreview({ startX, startY, endX, endY, type, viewportScale }: ConnectorPreviewProps) {
  const dash = [8 / viewportScale, 4 / viewportScale] as [number, number]
  const ct = type as ConnectionType
  const points = getConnectorPath(ct, startX, startY, endX, endY)
  const baseProps = {
    stroke: PREVIEW_STROKE,
    fill: PREVIEW_STROKE,
    strokeWidth: 2,
    opacity: 0.6,
    dash,
    listening: false,
    perfectDrawEnabled: false,
  }

  if (ct === 'line') {
    return <Line points={points} {...baseProps} />
  }
  return (
    <Arrow
      points={points}
      tension={isCurvedPath(ct) ? 0.5 : 0}
      pointerLength={10}
      pointerWidth={10}
      pointerAtBeginning={pointerAtBeginning(ct)}
      pointerAtEnd={pointerAtEnd(ct)}
      {...baseProps}
    />
  )
}
