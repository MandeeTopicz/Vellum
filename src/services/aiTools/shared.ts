/**
 * Shared utilities for AI tools: colors, context serialization, object conversion.
 */
import type { CreateObjectInput } from '../objects'
import type { BoardObject } from '../../types'
import { getObjectBounds } from '../../utils/objectBounds'

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

const DEFAULT_MARGIN = 40

/**
 * Find a position for a rect so it does not overlap existing bounds (with margin).
 * Used by AI generator to place new content outside existing objects.
 * @param width - Width of the rect to place
 * @param height - Height of the rect to place
 * @param preferredCenter - Preferred center point (x, y)
 * @param existingObjects - Existing board objects to avoid
 * @param margin - Gap between new rect and existing objects (default 40)
 * @returns Top-left { x, y } for the rect
 */
export function findNonOverlappingPosition(
  width: number,
  height: number,
  preferredCenter: { x: number; y: number },
  existingObjects: BoardObject[],
  margin: number = DEFAULT_MARGIN
): { x: number; y: number } {
  const existingBounds = existingObjects.map((o) => getObjectBounds(o))
  return findNonOverlappingPositionWithBounds(width, height, preferredCenter, existingBounds, margin)
}

/** Bounds from createInput for overlap checking */
function createInputToBounds(input: CreateObjectInput): { left: number; top: number; right: number; bottom: number } | null {
  if (input.type === 'line') {
    return {
      left: Math.min(input.start.x, input.end.x),
      top: Math.min(input.start.y, input.end.y),
      right: Math.max(input.start.x, input.end.x),
      bottom: Math.max(input.start.y, input.end.y),
    }
  }
  if ('position' in input) {
    const dims = 'dimensions' in input ? input.dimensions : { width: 100, height: 100 }
    const w = dims?.width ?? 100
    const h = dims?.height ?? 100
    return {
      left: input.position.x,
      top: input.position.y,
      right: input.position.x + w,
      bottom: input.position.y + h,
    }
  }
  return null
}

/**
 * Returns adjusted top-left position so a rect of (width, height) does not overlap
 * existing objects. Uses viewport center as preferred placement when available.
 * Also considers already-created items in this batch (createdItems).
 */
export function getAdjustedPosition(
  ctx: {
    objectsList: BoardObject[]
    viewportCenter?: { x: number; y: number }
    createdItems?: { objectId: string; createInput: CreateObjectInput }[]
  },
  intendedLeft: number,
  intendedTop: number,
  width: number,
  height: number
): { x: number; y: number } {
  const vc = ctx.viewportCenter ?? { x: intendedLeft + width / 2, y: intendedTop + height / 2 }
  const existingFromBoard = ctx.objectsList
  const existingFromBatch = (ctx.createdItems ?? [])
    .map((i) => createInputToBounds(i.createInput))
    .filter((b): b is NonNullable<typeof b> => b != null)
  const combinedBounds = [
    ...existingFromBoard.map((o) => getObjectBounds(o)),
    ...existingFromBatch,
  ]
  return findNonOverlappingPositionWithBounds(width, height, vc, combinedBounds)
}

/**
 * Like findNonOverlappingPosition but accepts raw bounds array.
 * @internal
 */
export function findNonOverlappingPositionWithBounds(
  width: number,
  height: number,
  preferredCenter: { x: number; y: number },
  existingBounds: { left: number; top: number; right: number; bottom: number }[],
  margin: number = DEFAULT_MARGIN
): { x: number; y: number } {
  const preferredLeft = preferredCenter.x - width / 2
  const preferredTop = preferredCenter.y - height / 2

  const overlaps = (left: number, top: number): boolean => {
    const right = left + width
    const bottom = top + height
    for (const b of existingBounds) {
      const bl = b.left - margin
      const bt = b.top - margin
      const br = b.right + margin
      const bb = b.bottom + margin
      if (left < br && right > bl && top < bb && bottom > bt) return true
    }
    return false
  }

  if (!overlaps(preferredLeft, preferredTop)) {
    return { x: preferredLeft, y: preferredTop }
  }

  const step = Math.max(width, height, margin) * 0.6
  for (let ring = 1; ring < 12; ring++) {
    const d = ring * step
    const candidates: [number, number][] = [
      [preferredLeft + d, preferredTop],
      [preferredLeft + d, preferredTop + d],
      [preferredLeft, preferredTop + d],
      [preferredLeft - d, preferredTop + d],
      [preferredLeft - d, preferredTop],
      [preferredLeft - d, preferredTop - d],
      [preferredLeft, preferredTop - d],
      [preferredLeft + d, preferredTop - d],
    ]
    for (const [left, top] of candidates) {
      if (!overlaps(left, top)) return { x: left, y: top }
    }
  }
  return { x: preferredLeft, y: preferredTop }
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

/** @internal Appends rotation and linkUrl to create input when present */
function withRotationAndLink<T extends Record<string, unknown>>(
  input: T,
  obj: BoardObject
): T & { rotation?: number; linkUrl?: string | null } {
  const rot = (obj as { rotation?: number }).rotation
  const link = (obj as { linkUrl?: string | null }).linkUrl
  return {
    ...input,
    ...(typeof rot === 'number' && { rotation: rot }),
    ...(link !== undefined && { linkUrl: link }),
  } as T & { rotation?: number; linkUrl?: string | null }
}

/** Converts BoardObject to CreateObjectInput with position offset (for copy/paste/duplicate). Preserves all styling. */
export function objToCreateInput(obj: BoardObject, dx: number, dy: number): CreateObjectInput | null {
  switch (obj.type) {
    case 'sticky': {
      const s = obj as { cornerRadius?: number; opacity?: number }
      return withRotationAndLink({
        type: 'sticky' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        fillColor: obj.fillColor,
        textStyle: obj.textStyle,
        cornerRadius: s.cornerRadius,
        opacity: s.opacity,
      }, obj)
    }
    case 'rectangle': {
      const style = shapeStyle(obj)
      return withRotationAndLink({
        type: 'rectangle' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        cornerRadius: style.cornerRadius,
      }, obj)
    }
    case 'circle':
    case 'triangle': {
      const style = shapeStyle(obj)
      const tri = obj as { inverted?: boolean }
      return withRotationAndLink({
        type: obj.type as 'circle' | 'triangle',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        ...(obj.type === 'triangle' && { inverted: tri.inverted }),
      }, obj)
    }
    case 'line': {
      const line = obj as { strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; connectionType?: 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double' }
      return withRotationAndLink({
        type: 'line' as const,
        start: { x: obj.start.x + dx, y: obj.start.y + dy },
        end: { x: obj.end.x + dx, y: obj.end.y + dy },
        strokeColor: obj.strokeColor,
        strokeWidth: obj.strokeWidth,
        strokeOpacity: line.strokeOpacity,
        strokeStyle: line.strokeStyle,
        connectionType: line.connectionType,
      }, obj)
    }
    case 'text':
      return withRotationAndLink({
        type: 'text' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        textStyle: obj.textStyle,
      }, obj)
    case 'emoji':
      return withRotationAndLink({
        type: 'emoji' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        emoji: obj.emoji,
        fontSize: obj.fontSize,
      }, obj)
    case 'pen': {
      const pen = obj as { points: [number, number][]; color?: string; strokeWidth?: number; isHighlighter?: boolean; opacity?: number; strokeType?: 'solid' | 'dotted' | 'double' }
      const points = pen.points.map((p) => [p[0] + dx, p[1] + dy] as [number, number])
      return withRotationAndLink({
        type: 'pen' as const,
        points,
        color: pen.color,
        strokeWidth: pen.strokeWidth,
        isHighlighter: pen.isHighlighter,
        opacity: pen.opacity,
        strokeType: pen.strokeType,
      }, obj)
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
      return withRotationAndLink({
        type: obj.type as 'diamond' | 'star' | 'pentagon' | 'hexagon' | 'octagon' | 'plus' | 'arrow' | 'tab-shape' | 'trapezoid' | 'circle-cross',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        ...(obj.type === 'arrow' && { direction: arr.direction }),
      }, obj)
    }
    case 'parallelogram': {
      const style = shapeStyle(obj)
      const p = obj as { shapeKind?: 'right' | 'left' }
      return withRotationAndLink({
        type: 'parallelogram' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        shapeKind: p.shapeKind ?? 'right',
      }, obj)
    }
    case 'cylinder': {
      const style = shapeStyle(obj)
      const c = obj as { shapeKind?: 'vertical' | 'horizontal' }
      return withRotationAndLink({
        type: 'cylinder' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: style.fillColor,
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth,
        strokeOpacity: style.strokeOpacity,
        strokeStyle: style.strokeStyle,
        opacity: style.opacity,
        shapeKind: c.shapeKind ?? 'vertical',
      }, obj)
    }
    case 'frame':
      return withRotationAndLink({
        type: 'frame' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        title: (obj as { title?: string }).title,
      }, obj)
    case 'image': {
      const img = obj as { url: string }
      return withRotationAndLink({
        type: 'image' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        url: img.url,
      }, obj)
    }
    case 'document': {
      const doc = obj as { url: string; fileName?: string; fileType?: string }
      return withRotationAndLink({
        type: 'document' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        url: doc.url,
        fileName: doc.fileName,
        fileType: doc.fileType,
      }, obj)
    }
    case 'embed': {
      const emb = obj as { url: string; embedType: 'youtube' | 'google-doc' }
      return withRotationAndLink({
        type: 'embed' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        url: emb.url,
        embedType: emb.embedType,
      }, obj)
    }
    case 'link-card': {
      const lc = obj as { url: string; title?: string }
      return withRotationAndLink({
        type: 'link-card' as const,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        url: lc.url,
        title: lc.title,
      }, obj)
    }
    default:
      return null
  }
}
