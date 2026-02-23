/**
 * Shared utilities and types for canvas shape components.
 * Used by all shape components in ObjectLayer.
 */
import React, { useEffect } from 'react'
import type { BoardObject } from '../../../types'
import type Konva from 'konva'
import type { Viewport } from '../InfiniteCanvas'
import { stageToCanvas } from '../../../utils/coordinates'

export type ObjectResizeUpdates =
  | { position: { x: number; y: number }; dimensions: { width: number; height: number }; rotation?: number }
  | { start: { x: number; y: number }; end: { x: number; y: number } }
  | { points: [number, number][] }

/** Minimum dimensions when resizing shapes */
export const MIN_SIZE = 20
/** Minimum line selection box size - larger than MIN_SIZE for easier resizing at 100% zoom */
export const MIN_LINE_HIT = 36

/** Object types that support resize via Transformer */
export const RESIZABLE_TYPES = new Set([
  'sticky', 'rectangle', 'circle', 'triangle', 'line', 'diamond', 'star',
  'pentagon', 'hexagon', 'octagon', 'arrow', 'plus', 'parallelogram',
  'cylinder', 'tab-shape', 'trapezoid', 'circle-cross', 'text', 'frame', 'pen',
  'image', 'document', 'embed', 'link-card',
])

export function isResizableType(type: string): boolean {
  return RESIZABLE_TYPES.has(type)
}

/** Start positions for multi-drag (shared ref so all shapes read/write same data) */
export type MultiDragStartPositions = Record<string, { x: number; y: number }>


/** Live positions during multi-drag (React state, so props stay in sync and shapes don't shift) */
export type MultiDragPositions = Record<string, { x: number; y: number }>

/** Base props shared by all position-based shape components. viewportRef avoids re-renders on pan/zoom. */
export interface BaseShapeProps {
  viewportRef: React.MutableRefObject<Viewport>
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  /** When true, objects do not listen so selection rect/lasso pass through */
  isSelecting?: boolean
  /** When false, disable shadows/effects for performance when zoomed out */
  showEffects?: boolean
  /** Override position for rendering (e.g. resolved world coords when nested in frame) */
  displayPosition?: { x: number; y: number }
  /** When set, enables real-time multi-drag: all selected move together during drag */
  selectedIds?: Set<string>
  /** Ref to store start positions during multi-drag; shared across shapes */
  multiDragStartPositionsRef?: React.MutableRefObject<MultiDragStartPositions | null>
  /** Ref to store pointer pos at drag start (unified delta) */
  multiDragStartPointerRef?: React.MutableRefObject<{ x: number; y: number } | null>
  /** Live positions during multi-drag - shapes use these for x,y to avoid React overwriting imperative updates */
  multiDragPositions?: MultiDragPositions | null
  /** Per-object drag preview - only this object's position during multi-drag; avoids re-rendering non-dragged objects */
  dragPreviewPosition?: { x: number; y: number } | null
  /** Called on drag start to set initial live positions */
  onMultiDragStart?: (positions: MultiDragPositions) => void
  /** Called on drag move to update live positions (state-driven, preserves relative layout) */
  onMultiDragMove?: (positions: MultiDragPositions) => void
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onObjectDragStart?: () => void
  onObjectClick: (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }, canvasPos?: { x: number; y: number }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
  /** When connector tool active: report hover for anchor dots */
  connectorToolActive?: boolean
  onConnectorHover?: (objectId: string | null) => void
  /** When true, block pointer events so pen stroke is not interrupted when drawing over objects */
  isPenStrokeActive?: boolean
}

/** Props that affect shape rendering for memo comparison. viewport excluded — use viewportRef, refs don't trigger re-renders. */
interface MemoCompareProps {
  obj: BoardObject
  selected: boolean
  showEffects?: boolean
  displayPosition?: { x: number; y: number } | null
  multiDragPositions?: MultiDragPositions | null
  dragPreviewPosition?: { x: number; y: number } | null
  multiDragLineEndpoints?: Record<string, { start?: { x: number; y: number }; end?: { x: number; y: number } }> | null
}

/**
 * Custom comparator for React.memo on shape components.
 * Skips re-render when obj, selected, viewport, and other render-affecting props are unchanged.
 */
export function areShapePropsEqual<P extends MemoCompareProps>(prev: P, next: P): boolean {
  if (prev.obj !== next.obj) return false
  if (prev.selected !== next.selected) return false
  if (prev.showEffects !== next.showEffects) return false
  if (prev.displayPosition !== next.displayPosition) {
    if (!prev.displayPosition || !next.displayPosition) return false
    if (prev.displayPosition.x !== next.displayPosition?.x || prev.displayPosition.y !== next.displayPosition?.y)
      return false
  }
  if (prev.dragPreviewPosition !== next.dragPreviewPosition) return false
  if (prev.multiDragLineEndpoints !== next.multiDragLineEndpoints) return false
  return true
}

const OBJ_NAME_PREFIX = 'obj-'

/**
 * Returns common Konva Group props for drag/click handling.
 * Used by all draggable shape components.
 * When selectedIds has > 1 item, adds onDragStart/onDragMove so all selected objects move together in real time.
 */
export function shapeHandlers(
  objectId: string,
  viewportRef: React.MutableRefObject<Viewport>,
  canEdit: boolean,
  selected: boolean,
  onObjectDragEnd: (objectId: string, x: number, y: number) => void,
  onObjectClick: (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }, canvasPos?: { x: number; y: number }) => void,
  isPointerTool: boolean,
  isSelecting?: boolean,
  options?: {
    onObjectDragStart?: () => void
    selectedIds?: Set<string>
    multiDragStartPositionsRef?: React.MutableRefObject<MultiDragStartPositions | null>
    /** When provided, delta computed from pointer (unified delta) instead of dragged node */
    multiDragStartPointerRef?: React.MutableRefObject<{ x: number; y: number } | null>
    onMultiDragStart?: (positions: MultiDragPositions) => void
    onMultiDragMove?: (positions: MultiDragPositions) => void
    connectorToolActive?: boolean
    onConnectorHover?: (objectId: string | null) => void
    /** When true, block pointer events so pen stroke is not interrupted when drawing over objects */
    isPenStrokeActive?: boolean
  }
): Record<string, unknown> {
  const onObjectDragStart = options?.onObjectDragStart
  const selectedIds = options?.selectedIds
  const multiDragRef = options?.multiDragStartPositionsRef
  const pointerRef = options?.multiDragStartPointerRef
  const onMultiDragStart = options?.onMultiDragStart
  const onMultiDragMove = options?.onMultiDragMove
  const connectorToolActive = options?.connectorToolActive
  const onConnectorHover = options?.onConnectorHover
  const isPenStrokeActive = options?.isPenStrokeActive ?? false
  const isMultiDrag = Boolean(
    selectedIds && selectedIds.size > 1 && multiDragRef && selectedIds.has(objectId) && onMultiDragStart && onMultiDragMove
  )

  const base: Record<string, unknown> = {
    name: `${OBJ_NAME_PREFIX}${objectId}`,
    listening: !isSelecting && !isPenStrokeActive && (isPointerTool || connectorToolActive) && (selected || canEdit),
    draggable: canEdit && isPointerTool && selected,
    ...(onObjectDragStart && {
      onDragStart: () => {
        onObjectDragStart()
      },
    }),
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
      onObjectDragEnd(objectId, canvasPos.x, canvasPos.y)
      node.position({ x: canvasPos.x, y: canvasPos.y })
    },
    onClick: (e: { evt: MouseEvent; target: Konva.Node }) => {
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      const canvasPos = pos ? stageToCanvas(pos.x, pos.y, viewportRef.current) : undefined
      onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey, metaKey: e.evt.metaKey }, canvasPos)
    },
    ...(connectorToolActive && onConnectorHover && {
      onMouseEnter: () => onConnectorHover(objectId),
      onMouseLeave: () => onConnectorHover(null),
    }),
  }

  if (!isMultiDrag) return base

  base.onDragStart = (e: { target: Konva.Node }) => {
    onObjectDragStart?.()
    const layer = e.target.getLayer()
    if (!layer || !selectedIds || !multiDragRef || !onMultiDragStart) return
    const positions: MultiDragStartPositions = {}
    for (const id of selectedIds) {
      const nodes = layer.find((n: Konva.Node) => n.name() === `${OBJ_NAME_PREFIX}${id}`)
      const node = nodes[0] as Konva.Node | undefined
      if (node) {
        const abs = node.getAbsolutePosition()
        const canvas = stageToCanvas(abs.x, abs.y, viewportRef.current)
        positions[id] = { x: canvas.x, y: canvas.y }
      }
    }
    multiDragRef.current = positions
    if (pointerRef) {
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (pos) pointerRef.current = stageToCanvas(pos.x, pos.y, viewportRef.current)
      else pointerRef.current = null
    }
    onMultiDragStart(positions)
  }

  base.onDragMove = (e: { target: Konva.Node }) => {
    const start = multiDragRef?.current
    if (!start || !selectedIds || !onMultiDragMove || e.target.name() !== `${OBJ_NAME_PREFIX}${objectId}`) return
    let dx: number
    let dy: number
    if (pointerRef?.current) {
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!pos) return
      const currentCanvas = stageToCanvas(pos.x, pos.y, viewportRef.current)
      dx = currentCanvas.x - pointerRef.current.x
      dy = currentCanvas.y - pointerRef.current.y
    } else {
      const abs = e.target.getAbsolutePosition()
      const draggedCanvas = stageToCanvas(abs.x, abs.y, viewportRef.current)
      const startPos = start[objectId]
      if (!startPos) return
      dx = draggedCanvas.x - startPos.x
      dy = draggedCanvas.y - startPos.y
    }
    const positions: MultiDragPositions = {}
    for (const id of selectedIds) {
      const startForId = start[id]
      if (startForId) {
        positions[id] = { x: startForId.x + dx, y: startForId.y + dy }
      }
    }
    onMultiDragMove(positions)
  }

  return base
}

/** Snapshot captured at resize start for correct delta-based resize (avoids accumulation bug) */
export interface ResizeSnapshot {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Computes new bounds from snapshot + total pointer delta.
 * Each handle direction uses snapshot as origin, never accumulated state.
 * @param snapshot - Original bounds at resize start (canvas coords)
 * @param totalDx - Total pointer delta X from start to now (canvas coords)
 * @param totalDy - Total pointer delta Y from start to now (canvas coords)
 * @param anchor - Konva Transformer anchor name (e.g. 'bottom-right')
 * @param shiftKey - When true, lock aspect ratio (use min scale)
 */
export function computeNewBoundsFromSnapshot(
  snapshot: ResizeSnapshot,
  totalDx: number,
  totalDy: number,
  anchor: string | null,
  shiftKey: boolean
): ResizeSnapshot {
  const { left, top, width, height } = snapshot
  const right = left + width
  const bottom = top + height

  let newLeft = left
  let newTop = top
  let newRight = right
  let newBottom = bottom

  switch (anchor) {
    case 'top-left':
      newLeft = left + totalDx
      newTop = top + totalDy
      newRight = right
      newBottom = bottom
      break
    case 'top-center':
      newTop = top + totalDy
      newBottom = bottom
      break
    case 'top-right':
      newTop = top + totalDy
      newRight = right + totalDx
      newBottom = bottom
      break
    case 'middle-left':
      newLeft = left + totalDx
      newRight = right
      break
    case 'middle-right':
      newRight = right + totalDx
      break
    case 'bottom-left':
      newLeft = left + totalDx
      newRight = right
      newBottom = bottom + totalDy
      break
    case 'bottom-center':
      newBottom = bottom + totalDy
      break
    case 'bottom-right':
      newRight = right + totalDx
      newBottom = bottom + totalDy
      break
    default:
      newRight = right + totalDx
      newBottom = bottom + totalDy
  }

  let newWidth = newRight - newLeft
  let newHeight = newBottom - newTop

  if (shiftKey && anchor && !anchor.includes('-center')) {
    const scaleX = newWidth / width || 1
    const scaleY = newHeight / height || 1
    const scale = Math.min(scaleX, scaleY)
    newWidth = Math.max(MIN_SIZE, width * scale)
    newHeight = Math.max(MIN_SIZE, height * scale)
    if (anchor.includes('left')) newLeft = newRight - newWidth
    if (anchor.includes('top')) newTop = newBottom - newHeight
  }

  newWidth = Math.max(MIN_SIZE, newWidth)
  newHeight = Math.max(MIN_SIZE, newHeight)

  return {
    left: newLeft,
    top: newTop,
    width: newWidth,
    height: newHeight,
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
