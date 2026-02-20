/**
 * Board event handlers: drag, click, resize, keyboard, pen, arrow, eraser, etc.
 */
import { useEffect, useCallback, useMemo, useRef } from 'react'
import { createObject, updateObject, deleteObject, batchUpdatePositions, type ObjectUpdates } from '../services/objects'
import {
  createComment,
  addCommentReply,
  deleteComment,
} from '../services/comments'
import { updateBoard } from '../services/board'
import { processAICommand } from '../services/aiAgent'
import { canvasToStage } from '../components/Canvas/InfiniteCanvas'
import type { ObjectResizeUpdates } from '../components/Canvas/ObjectLayer'
import type { LineObject, PenObject, TextObject, ObjectsMap } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types/objects'
import { throttle } from '../utils/throttle'
import { debounce } from '../utils/debounce'
import type { useBoardData } from './useBoardData'
import type { useBoardTools } from './useBoardTools'

const MOUSE_MOVE_THROTTLE_MS = 16

type Data = ReturnType<typeof useBoardData>
type Tools = ReturnType<typeof useBoardTools>

export interface UseBoardEventsParams {
  data: Data
  tools: Tools
  user: { uid: string } | null
}

export function useBoardEvents({ data, tools, user }: UseBoardEventsParams) {
  const { id, canEdit, objects, setObjects, viewport, dimensions, pushUndo, handleUndo, handleRedo, viewportRef, flushCursorUpdate } = data
  const {
    activeTool,
    setActiveTool,
    selectedIds,
    setSelectedIds,
    setEditingStickyId,
    setEditingText,
    editingStickyId,
    editingText,
    setCommentModalPos,
    setCommentThread,
    commentThread,
    pendingEmoji,
    arrowPreview,
    setArrowPreview,
    penDrawingActive,
    eraserActive,
    penStyles,
    currentPenPointsRef,
    setCurrentPenPoints,
    justClosedStickyEditorRef,
    justClosedTextEditorRef,
    justFinishedArrowDragRef,
  } = tools

  const containerRef = data.containerRef

  const dragUpdateQueueRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const flushDragUpdates = useMemo(
    () =>
      debounce(async () => {
        const queue = dragUpdateQueueRef.current
        if (queue.size === 0 || !id) return
        const updates = Array.from(queue.entries()).map(([objectId, { x, y }]) => ({ objectId, x, y }))
        queue.clear()
        await batchUpdatePositions(id, updates)
      }, 100),
    [id]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('pointer')
        setSelectedIds(new Set())
        setCommentModalPos(null)
        setCommentThread(null)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0 && canEdit) {
          e.preventDefault()
          selectedIds.forEach((oid: string) => {
            const obj = objects[oid]
            if (obj) pushUndo({ type: 'delete', objectId: oid, deleted: obj })
            deleteObject(id, oid)
          })
          setSelectedIds(new Set())
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [id, canEdit, selectedIds, objects, pushUndo, handleUndo, handleRedo, setActiveTool, setSelectedIds, setCommentModalPos, setCommentThread])

  const getViewportCenter = useCallback(() => {
    const w = dimensions.width
    const h = dimensions.height
    return {
      x: (w / 2 - viewport.x) / viewport.scale,
      y: (h / 2 - viewport.y) / viewport.scale,
    }
  }, [dimensions, viewport])

  const handleStageMouseMove = useMemo(
    () =>
      throttle(
        (e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } | null }) => {
          if (!id || editingText != null) return
          const stage = e.target?.getStage() as { getPointerPosition: () => { x: number; y: number } | null } | null
          if (!stage?.getPointerPosition) return
          const pos = stage.getPointerPosition()
          if (!pos) return
          flushCursorUpdate(pos.x, pos.y)
        },
        MOUSE_MOVE_THROTTLE_MS
      ),
    [id, editingText, flushCursorUpdate]
  )

  useEffect(() => {
    if (!id || editingText != null) return
    const handler = throttle((e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const stageX = e.clientX - rect.left
      const stageY = e.clientY - rect.top
      if (stageX < 0 || stageY < 0 || stageX > rect.width || stageY > rect.height) return
      flushCursorUpdate(stageX, stageY)
    }, MOUSE_MOVE_THROTTLE_MS)
    document.addEventListener('mousemove', handler)
    return () => document.removeEventListener('mousemove', handler)
  }, [id, editingText, flushCursorUpdate])

  const handleObjectDragEnd = useCallback(
    async (objectId: string, x: number, y: number) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      if (!obj) return
      if (obj.type === 'line') {
        const line = obj as LineObject
        const minX = Math.min(line.start.x, line.end.x)
        const minY = Math.min(line.start.y, line.end.y)
        const dx = x - minX
        const dy = y - minY
        const to = {
          start: { x: line.start.x + dx, y: line.start.y + dy },
          end: { x: line.end.x + dx, y: line.end.y + dy },
        }
        pushUndo({ type: 'update', objectId, from: { start: line.start, end: line.end }, to })
        await updateObject(id, objectId, to)
      } else if ('position' in obj) {
        const from = { position: (obj as { position: { x: number; y: number } }).position }
        const to = { position: { x, y } }
        pushUndo({ type: 'update', objectId, from, to })
        setObjects((prev: ObjectsMap) => {
          const o = prev[objectId]
          if (!o || !('position' in o)) return prev
          return { ...prev, [objectId]: { ...o, position: { x, y } } }
        })
        dragUpdateQueueRef.current.set(objectId, { x, y })
        flushDragUpdates()
      }
    },
    [id, canEdit, objects, pushUndo, setObjects]
  )

  const handleObjectClick = useCallback(
    (objectId: string, e: { ctrlKey: boolean }) => {
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(prev)
        if (e.ctrlKey) {
          if (next.has(objectId)) next.delete(objectId)
          else next.add(objectId)
        } else {
          return new Set([objectId])
        }
        return next
      })
    },
    [setSelectedIds]
  )

  const handleObjectResizeEnd = useCallback(
    async (objectId: string, updates: ObjectResizeUpdates) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      if (!obj) return
      const from =
        'start' in updates
          ? { start: (obj as LineObject).start, end: (obj as LineObject).end }
          : {
              position: (obj as { position: { x: number; y: number } }).position,
              dimensions: (obj as { dimensions: { width: number; height: number } }).dimensions,
            }
      pushUndo({ type: 'update', objectId, from, to: updates })
      setObjects((prev: ObjectsMap) => {
        const o = prev[objectId]
        if (!o) return prev
        if ('start' in updates) {
          return { ...prev, [objectId]: { ...o, start: updates.start, end: updates.end } }
        }
        return {
          ...prev,
          [objectId]: { ...o, position: updates.position, dimensions: updates.dimensions },
        }
      })
      await updateObject(id, objectId, updates as ObjectUpdates)
    },
    [id, canEdit, objects, pushUndo, setObjects]
  )

  const handleAICommand = useCallback(
    async (prompt: string): Promise<{ success: boolean; message: string }> => {
      if (!id || !canEdit) return { success: false, message: 'Cannot edit' }
      const vp = viewportRef.current
      const canvasCenterX = (dimensions.width / 2 - vp.x) / vp.scale
      const canvasCenterY = (dimensions.height / 2 - vp.y) / vp.scale
      const viewportCenter = { x: canvasCenterX, y: canvasCenterY }
      const result = await processAICommand(id, prompt, Object.values(objects), viewportCenter)
      if (!result.success) return { success: false, message: result.message }
      if (result.createdItems?.length) {
        for (const { objectId, createInput } of result.createdItems) {
          pushUndo({ type: 'create', objectId, createInput })
        }
        const positions = result.createdItems
          .map((c) => ('position' in c.createInput ? c.createInput.position : null))
          .filter((p): p is { x: number; y: number } => p != null)
        if (positions.length > 0) {
          const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length
          const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length
          data.setViewport((prev) => ({
            ...prev,
            x: dimensions.width / 2 - avgX * prev.scale,
            y: dimensions.height / 2 - avgY * prev.scale,
          }))
        }
      }
      return { success: true, message: result.message }
    },
    [id, canEdit, objects, pushUndo, dimensions, data]
  )

  const handleBackgroundClick = useCallback(
    async (payload: { x: number; y: number; clientX?: number; clientY?: number }) => {
      if (activeTool === 'pointer' && (justClosedStickyEditorRef.current || justClosedTextEditorRef.current)) {
        justClosedStickyEditorRef.current = false
        justClosedTextEditorRef.current = false
        setActiveTool('pointer')
        setSelectedIds(new Set())
        return
      }
      if (editingStickyId || editingText) {
        setEditingStickyId(null)
        setEditingText(null)
        setActiveTool('pointer')
        setSelectedIds(new Set())
        return
      }
      setSelectedIds(new Set())

      const { x: canvasX, y: canvasY } = payload

      if (justFinishedArrowDragRef.current) {
        justFinishedArrowDragRef.current = false
        return
      }

      if (activeTool === 'comment' && canEdit) {
        setCommentModalPos({ x: canvasX, y: canvasY })
      }
      if (activeTool === 'text' && canEdit) {
        const { clientX, clientY } = payload
        if (clientX != null && clientY != null) {
          setEditingText({
            id: null,
            screenX: clientX,
            screenY: clientY,
            canvasX,
            canvasY,
            value: '',
            isNew: true,
            textStyle: { ...DEFAULT_TEXT_STYLE },
          })
        }
      } else if (
        (activeTool === 'sticky' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle' || activeTool === 'triangle-inverted' || activeTool === 'diamond' || activeTool === 'star' || activeTool === 'pentagon' || activeTool === 'hexagon' || activeTool === 'plus' || activeTool === 'parallelogram-right' || activeTool === 'parallelogram-left' || activeTool === 'cylinder-vertical' || activeTool === 'cylinder-horizontal' || activeTool === 'tab-shape' || activeTool === 'trapezoid' || activeTool === 'circle-cross') &&
        canEdit
      ) {
        const basePos = { x: canvasX - 50, y: canvasY - 50 }
        const baseDims = { width: 100, height: 100 }
        const baseStyle = { fillColor: 'transparent' as const, strokeColor: '#000000' as const, strokeWidth: 2 as const }
        let input: Parameters<typeof createObject>[1] | null = null
        if (activeTool === 'sticky') {
          input = { type: 'sticky', position: { x: canvasX - 100, y: canvasY - 100 }, dimensions: { width: 200, height: 200 }, fillColor: '#fef08a' }
        } else if (activeTool === 'rectangle') {
          input = { type: 'rectangle', position: { ...basePos, y: canvasY - 50 }, dimensions: { width: 150, height: 100 }, ...baseStyle }
        } else if (activeTool === 'circle') {
          input = { type: 'circle', position: basePos, dimensions: baseDims, ...baseStyle }
        } else if (activeTool === 'triangle') {
          input = { type: 'triangle', position: { ...basePos, y: canvasY - 40 }, dimensions: { width: 100, height: 80 }, ...baseStyle }
        } else if (activeTool === 'triangle-inverted') {
          input = { type: 'triangle', position: { ...basePos, y: canvasY - 40 }, dimensions: { width: 100, height: 80 }, inverted: true, ...baseStyle }
        } else if (activeTool === 'diamond' || activeTool === 'star' || activeTool === 'pentagon' || activeTool === 'hexagon') {
          input = { type: activeTool, position: basePos, dimensions: baseDims, ...baseStyle }
        } else if (activeTool === 'plus') {
          input = { type: 'plus', position: basePos, dimensions: baseDims, ...baseStyle }
        } else if (activeTool === 'parallelogram-right') {
          input = { type: 'parallelogram', position: basePos, dimensions: baseDims, shapeKind: 'right', ...baseStyle }
        } else if (activeTool === 'parallelogram-left') {
          input = { type: 'parallelogram', position: basePos, dimensions: baseDims, shapeKind: 'left', ...baseStyle }
        } else if (activeTool === 'cylinder-vertical') {
          input = { type: 'cylinder', position: basePos, dimensions: baseDims, shapeKind: 'vertical', ...baseStyle }
        } else if (activeTool === 'cylinder-horizontal') {
          input = { type: 'cylinder', position: basePos, dimensions: baseDims, shapeKind: 'horizontal', ...baseStyle }
        } else if (activeTool === 'tab-shape' || activeTool === 'trapezoid' || activeTool === 'circle-cross') {
          input = { type: activeTool, position: basePos, dimensions: baseDims, ...baseStyle }
        }
        if (input) {
          const objectId = await createObject(id, input)
          pushUndo({ type: 'create', objectId, createInput: input })
          if (activeTool === 'sticky') {
            setEditingStickyId(objectId)
          } else {
            setSelectedIds(new Set([objectId]))
            setActiveTool('pointer')
          }
        }
      }
      if (activeTool === 'emoji' && canEdit) {
        const emoji = pendingEmoji ?? '😀'
        const input = { type: 'emoji' as const, position: { x: canvasX - 16, y: canvasY - 16 }, emoji }
        const objectId = await createObject(id, input)
        pushUndo({ type: 'create', objectId, createInput: input })
        setSelectedIds(new Set([objectId]))
        setActiveTool('pointer')
      }
    },
    [id, activeTool, canEdit, pendingEmoji, pushUndo, editingStickyId, editingText]
  )

  const handleStickyDoubleClick = useCallback((objectId: string) => {
    if (!canEdit) return
    setEditingStickyId(objectId)
  }, [canEdit, setEditingStickyId])

  const handleTextDoubleClick = useCallback(
    (objectId: string) => {
      if (!canEdit) return
      const obj = objects[objectId]
      if (!obj || obj.type !== 'text') return
      const textObj = obj as TextObject
      const stage = canvasToStage(obj.position.x, obj.position.y, viewport)
      const rect = containerRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + stage.x : stage.x
      const screenY = rect ? rect.top + stage.y : stage.y
      setEditingText({
        id: objectId,
        screenX,
        screenY,
        canvasX: obj.position.x,
        canvasY: obj.position.y,
        value: textObj.content ?? '',
        isNew: false,
        textStyle: { ...DEFAULT_TEXT_STYLE, ...textObj.textStyle },
      })
    },
    [canEdit, objects, viewport]
  )

  const handleStickySave = useCallback(
    async (objectId: string, content: string) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      const oldContent = obj && obj.type === 'sticky' ? obj.content : ''
      pushUndo({ type: 'update', objectId, from: { content: oldContent }, to: { content } })
      await updateObject(id, objectId, { content })
      justClosedStickyEditorRef.current = true
      setEditingStickyId(null)
    },
    [id, canEdit, objects, pushUndo, setEditingStickyId]
  )

  const handleTextCommit = useCallback(
    async (value: string) => {
      if (!id || !canEdit || !editingText) return
      const trimmed = value.trim()
      if (editingText.isNew) {
        if (trimmed === '') {
          setEditingText(null)
          justClosedTextEditorRef.current = true
          setActiveTool('pointer')
          return
        }
        const input = {
          type: 'text' as const,
          position: { x: editingText.canvasX, y: editingText.canvasY },
          dimensions: { width: 200, height: 40 },
          content: trimmed,
          textStyle: editingText.textStyle,
        }
        const objectId = await createObject(id, input)
        pushUndo({ type: 'create', objectId, createInput: input })
      } else {
        const objectId = editingText.id!
        const obj = objects[objectId]
        const oldContent = obj && obj.type === 'text' ? obj.content : ''
        pushUndo({ type: 'update', objectId, from: { content: oldContent }, to: { content: trimmed } })
        await updateObject(id, objectId, { content: trimmed })
      }
      justClosedTextEditorRef.current = true
      setEditingText(null)
      setActiveTool('pointer')
    },
    [id, canEdit, editingText, objects, pushUndo]
  )

  const handleTextCancel = useCallback(() => {
    setEditingText(null)
    justClosedTextEditorRef.current = true
    setActiveTool('pointer')
  }, [setEditingText, setActiveTool])

  const handleTextFormatChange = useCallback(
    (updates: Partial<typeof DEFAULT_TEXT_STYLE>) => {
      if (!editingText) return
      const newStyle = { ...editingText.textStyle, ...updates }
      setEditingText({ ...editingText, textStyle: newStyle })
      if (!editingText.isNew && editingText.id) {
        updateObject(id, editingText.id, { textStyle: updates })
      }
    },
    [id, editingText]
  )

  const handleCreateMindMap = useCallback(() => {
    console.log('Create mind map from text box')
  }, [])

  const handleCommentSave = useCallback(
    async (text: string) => {
      if (!id || !canEdit || !tools.commentModalPos) return
      await createComment(id, tools.commentModalPos, text)
      setCommentModalPos(null)
    },
    [id, canEdit, tools.commentModalPos]
  )

  const handleCommentReply = useCallback(
    async (text: string) => {
      if (!id || !commentThread) return
      await addCommentReply(id, commentThread.id, text)
    },
    [id, commentThread]
  )

  const handleCommentDelete = useCallback(
    async () => {
      if (!id || !commentThread) return
      pushUndo({ type: 'deleteComment', commentId: commentThread.id, deleted: commentThread })
      await deleteComment(id, commentThread.id)
      setCommentThread(null)
    },
    [id, commentThread, pushUndo, setCommentThread]
  )

  const handleZoomIn = useCallback(() => {
    const center = getViewportCenter()
    const newScale = Math.min(4, viewport.scale * 1.2)
    const w = dimensions.width
    const h = dimensions.height
    data.setViewport({
      x: w / 2 - center.x * newScale,
      y: h / 2 - center.y * newScale,
      scale: newScale,
    })
  }, [viewport, dimensions, getViewportCenter, data])

  const handleZoomOut = useCallback(() => {
    const center = getViewportCenter()
    const newScale = Math.max(0.1, viewport.scale / 1.2)
    const w = dimensions.width
    const h = dimensions.height
    data.setViewport({
      x: w / 2 - center.x * newScale,
      y: h / 2 - center.y * newScale,
      scale: newScale,
    })
  }, [viewport, dimensions, getViewportCenter, data])

  const handlePenStrokeStart = useCallback(
    (pos: { x: number; y: number }) => {
      if (!penDrawingActive) return
      const pts: [number, number][] = [[pos.x, pos.y]]
      currentPenPointsRef.current = pts
      setCurrentPenPoints(pts)
    },
    [penDrawingActive]
  )

  const handlePenStrokeMove = useCallback(
    (pos: { x: number; y: number }) => {
      if (!penDrawingActive) return
      const next = [...currentPenPointsRef.current, [pos.x, pos.y] as [number, number]]
      currentPenPointsRef.current = next
      setCurrentPenPoints(next)
    },
    [penDrawingActive]
  )

  const handlePenStrokeEnd = useCallback(async () => {
    const pointsToSave = [...currentPenPointsRef.current]
    currentPenPointsRef.current = []
    setCurrentPenPoints([])
    if (!id || !canEdit || pointsToSave.length < 2) return
    const isHighlighter = activeTool === 'highlighter'
    const input = {
      type: 'pen' as const,
      points: pointsToSave,
      color: penStyles.color,
      strokeWidth: penStyles.size,
      isHighlighter,
      opacity: penStyles.opacity / 100,
      strokeType: penStyles.strokeType,
    }
    const objectId = await createObject(id, input)
    pushUndo({ type: 'create', objectId, createInput: input })
    setSelectedIds(new Set([objectId]))
    setActiveTool('pointer')
  }, [id, canEdit, activeTool, penStyles, pushUndo])

  const handleArrowDragStart = useCallback(
    (pos: { x: number; y: number }) => {
      if (!tools.arrowToolActive) return
      setArrowPreview({
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        type: activeTool,
      })
    },
    [tools.arrowToolActive, activeTool]
  )

  const handleArrowDragMove = useCallback((pos: { x: number; y: number }) => {
    setArrowPreview((prev: typeof arrowPreview) => (prev ? { ...prev, endX: pos.x, endY: pos.y } : null))
  }, [setArrowPreview])

  const handleArrowDragEnd = useCallback(
    async (pos: { x: number; y: number }) => {
      const preview = arrowPreview
      setArrowPreview(null)
      justFinishedArrowDragRef.current = true
      if (!id || !canEdit || !preview) return
      const distance = Math.sqrt((pos.x - preview.startX) ** 2 + (pos.y - preview.startY) ** 2)
      if (distance < 10) return
      const input = {
        type: 'line' as const,
        start: { x: preview.startX, y: preview.startY },
        end: { x: pos.x, y: pos.y },
        strokeColor: '#000000',
        strokeWidth: 2,
        connectionType: preview.type as 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double',
      }
      const objectId = await createObject(id, input)
      pushUndo({ type: 'create', objectId, createInput: input })
      setSelectedIds(new Set([objectId]))
      setActiveTool('pointer')
    },
    [id, canEdit, arrowPreview, pushUndo]
  )

  const handleEraserMove = useCallback(
    (pos: { x: number; y: number }) => {
      if (!id || !canEdit || !eraserActive) return
      const eraserRadius = penStyles.size
      const penObjects = Object.values(objects).filter((obj): obj is PenObject => obj.type === 'pen')
      for (const penObj of penObjects) {
        for (let i = 0; i < penObj.points.length; i++) {
          const [px, py] = penObj.points[i]
          const dist = Math.sqrt((px - pos.x) ** 2 + (py - pos.y) ** 2)
          if (dist < eraserRadius) {
            pushUndo({ type: 'delete', objectId: penObj.objectId, deleted: penObj })
            deleteObject(id, penObj.objectId)
            return
          }
        }
      }
    },
    [id, canEdit, eraserActive, objects, penStyles.size, pushUndo]
  )

  const handleBoardNameChange = useCallback(
    async (name: string) => {
      if (!id || !data.board || data.board.ownerId !== user?.uid) return
      await updateBoard(id, { name })
      data.setBoard((b: import('../types').Board | null) => (b ? { ...b, name } : null))
    },
    [id, data, user?.uid]
  )

  return {
    handleStageMouseMove,
    handleObjectDragEnd,
    handleObjectClick,
    handleObjectResizeEnd,
    handleAICommand,
    handleBackgroundClick,
    handleStickyDoubleClick,
    handleTextDoubleClick,
    handleStickySave,
    handleTextCommit,
    handleTextCancel,
    handleTextFormatChange,
    handleCreateMindMap,
    handleCommentSave,
    handleCommentReply,
    handleCommentDelete,
    handleZoomIn,
    handleZoomOut,
    handlePenStrokeStart,
    handlePenStrokeMove,
    handlePenStrokeEnd,
    handleArrowDragStart,
    handleArrowDragMove,
    handleArrowDragEnd,
    handleEraserMove,
    handleBoardNameChange,
  }
}
