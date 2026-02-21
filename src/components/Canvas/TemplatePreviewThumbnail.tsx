/**
 * TemplatePreviewThumbnail – SVG preview of a template showing words, colors, and layout.
 * Renders CreateObjectInput[] as scaled shapes with text.
 */
import { getTemplatePreviewObjects, getCreateInputsBbox } from '../../utils/templates'
import { fitToRect } from '../../utils/scenePreview'
import './TemplatePreviewThumbnail.css'

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
 * Renders a template thumbnail with accurate content, colors, and layout.
 * @param templateKey - Template id
 * @param width - Preview width (default 160)
 * @param height - Preview height (default 100)
 */
export default function TemplatePreviewThumbnail({
  templateKey,
  width = 160,
  height = 100,
  className = '',
}: TemplatePreviewThumbnailProps) {
  const inputs = getTemplatePreviewObjects(templateKey)
  const bbox = getCreateInputsBbox(inputs)

  if (!bbox || inputs.length === 0) {
    return (
      <div
        className={`template-preview-empty ${className}`.trim()}
        style={{ width, height }}
      >
        <span />
      </div>
    )
  }

  const { scale, tx, ty } = fitToRect(width, height, bbox, 8)
  const transform = `translate(${tx},${ty}) scale(${scale})`

  const elements: React.ReactNode[] = []
  inputs.forEach((inp, i) => {
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
          strokeWidth={0.5}
          rx={inp.cornerRadius ?? 0}
        />
      )
      return
    }

    if (inp.type === 'line') {
      const isArrow = inp.connectionType === 'arrow-straight' || inp.connectionType === 'arrow-curved'
      elements.push(
        <line
          key={key}
          x1={inp.start.x}
          y1={inp.start.y}
          x2={inp.end.x}
          y2={inp.end.y}
          stroke={inp.strokeColor ?? '#64748b'}
          strokeWidth={inp.strokeWidth ?? 1}
          markerEnd={isArrow ? 'url(#template-preview-arrow)' : undefined}
        />
      )
      return
    }

    if (inp.type === 'text') {
      const content = truncateContent(inp.content, inp.dimensions.width, inp.dimensions.height)
      elements.push(
        <g key={key}>
          <rect
            x={inp.position.x}
            y={inp.position.y}
            width={inp.dimensions.width}
            height={inp.dimensions.height}
            fill="transparent"
          />
          <text
            x={inp.position.x + 2}
            y={inp.position.y + inp.dimensions.height / 2}
            dominantBaseline="middle"
            className="template-preview-text template-preview-text-small"
          >
            {content}
          </text>
        </g>
      )
    }
  })

  return (
    <div
      className={`template-preview-thumbnail ${className}`.trim()}
      style={{ width, height }}
    >
      <svg width={width} height={height} className="template-preview-svg">
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

/** Truncates content to fit small preview cells. */
function truncateContent(
  content: string | undefined,
  maxW: number,
  maxH: number
): string {
  if (!content) return ''
  const maxLen = Math.max(4, Math.floor((maxW * maxH) / 80))
  const single = content.replace(/\n/g, ' ').trim()
  if (single.length <= maxLen) return single
  return single.slice(0, maxLen - 1) + '…'
}
