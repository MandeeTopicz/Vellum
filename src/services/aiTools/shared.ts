/**
 * Shared utilities for AI tools: colors, context serialization, object conversion.
 */
import type { CreateObjectInput } from '../objects'
import type { BoardObject } from '../../types'

export const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  pink: '#fce7f3',
  blue: '#dbeafe',
  green: '#dcfce7',
  orange: '#ffedd5',
}

export const NAMED_COLORS: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
  gray: '#6b7280',
  black: '#1f2937',
  white: '#f9fafb',
}

/** Resolves a color name or hex to a hex string */
export function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  if (color.startsWith('#')) return color
  return NAMED_COLORS[color.toLowerCase()] ?? fallback
}

/** Minimal object shape sent to Cloud Function for AI context */
export function toContextObject(obj: BoardObject): {
  objectId: string
  type: string
  content?: string
  position?: { x: number; y: number }
  fillColor?: string
  dimensions?: { width: number; height: number }
} {
  const base: ReturnType<typeof toContextObject> = { objectId: obj.objectId, type: obj.type }
  if ('content' in obj && typeof obj.content === 'string') base.content = obj.content
  if ('position' in obj) base.position = obj.position
  if ('start' in obj) base.position = (obj as { start: { x: number; y: number } }).start
  if ('fillColor' in obj && typeof (obj as { fillColor?: string }).fillColor === 'string') base.fillColor = (obj as { fillColor: string }).fillColor
  if ('dimensions' in obj) base.dimensions = (obj as { dimensions: { width: number; height: number } }).dimensions
  return base
}

/** Extracts common shape styling for copy/duplicate (preserves all style changes) */
function shapeStyle(obj: BoardObject) {
  const o = obj as unknown as Record<string, unknown>
  return {
    fillColor: o.fillColor as string | undefined,
    strokeColor: o.strokeColor as string | undefined,
    strokeWidth: o.strokeWidth as number | undefined,
    strokeOpacity: o.strokeOpacity as number | undefined,
    strokeStyle: o.strokeStyle as 'solid' | 'dashed' | 'dotted' | undefined,
    opacity: o.opacity as number | undefined,
    cornerRadius: o.cornerRadius as number | undefined,
  }
}

/** Returns top-left (minX, minY) of bounding box for objects, used as paste anchor. */
export function getObjectsBboxMin(objs: BoardObject[]): { x: number; y: number } | null {
  if (objs.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  for (const obj of objs) {
    if (obj.type === 'line') {
      const line = obj as { start: { x: number; y: number }; end: { x: number; y: number } }
      minX = Math.min(minX, line.start.x, line.end.x)
      minY = Math.min(minY, line.start.y, line.end.y)
    } else if (obj.type === 'pen') {
      const pen = obj as { points: [number, number][] }
      for (const p of pen.points) {
        minX = Math.min(minX, p[0])
        minY = Math.min(minY, p[1])
      }
    } else if ('position' in obj) {
      minX = Math.min(minX, obj.position.x)
      minY = Math.min(minY, obj.position.y)
    }
  }
  if (minX === Infinity || minY === Infinity) return null
  return { x: minX, y: minY }
}

/** Converts BoardObject to CreateObjectInput with position offset (for copy/paste/duplicate). Preserves all styling. */
export function objToCreateInput(obj: BoardObject, dx: number, dy: number): CreateObjectInput | null {
  switch (obj.type) {
    case 'sticky': {
      const s = obj as { cornerRadius?: number; opacity?: number }
      return {
        type: 'sticky',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        fillColor: obj.fillColor,
        textStyle: obj.textStyle,
        cornerRadius: s.cornerRadius,
        opacity: s.opacity,
      }
    }
    case 'rectangle': {
      const style = shapeStyle(obj)
      return {
        type: 'rectangle',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        cornerRadius: style.cornerRadius,
      }
    }
    case 'circle':
    case 'triangle': {
      const style = shapeStyle(obj)
      const tri = obj as { inverted?: boolean }
      return {
        type: obj.type,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        ...(obj.type === 'triangle' && { inverted: tri.inverted }),
      }
    }
    case 'line': {
      const line = obj as { strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; connectionType?: 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double' }
      return {
        type: 'line',
        start: { x: obj.start.x + dx, y: obj.start.y + dy },
        end: { x: obj.end.x + dx, y: obj.end.y + dy },
        strokeColor: obj.strokeColor,
        strokeWidth: obj.strokeWidth,
        strokeOpacity: line.strokeOpacity,
        strokeStyle: line.strokeStyle,
        connectionType: line.connectionType,
      }
    }
    case 'text':
      return {
        type: 'text',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        textStyle: obj.textStyle,
      }
    case 'emoji':
      return {
        type: 'emoji',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        emoji: obj.emoji,
        fontSize: obj.fontSize,
      }
    case 'pen': {
      const pen = obj as { points: [number, number][]; color?: string; strokeWidth?: number; isHighlighter?: boolean; opacity?: number; strokeType?: 'solid' | 'dotted' | 'double' }
      const points = pen.points.map((p) => [p[0] + dx, p[1] + dy] as [number, number])
      return {
        type: 'pen',
        points,
        color: pen.color,
        strokeWidth: pen.strokeWidth,
        isHighlighter: pen.isHighlighter,
        opacity: pen.opacity,
        strokeType: pen.strokeType,
      }
    }
    case 'diamond':
    case 'star':
    case 'pentagon':
    case 'hexagon':
    case 'octagon':
    case 'plus':
    case 'arrow':
    case 'tab-shape':
    case 'trapezoid':
    case 'circle-cross': {
      const style = shapeStyle(obj)
      const arr = obj as { direction?: 'right' | 'left' }
      return {
        type: obj.type,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        ...(obj.type === 'arrow' && { direction: arr.direction }),
      }
    }
    case 'parallelogram': {
      const style = shapeStyle(obj)
      const p = obj as { shapeKind?: 'right' | 'left' }
      return {
        type: 'parallelogram',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        shapeKind: p.shapeKind ?? 'right',
      }
    }
    case 'cylinder': {
      const style = shapeStyle(obj)
      const c = obj as { shapeKind?: 'vertical' | 'horizontal' }
      return {
        type: 'cylinder',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        shapeKind: c.shapeKind ?? 'vertical',
      }
    }
    default:
      return null
  }
}
