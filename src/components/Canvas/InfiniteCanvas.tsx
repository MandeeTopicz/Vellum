import { memo, useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { throttle } from '../../utils/throttle'
import { Stage, Layer, Group, Rect, Shape, Line } from 'react-konva'
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
const MIN_SCALE = 0.1 // Don't allow zooming out past 10% (prevents lag)
const MAX_SCALE = 5.0
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
  onPenStrokeEnd?: (finalPos?: CanvasPosition) => void
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
  /** Called on right-click anywhere on the canvas; clientX/clientY for fixed-position menu */
  onContextMenu?: (payload: { clientX: number; clientY: number }) => void
  /** Called when right-click drag or Shift+drag selection box completes; rect in canvas coords */
  onSelectionBoxEnd?: (rect: { left: number; top: number; right: number; bottom: number }) => void
  /** Lasso tool active: draw freehand selection path */
  lassoToolActive?: boolean
  /** Called when lasso path is complete; polygon in canvas coords */
  onLassoEnd?: (polygon: { x: number; y: number }[]) => void
  /** Called when right-click drag or lasso selection starts */
  onSelectionStart?: () => void
  /** Called when right-click drag or lasso selection ends */
  onSelectionEnd?: () => void
  /** Active pen stroke rendered last in main layer so it paints above all objects (avoids cross-layer compositing) */
  activePenStrokeOverlay?: React.ReactNode
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
  onContextMenu,
  onSelectionBoxEnd,
  lassoToolActive = false,
  onLassoEnd,
  onSelectionStart,
  onSelectionEnd,
  activePenStrokeOverlay,
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
  const pendingWheelRef = useRef<{ deltaY: number; clientX: number; clientY: number } | null>(null)
  const zoomRafRef = useRef<number | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  const isRightDragSelectingRef = useRef(false)
  const selectionBoxRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null)
  /** 'right' = right-click drag, 'shift' = Shift+left-drag (for trackpad / no right-click) */
  const selectionBoxTriggerRef = useRef<'right' | 'shift'>(null!)
  const selectionDocListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null)

  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([])
  const [lassoClosed, setLassoClosed] = useState(false)
  const isDrawingLassoRef = useRef(false)
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([])
  const lassoDocListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null)
  const penDocListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null)

  const throttledViewportChange = useMemo(
    () => throttle((v: Viewport) => onViewportChange(v), 16),
    [onViewportChange]
  )

  useEffect(
    () => () => {
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current)
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
      if (selectionDocListenersRef.current) {
        document.removeEventListener('mousemove', selectionDocListenersRef.current.move)
        document.removeEventListener('mouseup', selectionDocListenersRef.current.up)
        selectionDocListenersRef.current = null
      }
      if (lassoDocListenersRef.current) {
        document.removeEventListener('mousemove', lassoDocListenersRef.current.move)
        document.removeEventListener('mouseup', lassoDocListenersRef.current.up)
        lassoDocListenersRef.current = null
      }
      if (penDocListenersRef.current) {
        document.removeEventListener('mousemove', penDocListenersRef.current.move)
        document.removeEventListener('mouseup', penDocListenersRef.current.up)
        penDocListenersRef.current = null
      }
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

  /**
   * Convert DOM client coords to canvas coords. Used during right-drag selection
   * so we keep tracking when the pointer leaves the stage (getPointerPosition returns null).
   */
  const clientToCanvas = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const stage = stageRef.current
    if (!stage) return null
    const container = stage.container()
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const stageX = clientX - rect.left
    const stageY = clientY - rect.top
    return stageToCanvas(stageX, stageY, viewportRef.current)
  }, [])

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      if (editingTextOpen) return
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      pendingWheelRef.current = {
        deltaY: e.evt.deltaY,
        clientX: e.evt.clientX,
        clientY: e.evt.clientY,
      }

      if (!zoomRafRef.current) {
        zoomRafRef.current = requestAnimationFrame(() => {
          zoomRafRef.current = null
          const evt = pendingWheelRef.current
          if (!evt) return
          pendingWheelRef.current = null

          const stageInRaf = stageRef.current
          if (!stageInRaf) return

          onZoomingChange?.(true)
          if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
          zoomTimeoutRef.current = setTimeout(() => {
            zoomTimeoutRef.current = null
            onZoomingChange?.(false)
          }, 200)

          const container = stageInRaf.container()
          if (!container) return
          const rect = container.getBoundingClientRect()
          const pointer = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top,
          }

          const vp = viewportRef.current
          const scaleBy = 1 - evt.deltaY * ZOOM_SENSITIVITY
          const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * scaleBy))
          const mousePointTo = {
            x: (pointer.x - vp.x) / vp.scale,
            y: (pointer.y - vp.y) / vp.scale,
          }
          const newX = pointer.x - mousePointTo.x * newScale
          const newY = pointer.y - mousePointTo.y * newScale

          throttledViewportChange({
            x: newX,
            y: newY,
            scale: newScale,
          })
        })
      }
    },
    [throttledViewportChange, editingTextOpen, onZoomingChange]
  )

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isPenOrEraser = (penDrawingActive || eraserActive) && e.evt.button === 0
      const isRightClick = e.evt.button === 2
      const isLassoLeft = lassoToolActive && e.evt.button === 0
      const canvasPos = getCanvasPos()

      if (isPenOrEraser) {
        e.evt.preventDefault()
        e.evt.stopPropagation()
        if ('cancelBubble' in e.evt) (e.evt as { cancelBubble?: boolean }).cancelBubble = true
        if (e.cancelBubble !== undefined) e.cancelBubble = true
        if (canvasPos && penDrawingActive && onPenStrokeStart) {
          isPenDrawingRef.current = true
          setIsPenDrawing(true)
          onPenStrokeStart(canvasPos)

          const docMove = (evt: MouseEvent) => {
            const pos = clientToCanvas(evt.clientX, evt.clientY)
            if (pos && isPenDrawingRef.current && onPenStrokeMove) {
              onPenStrokeMove(pos)
            }
          }
          const docUp = (evt: MouseEvent) => {
            evt.preventDefault()
            if (penDocListenersRef.current) {
              document.removeEventListener('mousemove', penDocListenersRef.current.move)
              document.removeEventListener('mouseup', penDocListenersRef.current.up)
              penDocListenersRef.current = null
            }
            isPenDrawingRef.current = false
            setIsPenDrawing(false)
            const finalPos = clientToCanvas(evt.clientX, evt.clientY)
            onPenStrokeEnd?.(finalPos ?? undefined)
          }
          const listeners = { move: docMove, up: docUp }
          penDocListenersRef.current = listeners
          document.addEventListener('mousemove', docMove)
          document.addEventListener('mouseup', docUp)
          return
        }
        if (canvasPos && eraserActive && onEraserMove) {
          isEraserDraggingRef.current = true
          setIsEraserDragging(true)
          onEraserMove(canvasPos)
          return
        }
      }

      if ((isRightClick || isLassoLeft) && canvasPos) {
        const isShiftLeftDrag = e.evt.button === 0 && e.evt.shiftKey
        const startSelectionBox = (isRightClick || isShiftLeftDrag) && onSelectionBoxEnd
        const startLasso = isLassoLeft && !isShiftLeftDrag && onLassoEnd

        if (startLasso) {
          e.evt.preventDefault()
          e.evt.stopPropagation()
          if ('cancelBubble' in e.evt) (e.evt as { cancelBubble?: boolean }).cancelBubble = true
          if (e.cancelBubble !== undefined) e.cancelBubble = true
          onSelectionStart?.()
          isDrawingLassoRef.current = true
          const pts = [{ x: canvasPos.x, y: canvasPos.y }]
          lassoPointsRef.current = pts
          setLassoPoints(pts)

          const docMove = (evt: MouseEvent) => {
            const pos = clientToCanvas(evt.clientX, evt.clientY)
            if (pos && isDrawingLassoRef.current) {
              lassoPointsRef.current = [...lassoPointsRef.current, { x: pos.x, y: pos.y }]
              setLassoPoints(lassoPointsRef.current)
            }
          }
          const docUp = (evt: MouseEvent) => {
            evt.preventDefault()
            if (lassoDocListenersRef.current) {
              document.removeEventListener('mousemove', lassoDocListenersRef.current.move)
              document.removeEventListener('mouseup', lassoDocListenersRef.current.up)
              lassoDocListenersRef.current = null
            }
            isDrawingLassoRef.current = false
            const pts = lassoPointsRef.current
            if (pts.length >= 3 && onLassoEnd) {
              setLassoClosed(true)
              onLassoEnd([...pts])
              setTimeout(() => {
                setLassoClosed(false)
                setLassoPoints([])
              }, 200)
            } else {
              setLassoPoints([])
            }
            onSelectionEnd?.()
          }
          const listeners = { move: docMove, up: docUp }
          lassoDocListenersRef.current = listeners
          document.addEventListener('mousemove', docMove)
          document.addEventListener('mouseup', docUp)
          return
        }
        if (startSelectionBox) {
          e.evt.preventDefault()
          e.evt.stopPropagation()
          if ('cancelBubble' in e.evt) (e.evt as { cancelBubble?: boolean }).cancelBubble = true
          if (e.cancelBubble !== undefined) e.cancelBubble = true
          onSelectionStart?.()
          isRightDragSelectingRef.current = true
          selectionBoxTriggerRef.current = isRightClick ? 'right' : 'shift'
          const box = { startX: canvasPos.x, startY: canvasPos.y, endX: canvasPos.x, endY: canvasPos.y }
          selectionBoxRef.current = box
          setSelectionBox(box)

          const docMove = (evt: MouseEvent) => {
            const pos = clientToCanvas(evt.clientX, evt.clientY)
            if (pos && selectionBoxRef.current) {
              const next = { ...selectionBoxRef.current, endX: pos.x, endY: pos.y }
              selectionBoxRef.current = next
              setSelectionBox(next)
            }
          }
          const docUp = (evt: MouseEvent) => {
            evt.preventDefault()
            if (selectionDocListenersRef.current) {
              document.removeEventListener('mousemove', selectionDocListenersRef.current.move)
              document.removeEventListener('mouseup', selectionDocListenersRef.current.up)
              selectionDocListenersRef.current = null
            }
            isRightDragSelectingRef.current = false
            const prev = selectionBoxRef.current
            setSelectionBox(null)
            selectionBoxRef.current = null
            if (prev) {
              const left = Math.min(prev.startX, prev.endX)
              const right = Math.max(prev.startX, prev.endX)
              const top = Math.min(prev.startY, prev.endY)
              const bottom = Math.max(prev.startY, prev.endY)
              const dx = right - left
              const dy = bottom - top
              const minDrag = 5
              if ((dx >= minDrag || dy >= minDrag) && onSelectionBoxEnd) {
                onSelectionBoxEnd({ left, top, right, bottom })
              } else if (selectionBoxTriggerRef.current === 'right' && onContextMenu) {
                onContextMenu({ clientX: evt.clientX, clientY: evt.clientY })
              }
            }
            onSelectionEnd?.()
          }
          const listeners = { move: docMove, up: docUp }
          selectionDocListenersRef.current = listeners
          document.addEventListener('mousemove', docMove)
          document.addEventListener('mouseup', docUp)
          return
        }
      }

      if (editingTextOpen) {
        didPanRef.current = false
        return
      }
      const target = e.target
      const targetName = target.name()
      const isBackground = targetName === 'background' || targetName === 'stageFill' || target === target.getStage()
      if (!canvasPos) return

      if (arrowToolActive && onArrowDragStart && e.evt.button === 0) {
        e.evt.preventDefault()
        isArrowDraggingRef.current = true
        setIsArrowDragging(true)
        onArrowDragStart(canvasPos)
        return
      }
      if (!isBackground) return
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
    [viewport, editingTextOpen, penDrawingActive, eraserActive, arrowToolActive, lassoToolActive, onPenStrokeStart, onPenStrokeMove, onPenStrokeEnd, onEraserMove, onArrowDragStart, onPanningChange, getCanvasPos, onSelectionBoxEnd, onLassoEnd, onContextMenu, onSelectionStart, onSelectionEnd, clientToCanvas]
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

  const handleMouseUp = useCallback(
    (_e?: Konva.KonvaEventObject<MouseEvent>) => {
      if (isRightDragSelectingRef.current) {
        return
      }
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
      const finalPos = getCanvasPos()
      onPenStrokeEnd?.(finalPos ?? undefined)
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
    },
    [isPanning, isPenDrawing, isEraserDragging, onViewportChange, onPenStrokeEnd, onArrowDragEnd, onPanningChange, getCanvasPos]
  )

  const combinedMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const canvasPos = getCanvasPos()
      if (isRightDragSelectingRef.current && canvasPos) {
        const next = { startX: selectionBoxRef.current!.startX, startY: selectionBoxRef.current!.startY, endX: canvasPos.x, endY: canvasPos.y }
        selectionBoxRef.current = next
        setSelectionBox(next)
        return
      }
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
      if (penDrawingActive || eraserActive) return
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
    [onBackgroundClick, penDrawingActive, eraserActive]
  )

  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault()
      if (isRightDragSelectingRef.current) return
      const evt = e.evt as MouseEvent
      onContextMenu?.({ clientX: evt.clientX, clientY: evt.clientY })
    },
    [onContextMenu]
  )

  const result = (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      pixelRatio={1}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseUp={(e) => handleMouseUp(e)}
      onMouseLeave={(e) => handleMouseUp(e)}
      onMouseMove={combinedMouseMove}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
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
          {selectionBox && (
            <Rect
              x={Math.min(selectionBox.startX, selectionBox.endX)}
              y={Math.min(selectionBox.startY, selectionBox.endY)}
              width={Math.abs(selectionBox.endX - selectionBox.startX)}
              height={Math.abs(selectionBox.endY - selectionBox.startY)}
              stroke="#4A90D9"
              strokeWidth={2 / viewport.scale}
              dash={[6 / viewport.scale, 4 / viewport.scale]}
              fill="rgba(74, 144, 217, 0.1)"
              listening={false}
            />
          )}
          {lassoPoints.length >= 2 && (
            <Line
              points={lassoPoints.flatMap((p) => [p.x, p.y])}
              stroke="#4A90D9"
              strokeWidth={2 / viewport.scale}
              dash={[6 / viewport.scale, 3 / viewport.scale]}
              fill={lassoClosed ? 'rgba(74, 144, 217, 0.08)' : undefined}
              closed={lassoClosed}
              listening={false}
            />
          )}
          {activePenStrokeOverlay}
        </Group>
      </Layer>
      {cursorLayer}
    </Stage>
  )
  return result
}

export default memo(InfiniteCanvas)
