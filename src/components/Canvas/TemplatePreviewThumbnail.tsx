/**
 * TemplatePreviewThumbnail – SVG preview of a template for the Template Selection Modal.
 * Renders real composed template CreateObjectInput[] as scaled shapes.
 * Layout-accurate, centered, fit-to-container with uniform scaling.
 */
import { memo } from 'react'
import { getTemplatePreviewObjects, getCreateInputsBbox } from '../../utils/templates'
import { pathRightAngle, pathCurvedClockwise, pathCurvedCounterClockwise } from '../../utils/connectorPaths'
import { fitToRect } from '../../utils/scenePreview'
import './TemplatePreviewThumbnail.css'

const THUMBNAIL_PADDING = 20

interface TemplatePreviewThumbnailProps {
  /** Template id (e.g. 'swot', 'kanban-board') */
  templateKey: string
  /** Preview area width */
  width?: number
  /** Preview area height */
  height?: number
  className?: string
}

/**
 * Renders a template thumbnail with layout-accurate content from real template data.
 * Read-only, no interaction. Used in Template Selection Modal.
 */
function TemplatePreviewThumbnailComponent({
  templateKey,
  width = 160,
  height = 100,
  className = '',
}: TemplatePreviewThumbnailProps) {
  const inputs = getTemplatePreviewObjects(templateKey)

  const filteredInputs = inputs.filter((inp) => {
    if (inp.type === 'rectangle' && inp.fillColor === '#FFFFFF') {
      const area = inp.dimensions.width * inp.dimensions.height
      if (area > 400_000) return false
    }
    return true
  })

  const bbox = getCreateInputsBbox(filteredInputs)

  if (!bbox || filteredInputs.length === 0) {
    return (
      <div
        className={`template-preview-empty ${className}`.trim()}
        style={{ width, height }}
      >
        <span />
      </div>
    )
  }

  const { scale, tx, ty } = fitToRect(width, height, bbox, THUMBNAIL_PADDING)
  const transform = `translate(${tx},${ty}) scale(${scale})`

  const elements: React.ReactNode[] = []
  filteredInputs.forEach((inp, i) => {
    const key = `${templateKey}-${i}`

    if (inp.type === 'sticky') {
      elements.push(
        <g key={key}>
          <rect
            x={inp.position.x}
            y={inp.position.y}
            width={inp.dimensions.width}
            height={inp.dimensions.height}
            fill={inp.fillColor ?? '#fef08a'}
            stroke="#d1d5db"
            strokeWidth={0.5}
            rx={inp.cornerRadius ?? 4}
          />
          <text
            x={inp.position.x + inp.dimensions.width / 2}
            y={inp.position.y + inp.dimensions.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="template-preview-text"
          >
            {truncateContent(inp.content, inp.dimensions.width, inp.dimensions.height)}
          </text>
        </g>
      )
      return
    }

    if (inp.type === 'rectangle') {
      elements.push(
        <rect
          key={key}
          x={inp.position.x}
          y={inp.position.y}
          width={inp.dimensions.width}
          height={inp.dimensions.height}
          fill={inp.fillColor ?? 'transparent'}
          stroke={inp.strokeColor ?? '#e5e7eb'}
          strokeWidth={inp.strokeWidth ?? 0.5}
          rx={inp.cornerRadius ?? 0}
        />
      )
      return
    }

    if (inp.type === 'circle') {
      const cx = inp.position.x + inp.dimensions.width / 2
      const cy = inp.position.y + inp.dimensions.height / 2
      const rx = inp.dimensions.width / 2
      const ry = inp.dimensions.height / 2
      elements.push(
        <ellipse
          key={key}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={inp.fillColor ?? 'transparent'}
          stroke={inp.strokeColor ?? 'transparent'}
          strokeWidth={inp.strokeWidth ?? 0}
        />
      )
      return
    }

    if (inp.type === 'diamond') {
      const cx = inp.position.x + inp.dimensions.width / 2
      const cy = inp.position.y + inp.dimensions.height / 2
      const hw = inp.dimensions.width / 2
      const hh = inp.dimensions.height / 2
      const points = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`
      elements.push(
        <polygon
          key={key}
          points={points}
          fill={inp.fillColor ?? 'transparent'}
          stroke={inp.strokeColor ?? 'transparent'}
          strokeWidth={inp.strokeWidth ?? 0}
        />
      )
      return
    }

    if (inp.type === 'line') {
      const stroke = inp.strokeColor ?? '#64748b'
      const strokeW = inp.strokeWidth ?? 1
      const ct = inp.connectionType ?? 'line'
      const isArrow =
        ct === 'arrow-straight' ||
        ct === 'arrow-curved' ||
        ct === 'arrow-curved-cw' ||
        ct === 'arrow-elbow-bidirectional' ||
        ct === 'arrow-double'

      if (ct === 'arrow-curved' || ct === 'arrow-curved-cw') {
        const x1 = inp.start.x
        const y1 = inp.start.y
        const x2 = inp.end.x
        const y2 = inp.end.y
        const pts = ct === 'arrow-curved-cw' ? pathCurvedClockwise(x1, y1, x2, y2) : pathCurvedCounterClockwise(x1, y1, x2, y2)
        const cx = pts[2]
        const cy = pts[3]
        const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
        elements.push(
          <path
            key={key}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            markerEnd={isArrow ? 'url(#template-preview-arrow)' : undefined}
          />
        )
      } else if (ct === 'arrow-elbow-bidirectional') {
        const x1 = inp.start.x
        const y1 = inp.start.y
        const x2 = inp.end.x
        const y2 = inp.end.y
        const pts = pathRightAngle(x1, y1, x2, y2)
        const d = `M ${pts[0]} ${pts[1]} L ${pts[2]} ${pts[3]} L ${pts[4]} ${pts[5]} L ${pts[6]} ${pts[7]}`
        elements.push(
          <path
            key={key}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            markerEnd={isArrow ? 'url(#template-preview-arrow)' : undefined}
          />
        )
      } else {
        elements.push(
          <line
            key={key}
            x1={inp.start.x}
            y1={inp.start.y}
            x2={inp.end.x}
            y2={inp.end.y}
            stroke={stroke}
            strokeWidth={strokeW}
            markerEnd={isArrow ? 'url(#template-preview-arrow)' : undefined}
          />
        )
      }
      return
    }

    if (inp.type === 'text') {
      const content = truncateContent(inp.content, inp.dimensions.width, inp.dimensions.height)
      const textAlign = inp.textStyle?.textAlign ?? 'left'
      const x =
        textAlign === 'center'
          ? inp.position.x + inp.dimensions.width / 2
          : textAlign === 'right'
            ? inp.position.x + inp.dimensions.width - 2
            : inp.position.x + 2
      elements.push(
        <g key={key}>
          <text
            x={x}
            y={inp.position.y + inp.dimensions.height / 2}
            textAnchor={textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start'}
            dominantBaseline="middle"
            className="template-preview-text template-preview-text-small"
          >
            {content}
          </text>
        </g>
      )
      return
    }

    if (inp.type === 'emoji') {
      const size = 24
      const cx = inp.position.x + size / 2
      const cy = inp.position.y + size / 2
      const fontSize = inp.fontSize ?? 14
      elements.push(
        <text
          key={key}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          className="template-preview-emoji"
          style={{ fontSize }}
        >
          {inp.emoji ?? ''}
        </text>
      )
      return
    }

    if (inp.type === 'pen' && inp.points.length >= 2) {
      const d = inp.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
        .join(' ')
      elements.push(
        <path
          key={key}
          d={d}
          fill="none"
          stroke={inp.color ?? '#374151'}
          strokeWidth={inp.strokeWidth ?? 2}
        />
      )
    }
  })

  return (
    <div
      className={`template-preview-thumbnail ${className}`.trim()}
      style={{ width, height }}
    >
      <svg width={width} height={height} className="template-preview-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker
            id="template-preview-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="#64748b" />
          </marker>
        </defs>
        <g transform={transform}>{elements}</g>
      </svg>
    </div>
  )
}

export default memo(TemplatePreviewThumbnailComponent)

/** Truncates content to fit small preview cells. */
function truncateContent(
  content: string | undefined,
  maxW: number,
  maxH: number
): string {
  if (!content) return ''
  const maxLen = Math.max(4, Math.floor((maxW * maxH) / 120))
  const single = content.replace(/\n/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen - 1) + '…'
}
