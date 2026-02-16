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
}

export type BoardObjectType = 'sticky' | 'rectangle' | 'circle' | 'triangle' | 'line'

/** Sticky note: resizable, editable text, fill + text styling */
export interface StickyObject extends BoardObjectBase {
  type: 'sticky'
  position: Point
  dimensions: { width: number; height: number }
  content: string
  fillColor: string
  textStyle: TextStyle
}

/** Rectangle shape */
export interface RectangleObject extends BoardObjectBase {
  type: 'rectangle'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
}

/** Circle/ellipse: dimensions = width & height (radius = min/2 for circle) */
export interface CircleObject extends BoardObjectBase {
  type: 'circle'
  position: Point
  dimensions: { width: number; height: number }
  fillColor: string
}

/** Triangle: 3 points in canvas space */
export interface TriangleObject extends BoardObjectBase {
  type: 'triangle'
  points: [Point, Point, Point]
  fillColor: string
}

/** Straight line: start and end points */
export interface LineObject extends BoardObjectBase {
  type: 'line'
  start: Point
  end: Point
  strokeColor: string
  strokeWidth?: number
}

export type BoardObject =
  | StickyObject
  | RectangleObject
  | CircleObject
  | TriangleObject
  | LineObject

/** Normalized client state: objectId -> object */
export type ObjectsMap = Record<string, BoardObject>

/** Default dimensions for new shapes (before resize) */
export const DEFAULT_SHAPE_SIZE = { width: 120, height: 80 }
export const DEFAULT_STICKY_SIZE = { width: 200, height: 160 }
export const DEFAULT_LINE_LENGTH = 100
