import { memo, useMemo } from 'react'
import { Rect } from 'react-konva'
import type { ObjectsMap, BoardObject } from '../../types'
import type { Viewport } from './InfiniteCanvas'
import { isResizableType } from './shapes'
import { getObjectBounds } from '../../utils/objectBounds'

const ZOOMED_OUT_THRESHOLD = 0.25

function shouldRenderSimplified(obj: BoardObject, zoomedOut: boolean): boolean {
  if (!zoomedOut) return false
  if (obj.type === 'text' || obj.type === 'pen') return true
  const dims = (obj as { dimensions?: { width: number; height: number } }).dimensions
  const w = dims?.width ?? 100
  const h = dims?.height ?? 100
  return w < 50 || h < 50
}

function getSimplifiedRectProps(obj: BoardObject): { x: number; y: number; width: number; height: number; fill: string } {
  const bounds = getObjectBounds(obj)
  const fill = 'fillColor' in obj && typeof (obj as { fillColor?: string }).fillColor === 'string'
    ? (obj as { fillColor: string }).fillColor
    : 'strokeColor' in obj && typeof (obj as { strokeColor?: string }).strokeColor === 'string'
      ? (obj as { strokeColor: string }).strokeColor
      : '#ccc'
  return {
    x: bounds.left,
    y: bounds.top,
    width: bounds.right - bounds.left || 20,
    height: bounds.bottom - bounds.top || 20,
    fill,
  }
}

/**
 * Check if object is within visible viewport (with padding for smooth scrolling).
 */
function isInViewport(
  obj: BoardObject,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const padding = 300
  const viewLeft = -viewport.x / viewport.scale - padding
  const viewTop = -viewport.y / viewport.scale - padding
  const viewRight = viewLeft + canvasWidth / viewport.scale + padding
  const viewBottom = viewTop + canvasHeight / viewport.scale + padding

  const { left, top, right, bottom } = getObjectBounds(obj)
  return left < viewRight && right > viewLeft && top < viewBottom && bottom > viewTop
}
import {
  RectangleShape,
  CircleShape,
  StickyShape,
  TriangleShape,
  PolygonShape,
  StarShape,
  ArrowShape,
  PlusShape,
  ParallelogramShape,
  CylinderShape,
  TabShape,
  TrapezoidShape,
  CircleCrossShape,
  LineShape,
  TextShape,
  PenShape,
  PenStrokePreview,
  EmojiShape,
  ArrowPreview,
  type CurrentPenStroke,
} from './shapes'

export type ObjectResizeUpdates =
  | { position: { x: number; y: number }; dimensions: { width: number; height: number } }
  | { start: { x: number; y: number }; end: { x: number; y: number } }

interface ObjectLayerProps {
  objects: ObjectsMap
  viewport: Viewport
  canvasWidth: number
  canvasHeight: number
  selectedIds: Set<string>
  isPointerTool: boolean
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onObjectClick: (objectId: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
  onStickyDoubleClick: (objectId: string) => void
  onTextDoubleClick: (objectId: string) => void
  canEdit: boolean
  currentPenStroke?: CurrentPenStroke | null
  arrowPreview?: {
    startX: number
    startY: number
    endX: number
    endY: number
    type: string
  } | null
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function viewportEqual(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale
}

function ObjectLayerInner({
  objects,
  viewport,
  canvasWidth,
  canvasHeight,
  selectedIds,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  onStickyDoubleClick,
  onTextDoubleClick,
  canEdit,
  currentPenStroke,
  arrowPreview,
}: ObjectLayerProps) {
  const sortedObjects = useMemo(
    () =>
      Object.values(objects).sort((a, b) => {
        const aOrder = a.displayOrder ?? a.createdAt?.toMillis?.() ?? 0
        const bOrder = b.displayOrder ?? b.createdAt?.toMillis?.() ?? 0
        return aOrder - bOrder
      }),
    [objects]
  )

  const visibleObjects = useMemo(
    () => sortedObjects.filter((obj) =>
      isInViewport(obj, viewport, canvasWidth, canvasHeight)
    ),
    [sortedObjects, viewport, canvasWidth, canvasHeight]
  )

  const resizable = canEdit && onObjectResizeEnd
  const showEffects = viewport.scale > 0.5
  const isZoomedOut = viewport.scale < ZOOMED_OUT_THRESHOLD

  return (
    <>
      {arrowPreview && (
        <ArrowPreview
          startX={arrowPreview.startX}
          startY={arrowPreview.startY}
          endX={arrowPreview.endX}
          endY={arrowPreview.endY}
          type={arrowPreview.type}
        />
      )}
      {currentPenStroke && currentPenStroke.points.length >= 2 && (
        <PenStrokePreview stroke={currentPenStroke} />
      )}
      {visibleObjects.map((obj) => {
        const selected = selectedIds.has(obj.objectId)
        const resizableForObj = resizable && isResizableType(obj.type)
        if (isZoomedOut && shouldRenderSimplified(obj, isZoomedOut)) {
          const { x, y, width, height, fill } = getSimplifiedRectProps(obj)
          return (
            <Rect
              key={obj.objectId}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={fill}
              listening={false}
              perfectDrawEnabled={false}
            />
          )
        }
        if (obj.type === 'sticky') {
          return (
            <StickyShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              showEffects={showEffects}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
              onStickyDoubleClick={onStickyDoubleClick}
            />
          )
        }
        if (obj.type === 'rectangle') {
          return (
            <RectangleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'circle') {
          return (
            <CircleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'triangle') {
          return (
            <TriangleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'diamond' || obj.type === 'pentagon' || obj.type === 'hexagon' || obj.type === 'octagon') {
          return (
            <PolygonShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'star') {
          return (
            <StarShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'plus') {
          return (
            <PlusShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'parallelogram') {
          return (
            <ParallelogramShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'cylinder') {
          return (
            <CylinderShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'tab-shape') {
          return (
            <TabShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'trapezoid') {
          return (
            <TrapezoidShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'circle-cross') {
          return (
            <CircleCrossShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'arrow') {
          return (
            <ArrowShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'line') {
          return (
            <LineShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
            />
          )
        }
        if (obj.type === 'pen') {
          return (
            <PenShape
              key={obj.objectId}
              obj={obj}
              isPointerTool={isPointerTool}
              onObjectClick={onObjectClick}
            />
          )
        }
        if (obj.type === 'text') {
          return (
            <TextShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizableForObj ? onObjectResizeEnd : undefined}
              onTextDoubleClick={onTextDoubleClick}
            />
          )
        }
        if (obj.type === 'emoji') {
          return (
            <EmojiShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        return null
      })}
    </>
  )
}

function objectLayerPropsEqual(prev: ObjectLayerProps, next: ObjectLayerProps): boolean {
  if (prev.objects !== next.objects) return false
  if (!setsEqual(prev.selectedIds, next.selectedIds)) return false
  if (!viewportEqual(prev.viewport, next.viewport)) return false
  if (prev.canvasWidth !== next.canvasWidth || prev.canvasHeight !== next.canvasHeight) return false
  if (prev.isPointerTool !== next.isPointerTool) return false
  if (prev.canEdit !== next.canEdit) return false
  if (prev.onObjectDragEnd !== next.onObjectDragEnd) return false
  if (prev.onObjectClick !== next.onObjectClick) return false
  if (prev.onObjectResizeEnd !== next.onObjectResizeEnd) return false
  if (prev.onStickyDoubleClick !== next.onStickyDoubleClick) return false
  if (prev.onTextDoubleClick !== next.onTextDoubleClick) return false
  if (prev.currentPenStroke !== next.currentPenStroke) return false
  if (prev.arrowPreview !== next.arrowPreview) return false
  if (
    prev.arrowPreview &&
    next.arrowPreview &&
    (prev.arrowPreview.startX !== next.arrowPreview.startX ||
      prev.arrowPreview.startY !== next.arrowPreview.startY ||
      prev.arrowPreview.endX !== next.arrowPreview.endX ||
      prev.arrowPreview.endY !== next.arrowPreview.endY)
  )
    return false
  return true
}

const ObjectLayer = memo(ObjectLayerInner, objectLayerPropsEqual)

export default ObjectLayer
