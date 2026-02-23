/**
 * Renders live preview connector during smart connector flow (source anchor → cursor).
 * Dashed line with reduced opacity to indicate preview state.
 */
import { Arrow } from 'react-konva'

const PREVIEW_STROKE = '#4A90D9'

export interface ConnectorPreviewProps {
  startX: number
  startY: number
  endX: number
  endY: number
  type: string
  /** Viewport scale for dash sizing */
  viewportScale: number
}

export function ConnectorPreview({ startX, startY, endX, endY, type, viewportScale }: ConnectorPreviewProps) {
  const dash = [8 / viewportScale, 4 / viewportScale] as [number, number]
  const baseProps = {
    stroke: PREVIEW_STROKE,
    fill: PREVIEW_STROKE,
    strokeWidth: 2,
    opacity: 0.6,
    dash,
    listening: false,
    perfectDrawEnabled: false,
  }

  const points = [startX, startY, endX, endY]
  switch (type) {
    case 'arrow-straight':
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          {...baseProps}
        />
      )
    case 'arrow-curved':
    case 'arrow-curved-cw': {
      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2
      const perpX = -(endY - startY) * 0.2
      const perpY = (endX - startX) * 0.2
      /** Clockwise = bows down/right (+); counter-clockwise = bows up/left (-) */
      const sign = type === 'arrow-curved-cw' ? 1 : -1
      const controlX = midX + sign * perpX
      const controlY = midY + sign * perpY
      const curvePoints = [startX, startY, controlX, controlY, endX, endY]
      return (
        <Arrow
          points={curvePoints}
          tension={0.5}
          pointerLength={10}
          pointerWidth={10}
          {...baseProps}
        />
      )
    }
    case 'arrow-elbow-bidirectional':
    case 'arrow-elbow': {
      const deltaX = endX - startX
      const deltaY = endY - startY
      const elbowX = Math.abs(deltaX) > Math.abs(deltaY) ? endX : startX
      const elbowY = Math.abs(deltaX) > Math.abs(deltaY) ? startY : endY
      const elbowPoints = [startX, startY, elbowX, elbowY, endX, endY]
      return (
        <Arrow
          points={elbowPoints}
          pointerLength={10}
          pointerWidth={10}
          pointerAtBeginning
          pointerAtEnd
          {...baseProps}
        />
      )
    }
    case 'arrow-double':
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          pointerAtBeginning
          pointerAtEnd
          {...baseProps}
        />
      )
    default:
      /** Fallback: straight arrow (never use elbow for unknown types) */
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          {...baseProps}
        />
      )
  }
}
