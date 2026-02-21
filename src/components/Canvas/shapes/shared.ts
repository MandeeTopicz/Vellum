/**
 * Shared utilities and types for canvas shape components.
 * Used by all shape components in ObjectLayer.
 */
import { useEffect } from 'react'
import type Konva from 'konva'
import type { Viewport } from '../InfiniteCanvas'
import { stageToCanvas } from '../../../utils/coordinates'

export type ObjectResizeUpdates =
  | { position: { x: number; y: number }; dimensions: { width: number; height: number }; rotation?: number }
  | { start: { x: number; y: number }; end: { x: number; y: number } }

/** Minimum dimensions when resizing shapes */
export const MIN_SIZE = 20
/** Minimum line selection box size - larger than MIN_SIZE for easier resizing at 100% zoom */
export const MIN_LINE_HIT = 36

/** Object types that support resize via Transformer */
export const RESIZABLE_TYPES = new Set([
  'sticky', 'rectangle', 'circle', 'triangle', 'line', 'diamond', 'star',
  'pentagon', 'hexagon', 'octagon', 'arrow', 'plus', 'parallelogram',
  'cylinder', 'tab-shape', 'trapezoid', 'circle-cross', 'text', 'frame',
])

export function isResizableType(type: string): boolean {
  return RESIZABLE_TYPES.has(type)
}

/** Base props shared by all position-based shape components */
export interface BaseShapeProps {
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  /** When false, disable shadows/effects for performance when zoomed out */
  showEffects?: boolean
  /** Override position for rendering (e.g. resolved world coords when nested in frame) */
  displayPosition?: { x: number; y: number }
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onObjectClick: (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
}

/**
 * Returns common Konva Group props for drag/click handling.
 * Used by all draggable shape components.
 */
export function shapeHandlers(
  objectId: string,
  viewport: Viewport,
  canEdit: boolean,
  selected: boolean,
  onObjectDragEnd: (objectId: string, x: number, y: number) => void,
  onObjectClick: (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }) => void,
  isPointerTool: boolean
) {
  return {
    listening: isPointerTool && (selected || canEdit),
    draggable: canEdit && isPointerTool && selected,
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
      onObjectDragEnd(objectId, canvasPos.x, canvasPos.y)
      node.position({ x: canvasPos.x, y: canvasPos.y })
    },
    onClick: (e: { evt: MouseEvent }) => onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey, metaKey: e.evt.metaKey }),
  }
}

/** Bound box function for Transformer - prevents resizing below MIN_SIZE */
export function boundBoxFunc(
  oldBox: { x: number; y: number; width: number; height: number; rotation: number },
  newBox: { x: number; y: number; width: number; height: number; rotation: number }
) {
  if (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE) {
    return oldBox
  }
  return newBox
}

/**
 * Attaches Transformer to shape node when selected.
 * Call from useEffect in shape components.
 */
export function useShapeTransform(
  selected: boolean,
  hasResizeHandler: boolean,
  trRef: React.RefObject<Konva.Transformer | null>,
  shapeRef: React.RefObject<Konva.Group | null>
) {
  useEffect(() => {
    if (selected && hasResizeHandler && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, hasResizeHandler, trRef, shapeRef])
}
