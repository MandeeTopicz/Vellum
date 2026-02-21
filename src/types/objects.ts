import type { Timestamp } from 'firebase/firestore'

/** Text styling for sticky notes and any text-bearing elements */
export interface TextStyle {
  fontFamily: string
  fontSize: number
  fontColor: string
  bold: boolean
  italic: boolean
  underline: boolean
  textAlign: 'left' | 'center' | 'right'
  /** Render content as bullet list (split by newlines, prefix with bullets) */
  bulletList?: boolean
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontColor: '#1a1a1a',
  bold: false,
  italic: false,
  underline: false,
  textAlign: 'left',
}

/** Point in 2D canvas space */
export interface Point {
  x: number
  y: number
}

/** Common fields for all board objects */
export interface BoardObjectBase {
  objectId: string
  type: BoardObjectType
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Z-order; higher = on top. If absent, sort by createdAt. */
  displayOrder?: number
  /** Clickable URL; Cmd/Ctrl+click opens. Only http(s)/mailto allowed. */
  linkUrl?: string | null
}

export type BoardObjectType =
  | 'sticky'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'diamond'
  | 'star'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'arrow'
  | 'plus'
  | 'parallelogram'
  | 'cylinder'
  | 'tab-shape'
  | 'trapezoid'
  | 'circle-cross'
  | 'text'
  | 'pen'
  | 'emoji'
  | 'frame'

/** Frame container: groups children with relative coordinates. Renders behind other objects. */
export interface FrameObject extends BoardObjectBase, RotatableFields {
  type: 'frame'
  position: Point
  dimensions: { width: number; height: number }
  title?: string
}

/** Nesting: parentId = null for top-level, else frame id. localX/localY are relative to parent or world. */
export interface NestableFields {
  parentId?: string | null
  localX?: number
  localY?: number
}

/** Rotation in degrees [0, 360). Rotates around object center. */
export interface RotatableFields {
  rotation?: number
}

/** Sticky note: resizable, editable text, fill + text styling */
export interface StickyObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'sticky'
  position: Point
  dimensions: { width: number; height: number }
  content: string
  fillColor: string
  textStyle: TextStyle
  opacity?: number
  /** Rounded corner radius (default 12) for template styling */
  cornerRadius?: number
}

/** Base shape styling (black border, transparent fill by default) */
export const DEFAULT_STROKE_COLOR = '#000000'
export const DEFAULT_FILL_COLOR = 'transparent'

/** Stroke style for shape borders */
export type ShapeStrokeStyle = 'solid' | 'dashed' | 'dotted'

/** Rectangle shape */
export interface RectangleObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'rectangle'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeOpacity?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  /** Rounded corner radius (default 12) for template styling */
  cornerRadius?: number
}

/** Circle/ellipse: dimensions = width & height */
export interface CircleObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'circle'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeOpacity?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Triangle: position + dimensions; inverted = point down */
export interface TriangleObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'triangle'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  /** Point-up (default) or point-down */
  inverted?: boolean
}

/** Polygon shape (diamond, pentagon, hexagon, octagon): position + dimensions */
export interface PolygonObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'diamond' | 'pentagon' | 'hexagon' | 'octagon'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Star shape: position + dimensions */
export interface StarObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'star'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Arrow shape: position + dimensions; direction = 'right' | 'left' */
export interface ArrowObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'arrow'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  direction?: 'right' | 'left'
}

/** Plus/cross shape */
export interface PlusObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'plus'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Parallelogram: shapeKind = 'right' | 'left' */
export interface ParallelogramObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'parallelogram'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  shapeKind: 'right' | 'left'
}

/** Cylinder: shapeKind = 'vertical' | 'horizontal' */
export interface CylinderObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'cylinder'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  shapeKind: 'vertical' | 'horizontal'
}

/** Tab (document tab) shape */
export interface TabShapeObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'tab-shape'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Trapezoid shape */
export interface TrapezoidObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'trapezoid'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Circle with cross (flowchart decision) */
export interface CircleCrossObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'circle-cross'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
}

/** Connection arrow variant */
export type ConnectionType = 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double'

/** Line or connection arrow: start and end points */
export interface LineObject extends BoardObjectBase {
  type: 'line'
  start: Point
  end: Point
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: ShapeStrokeStyle
  opacity?: number
  /** Arrow style for connection tools; default 'line' = plain line */
  connectionType?: ConnectionType
}

/** Stroke style for pen objects */
export type PenStrokeType = 'solid' | 'dotted' | 'double'

/** Freehand pen stroke: array of [x, y] points */
export interface PenObject extends BoardObjectBase {
  type: 'pen'
  points: [number, number][]
  color: string
  strokeWidth: number
  isHighlighter: boolean
  opacity?: number
  strokeType?: PenStrokeType
}

/** Text box: editable text */
export interface TextObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'text'
  position: Point
  dimensions: { width: number; height: number }
  content: string
  textStyle: TextStyle
}

/** Emoji/sticker placed on canvas */
export interface EmojiObject extends BoardObjectBase, NestableFields, RotatableFields {
  type: 'emoji'
  position: Point
  emoji: string
  fontSize?: number
}

export type BoardObject =
  | StickyObject
  | FrameObject
  | RectangleObject
  | CircleObject
  | TriangleObject
  | LineObject
  | PolygonObject
  | StarObject
  | ArrowObject
  | PlusObject
  | ParallelogramObject
  | CylinderObject
  | TabShapeObject
  | TrapezoidObject
  | CircleCrossObject
  | TextObject
  | PenObject
  | EmojiObject

/** Normalized client state: objectId -> object */
export type ObjectsMap = Record<string, BoardObject>

/** Default dimensions for new shapes (before resize) */
export const DEFAULT_SHAPE_SIZE = { width: 120, height: 80 }
export const DEFAULT_STICKY_SIZE = { width: 200, height: 160 }
export const DEFAULT_LINE_LENGTH = 100
