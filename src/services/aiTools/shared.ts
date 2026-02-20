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

/** Converts BoardObject to CreateObjectInput with position offset (for duplicate) */
export function objToCreateInput(obj: BoardObject, dx: number, dy: number): CreateObjectInput | null {
  switch (obj.type) {
    case 'sticky':
      return {
        type: 'sticky',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        fillColor: obj.fillColor,
        textStyle: obj.textStyle,
      }
    case 'rectangle':
    case 'circle':
    case 'triangle':
      return {
        type: obj.type,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: obj.fillColor,
      }
    case 'line':
      return {
        type: 'line',
        start: { x: obj.start.x + dx, y: obj.start.y + dy },
        end: { x: obj.end.x + dx, y: obj.end.y + dy },
        strokeColor: obj.strokeColor,
        strokeWidth: obj.strokeWidth,
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
    default:
      return null
  }
}
