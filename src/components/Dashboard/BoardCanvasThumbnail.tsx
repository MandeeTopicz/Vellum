/**
 * BoardCanvasThumbnail – Konva export to PNG for board preview.
 * Renders a non-interactive Konva Stage, fits all objects to thumbnail, exports to dataURL.
 */
import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Group, Rect, Ellipse, Line, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject } from '../../types'
import { getBbox, fitToRect } from '../../utils/scenePreview'
import ScenePreviewSVG from './ScenePreviewSVG'

const PADDING = 16
const PIXEL_RATIO = 2

interface BoardCanvasThumbnailProps {
  scene: { objects?: BoardObject[]; appState?: { viewBackgroundColor?: string } } | null
  width: number
  height: number
  className?: string
  animate?: boolean
}

/**
 * Renders a single object as a Konva primitive (read-only, no interaction).
 */
function PreviewObject({ obj }: { obj: BoardObject }) {
  const opacity = 'opacity' in obj && typeof (obj as { opacity?: number }).opacity === 'number'
    ? (obj as { opacity: number }).opacity
    : 1

  if (obj.type === 'sticky') {
    const s = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string }
    return (
      <Group x={s.position.x} y={s.position.y} opacity={opacity} listening={false}>
        <Rect
          width={s.dimensions.width}
          height={s.dimensions.height}
          fill={s.fillColor ?? '#fef08a'}
          stroke="#d1d5db"
          strokeWidth={1}
          cornerRadius={12}
          listening={false}
        />
      </Group>
    )
  }
  if (obj.type === 'rectangle') {
    const r = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number }
    return (
      <Group x={r.position.x} y={r.position.y} opacity={opacity} listening={false}>
        <Rect
          width={r.dimensions.width}
          height={r.dimensions.height}
          fill={r.fillColor ?? 'transparent'}
          stroke={r.strokeColor ?? '#000000'}
          strokeWidth={r.strokeWidth ?? 2}
          listening={false}
        />
      </Group>
    )
  }
  if (obj.type === 'circle') {
    const c = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string }
    const w = c.dimensions.width
    const h = c.dimensions.height
    return (
      <Group x={c.position.x} y={c.position.y} opacity={opacity} listening={false}>
        <Ellipse
          x={w / 2}
          y={h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          fill={c.fillColor ?? 'transparent'}
          stroke={c.strokeColor ?? '#000000'}
          strokeWidth={2}
          listening={false}
        />
      </Group>
    )
  }
  if (obj.type === 'line') {
    const l = obj as { start: { x: number; y: number }; end: { x: number; y: number }; strokeColor?: string; strokeWidth?: number }
    return (
      <Line
        points={[l.start.x, l.start.y, l.end.x, l.end.y]}
        stroke={l.strokeColor ?? '#000000'}
        strokeWidth={l.strokeWidth ?? 2}
        listening={false}
      />
    )
  }
  if (obj.type === 'pen') {
    const p = obj as { points: [number, number][]; color?: string; strokeWidth?: number }
    if (p.points.length < 2) return null
    const flat = p.points.flat()
    return (
      <Line
        points={flat}
        stroke={p.color ?? '#000000'}
        strokeWidth={p.strokeWidth ?? 3}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    )
  }
  if (obj.type === 'triangle') {
    const t = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; inverted?: boolean }
    const w = t.dimensions.width
    const h = t.dimensions.height
    const pts = t.inverted
      ? [w / 2, 0, 0, h, w, h]
      : [w / 2, h, 0, 0, w, 0]
    return (
      <Group x={t.position.x} y={t.position.y} opacity={opacity} listening={false}>
        <Line
          points={pts}
          fill={t.fillColor ?? 'transparent'}
          closed
          stroke={t.strokeColor ?? '#000000'}
          strokeWidth={2}
          listening={false}
        />
      </Group>
    )
  }
  if (obj.type === 'emoji') {
    const e = obj as { position: { x: number; y: number }; emoji: string; fontSize?: number }
    const fs = e.fontSize ?? 24
    return (
      <Group x={e.position.x} y={e.position.y} listening={false}>
        <Text text={e.emoji} fontSize={fs} listening={false} />
      </Group>
    )
  }
  if (obj.type === 'text') {
    const tx = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; content?: string }
    return (
      <Group x={tx.position.x} y={tx.position.y} listening={false}>
        <Rect
          width={tx.dimensions.width}
          height={tx.dimensions.height}
          fill="transparent"
          stroke="#e5e7eb"
          strokeWidth={1}
          listening={false}
        />
      </Group>
    )
  }
  if (
    obj.type === 'diamond' || obj.type === 'star' || obj.type === 'pentagon' ||
    obj.type === 'hexagon' || obj.type === 'octagon' || obj.type === 'arrow' ||
    obj.type === 'plus' || obj.type === 'parallelogram' || obj.type === 'cylinder' ||
    obj.type === 'tab-shape' || obj.type === 'trapezoid' || obj.type === 'circle-cross'
  ) {
    const sh = obj as { position: { x: number; y: number }; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string }
    return (
      <Group x={sh.position.x} y={sh.position.y} opacity={opacity} listening={false}>
        <Rect
          width={sh.dimensions.width}
          height={sh.dimensions.height}
          fill={sh.fillColor ?? 'transparent'}
          stroke={sh.strokeColor ?? '#000000'}
          strokeWidth={2}
          listening={false}
        />
      </Group>
    )
  }
  return null
}

export default function BoardCanvasThumbnail({
  scene,
  width,
  height,
  className = '',
}: BoardCanvasThumbnailProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setDataUrl(null)

    const objects = scene?.objects ?? []
    if (objects.length === 0) {
      return
    }

    const bbox = getBbox(objects)
    if (!bbox) return

    const run = () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (cancelled) return
        try {
          const stage = stageRef.current
          if (!stage || cancelled) return
          const uri = stage.toDataURL({ pixelRatio: PIXEL_RATIO })
          if (!cancelled) {
            setDataUrl(uri)
          }
        } catch (e) {
          if (!cancelled) setError(true)
        }
      })
    }

    const t = setTimeout(run, 50)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [scene, width, height])

  const bgColor = scene?.appState?.viewBackgroundColor ?? '#ffffff'

  if (!scene || (scene.objects ?? []).length === 0) {
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

  const bbox = getBbox(scene.objects!)
  const fit = bbox ? fitToRect(width, height, bbox, PADDING) : null

  return (
    <div
      className={`board-canvas-thumbnail ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius: 8,
        background: bgColor,
        overflow: 'hidden',
        position: 'relative',
        objectFit: 'contain' as const,
      }}
    >
      {!dataUrl && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#9ca3af',
          }}
        >
          Loading…
        </div>
      )}
      {error ? (
        <ScenePreviewSVG scene={scene} width={width} height={height} />
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="Board preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 8,
          }}
        />
      ) : null}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        {fit && (
          <Stage
            ref={(node) => { stageRef.current = node ? (node as unknown as Konva.Stage) : null }}
            width={width}
            height={height}
            listening={false}
          >
            <Layer listening={false}>
              <Group
                x={fit.tx}
                y={fit.ty}
                scaleX={fit.scale}
                scaleY={fit.scale}
                listening={false}
              >
                {scene.objects!.map((obj) => (
                  <PreviewObject key={obj.objectId} obj={obj} />
                ))}
              </Group>
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  )
}
