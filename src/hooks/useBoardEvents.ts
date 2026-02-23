/**
 * Board event handlers: drag, click, resize, keyboard, pen, arrow, eraser, etc.
 */
import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { createObject, updateObject, deleteObject, batchDeleteObjects, batchUpdatePositions, batchUpdatePositionsAndLines, createInputToBoardObject, type ObjectUpdates, type CreateObjectInput, type PositionUpdate } from '../services/objects'
import {
  penStrokesToImageBlob,
  recognizeHandwriting,
  getIdToken,
} from '../services/handwritingRecognition'
import { objToCreateInput, getObjectsBboxMin } from '../services/aiTools/shared'
import {
  createComment,
  addCommentReply,
  deleteComment,
} from '../services/comments'
import { updateBoard } from '../services/board'
import { processAICommand } from '../services/aiAgent'
import { executeCreateKanbanBoard, executeCreateFlowchart, executeCreateMindMap, executeCreateTimeline } from '../services/aiTools'
import { buildComposedTemplate, wrapComposedTemplateInFrame, TEMPLATE_FORMAT_MAP } from '../utils/templates'
import { insertComposedTemplateWithFrame, wrapCreatedItemsInFrame } from '../services/templateInsert'
import { canvasToStage } from '../components/Canvas/InfiniteCanvas'
import type { ObjectResizeUpdates } from '../components/Canvas/ObjectLayer'
import type { LineObject, PenObject, TextObject, ObjectsMap, BoardObject } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types/objects'
import { throttle } from '../utils/throttle'
import { debounce } from '../utils/debounce'
import { objectsInSelectionRect, objectsInLassoPolygon, getBoardContentBounds, getObjectBounds, unionBounds } from '../utils/objectBounds'
import { isImageUrl, isGoogleDoc, isYouTube } from '../utils/urlDetection'
import { uploadBoardImage, uploadBoardFile } from '../services/storage'
import { stageToCanvas } from '../utils/coordinates'
import { getNearestAnchor, getNearestEdgePoint } from '../utils/connectorAnchors'
import { measureTextDimensions } from '../utils/textMeasurement'
import { getLineAnchorStatus, getConnectedLineIds } from '../utils/connectedLines'
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
  /** Called when multi-drag ends so live positions are cleared */
  clearMultiDragPositions?: () => void
  /** Selection expanded with lines that intersect selection bounds (for moving lines with frames) */
  expandedSelectedIds?: Set<string>
  /** Show toast notification (e.g. for handwriting recognition errors) */
  showToast?: (message: string) => void
}

export function useBoardEvents({ data, tools, user, clearMultiDragPositions, expandedSelectedIds, showToast }: UseBoardEventsParams) {
  const { id, canEdit, objects, setObjects, viewport, dimensions, pushUndo, handleUndo, handleRedo, viewportRef, flushCursorUpdate, containerRef } = data
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
    justClosedStickyEditorRef,
    justClosedTextEditorRef,
    justFinishedArrowDragRef,
    justFinishedObjectDragRef,
    justFinishedPenStrokeRef,
    textareaValueRef,
    copiedObjects,
    setCopiedObjects,
    setTemplatesModalOpen,
    setPenStylesOpen,
    connectorToolActive,
    activeConnectorType,
  } = tools

  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const activeToolRef = useRef(activeTool)
  activeToolRef.current = activeTool
  const connectorHoveredObjectIdRef = useRef<string | null>(null)
  const objectsRef = useRef(objects)

  const [isConverting, setIsConverting] = useState(false)
  const [convertButtonShake, setConvertButtonShake] = useState(false)
  const [convertJustFinishedId, setConvertJustFinishedId] = useState<string | null>(null)

  /** Smart connector flow: idle | preview (source chosen, waiting for dest) */
  const connectorStateRef = useRef<{
    phase: 'idle' | 'preview'
    sourceObjectId: string | null
    sourceAnchorPoint: { x: number; y: number } | null
    sourceAnchor: 'top' | 'right' | 'bottom' | 'left'
    sourceAnchorT: number
  }>({ phase: 'idle', sourceObjectId: null, sourceAnchorPoint: null, sourceAnchor: 'right', sourceAnchorT: 0.5 })
  const [connectorSource, setConnectorSource] = useState<{
    sourceObjectId: string
    sourceAnchorPoint: { x: number; y: number }
    sourceAnchor: 'top' | 'right' | 'bottom' | 'left'
  } | null>(null)
  const [connectorPreviewEndPos, setConnectorPreviewEndPos] = useState<{ x: number; y: number } | null>(null)
  const [connectorHoveredObjectId, setConnectorHoveredObjectId] = useState<string | null>(null)
  const [connectorHoverAnchor, setConnectorHoverAnchor] = useState<{ x: number; y: number } | null>(null)
  connectorHoveredObjectIdRef.current = connectorHoveredObjectId
  objectsRef.current = objects

  /** Clear connector hover/preview state when switching away from connector tool (avoids setState on every mousemove when inactive) */
  const lastConnectorPreviewPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastConnectorHoverAnchorRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!connectorToolActive) {
      lastConnectorPreviewPosRef.current = null
      lastConnectorHoverAnchorRef.current = null
      setConnectorHoverAnchor(null)
      setConnectorPreviewEndPos(null)
    }
  }, [connectorToolActive])

  const onConnectorHover = useCallback((objectId: string | null) => {
    setConnectorHoveredObjectId(objectId)
  }, [])

  /** Switch to pointer only if current tool is not pen/highlighter/eraser */
  const maybeSwitchToPointer = useCallback(() => {
    if (!PERSISTENT_DRAWING_TOOLS.includes(activeTool as (typeof PERSISTENT_DRAWING_TOOLS)[number])) {
      setActiveTool('pointer')
    }
  }, [activeTool, setActiveTool])
  const handleTextCommitRef = useRef<(value: string, dimensions?: { width: number; height: number }) => Promise<void>>(async () => {})

  const dragUpdateQueueRef = useRef<Map<string, PositionUpdate>>(new Map())
  const flushDragUpdates = useMemo(
    () =>
      debounce(async () => {
        const queue = dragUpdateQueueRef.current
        if (queue.size === 0 || !id) return
        const updates = Array.from(queue.values())
        queue.clear()
        await batchUpdatePositions(id, updates)
      }, 50),
    [id]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        setActiveTool((prev) => (prev === 'lasso' ? 'pointer' : 'lasso'))
        return
      }
      if (e.key === 'Escape') {
        if (isConverting) return
        if (connectorStateRef.current.phase === 'preview') {
          connectorStateRef.current = { phase: 'idle', sourceObjectId: null, sourceAnchorPoint: null, sourceAnchor: 'right', sourceAnchorT: 0.5 }
          setConnectorSource(null)
          setConnectorPreviewEndPos(null)
          return
        }
        maybeSwitchToPointer()
        setSelectedIds(new Set())
        setCommentModalPos(null)
        setCommentThread(null)
        setTemplatesModalOpen(false)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0 && canEdit) {
          e.preventDefault()
          const framesById: FramesByIdMap = {}
          for (const o of Object.values(objects)) {
            if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
          }
          const idsToDelete = new Set<string>()
          const frameIds = new Set<string>()
          selectedIds.forEach((oid) => {
            const o = objects[oid]
            if (o?.type === 'frame') frameIds.add(oid)
          })
          for (const fid of frameIds) {
            const frame = objects[fid]
            if (!frame || frame.type !== 'frame') continue
            const childIds = Object.values(objects)
              .filter((o) => getParentId(o) === fid)
              .map((o) => o.objectId)
            const movingIds = new Set([fid, ...childIds])
            const connectedLineIds = getConnectedLineIds(objects, movingIds, framesById)
            const children = childIds.map((cid) => objects[cid]).filter(Boolean)
            const connectedLines = Array.from(connectedLineIds).map((lid) => objects[lid]).filter(Boolean)
            pushUndo({
              type: 'DELETE_FRAME_WITH_CONTENTS',
              snapshot: {
                frame: { ...frame } as BoardObject,
                children: children.map((o) => ({ ...o } as BoardObject)),
                connectedLines: connectedLines.map((o) => ({ ...o } as BoardObject)),
              },
            })
            idsToDelete.add(fid)
            childIds.forEach((cid) => idsToDelete.add(cid))
            connectedLineIds.forEach((lid) => idsToDelete.add(lid))
          }
          for (const oid of selectedIds) {
            if (idsToDelete.has(oid)) continue
            const obj = objects[oid]
            if (obj) {
              pushUndo({ type: 'delete', objectId: oid, deleted: obj })
              idsToDelete.add(oid)
            }
          }
          if (idsToDelete.size > 0) {
            setObjects((prev: ObjectsMap) => {
              const next = { ...prev }
              idsToDelete.forEach((oid) => delete next[oid])
              return next
            })
            setSelectedIds(new Set())
            ;(async () => {
              const ids = Array.from(idsToDelete)
              if (ids.length === 1) {
                await deleteObject(id, ids[0])
              } else {
                await batchDeleteObjects(id, ids)
              }
            })()
          }
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
  }, [id, canEdit, selectedIds, objects, pushUndo, handleUndo, handleRedo, maybeSwitchToPointer, setSelectedIds, setObjects, setCommentModalPos, setCommentThread, setTemplatesModalOpen, setActiveTool])

  const getViewportCenter = useCallback(() => {
    const w = dimensions.width
    const h = dimensions.height
    return {
      x: (w / 2 - viewport.x) / viewport.scale,
      y: (h / 2 - viewport.y) / viewport.scale,
    }
  }, [dimensions, viewport])

  const stageMouseMoveRafRef = useRef<number | null>(null)
  const lastStageMouseMoveRef = useRef<{ getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } | null>(null)
  const handleStageMouseMove = useCallback(
    (e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } | null }) => {
      lastStageMouseMoveRef.current = e.target
      if (stageMouseMoveRafRef.current) cancelAnimationFrame(stageMouseMoveRafRef.current)
      stageMouseMoveRafRef.current = requestAnimationFrame(() => {
        stageMouseMoveRafRef.current = null
        if (!id || editingText != null) return
        const target = lastStageMouseMoveRef.current
        const stage = target?.getStage?.() as { getPointerPosition: () => { x: number; y: number } | null } | null
        if (!stage?.getPointerPosition) return
        const pos = stage.getPointerPosition()
        if (!pos) return
        flushCursorUpdate(pos.x, pos.y)
        if (connectorToolActive) {
          const vp = viewportRef.current
          const canvas = stageToCanvas(pos.x, pos.y, vp)
          const POS_THRESHOLD = 2 // px - skip setState if position change is trivial
          if (connectorStateRef.current.phase === 'preview') {
            const last = lastConnectorPreviewPosRef.current
            if (!last || Math.abs(canvas.x - last.x) > POS_THRESHOLD || Math.abs(canvas.y - last.y) > POS_THRESHOLD) {
              lastConnectorPreviewPosRef.current = { x: canvas.x, y: canvas.y }
              setConnectorPreviewEndPos({ x: canvas.x, y: canvas.y })
            }
          }
          if (connectorHoveredObjectIdRef.current) {
            const obj = objectsRef.current?.[connectorHoveredObjectIdRef.current]
            if (obj && obj.type !== 'line' && obj.type !== 'pen') {
              const framesById: FramesByIdMap = {}
              for (const o of Object.values(objectsRef.current ?? {})) {
                if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
              }
              const pt = getNearestEdgePoint(obj, canvas, framesById)
              const newAnchor = pt ? { x: pt.x, y: pt.y } : null
              const last = lastConnectorHoverAnchorRef.current
              const changed = !last !== !newAnchor ||
                (newAnchor && (!last || Math.abs(newAnchor.x - last.x) > POS_THRESHOLD || Math.abs(newAnchor.y - last.y) > POS_THRESHOLD))
              if (changed) {
                lastConnectorHoverAnchorRef.current = newAnchor
                setConnectorHoverAnchor(newAnchor)
              }
            } else {
              if (lastConnectorHoverAnchorRef.current !== null) {
                lastConnectorHoverAnchorRef.current = null
                setConnectorHoverAnchor(null)
              }
            }
          } else {
            if (lastConnectorHoverAnchorRef.current !== null) {
              lastConnectorHoverAnchorRef.current = null
              setConnectorHoverAnchor(null)
            }
          }
        }
      })
    },
    [id, editingText, flushCursorUpdate, connectorToolActive]
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

  const handleObjectDragStart = useCallback(() => {
    justFinishedObjectDragRef.current = true
  }, [])

  const handleObjectDragEnd = useCallback(
    async (objectId: string, x: number, y: number) => {
      if (!id || !canEdit) return
      justFinishedObjectDragRef.current = true
      const currentObjects = objects
      const currentSelected = expandedSelectedIds ?? selectedIdsRef.current
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
      } else if (draggedObj.type === 'pen') {
        const bounds = getObjectBounds(draggedObj)
        dx = x - bounds.left
        dy = y - bounds.top
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
      const penUpdates: Array<{ oid: string; points: [number, number][]; from: { points: [number, number][] } }> = []
      const batchUndoItems: Array<{ objectId: string; from: Record<string, unknown>; to: Record<string, unknown> }> = []

      const movingObjectIds = new Set(idsToMove.filter((id) => currentObjects[id]?.type !== 'line'))

      for (const oid of idsToMove) {
        const o = currentObjects[oid]
        if (!o) continue
        if (o.type === 'line') {
          const line = o as LineObject
          const status = getLineAnchorStatus(line, oid, currentObjects, movingObjectIds, framesById)
          let to: { start: { x: number; y: number }; end: { x: number; y: number } }
          if (status.startConnected && status.endConnected) {
            to = {
              start: { x: line.start.x + dx, y: line.start.y + dy },
              end: { x: line.end.x + dx, y: line.end.y + dy },
            }
          } else if (status.startConnected) {
            to = {
              start: { x: line.start.x + dx, y: line.start.y + dy },
              end: { ...line.end },
            }
          } else if (status.endConnected) {
            to = {
              start: { ...line.start },
              end: { x: line.end.x + dx, y: line.end.y + dy },
            }
          } else {
            continue
          }
          lineUpdates.push({ oid, to, from: { start: line.start, end: line.end } })
        } else if (o.type === 'pen') {
          const pen = o as PenObject
          const newPoints = pen.points.map(([px, py]) => [px + dx, py + dy] as [number, number])
          penUpdates.push({ oid, points: newPoints, from: { points: pen.points } })
        } else if (o.type === 'frame') {
          const pos = (o as { position: { x: number; y: number } }).position
          const newX = oid === objectId ? x : pos.x + dx
          const newY = oid === objectId ? y : pos.y + dy
          positionUpdates[oid] = { objectId: oid, x: newX, y: newY }
          batchUndoItems.push({
            objectId: oid,
            from: { position: pos },
            to: { position: { x: newX, y: newY } },
          })
          dragUpdateQueueRef.current.set(oid, { objectId: oid, x: newX, y: newY })
        } else if (isNestableType(o.type) && 'position' in o) {
          const parentId = getParentId(o)
          if (parentId && idsToMove.includes(parentId)) {
            continue
          }
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
          batchUndoItems.push({
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
        batchUndoItems.push({ objectId: oid, from, to })
      }

      if (lineUpdates.length > 0) {
        const posArray = Object.values(positionUpdates)
        const lineArray = lineUpdates.map((l) => ({ objectId: l.oid, start: l.to.start, end: l.to.end }))
        posArray.forEach((p) => dragUpdateQueueRef.current.delete(p.objectId))
        lineArray.forEach((l) => dragUpdateQueueRef.current.delete(l.objectId))
        await batchUpdatePositionsAndLines(id, posArray, lineArray)
      }

      for (const { oid, points, from } of penUpdates) {
        batchUndoItems.push({ objectId: oid, from, to: { points } })
        await updateObject(id, oid, { points })
      }

      if (batchUndoItems.length > 0) {
        if (batchUndoItems.length === 1) {
          const u = batchUndoItems[0]
          pushUndo({ type: 'update', objectId: u.objectId, from: u.from, to: u.to })
        } else {
          pushUndo({ type: 'batchUpdate', updates: batchUndoItems })
        }
      }

      if (penUpdates.length > 0) {
        setObjects((prev: ObjectsMap) => {
          let next = prev
          for (const { oid, points } of penUpdates) {
            const o = next[oid]
            if (o && o.type === 'pen') {
              next = { ...next, [oid]: { ...o, points } }
            }
          }
          return next
        })
      }

      if (lineUpdates.length > 0) {
        setObjects((prev: ObjectsMap) => {
          let next = prev
          for (const { oid, to } of lineUpdates) {
            const o = next[oid]
            if (o && o.type === 'line') {
              next = { ...next, [oid]: { ...o, start: to.start, end: to.end } }
            }
          }
          return next
        })
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
      clearMultiDragPositions?.()
      flushDragUpdates()
    },
    [id, canEdit, objects, pushUndo, setObjects, clearMultiDragPositions, expandedSelectedIds]
  )

  const handleLassoEnd = useCallback(
    (polygon: { x: number; y: number }[]) => {
      const framesById: FramesByIdMap = {}
      for (const o of Object.values(objects)) {
        if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
      }
      const allIds = objectsInLassoPolygon(objects, polygon, framesById)
      const ids = allIds.filter((objectId) => objects[objectId]?.type === 'pen')
      setSelectedIds(new Set(ids))
      setActiveTool('pointer')
    },
    [objects, setSelectedIds, setActiveTool]
  )

  const handleSelectionBoxEnd = useCallback(
    (rect: { left: number; top: number; right: number; bottom: number }) => {
      const framesById: FramesByIdMap = {}
      for (const o of Object.values(objects)) {
        if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
      }
      const allIds = objectsInSelectionRect(objects, rect, framesById)
      setSelectedIds(new Set(allIds))
      setActiveTool('pointer')
    },
    [objects, setSelectedIds, setActiveTool]
  )

  const handleObjectClick = useCallback(
    async (objectId: string, e: { ctrlKey: boolean; metaKey: boolean }, canvasPos?: { x: number; y: number }) => {
      if (PERSISTENT_DRAWING_TOOLS.includes(activeTool as (typeof PERSISTENT_DRAWING_TOOLS)[number])) {
        return
      }
      const obj = objects[objectId]
      if (!obj) return

      if (connectorToolActive && canEdit && obj.type !== 'line' && obj.type !== 'pen') {
        const framesById: FramesByIdMap = {}
        for (const o of Object.values(objects)) {
          if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
        }
        const b = getObjectBounds(obj)
        const clickPos: { x: number; y: number } = canvasPos ?? { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
        const anchorResult = getNearestAnchor(obj, clickPos, framesById)
        if (!anchorResult) return
        const [anchorSide, anchorPoint] = anchorResult

        const state = connectorStateRef.current
        if (state.phase === 'idle') {
          connectorStateRef.current = {
            phase: 'preview',
            sourceObjectId: objectId,
            sourceAnchorPoint: anchorPoint,
            sourceAnchor: anchorSide,
            sourceAnchorT: anchorPoint.t,
          }
          setConnectorSource({ sourceObjectId: objectId, sourceAnchorPoint: anchorPoint, sourceAnchor: anchorSide })
          setConnectorPreviewEndPos(canvasPos ? { x: canvasPos.x, y: canvasPos.y } : { x: anchorPoint.x, y: anchorPoint.y })
          return
        }
        if (state.phase === 'preview' && state.sourceObjectId === objectId) {
          return
        }
        if (state.phase === 'preview' && state.sourceObjectId !== objectId) {
          const destCenter: { x: number; y: number } = canvasPos ?? (() => { const b2 = getObjectBounds(obj); return { x: (b2.left + b2.right) / 2, y: (b2.top + b2.bottom) / 2 }; })()
          const destAnchorResult = getNearestAnchor(obj, destCenter, framesById)
          if (!destAnchorResult || !id) return
          const [destAnchorSide, destAnchorPoint] = destAnchorResult
          const maxDisplayOrder = Math.max(0, ...Object.values(objects).map((o) => o.displayOrder ?? (o.createdAt?.toMillis?.() ?? 0)))
          const input = {
            type: 'line' as const,
            start: state.sourceAnchorPoint!,
            end: destAnchorPoint,
            strokeColor: '#374151',
            strokeWidth: 2,
            connectionType: activeConnectorType as 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double',
            startObjectId: state.sourceObjectId!,
            endObjectId: objectId,
            startAnchor: state.sourceAnchor,
            startAnchorT: state.sourceAnchorT,
            endAnchor: destAnchorSide,
            endAnchorT: destAnchorPoint.t,
            displayOrder: maxDisplayOrder + 1,
          }
          const newId = await createObject(id, input)
          pushUndo({ type: 'create', objectId: newId, createInput: input })
          setSelectedIds(new Set([newId]))
          connectorStateRef.current = { phase: 'idle', sourceObjectId: null, sourceAnchorPoint: null, sourceAnchor: 'right', sourceAnchorT: 0.5 }
          setConnectorSource(null)
          setConnectorPreviewEndPos(null)
          return
        }
      }

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
    [activeTool, objects, setSelectedIds, connectorToolActive, canEdit, id, activeConnectorType, pushUndo]
  )

  const handleObjectResizeEnd = useCallback(
    async (objectId: string, updates: ObjectResizeUpdates) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      if (!obj) return
      const from =
        'start' in updates
          ? { start: (obj as LineObject).start, end: (obj as LineObject).end }
          : 'points' in updates
            ? { points: (obj as PenObject).points }
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
        if ('points' in updates) {
          return { ...prev, [objectId]: { ...o, points: updates.points } }
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
      if (isConverting) return
      if (justClosedStickyEditorRef.current || justClosedTextEditorRef.current) {
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

      if (connectorStateRef.current.phase === 'preview') {
          connectorStateRef.current = { phase: 'idle', sourceObjectId: null, sourceAnchorPoint: null, sourceAnchor: 'right', sourceAnchorT: 0.5 }
        setConnectorSource(null)
        setConnectorPreviewEndPos(null)
        return
      }

      if (justFinishedArrowDragRef.current) {
        justFinishedArrowDragRef.current = false
        return
      }
      if (justFinishedObjectDragRef.current) {
        justFinishedObjectDragRef.current = false
        return
      }
      if (justFinishedPenStrokeRef.current) {
        justFinishedPenStrokeRef.current = false
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
            dimensions: { width: 200, height: 40 },
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
    [id, activeTool, canEdit, pendingEmoji, pushUndo, editingStickyId, editingText, objects, setObjects, maybeSwitchToPointer, isConverting]
  )

  const handleStickyDoubleClick = useCallback((objectId: string) => {
    if (!canEdit) return
    if (PERSISTENT_DRAWING_TOOLS.includes(activeToolRef.current as (typeof PERSISTENT_DRAWING_TOOLS)[number])) return
    setEditingStickyId(objectId)
  }, [canEdit, setEditingStickyId])

  const handleTextDoubleClick = useCallback(
    (objectId: string) => {
      if (!canEdit) return
      if (PERSISTENT_DRAWING_TOOLS.includes(activeToolRef.current as (typeof PERSISTENT_DRAWING_TOOLS)[number])) return
      const objs = objectsRef.current
      const obj = objs[objectId]
      if (!obj || obj.type !== 'text') return
      const textObj = obj as TextObject
      const content = textObj.content ?? ''
      const framesById: FramesByIdMap = {}
      for (const o of Object.values(objs)) {
        if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
      }
      const worldPos = getParentId(obj)
        ? (resolveWorldPos(obj, framesById) ?? { x: obj.position.x, y: obj.position.y })
        : obj.position
      const vp = viewportRef.current
      const stage = canvasToStage(worldPos.x, worldPos.y, vp)
      const rect = containerRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + stage.x : stage.x
      const screenY = rect ? rect.top + stage.y : stage.y
      textareaValueRef.current = content
      setEditingText({
        id: objectId,
        screenX,
        screenY,
        canvasX: worldPos.x,
        canvasY: worldPos.y,
        value: content,
        isNew: false,
        textStyle: { ...DEFAULT_TEXT_STYLE, ...textObj.textStyle },
        dimensions: textObj.dimensions,
      })
    },
    [canEdit, setEditingText]
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
    async (value: string, dimensions?: { width: number; height: number }) => {
      if (!id || !canEdit || !editingText) return
      const trimmed = value.trim()
      const raw = dimensions ?? editingText.dimensions
      const dims = {
        width: Math.max(100, raw.width),
        height: Math.max(40, raw.height),
      }
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
          dimensions: dims,
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
        pushUndo({
          type: 'update',
          objectId,
          from: { content: oldContent },
          to: { content: trimmed, dimensions: dims },
        })
        await updateObject(id, objectId, { content: trimmed, dimensions: dims })
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
      if (isConverting || !penDrawingActive) return
      const pts: [number, number][] = [[pos.x, pos.y]]
      currentPenPointsRef.current = pts
      tools.setIsPenStrokeActive(true)
    },
    [penDrawingActive, isConverting, tools]
  )

  const handlePenStrokeMove = useCallback(
    (pos: { x: number; y: number }) => {
      if (!penDrawingActive) return
      currentPenPointsRef.current.push([pos.x, pos.y])
      const lineRef = tools.activeStrokeLineRef
      if (lineRef?.current) {
        const flat = currentPenPointsRef.current.flatMap(([x, y]) => [x, y])
        lineRef.current.points(flat)
        lineRef.current.getLayer()?.batchDraw()
      }
    },
    [penDrawingActive, tools]
  )

  const handlePenStrokeEnd = useCallback(
    async (finalPos?: { x: number; y: number }) => {
      justFinishedPenStrokeRef.current = true
      let pointsToSave = [...currentPenPointsRef.current]
      if (finalPos) {
        pointsToSave = [...pointsToSave, [finalPos.x, finalPos.y] as [number, number]]
      }
      currentPenPointsRef.current = []
      tools.setIsPenStrokeActive(false)
      const lineRef = tools.activeStrokeLineRef
      if (lineRef?.current) {
        lineRef.current.points([])
        lineRef.current.getLayer()?.batchDraw()
      }
      if (!id || !canEdit || pointsToSave.length < 2) return
      const isHighlighter = activeTool === 'highlighter'
      const maxDisplayOrder = Math.max(
        0,
        ...Object.values(objects).map((o) => o.displayOrder ?? (o.createdAt?.toMillis?.() ?? 0))
      )
      const input: CreateObjectInput = {
        type: 'pen',
        points: pointsToSave,
        color: penStyles.color,
        strokeWidth: penStyles.size,
        isHighlighter,
        opacity: penStyles.opacity / 100,
        strokeType: penStyles.strokeType,
        displayOrder: maxDisplayOrder + 1,
      }
      const objectId = await createObject(id, input)
      pushUndo({ type: 'create', objectId, createInput: input })
      setSelectedIds(new Set([objectId]))
    },
    [id, canEdit, activeTool, penStyles, pushUndo, objects, tools, setSelectedIds]
  )

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

  const handleAddLink = useCallback(
    async (url: string, contentType?: 'image' | 'document') => {
      if (!id || !canEdit) return
      if (selectedIds.size > 0) {
        const ids = Array.from(selectedIds)
        for (const oid of ids) {
          const obj = objects[oid]
          if (!obj || obj.type === 'pen' || obj.type === 'line') continue
          const currentLink = (obj as { linkUrl?: string | null }).linkUrl ?? null
          pushUndo({ type: 'update', objectId: oid, from: { linkUrl: currentLink }, to: { linkUrl: url } })
          await updateObject(id, oid, { linkUrl: url })
        }
        return
      }
      const center = getViewportCenter()
      const maxZ = Math.max(0, ...Object.values(objects).map((o) => o.displayOrder ?? o.createdAt?.toMillis?.() ?? 0))
      let input: CreateObjectInput
      if (contentType === 'image' || (contentType !== 'document' && isImageUrl(url))) {
        console.log('[IMAGE UPLOAD] handleAddLink: creating image from URL')
        input = { type: 'image', position: { x: center.x - 200, y: center.y - 150 }, dimensions: { width: 400, height: 300 }, url }
      } else if (contentType === 'document') {
        input = { type: 'document', position: { x: center.x - 100, y: center.y - 120 }, dimensions: { width: 200, height: 240 }, url, fileName: 'Document', fileType: 'pdf' }
      } else if (isYouTube(url)) {
        input = { type: 'embed', position: { x: center.x - 280, y: center.y - 158 }, dimensions: { width: 560, height: 315 }, url, embedType: 'youtube' }
      } else if (isGoogleDoc(url)) {
        input = { type: 'embed', position: { x: center.x - 300, y: center.y - 200 }, dimensions: { width: 600, height: 400 }, url, embedType: 'google-doc' }
      } else {
        input = { type: 'link-card', position: { x: center.x - 150, y: center.y - 40 }, dimensions: { width: 300, height: 80 }, url, title: url }
      }
      const newId = await createObject(id, { ...input, displayOrder: maxZ + 1 })
      if (input.type === 'image') {
        console.log('[IMAGE UPLOAD] handleAddLink created object id:', newId)
        console.log('[IMAGE UPLOAD] setSelectedIds called with:', newId)
        console.log('[IMAGE UPLOAD] setActiveTool called: pointer')
      }
      pushUndo({ type: 'create', objectId: newId, createInput: input })
      setSelectedIds(new Set([newId]), { force: true })
      setActiveTool('pointer')
    },
    [id, canEdit, selectedIds, objects, pushUndo, getViewportCenter, setSelectedIds, setActiveTool]
  )

  const getMaxDisplayOrder = useCallback(() => {
    return Math.max(0, ...Object.values(objects).map((o) => o.displayOrder ?? o.createdAt?.toMillis?.() ?? 0))
  }, [objects])

  const handleCanvasFileDrop = useCallback(
    async (files: File[], dropCanvasPos: { x: number; y: number }) => {
      if (!id || !canEdit) return
      const center = dropCanvasPos
      const maxZ = getMaxDisplayOrder() + 1
      for (const file of files) {
        try {
          if (file.type.startsWith('image/')) {
            console.log('[IMAGE UPLOAD] Starting upload')
            const url = await uploadBoardImage(id, file)
            const dims = await new Promise<{ w: number; h: number }>((resolve) => {
              const img = new window.Image()
              img.onload = () => {
                let w = img.naturalWidth
                let h = img.naturalHeight
                if (w > 800) {
                  h = (h * 800) / w
                  w = 800
                }
                resolve({ w, h })
              }
              img.onerror = () => resolve({ w: 400, h: 300 })
              img.src = url
            })
            const input: CreateObjectInput = {
              type: 'image',
              position: { x: center.x - dims.w / 2, y: center.y - dims.h / 2 },
              dimensions: { width: dims.w, height: dims.h },
              url,
              displayOrder: maxZ,
            }
            const newId = await createObject(id, input)
            console.log('[IMAGE UPLOAD] Created object id:', newId)
            pushUndo({ type: 'create', objectId: newId, createInput: input })
            setSelectedIds(new Set([newId]), { force: true })
            console.log('[IMAGE UPLOAD] setSelectedIds called with:', newId)
          } else if (file.type === 'application/pdf') {
            const url = await uploadBoardFile(id, file)
            const input: CreateObjectInput = {
              type: 'document',
              position: { x: center.x - 100, y: center.y - 120 },
              dimensions: { width: 200, height: 240 },
              url,
              fileName: file.name,
              fileType: 'pdf',
              displayOrder: maxZ,
            }
            const newId = await createObject(id, input)
            pushUndo({ type: 'create', objectId: newId, createInput: input })
            setSelectedIds(new Set([newId]), { force: true })
          }
        } catch (err) {
          console.error('File drop failed:', err)
          showToast?.(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      console.log('[IMAGE UPLOAD] setActiveTool called: pointer')
      setActiveTool('pointer')
    },
    [id, canEdit, getMaxDisplayOrder, pushUndo, setSelectedIds, setActiveTool, showToast]
  )

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!id || !canEdit || !files || files.length === 0) return
      const center = getViewportCenter()
      await handleCanvasFileDrop(Array.from(files), center)
    },
    [id, canEdit, getViewportCenter, handleCanvasFileDrop]
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
    const framesById: FramesByIdMap = {}
    for (const o of Object.values(objects)) {
      if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
    }
    const idsToDelete = new Set<string>()
    const frameIds = new Set<string>()
    selectedIds.forEach((oid) => {
      const o = objects[oid]
      if (o?.type === 'frame') frameIds.add(oid)
    })
    for (const fid of frameIds) {
      const frame = objects[fid]
      if (!frame || frame.type !== 'frame') continue
      const childIds = Object.values(objects)
        .filter((o) => getParentId(o) === fid)
        .map((o) => o.objectId)
      const movingIds = new Set([fid, ...childIds])
      const connectedLineIds = getConnectedLineIds(objects, movingIds, framesById)
      const children = childIds.map((cid) => objects[cid]).filter(Boolean)
      const connectedLines = Array.from(connectedLineIds).map((lid) => objects[lid]).filter(Boolean)
      pushUndo({
        type: 'DELETE_FRAME_WITH_CONTENTS',
        snapshot: {
          frame: { ...frame } as BoardObject,
          children: children.map((o) => ({ ...o } as BoardObject)),
          connectedLines: connectedLines.map((o) => ({ ...o } as BoardObject)),
        },
      })
      idsToDelete.add(fid)
      childIds.forEach((cid) => idsToDelete.add(cid))
      connectedLineIds.forEach((lid) => idsToDelete.add(lid))
    }
    for (const oid of selectedIds) {
      if (idsToDelete.has(oid)) continue
      const obj = objects[oid]
      if (obj) {
        pushUndo({ type: 'delete', objectId: oid, deleted: obj })
        idsToDelete.add(oid)
      }
    }
    if (idsToDelete.size > 0) {
      setObjects((prev: ObjectsMap) => {
        const next = { ...prev }
        idsToDelete.forEach((oid) => delete next[oid])
        return next
      })
      setSelectedIds(new Set())
      const ids = Array.from(idsToDelete)
      if (ids.length === 1) {
        deleteObject(id, ids[0])
      } else {
        batchDeleteObjects(id, ids)
      }
    }
  }, [id, canEdit, selectedIds, objects, pushUndo, setSelectedIds, setObjects])

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

  /**
   * Converts selected pen strokes to text via handwriting recognition API.
   * Creates a text object at the strokes' position, deletes the strokes.
   */
  const handleHandwritingRecognition = useCallback(async () => {
    if (isConverting || !id || !canEdit || selectedIds.size === 0) return
    const penObjs = Array.from(selectedIds)
      .map((oid) => objects[oid])
      .filter((o): o is PenObject => o != null && o.type === 'pen')
    if (penObjs.length === 0) {
      showToast?.('Please select pen strokes to convert')
      return
    }
    const token = await getIdToken()
    if (!token) {
      showToast?.('You must be signed in to use handwriting recognition')
      return
    }
    setIsConverting(true)
    try {
      const blob = await penStrokesToImageBlob(penObjs)
      const { text } = await recognizeHandwriting(blob, token)
      if (!text.trim()) {
        showToast?.('No text was recognized in the selection')
        return
      }
      const boundsList = penObjs.map((obj) => getObjectBounds(obj))
      const union = unionBounds(boundsList)
      if (!union) {
        showToast?.('Could not determine position')
        return
      }
      const penW = union.right - union.left
      const penH = union.bottom - union.top

      const strokeColorCounts = penObjs.reduce((acc, s) => {
        const c =
          (s as { color?: string }).color ||
          (s as { stroke?: string }).stroke ||
          (s as { strokeColor?: string }).strokeColor ||
          (s as { fill?: string }).fill ||
          '#000000'
        acc[c] = (acc[c] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
      const fontColor =
        Object.entries(strokeColorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#000000'

      const totalHeight = penH
      const totalWidth = penW
      const isLikelySingleLine = totalHeight / totalWidth < 0.25
      const estimatedLines = isLikelySingleLine
        ? 1
        : Math.max(1, Math.round(totalHeight / (totalWidth * 0.15)))
      const rawFontSize = Math.round(totalHeight / estimatedLines)
      const fontSize = Math.min(300, Math.max(12, rawFontSize))

      const textStyle = { ...DEFAULT_TEXT_STYLE, fontColor, fontSize }
      const scaledMaxWidth = Math.max(800, fontSize * 20)
      const { width: textW, height: textH } = measureTextDimensions(
        text.trim(),
        fontSize,
        textStyle.fontFamily,
        scaledMaxWidth
      )
      const textX = union.left + penW / 2 - textW / 2
      const textY = union.top + penH / 2 - textH / 2
      const textInput: CreateObjectInput = {
        type: 'text',
        position: { x: textX, y: textY },
        dimensions: { width: textW, height: textH },
        content: text.trim(),
        textStyle,
      }
      const newId = await createObject(id, textInput)
      for (const p of penObjs) {
        pushUndo({ type: 'delete', objectId: p.objectId, deleted: p })
      }
      pushUndo({ type: 'create', objectId: newId, createInput: textInput })
      const penIds = penObjs.map((p) => p.objectId)
      if (penIds.length === 1) {
        deleteObject(id, penIds[0])
      } else {
        batchDeleteObjects(id, penIds)
      }
      setObjects((prev: ObjectsMap) => {
        const next = { ...prev }
        penIds.forEach((oid) => delete next[oid])
        return next
      })
      setSelectedIds(new Set([newId]))
      const stage = canvasToStage(textX, textY, viewport)
      const rect = containerRef.current?.getBoundingClientRect()
      const screenX = rect ? rect.left + stage.x : stage.x
      const screenY = rect ? rect.top + stage.y : stage.y
      setEditingText({
        id: newId,
        screenX,
        screenY,
        canvasX: textX,
        canvasY: textY,
        value: text.trim(),
        isNew: false,
        textStyle,
        dimensions: { width: textW, height: textH },
      })
      setConvertJustFinishedId(newId)
      setTimeout(() => setConvertJustFinishedId(null), 200)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast?.(msg)
      setConvertButtonShake(true)
      setTimeout(() => setConvertButtonShake(false), 400)
    } finally {
      setIsConverting(false)
    }
  }, [
    id,
    canEdit,
    selectedIds,
    objects,
    pushUndo,
    setSelectedIds,
    setObjects,
    setEditingText,
    showToast,
    viewport,
    containerRef,
    isConverting,
  ])

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

        const wrapped = createdItems.length >= 2
          ? await wrapCreatedItemsInFrame(id, createdItems)
          : createdItems
        for (const { objectId, createInput } of wrapped) {
          pushUndo({ type: 'create', objectId, createInput })
        }
        const ids = wrapped.map((item) => item.objectId)
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

  /** Inserts template by key: composed first (wrapped in frame), else format-structure fallback. */
  const insertTemplateByKey = useCallback(
    async (key: string): Promise<void> => {
      if (!id || !canEdit) return

      const composed = buildComposedTemplate(key)
      if (composed.length > 0) {
        const framesById: FramesByIdMap = {}
        for (const o of Object.values(objects)) {
          if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
        }
        const existingBounds = getBoardContentBounds(objects, framesById)
        const SPAWN_GAP = 100
        const viewportCenter = getViewportCenter()
        let spawnCenterX: number
        let spawnCenterY: number
        if (!existingBounds) {
          spawnCenterX = viewportCenter.x
          spawnCenterY = viewportCenter.y
        } else {
          const framePadding = key === 'swot' ? 48 : 24
          const { frameInput } = wrapComposedTemplateInFrame(composed, undefined, framePadding)
          const fw = 'dimensions' in frameInput ? frameInput.dimensions.width : 400
          const fh = 'dimensions' in frameInput ? frameInput.dimensions.height : 300
          spawnCenterX = existingBounds.maxX + SPAWN_GAP + fw / 2
          spawnCenterY = existingBounds.minY + fh / 2
        }
        const maxDisplayOrder = Object.values(objects).reduce(
          (m, o) => Math.max(m, o.displayOrder ?? (o.createdAt?.toMillis?.() ?? 0)),
          0
        )
        const created = await insertComposedTemplateWithFrame(id, key, composed, spawnCenterX, spawnCenterY, maxDisplayOrder)
        for (const { objectId, createInput } of created) {
          pushUndo({ type: 'create', objectId, createInput })
        }
        if (created.length > 0) {
          setSelectedIds(new Set(created.map((c) => c.objectId)))
          maybeSwitchToPointer()
          const frame = created[0]
          const framePos = 'position' in frame.createInput ? frame.createInput.position : { x: spawnCenterX, y: spawnCenterY }
          const dims = 'dimensions' in frame.createInput ? frame.createInput.dimensions : { width: 400, height: 300 }
          const templateCenterX = framePos.x + dims.width / 2
          const templateCenterY = framePos.y + dims.height / 2
          const w = dimensions.width
          const h = dimensions.height
          data.setViewport((prev) => ({
            ...prev,
            x: w / 2 - templateCenterX * prev.scale,
            y: h / 2 - templateCenterY * prev.scale,
          }))
        }
        return
      }

      const format = TEMPLATE_FORMAT_MAP[key]
      if (format) {
        await insertFormatsStructure(format)
      } else {
        await insertFormatsStructure('Doc')
      }
    },
    [id, canEdit, objects, dimensions, data, getViewportCenter, pushUndo, setSelectedIds, maybeSwitchToPointer, insertFormatsStructure]
  )

  useEffect(() => {
    const handleCopyPasteDuplicate = async (e: KeyboardEvent) => {
      if (!canEdit || editingStickyId || editingText) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'c') {
        e.preventDefault()
        handleCopy()
      } else if (meta && e.key === 'v') {
        e.preventDefault()
        if (copiedObjects.length > 0) {
          handlePaste()
        } else {
          try {
            const text = await navigator.clipboard.readText()
            const trimmed = text?.trim() ?? ''
            if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
              await handleAddLink(trimmed)
            }
          } catch {
            /* clipboard not available or permission denied */
          }
        }
      } else if (meta && e.key === 'd') {
        e.preventDefault()
        if (selectedIds.size > 0) handleDuplicate()
      }
    }
    window.addEventListener('keydown', handleCopyPasteDuplicate)
    return () => window.removeEventListener('keydown', handleCopyPasteDuplicate)
  }, [canEdit, editingStickyId, editingText, selectedIds, copiedObjects, handleCopy, handlePaste, handleDuplicate, handleAddLink])

  return {
    handleStageMouseMove,
    handleObjectDragStart,
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
    handleAddLink,
    handleCanvasFileDrop,
    handleUploadFiles,
    handleSelectionBoxEnd,
    handleLassoEnd,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleDelete,
    handleSendToFront,
    handleBringToBack,
    handleHandwritingRecognition,
    insertTemplateByKey,
    isConverting,
    convertButtonShake,
    convertJustFinishedId,
    connectorSource,
    connectorPreviewEndPos,
    connectorHoveredObjectId,
    connectorHoverAnchor,
    onConnectorHover,
    connectorToolActive,
    activeConnectorType,
  }
}
