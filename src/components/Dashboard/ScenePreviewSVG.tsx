/**
 * ScenePreviewSVG – pure SVG fallback for board preview.
 * Simplified shapes when Konva export fails or is unavailable.
 */
import type { BoardObject } from '../../types'
import { getBbox, fitToRect } from '../../utils/scenePreview'

interface ScenePreviewSVGProps {
  scene: { objects?: BoardObject[]; appState?: { viewBackgroundColor?: string } } | null
  width: number
  height: number
  className?: string
}

export default function ScenePreviewSVG({
  scene,
  width,
  height,
  className = '',
}: ScenePreviewSVGProps) {
  const objects = scene?.objects ?? []
  const bgColor = scene?.appState?.viewBackgroundColor ?? '#ffffff'

  if (objects.length === 0) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          borderRadius: 8,
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: 12,
        }}
      >
        No preview
      </div>
    )
  }

  const bbox = getBbox(objects)
  if (!bbox) {
    return (
      <div
        className={className}
        style={{ width, height, borderRadius: 8, background: bgColor }}
      />
    )
  }

  const { scale, tx, ty } = fitToRect(width, height, bbox, 16)

  const transform = `translate(${tx},${ty}) scale(${scale})`

  const shapes: React.ReactNode[] = []

  objects.forEach((obj) => {
    const opacity = 'opacity' in obj && typeof (obj as { opacity?: number }).opacity === 'number'
      ? (obj as { opacity: number }).opacity
      : 1

    if (obj.type === 'sticky' || obj.type === 'rectangle') {
      const o = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string }
      const fill = obj.type === 'sticky' ? (o.fillColor ?? '#fef08a') : 'transparent'
      const stroke = obj.type === 'sticky' ? '#d1d5db' : '#000000'
      shapes.push(
        <rect
          key={obj.objectId}
          x={o.position.x}
          y={o.position.y}
          width={o.dimensions.width}
          height={o.dimensions.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={obj.type === 'sticky' ? 1 : 2}
          rx={obj.type === 'sticky' ? 12 : 0}
          opacity={opacity}
        />
      )
      return
    }
    if (obj.type === 'circle') {
      const c = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string }
      const cx = c.position.x + c.dimensions.width / 2
      const cy = c.position.y + c.dimensions.height / 2
      const rx = c.dimensions.width / 2
      const ry = c.dimensions.height / 2
      shapes.push(
        <ellipse
          key={obj.objectId}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={c.fillColor ?? 'transparent'}
          stroke={c.strokeColor ?? '#000000'}
          strokeWidth={2}
          opacity={opacity}
        />
      )
      return
    }
    if (obj.type === 'line') {
      const l = obj as { start: { x: number; y: number }; end: { x: number; y: number }; strokeColor?: string }
      shapes.push(
        <line
          key={obj.objectId}
          x1={l.start.x}
          y1={l.start.y}
          x2={l.end.x}
          y2={l.end.y}
          stroke={l.strokeColor ?? '#000000'}
          strokeWidth={2}
        />
      )
      return
    }
    if (obj.type === 'pen') {
      const p = obj as { points: [number, number][]; color?: string }
      if (p.points.length < 2) return
      const d = `M ${p.points.map(([x, y]) => `${x} ${y}`).join(' L ')}`
      shapes.push(
        <path
          key={obj.objectId}
          d={d}
          fill="none"
          stroke={p.color ?? '#000000'}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
      return
    }
    if (obj.type === 'triangle') {
      const t = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; inverted?: boolean }
      const w = t.dimensions.width
      const h = t.dimensions.height
      const pts = t.inverted
        ? `${t.position.x + w / 2},${t.position.y} ${t.position.x},${t.position.y + h} ${t.position.x + w},${t.position.y + h}`
        : `${t.position.x + w / 2},${t.position.y + h} ${t.position.x},${t.position.y} ${t.position.x + w},${t.position.y}`
      shapes.push(
        <polygon
          key={obj.objectId}
          points={pts}
          fill={t.fillColor ?? 'transparent'}
          stroke={t.strokeColor ?? '#000000'}
          strokeWidth={2}
          opacity={opacity}
        />
      )
      return
    }
    if (
      obj.type === 'diamond' || obj.type === 'star' || obj.type === 'pentagon' ||
      obj.type === 'hexagon' || obj.type === 'octagon' || obj.type === 'arrow' ||
      obj.type === 'plus' || obj.type === 'parallelogram' || obj.type === 'cylinder' ||
      obj.type === 'tab-shape' || obj.type === 'trapezoid' || obj.type === 'circle-cross' ||
      obj.type === 'text' || obj.type === 'emoji'
    ) {
      const o = obj as { position: { x: number; y: number }; dimensions?: { width: number; height: number }; fillColor?: string; strokeColor?: string }
      const dims = o.dimensions ?? { width: 100, height: 100 }
      shapes.push(
        <rect
          key={obj.objectId}
          x={o.position.x}
          y={o.position.y}
          width={dims.width}
          height={dims.height}
          fill={o.fillColor ?? 'transparent'}
          stroke={o.strokeColor ?? '#000000'}
          strokeWidth={2}
          opacity={opacity}
        />
      )
    }
  })

  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: 8,
        background: bgColor,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        <g transform={transform}>
          {shapes}
        </g>
      </svg>
    </div>
  )
}
