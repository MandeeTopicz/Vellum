import { memo, useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { throttle } from '../../utils/throttle'
import { Stage, Layer, Group, Rect, Shape } from 'react-konva'
import type Konva from 'konva'
import { stageToCanvas } from '../../utils/coordinates'
import type { Viewport } from '../../utils/coordinates'

export type { Viewport }

/** Re-export for consumers that need canvasToStage (e.g. overlays) */
export { canvasToStage } from '../../utils/coordinates'

/** Payload from background click: canvas coords (single source of truth) + DOM client coords for fixed overlays */
export interface BackgroundClickPayload {
  x: number
  y: number
  clientX?: number
  clientY?: number
}

const ZOOM_SENSITIVITY = 0.001
const MIN_SCALE = 0.0001 // Prevent zero/negative scale (numerical stability)
const CANVAS_FILL = '#fafafa'
const GRID_SPACING = 20
const GRID_DOT_COLOR = 'rgba(0, 0, 0, 0.12)'
const GRID_DOT_RADIUS = 1

interface DotGridProps {
  width: number
  height: number
  viewport: Viewport
}

/** Light gray dots, 20px spacing. Uses Canvas API in a single Shape for performance (avoids thousands of Circle components). */
function DotGrid({ width, height, viewport }: DotGridProps) {
  return (
    <Shape
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={(context, shape) => {
        const { x: vx, y: vy, scale } = viewport
        const left = -vx / scale - GRID_SPACING
        const top = -vy / scale - GRID_SPACING
        const right = (-vx + width) / scale + GRID_SPACING
        const bottom = (-vy + height) / scale + GRID_SPACING
        const startX = Math.floor(left / GRID_SPACING) * GRID_SPACING
        const startY = Math.floor(top / GRID_SPACING) * GRID_SPACING
        const endX = Math.ceil(right / GRID_SPACING) * GRID_SPACING
        const endY = Math.ceil(bottom / GRID_SPACING) * GRID_SPACING

        context.fillStyle = GRID_DOT_COLOR
        for (let x = startX; x <= endX; x += GRID_SPACING) {
          for (let y = startY; y <= endY; y += GRID_SPACING) {
            context.beginPath()
            context.arc(x, y, GRID_DOT_RADIUS, 0, Math.PI * 2)
            context.fill()
          }
        }
        context.fillStrokeShape(shape)
      }}
    />
  )
}

/** Canvas position for pen/eraser callbacks */
export interface CanvasPosition {
  x: number
  y: number
}

interface InfiniteCanvasProps {
  width: number
  height: number
  viewport: Viewport
  onViewportChange: (v: Viewport, options?: { immediate?: boolean }) => void
  onMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void
  /** Canvas coords (x,y) + clientX/clientY for fixed overlays. Conversion happens ONCE here. */
  onBackgroundClick?: (payload: BackgroundClickPayload) => void
  showGrid?: boolean
  creationToolActive?: boolean
  editingTextOpen?: boolean
  children: React.ReactNode
  cursorLayer: React.ReactNode
  /** Pen or highlighter active: handle draw on mousedown/move/up instead of pan */
  penDrawingActive?: boolean
  /** Eraser active: handle eraser on mousedown/move instead of pan */
  eraserActive?: boolean
  onPenStrokeStart?: (pos: CanvasPosition) => void
  onPenStrokeMove?: (pos: CanvasPosition) => void
  onPenStrokeEnd?: () => void
  onEraserMove?: (pos: CanvasPosition) => void
  /** Cursor override when pen tools active (e.g. crosshair, eraser circle) */
  cursor?: string
  /** Arrow tool active: handle click-and-drag instead of pan */
  arrowToolActive?: boolean
  onArrowDragStart?: (pos: CanvasPosition) => void
  onArrowDragMove?: (pos: CanvasPosition) => void
  onArrowDragEnd?: (pos: CanvasPosition) => void
  /** Called when zoom starts/stops - use to skip heavy work (e.g. cursor sync) during zoom */
  onZoomingChange?: (zooming: boolean) => void
  /** Called when pan starts/stops - use to skip cursor updates during pan */
  onPanningChange?: (panning: boolean) => void
}

function InfiniteCanvas({
  width,
  height,
  viewport,
  onViewportChange,
  onMouseMove,
  onBackgroundClick,
  showGrid = true,
  creationToolActive: _creationToolActive = false,
  editingTextOpen = false,
  children,
  cursorLayer,
  penDrawingActive = false,
  eraserActive = false,
  onPenStrokeStart,
  onPenStrokeMove,
  onPenStrokeEnd,
  onEraserMove,
  cursor,
  arrowToolActive = false,
  onArrowDragStart,
  onArrowDragMove,
  onArrowDragEnd,
  onZoomingChange,
  onPanningChange,
}: InfiniteCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const [isPanning, setIsPanning] = useState(false)
  const [isPenDrawing, setIsPenDrawing] = useState(false)
  const [isEraserDragging, setIsEraserDragging] = useState(false)
  const isPenDrawingRef = useRef(false)
  const isEraserDraggingRef = useRef(false)
  const isArrowDraggingRef = useRef(false)
  const [, setIsArrowDragging] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, scale: 1 })
  const didPanRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)
  const pendingPanRef = useRef<{ dx: number; dy: number } | null>(null)
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const throttledViewportChange = useMemo(
    () => throttle((v: Viewport) => onViewportChange(v), 16),
    [onViewportChange]
  )

  useEffect(
    () => () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
    },
    []
  )

  /** Batch Konva draw calls when viewport changes to avoid redundant redraws */
  useEffect(() => {
    stageRef.current?.batchDraw()
  }, [viewport, width, height])

  const getCanvasPos = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return null
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return stageToCanvas(pos.x, pos.y, viewportRef.current)
  }, [])

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      if (editingTextOpen) return
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      onZoomingChange?.(true)
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
      zoomTimeoutRef.current = setTimeout(() => {
        zoomTimeoutRef.current = null
        onZoomingChange?.(false)
      }, 200)

      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const scaleBy = 1 - e.evt.deltaY * ZOOM_SENSITIVITY
      const newScale = Math.max(MIN_SCALE, viewport.scale * scaleBy)

      // Zoom centered on mouse cursor: keep point under cursor fixed
      const mousePointTo = {
        x: (pointer.x - viewport.x) / viewport.scale,
        y: (pointer.y - viewport.y) / viewport.scale,
      }
      const newX = pointer.x - mousePointTo.x * newScale
      const newY = pointer.y - mousePointTo.y * newScale

      throttledViewportChange({
        x: newX,
        y: newY,
        scale: newScale,
      })
    },
    [viewport, throttledViewportChange, editingTextOpen, onZoomingChange]
  )

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (editingTextOpen) {
        didPanRef.current = false
        return
      }
      const target = e.target
      const targetName = target.name()
      const isBackground = targetName === 'background' || targetName === 'stageFill' || target === target.getStage()
      if (!isBackground) return
      const canvasPos = getCanvasPos()
      if (!canvasPos) return
      if (penDrawingActive && onPenStrokeStart) {
        isPenDrawingRef.current = true
        setIsPenDrawing(true)
        onPenStrokeStart(canvasPos)
        return
      }
      if (eraserActive && onEraserMove) {
        isEraserDraggingRef.current = true
        setIsEraserDragging(true)
        onEraserMove(canvasPos)
        return
      }
      if (arrowToolActive && onArrowDragStart) {
        isArrowDraggingRef.current = true
        setIsArrowDragging(true)
        onArrowDragStart(canvasPos)
        return
      }
      const stage = stageRef.current
      if (stage) {
        const pos = stage.getPointerPosition()
        if (pos) {
          setIsPanning(true)
          onPanningChange?.(true)
          didPanRef.current = false
          pendingPanRef.current = null
          panStartRef.current = { x: pos.x, y: pos.y, vx: viewport.x, vy: viewport.y, scale: viewport.scale }
        }
      }
    },
    [viewport, editingTextOpen, penDrawingActive, eraserActive, arrowToolActive, onPenStrokeStart, onEraserMove, onArrowDragStart, onPanningChange, getCanvasPos]
  )

  const handleMouseMovePan = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isPanning) return
      didPanRef.current = true
      const stage = stageRef.current
      if (!stage) return
      const pos = stage.getPointerPosition()
      if (!pos) return
      const { x: startX, y: startY } = panStartRef.current
      const dx = pos.x - startX
      const dy = pos.y - startY
      pendingPanRef.current = { dx, dy }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          const pending = pendingPanRef.current
          if (!pending) return
          const { vx, vy, scale } = panStartRef.current
          onViewportChange({
            x: vx + pending.dx,
            y: vy + pending.dy,
            scale,
          })
        })
      }
    },
    [isPanning, onViewportChange]
  )

  const handleMouseUp = useCallback(() => {
    if (isArrowDraggingRef.current && onArrowDragEnd) {
      isArrowDraggingRef.current = false
      setIsArrowDragging(false)
      const pos = getCanvasPos()
      if (pos) onArrowDragEnd(pos)
      return
    }
    if (isPenDrawingRef.current) {
      isPenDrawingRef.current = false
      setIsPenDrawing(false)
      onPenStrokeEnd?.()
      return
    }
    if (isEraserDraggingRef.current) {
      isEraserDraggingRef.current = false
      setIsEraserDragging(false)
      return
    }
    if (isPanning) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      const pending = pendingPanRef.current
      if (pending) {
        const { vx, vy, scale } = panStartRef.current
        onViewportChange({ x: vx + pending.dx, y: vy + pending.dy, scale }, { immediate: true })
      }
      setIsPanning(false)
      onPanningChange?.(false)
    }
  }, [isPanning, isPenDrawing, isEraserDragging, onViewportChange, onPenStrokeEnd, onArrowDragEnd, onPanningChange, getCanvasPos])

  const combinedMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const canvasPos = getCanvasPos()
      if (isArrowDraggingRef.current && canvasPos && onArrowDragMove) {
        onArrowDragMove(canvasPos)
        return
      }
      if (isPenDrawingRef.current && canvasPos && onPenStrokeMove) {
        onPenStrokeMove(canvasPos)
        return
      }
      if (isEraserDraggingRef.current && canvasPos && onEraserMove) {
        onEraserMove(canvasPos)
        return
      }
      handleMouseMovePan(e)
      if (!isPanning) onMouseMove?.(e)
    },
    [handleMouseMovePan, onMouseMove, isPanning, onPenStrokeMove, onEraserMove, onArrowDragMove, getCanvasPos]
  )

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (didPanRef.current) return
      const target = e.target
      const targetName = target.name()
      const isBackground = targetName === 'background' || targetName === 'stageFill' || target === target.getStage()
      if (isBackground && onBackgroundClick) {
        const stage = stageRef.current
        if (stage) {
          const pos = stage.getPointerPosition()
          if (pos) {
            const canvas = stageToCanvas(pos.x, pos.y, viewportRef.current)
            const evt = e.evt as MouseEvent
            onBackgroundClick({
              x: canvas.x,
              y: canvas.y,
              clientX: evt.clientX,
              clientY: evt.clientY,
            })
          }
        }
      }
    },
    [onBackgroundClick]
  )

  const result = (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={combinedMouseMove}
      onClick={handleClick}
      style={{
        cursor: cursor ?? (isPanning ? 'grabbing' : 'grab'),
        background: CANVAS_FILL,
      }}
    >
      <Layer listening={true}>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={CANVAS_FILL}
          listening={true}
          name="stageFill"
        />
        <Group
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          draggable={false}
        >
          <Rect
            x={-5000}
            y={-5000}
            width={20000}
            height={20000}
            fill={CANVAS_FILL}
            listening={true}
            name="background"
          />
          {showGrid && <DotGrid width={width} height={height} viewport={viewport} />}
          {children}
        </Group>
      </Layer>
      {cursorLayer}
    </Stage>
  )
  return result
}

export default memo(InfiniteCanvas)
