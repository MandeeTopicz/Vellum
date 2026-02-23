/**
 * Renders arrow preview during click-and-drag (connector tool).
 */
import { Arrow } from 'react-konva'

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
  const points = [startX, startY, endX, endY]
  switch (type) {
    case 'arrow-straight':
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    case 'arrow-curved':
    case 'arrow-curved-cw': {
      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2
      const perpX = -(endY - startY) * 0.2
      const perpY = (endX - startX) * 0.2
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
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
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
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
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
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    default:
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
  }
}
