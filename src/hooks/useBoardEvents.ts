/**
 * Board event handlers: drag, click, resize, keyboard, pen, arrow, eraser, etc.
 */
import { useEffect, useCallback, useMemo, useRef } from 'react'
import { createObject, updateObject, deleteObject, batchUpdatePositions, createInputToBoardObject, type ObjectUpdates, type CreateObjectInput, type PositionUpdate } from '../services/objects'
import { objToCreateInput, getObjectsBboxMin } from '../services/aiTools/shared'
import {
  createComment,
  addCommentReply,
  deleteComment,
} from '../services/comments'
import { updateBoard } from '../services/board'
import { processAICommand } from '../services/aiAgent'
import { executeCreateKanbanBoard, executeCreateFlowchart, executeCreateMindMap, executeCreateTimeline } from '../services/aiTools'
import { buildComposedTemplate, TEMPLATE_FORMAT_MAP, centerCreateInputsAt } from '../utils/templates'
import { canvasToStage } from '../components/Canvas/InfiniteCanvas'
import type { ObjectResizeUpdates } from '../components/Canvas/ObjectLayer'
import type { LineObject, PenObject, TextObject, ObjectsMap, BoardObject } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types/objects'
import { throttle } from '../utils/throttle'
import { debounce } from '../utils/debounce'
import { objectsInSelectionRect } from '../utils/objectBounds'
import {
  resolveWorldPos,
  getLocalPos,
  getParentId,
  isInsideFrame,
  getFrameBbox,
  isNestableType,
  findContainingFrame,
  type FramesByIdMap,
} from '../utils/frames'
import type { useBoardData } from './useBoardData'
import type { useBoardTools } from './useBoardTools'

const MOUSE_MOVE_THROTTLE_MS = 16

/** Pen, highlighter, eraser stay selected until user manually picks another tool */
const PERSISTENT_DRAWING_TOOLS = ['pen', 'highlighter', 'eraser'] as const

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
    textareaValueRef,
    copiedObjects,
    setCopiedObjects,
    setTemplatesModalOpen,
    setPenStylesOpen,
  } = tools

  const containerRef = data.containerRef
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  /** Switch to pointer only if current tool is not pen/highlighter/eraser */
  const maybeSwitchToPointer = useCallback(() => {
    if (!PERSISTENT_DRAWING_TOOLS.includes(activeTool as (typeof PERSISTENT_DRAWING_TOOLS)[number])) {
      setActiveTool('pointer')
    }
  }, [activeTool, setActiveTool])
  const handleTextCommitRef = useRef<(value: string) => Promise<void>>(async () => {})

  const dragUpdateQueueRef = useRef<Map<string, PositionUpdate>>(new Map())
  const flushDragUpdates = useMemo(
    () =>
      debounce(async () => {
        const queue = dragUpdateQueueRef.current
        if (queue.size === 0 || !id) return
        const updates = Array.from(queue.values())
        queue.clear()
        await batchUpdatePositions(id, updates)
      }, 100),
    [id]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        maybeSwitchToPointer()
        setSelectedIds(new Set())
        setCommentModalPos(null)
        setCommentThread(null)
        setTemplatesModalOpen(false)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0 && canEdit) {
          e.preventDefault()
          const frameIds = new Set<string>()
          selectedIds.forEach((oid) => {
            const o = objects[oid]
            if (o?.type === 'frame') frameIds.add(oid)
          })
          const childUpdates: PositionUpdate[] = []
          for (const fid of frameIds) {
            const frame = objects[fid] as { type: 'frame'; position: { x: number; y: number } } | undefined
            if (!frame) continue
            for (const [oid, o] of Object.entries(objects)) {
              if (oid === fid || o.type === 'frame') continue
              const pid = getParentId(o)
              if (pid === fid) {
                const pos = getLocalPos(o)
                if (pos) {
                  const childWorldX = frame.position.x + pos.x
                  const childWorldY = frame.position.y + pos.y
                  childUpdates.push({
                    objectId: oid,
                    x: childWorldX,
                    y: childWorldY,
                    parentId: null,
                    localX: childWorldX,
                    localY: childWorldY,
                  })
                }
              }
            }
          }
          if (childUpdates.length > 0) {
            batchUpdatePositions(id, childUpdates)
            setObjects((prev: ObjectsMap) => {
              let next: ObjectsMap = prev
              for (const u of childUpdates) {
                const o = next[u.objectId]
                if (o && isNestableType(o.type)) {
                  next = {
                    ...next,
                    [u.objectId]: {
                      ...o,
                      parentId: null,
                      localX: u.localX!,
                      localY: u.localY!,
                      position: { x: u.localX!, y: u.localY! },
                    } as BoardObject,
                  }
                }
              }
              return next
            })
          }
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
  }, [id, canEdit, selectedIds, objects, pushUndo, handleUndo, handleRedo, maybeSwitchToPointer, setSelectedIds, setCommentModalPos, setCommentThread, setTemplatesModalOpen])

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
      const currentObjects = objects
      const currentSelected = selectedIdsRef.current
      const obj = currentObjects[objectId]
      if (!obj) return

      const idsToMove =
        currentSelected.size > 1 && currentSelected.has(objectId)
          ? Array.from(currentSelected)
          : [objectId]
      const draggedObj = currentObjects[objectId]
      if (!draggedObj) return

      const framesById: FramesByIdMap = {}
      for (const o of Object.values(currentObjects)) {
        if (o.type === 'frame') {
          framesById[o.objectId] = o as FramesByIdMap[string]
        }
      }

      let dx: number
      let dy: number
      if (draggedObj.type === 'line') {
        const line = draggedObj as LineObject
        const minX = Math.min(line.start.x, line.end.x)
        const minY = Math.min(line.start.y, line.end.y)
        dx = x - minX
        dy = y - minY
      } else if ('position' in draggedObj) {
        const worldStart = resolveWorldPos(draggedObj, framesById)
        if (!worldStart) return
        dx = x - worldStart.x
        dy = y - worldStart.y
      } else {
        return
      }

      const positionUpdates: Record<string, PositionUpdate> = {}
      type LineUpdate = { oid: string; to: { start: { x: number; y: number }; end: { x: number; y: number } }; from: { start: { x: number; y: number }; end: { x: number; y: number } } }
      const lineUpdates: LineUpdate[] = []

      for (const oid of idsToMove) {
        const o = currentObjects[oid]
        if (!o) continue
        if (o.type === 'line') {
          const line = o as LineObject
          const to = {
            start: { x: line.start.x + dx, y: line.start.y + dy },
            end: { x: line.end.x + dx, y: line.end.y + dy },
          }
          lineUpdates.push({ oid, to, from: { start: line.start, end: line.end } })
        } else if (o.type === 'frame') {
          const pos = (o as { position: { x: number; y: number } }).position
          const newX = oid === objectId ? x : pos.x + dx
          const newY = oid === objectId ? y : pos.y + dy
          positionUpdates[oid] = { objectId: oid, x: newX, y: newY }
          pushUndo({
            type: 'update',
            objectId: oid,
            from: { position: pos },
            to: { position: { x: newX, y: newY } },
          })
          dragUpdateQueueRef.current.set(oid, { objectId: oid, x: newX, y: newY })
        } else if (isNestableType(o.type) && 'position' in o) {
          const worldStart = resolveWorldPos(o, framesById)
          if (!worldStart) continue
          const worldX = oid === objectId ? x : worldStart.x + dx
          const worldY = oid === objectId ? y : worldStart.y + dy
          const dims = (o as { dimensions?: { width: number; height: number } }).dimensions ?? { width: 100, height: 100 }
          const objWorldBBox = {
            left: worldX,
            top: worldY,
            right: worldX + dims.width,
            bottom: worldY + dims.height,
          }

          let newParentId: string | null = null
          let newLocalX = worldX
          let newLocalY = worldY

          const containingFrames: Array<{ id: string; area: number; displayOrder: number }> = []
          for (const [fid, frame] of Object.entries(framesById)) {
            if (frame.objectId === oid) continue
            const fb = getFrameBbox(frame)
            if (isInsideFrame(objWorldBBox, fb)) {
              const area = fb.width * fb.height
              const order = frame.displayOrder ?? 0
              containingFrames.push({ id: fid, area, displayOrder: order })
            }
          }
          containingFrames.sort((a, b) => {
            if (a.area !== b.area) return a.area - b.area
            return b.displayOrder - a.displayOrder
          })
          const topFrame = containingFrames[0]
          if (topFrame) {
            const f = framesById[topFrame.id]
            newParentId = f.objectId
            newLocalX = worldX - f.position.x
            newLocalY = worldY - f.position.y
          }

          const prevPos = getLocalPos(o)
          const prevParent = getParentId(o)
          positionUpdates[oid] = {
            objectId: oid,
            x: worldX,
            y: worldY,
            parentId: newParentId,
            localX: newLocalX,
            localY: newLocalY,
          }
          pushUndo({
            type: 'update',
            objectId: oid,
            from: prevPos
              ? { position: { x: prevPos.x, y: prevPos.y }, parentId: prevParent ?? null, localX: prevPos.x, localY: prevPos.y }
              : {},
            to: { position: { x: newLocalX, y: newLocalY }, parentId: newParentId, localX: newLocalX, localY: newLocalY },
          })
          dragUpdateQueueRef.current.set(oid, positionUpdates[oid])
        }
      }

      for (const { oid, to, from } of lineUpdates) {
        pushUndo({ type: 'update', objectId: oid, from, to })
        await updateObject(id, oid, to)
      }

      if (Object.keys(positionUpdates).length > 0) {
        setObjects((prev: ObjectsMap) => {
          let next: ObjectsMap = prev
          for (const [oid, upd] of Object.entries(positionUpdates)) {
            const o = next[oid]
            if (!o) continue
            if (o.type === 'frame' && 'position' in o) {
              next = { ...next, [oid]: { ...o, position: { x: upd.x, y: upd.y } } }
            } else if (isNestableType(o.type) && 'parentId' in upd) {
              next = {
                ...next,
                [oid]: {
                  ...o,
                  parentId: (upd as PositionUpdate).parentId ?? null,
                  localX: (upd as PositionUpdate).localX ?? upd.x,
                  localY: (upd as PositionUpdate).localY ?? upd.y,
                  position: { x: (upd as PositionUpdate).localX ?? upd.x, y: (upd as PositionUpdate).localY ?? upd.y },
                } as BoardObject,
              }
            }
          }
          return next
        })
      }
      flushDragUpdates()
    },
    [id, canEdit, objects, pushUndo, setObjects]
  )

  const handleSelectionBoxEnd = useCallback(
    (rect: { left: number; top: number; right: number; bottom: number }) => {
      const framesById: FramesByIdMap = {}
      for (const o of Object.values(objects)) {
        if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
      }
      const ids = objectsInSelectionRect(objects, rect, framesById)
      setSelectedIds(new Set(ids))
      maybeSwitchToPointer()
    },
    [objects, setSelectedIds, maybeSwitchToPointer]
  )

  const handleObjectClick = useCallback(
    (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }) => {
      const obj = objects[objectId]
      const linkUrl = obj && (obj as { linkUrl?: string | null }).linkUrl
      if ((e.ctrlKey || e.metaKey) && linkUrl) {
        const url = linkUrl.startsWith('http://') || linkUrl.startsWith('https://') || linkUrl.startsWith('mailto:')
          ? linkUrl
          : `https://${linkUrl}`
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(prev)
        if (e.ctrlKey || e.metaKey) {
          if (next.has(objectId)) next.delete(objectId)
          else next.add(objectId)
        } else {
          return new Set([objectId])
        }
        return next
      })
    },
    [objects, setSelectedIds]
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
              rotation: (obj as { rotation?: number }).rotation,
            }
      pushUndo({ type: 'update', objectId, from, to: updates })
      setObjects((prev: ObjectsMap) => {
        const o = prev[objectId]
        if (!o) return prev
        if ('start' in updates) {
          return { ...prev, [objectId]: { ...o, start: updates.start, end: updates.end } }
        }
        const posUpdates = updates as { position: { x: number; y: number }; dimensions: { width: number; height: number }; rotation?: number }
        const next = {
          ...o,
          position: posUpdates.position,
          dimensions: posUpdates.dimensions,
        } as BoardObject
        if (typeof (updates as { rotation?: number }).rotation === 'number') {
          (next as { rotation?: number }).rotation = (updates as { rotation: number }).rotation
        }
        return { ...prev, [objectId]: next }
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
        setSelectedIds(new Set(result.createdItems.map((c) => c.objectId)))
        maybeSwitchToPointer()
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
    [id, canEdit, objects, pushUndo, dimensions, data, setSelectedIds, maybeSwitchToPointer]
  )

  const handleBackgroundClick = useCallback(
    async (payload: { x: number; y: number; clientX?: number; clientY?: number }) => {
      if (activeTool === 'pointer' && (justClosedStickyEditorRef.current || justClosedTextEditorRef.current)) {
        justClosedStickyEditorRef.current = false
        justClosedTextEditorRef.current = false
        maybeSwitchToPointer()
        setSelectedIds(new Set())
        return
      }
      if (editingStickyId || editingText) {
        if (editingText) {
          const value = textareaValueRef.current ?? editingText.value
          await handleTextCommitRef.current(value)
        }
        setEditingStickyId(null)
        setEditingText(null)
        maybeSwitchToPointer()
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
          textareaValueRef.current = ''
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
        (activeTool === 'sticky' || activeTool === 'frame' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle' || activeTool === 'triangle-inverted' || activeTool === 'diamond' || activeTool === 'star' || activeTool === 'pentagon' || activeTool === 'hexagon' || activeTool === 'plus' || activeTool === 'parallelogram-right' || activeTool === 'parallelogram-left' || activeTool === 'cylinder-vertical' || activeTool === 'cylinder-horizontal' || activeTool === 'tab-shape' || activeTool === 'trapezoid' || activeTool === 'circle-cross') &&
        canEdit
      ) {
        const basePos = { x: canvasX - 50, y: canvasY - 50 }
        const baseDims = { width: 100, height: 100 }
        const baseStyle = { fillColor: 'transparent' as const, strokeColor: '#000000' as const, strokeWidth: 2 as const }
        let input: Parameters<typeof createObject>[1] | null = null
        if (activeTool === 'sticky') {
          input = { type: 'sticky', position: { x: canvasX - 100, y: canvasY - 100 }, dimensions: { width: 200, height: 200 }, fillColor: '#fef08a' }
        } else if (activeTool === 'frame') {
          input = { type: 'frame', position: { x: canvasX - 400, y: canvasY - 300 }, dimensions: { width: 800, height: 600 } }
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
        if (input && 'position' in input && 'dimensions' in input && isNestableType(input.type)) {
          const pos = input.position
          const dims = input.dimensions
          const objWorldBBox = {
            left: pos.x,
            top: pos.y,
            right: pos.x + dims.width,
            bottom: pos.y + dims.height,
          }
          const framesById: FramesByIdMap = {}
          for (const o of Object.values(objects)) {
            if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
          }
          const frameId = findContainingFrame(objWorldBBox, framesById)
          if (frameId) {
            const frame = framesById[frameId]
            if (frame) {
              Object.assign(input, {
                parentId: frameId,
                localX: pos.x - frame.position.x,
                localY: pos.y - frame.position.y,
              })
            }
          }
        }
        if (input) {
          const objectId = await createObject(id, input)
          setObjects((prev) => ({ ...prev, [objectId]: createInputToBoardObject(objectId, input) }))
          pushUndo({ type: 'create', objectId, createInput: input })
          if (activeTool === 'sticky') {
            setEditingStickyId(objectId)
          } else {
            setSelectedIds(new Set([objectId]))
            maybeSwitchToPointer()
          }
        }
      }
      if (activeTool === 'emoji' && canEdit) {
        const emoji = pendingEmoji ?? '😀'
        const size = 32
        const pos = { x: canvasX - 16, y: canvasY - 16 }
        const input: { type: 'emoji'; position: { x: number; y: number }; emoji: string; parentId?: string; localX?: number; localY?: number } = { type: 'emoji', position: pos, emoji }
        const objWorldBBox = { left: pos.x, top: pos.y, right: pos.x + size, bottom: pos.y + size }
        const framesById: FramesByIdMap = {}
        for (const o of Object.values(objects)) {
          if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
        }
        const frameId = findContainingFrame(objWorldBBox, framesById)
        if (frameId) {
          const frame = framesById[frameId]
          if (frame) {
            input.parentId = frameId
            input.localX = pos.x - frame.position.x
            input.localY = pos.y - frame.position.y
          }
        }
        const objectId = await createObject(id, input)
        pushUndo({ type: 'create', objectId, createInput: input })
        setSelectedIds(new Set([objectId]))
        maybeSwitchToPointer()
      }
    },
    [id, activeTool, canEdit, pendingEmoji, pushUndo, editingStickyId, editingText, objects, setObjects, maybeSwitchToPointer]
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
      const content = textObj.content ?? ''
      const stage = canvasToStage(obj.position.x, obj.position.y, viewport)
      const rect = containerRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + stage.x : stage.x
      const screenY = rect ? rect.top + stage.y : stage.y
      textareaValueRef.current = content
      setEditingText({
        id: objectId,
        screenX,
        screenY,
        canvasX: obj.position.x,
        canvasY: obj.position.y,
        value: content,
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
          maybeSwitchToPointer()
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
        setObjects((prev) => ({ ...prev, [objectId]: createInputToBoardObject(objectId, input) }))
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
      maybeSwitchToPointer()
    },
    [id, canEdit, editingText, objects, pushUndo, setObjects, maybeSwitchToPointer]
  )
  handleTextCommitRef.current = handleTextCommit

  const handleTextCancel = useCallback(() => {
    setEditingText(null)
    justClosedTextEditorRef.current = true
    maybeSwitchToPointer()
  }, [setEditingText, maybeSwitchToPointer])

  const handleTextFormatChange = useCallback(
    (updates: Partial<typeof DEFAULT_TEXT_STYLE>) => {
      if (!editingText) return
      const newStyle = { ...editingText.textStyle, ...updates }
      setEditingText({ ...editingText, textStyle: newStyle })
      if (!editingText.isNew && editingText.id) {
        updateObject(id, editingText.id, { textStyle: newStyle })
      }
    },
    [id, editingText]
  )

  const handleCreateMindMap = useCallback(() => {
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
    const newScale = Math.min(5, viewport.scale * 1.2)
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
    maybeSwitchToPointer()
    setPenStylesOpen(false)
  }, [id, canEdit, activeTool, penStyles, pushUndo, maybeSwitchToPointer, setPenStylesOpen])

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
      maybeSwitchToPointer()
    },
    [id, canEdit, arrowPreview, pushUndo, maybeSwitchToPointer]
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
            setPenStylesOpen(false)
            return
          }
        }
      }
    },
    [id, canEdit, eraserActive, objects, penStyles.size, pushUndo, setPenStylesOpen]
  )

  const handleBoardNameChange = useCallback(
    async (name: string) => {
      if (!id || !data.board || data.board.ownerId !== user?.uid) return
      await updateBoard(id, { name })
      data.setBoard((b: import('../types').Board | null) => (b ? { ...b, name } : null))
    },
    [id, data, user?.uid]
  )

  const handleObjectStyleUpdate = useCallback(
    async (objectId: string, updates: ObjectUpdates) => {
      if (!id || !canEdit) return
      await updateObject(id, objectId, updates)
    },
    [id, canEdit]
  )

  const handleCopy = useCallback(() => {
    if (!canEdit || selectedIds.size === 0) return
    const objs = Array.from(selectedIds)
      .map((oid) => objects[oid])
      .filter((o): o is BoardObject => o != null)
    setCopiedObjects(objs)
  }, [canEdit, selectedIds, objects, setCopiedObjects])

  const handlePaste = useCallback(
    async (targetCanvasPos?: { x: number; y: number }) => {
      if (!id || !canEdit || copiedObjects.length === 0) return
      let offsetX: number
      let offsetY: number
      if (targetCanvasPos) {
        const anchor = getObjectsBboxMin(copiedObjects)
        if (anchor) {
          offsetX = targetCanvasPos.x - anchor.x
          offsetY = targetCanvasPos.y - anchor.y
        } else {
          offsetX = targetCanvasPos.x
          offsetY = targetCanvasPos.y
        }
      } else {
        offsetX = 40
        offsetY = 40
      }
      const newIds: string[] = []
      try {
        for (const obj of copiedObjects) {
          const input = objToCreateInput(obj, offsetX, offsetY)
        if (input) {
          const newId = await createObject(id, input)
          newIds.push(newId)
        }
      }
      if (newIds.length > 0) {
        setSelectedIds(new Set(newIds))
      } else if (copiedObjects.length > 0) {
        console.warn('Paste: no objects could be created (unsupported types?)', copiedObjects.map((o) => o.type))
      }
    } catch (err) {
      console.error('Paste failed:', err)
      alert(`Paste failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    },
    [id, canEdit, copiedObjects, setSelectedIds]
  )

  const handleDuplicate = useCallback(async () => {
    if (!id || !canEdit || selectedIds.size === 0) return
    const offsetX = 50
    const offsetY = 50
    const newIds: string[] = []
    try {
      for (const oid of selectedIds) {
        const obj = objects[oid]
        if (!obj) continue
        const input = objToCreateInput(obj, offsetX, offsetY)
        if (input) {
          const newId = await createObject(id, input)
          newIds.push(newId)
        }
      }
      if (newIds.length > 0) {
        setSelectedIds(new Set(newIds))
      } else {
        console.warn('Duplicate: no objects created', Array.from(selectedIds).map((oid) => ({ id: oid, type: objects[oid]?.type })))
      }
    } catch (err) {
      console.error('Duplicate failed:', err)
      alert(`Duplicate failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [id, canEdit, selectedIds, objects, setSelectedIds])

  const handleDelete = useCallback(() => {
    if (!id || !canEdit || selectedIds.size === 0) return
    selectedIds.forEach((oid: string) => {
      const obj = objects[oid]
      if (obj) pushUndo({ type: 'delete', objectId: oid, deleted: obj })
      deleteObject(id, oid)
    })
    setSelectedIds(new Set())
  }, [id, canEdit, selectedIds, objects, pushUndo, setSelectedIds])

  const handleSendToFront = useCallback(async () => {
    if (!id || !canEdit || selectedIds.size === 0) return
    const allOrders = Object.values(objects).map((o) => o.displayOrder ?? o.createdAt?.toMillis?.() ?? 0)
    const maxOrder = allOrders.length > 0 ? Math.max(...allOrders) : 0
    const newOrder = maxOrder + 1
    for (const oid of selectedIds) {
      await updateObject(id, oid, { displayOrder: newOrder })
    }
  }, [id, canEdit, selectedIds, objects])

  const handleBringToBack = useCallback(async () => {
    if (!id || !canEdit || selectedIds.size === 0) return
    const allOrders = Object.values(objects).map((o) => o.displayOrder ?? o.createdAt?.toMillis?.() ?? 0)
    const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 0
    const newOrder = minOrder - 1
    for (const oid of selectedIds) {
      await updateObject(id, oid, { displayOrder: newOrder })
    }
  }, [id, canEdit, selectedIds, objects])

  /** Places elements at viewport center; optionally selects them. */
  const insertElementsAtCenter = useCallback(
    async (elements: CreateObjectInput[], opts?: { selectAndGroup?: boolean }): Promise<string[]> => {
      if (!id || !canEdit || elements.length === 0) return []
      const center = getViewportCenter()
      const centered = centerCreateInputsAt(elements, center.x, center.y)
      const newIds: string[] = []
      for (const input of centered) {
        const objectId = await createObject(id, input)
        pushUndo({ type: 'create', objectId, createInput: input })
        newIds.push(objectId)
      }
      if (opts?.selectAndGroup && newIds.length > 0) {
        setSelectedIds(new Set(newIds))
        maybeSwitchToPointer()
      }
      return newIds
    },
    [id, canEdit, getViewportCenter, pushUndo, setSelectedIds, maybeSwitchToPointer]
  )

  /** Inserts a structural format template (Doc/Kanban/Table/Timeline/Flow Chart/Slides) at viewport center. */
  const insertFormatsStructure = useCallback(
    async (kind: string): Promise<string[]> => {
      if (!id || !canEdit) return []
      const center = getViewportCenter()
      const createdItems: { objectId: string; createInput: CreateObjectInput }[] = []
      const actions: string[] = []
      const objectsMap = new Map(Object.entries(objects))
      const objectsList = Object.values(objects)
      const ctx = {
        boardId: id,
        args: { startX: center.x, startY: center.y } as Record<string, unknown>,
        objectsMap,
        objectsList,
        createdItems,
        actions,
      }

      try {
        if (kind === 'Kanban') {
          ctx.args = {
            startX: center.x - 550,
            startY: center.y - 200,
            mainTitle: 'Kanban Board',
            columns: [
              { title: 'To Do', items: ['Task 1', 'Task 2', 'Task 3'] },
              { title: 'In Progress', items: [] },
              { title: 'Done', items: [] },
            ],
          }
          await executeCreateKanbanBoard(ctx)
        } else if (kind === 'Flow Chart') {
          ctx.args = {
            startX: center.x - 100,
            startY: center.y - 100,
            steps: [
              { label: 'Start', type: 'start' },
              { label: 'Process', type: 'process' },
              { label: 'Decision', type: 'decision' },
              { label: 'End', type: 'end' },
            ],
            orientation: 'vertical',
          }
          await executeCreateFlowchart(ctx)
        } else if (kind === 'Mind Map') {
          ctx.args = {
            centerX: center.x,
            centerY: center.y,
            centerTopic: 'Main Topic',
            branches: ['Branch 1', 'Branch 2', 'Branch 3'],
          }
          await executeCreateMindMap(ctx)
        } else if (kind === 'Timeline') {
          ctx.args = {
            startX: center.x - 280,
            startY: center.y - 50,
            events: [
              { date: 'Mon', label: 'Event 1' },
              { date: 'Tue', label: 'Event 2' },
              { date: 'Wed', label: 'Event 3' },
            ],
          }
          await executeCreateTimeline(ctx)
        } else {
          ctx.args = {
            startX: center.x - 100,
            startY: center.y - 80,
          }
          const docInput: CreateObjectInput = {
            type: 'text',
            position: { x: center.x - 100, y: center.y - 80 },
            dimensions: { width: 400, height: 120 },
            content: kind === 'Doc' ? 'Document\n\nAdd your content here.' : kind === 'Slides' ? 'Slide 1' : '',
          }
          const objectId = await createObject(id, docInput)
          createdItems.push({ objectId, createInput: docInput })
          if (kind === 'Slides') {
            const slide2: CreateObjectInput = {
              type: 'rectangle',
              position: { x: center.x - 100, y: center.y + 60 },
              dimensions: { width: 400, height: 240 },
              fillColor: '#f3f4f6',
              strokeColor: '#e5e7eb',
              cornerRadius: 8,
            }
            const slide2Id = await createObject(id, slide2)
            createdItems.push({ objectId: slide2Id, createInput: slide2 })
          } else if (kind === 'Table') {
            const cellW = 100
            const cellH = 60
            const cols = 3
            const rows = 3
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const cell: CreateObjectInput = {
                  type: 'rectangle',
                  position: { x: center.x - (cols * cellW) / 2 + c * cellW, y: center.y - (rows * cellH) / 2 + r * cellH },
                  dimensions: { width: cellW - 4, height: cellH - 4 },
                  fillColor: r === 0 ? '#e5e7eb' : '#ffffff',
                  strokeColor: '#d1d5db',
                  strokeWidth: 1,
                }
                const cellId = await createObject(id, cell)
                createdItems.push({ objectId: cellId, createInput: cell })
              }
            }
          }
        }

        for (const { objectId, createInput } of createdItems) {
          pushUndo({ type: 'create', objectId, createInput })
        }
        const ids = createdItems.map((item) => item.objectId)
        if (ids.length > 0) {
          setSelectedIds(new Set(ids))
          maybeSwitchToPointer()
        }
        return ids
      } catch (err) {
        console.error('[insertFormatsStructure]', kind, err)
        return []
      }
    },
    [id, canEdit, objects, getViewportCenter, pushUndo, setSelectedIds, maybeSwitchToPointer]
  )

  /** Inserts template by key: composed first, else format-structure fallback. */
  const insertTemplateByKey = useCallback(
    async (key: string): Promise<void> => {
      if (!id || !canEdit) return

      const composed = buildComposedTemplate(key)
      if (composed.length > 0) {
        await insertElementsAtCenter(composed, { selectAndGroup: true })
        return
      }

      const format = TEMPLATE_FORMAT_MAP[key]
      if (format) {
        await insertFormatsStructure(format)
      } else {
        await insertFormatsStructure('Doc')
      }
    },
    [id, canEdit, insertElementsAtCenter, insertFormatsStructure]
  )

  useEffect(() => {
    const handleCopyPasteDuplicate = (e: KeyboardEvent) => {
      if (!canEdit || editingStickyId || editingText) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'c') {
        e.preventDefault()
        handleCopy()
      } else if (meta && e.key === 'v') {
        e.preventDefault()
        if (copiedObjects.length > 0) handlePaste()
      } else if (meta && e.key === 'd') {
        e.preventDefault()
        if (selectedIds.size > 0) handleDuplicate()
      }
    }
    window.addEventListener('keydown', handleCopyPasteDuplicate)
    return () => window.removeEventListener('keydown', handleCopyPasteDuplicate)
  }, [canEdit, editingStickyId, editingText, selectedIds, copiedObjects, handleCopy, handlePaste, handleDuplicate])

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
    handleObjectStyleUpdate,
    handleSelectionBoxEnd,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDelete,
    handleSendToFront,
    handleBringToBack,
    insertTemplateByKey,
  }
}
