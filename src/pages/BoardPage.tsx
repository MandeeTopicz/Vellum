import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getBoard, getCurrentUserRole, canCurrentUserEdit, updateBoard } from '../services/board'
import {
  subscribeToObjects,
  createObject,
  updateObject,
  deleteObject,
  restoreObject,
  objectToFirestoreDoc,
  type ObjectUpdates,
} from '../services/objects'
import {
  createComment,
  addCommentReply,
  deleteComment,
  restoreComment,
  subscribeToComments,
} from '../services/comments'
import { loadUndoStacks, saveUndoStacks, MAX_STACK_SIZE } from '../services/undoHistory'
import {
  setUserPresence,
  subscribeToPresence,
  subscribeToRtdbConnection,
  updateCursor,
} from '../services/presence'
import { useAuth } from '../context/AuthContext'
import type { Board as BoardType } from '../types'
import type { ObjectsMap, LineObject, PenObject, BoardObject, TextObject } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types/objects'
import type { BoardComment } from '../services/comments'
import type { PresenceUser } from '../services/presence'
import InfiniteCanvas, {
  type Viewport,
  type BackgroundClickPayload,
  canvasToStage,
} from '../components/Canvas/InfiniteCanvas'
import { stageToCanvas } from '../utils/coordinates'
import ObjectLayer, { type ObjectResizeUpdates, type CurrentPenStroke } from '../components/Canvas/ObjectLayer'
import CursorLayer from '../components/Canvas/CursorLayer'
import CommentLayer from '../components/Canvas/CommentLayer'
import WhiteboardToolbar from '../components/Canvas/WhiteboardToolbar'
import PenStylingToolbar, { type PenStyles } from '../components/Canvas/PenStylingToolbar'
import AIChatPanel from '../components/Canvas/AIChatPanel'
import type { WhiteboardTool } from '../components/Canvas/WhiteboardToolbar'
import WhiteboardNav from '../components/Canvas/WhiteboardNav'
import WhiteboardControls from '../components/Canvas/WhiteboardControls'
import StickyTextEditor from '../components/Canvas/StickyTextEditor'
import TextOverlayTextarea, { type EditingTextState } from '../components/Canvas/TextOverlayTextarea'
import TextFormatToolbar from '../components/Canvas/TextFormatToolbar'
import CommentModal from '../components/Canvas/CommentModal'
import CommentThreadModal from '../components/Canvas/CommentThreadModal'
import InviteModal from '../components/Invite/InviteModal'
import { getPendingInviteForBoard, acceptInvite } from '../services/invites'
import { processAICommand, clearConversation } from '../services/aiAgent'
import aiIcon from '../assets/ai-icon.png'
import type { BoardInvite } from '../types'
import './BoardPage.css'

const ERASER_CURSOR =
  "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\"><circle cx=\"16\" cy=\"16\" r=\"10\" fill=\"none\" stroke=\"%23333\" stroke-width=\"2\"/></svg>') 16 16, crosshair"

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [board, setBoard] = useState<BoardType | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [pendingInvite, setPendingInvite] = useState<BoardInvite | null>(null)
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [objects, setObjects] = useState<ObjectsMap>({})
  const [comments, setComments] = useState<BoardComment[]>([])
  const [, setPresence] = useState<PresenceUser[]>([])
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('pointer')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<EditingTextState | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [commentModalPos, setCommentModalPos] = useState<{ x: number; y: number } | null>(null)
  const [commentThread, setCommentThread] = useState<BoardComment | null>(null)
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [currentPenPoints, setCurrentPenPoints] = useState<[number, number][]>([])
  /** Ref updated synchronously during stroke so mouseup always has latest points (avoids React batching delay) */
  const currentPenPointsRef = useRef<[number, number][]>([])
  /** Click-and-drag arrow preview: live preview during drag */
  const [arrowPreview, setArrowPreview] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
    type: string
  } | null>(null)
  const justFinishedArrowDragRef = useRef(false)

  const [penToolStyles, setPenToolStyles] = useState<PenStyles>({
    color: '#000000',
    size: 3,
    opacity: 100,
    strokeType: 'solid',
  })
  const [highlighterToolStyles, setHighlighterToolStyles] = useState<PenStyles>({
    color: '#eab308',
    size: 24,
    opacity: 35,
    strokeType: 'solid',
  })
  const [eraserSize, setEraserSize] = useState(10)
  const [showGrid, setShowGrid] = useState(() => {
    try {
      const v = localStorage.getItem('vellum:showGrid')
      return v === null ? true : v === 'true'
    } catch {
      return true
    }
  })
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }))
  type UndoAction =
    | { type: 'create'; objectId: string; createInput: Parameters<typeof createObject>[1] }
    | { type: 'update'; objectId: string; from: Record<string, unknown>; to: Record<string, unknown> }
    | { type: 'delete'; objectId: string; deleted: BoardObject }
    | { type: 'deleteComment'; commentId: string; deleted: BoardComment }
  const undoStackRef = useRef<UndoAction[]>([])
  const redoStackRef = useRef<UndoAction[]>([])
  const justClosedStickyEditorRef = useRef(false)
  const justClosedTextEditorRef = useRef(false)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const id = boardId ?? ''
  const CURSOR_DEBUG = import.meta.env?.DEV === true

  useEffect(() => {
    if (!id) return
    let cancelled = false
    loadUndoStacks(id).then((stacks) => {
      if (cancelled || !stacks) return
      undoStackRef.current = stacks.undoStack as UndoAction[]
      redoStackRef.current = stacks.redoStack as UndoAction[]
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !user) return
    const uid = user.uid
    let cancelled = false
    async function load() {
      try {
        const b = await getBoard(id)
        if (cancelled) return
        if (!b) {
          setAccessDenied(true)
          setBoard(null)
          setPendingInvite(null)
          return
        }
        // Owner always has access
        if (b.ownerId === uid) {
          setBoard(b)
          setAccessDenied(false)
          setPendingInvite(null)
          const edit = await canCurrentUserEdit(id)
          if (!cancelled) setCanEdit(edit)
          return
        }
        const role = await getCurrentUserRole(id)
        if (cancelled) return
        if (role === null) {
          const invite = await getPendingInviteForBoard(id)
          if (cancelled) return
          if (invite) {
            setBoard(b)
            setPendingInvite(invite)
            setAccessDenied(false)
          } else {
            setAccessDenied(true)
            setBoard(b)
            setPendingInvite(null)
          }
          return
        }
        setBoard(b)
        setAccessDenied(false)
        setPendingInvite(null)
        const edit = await canCurrentUserEdit(id)
        if (!cancelled) setCanEdit(edit)
      } catch (err) {
        if (!cancelled) {
          console.error('[BoardPage] load error:', err)
          setAccessDenied(true)
          setBoard(null)
          setPendingInvite(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, user?.uid])

  useEffect(() => {
    if (!id || !user) return
    setUserPresence(id)
  }, [id, user])

  useEffect(() => {
    if (!id || !user) return
    if (containerRef.current) {
      const centerX = (dimensions.width / 2 - viewport.x) / viewport.scale
      const centerY = (dimensions.height / 2 - viewport.y) / viewport.scale
      updateCursor(id, centerX, centerY)
    }
  }, [id, user, dimensions, viewport])

  useEffect(() => {
    if (!id) return
    const unsub = subscribeToObjects(id, setObjects)
    return unsub
  }, [id])

  useEffect(() => {
    if (!id) return
    const unsub = subscribeToComments(id, setComments)
    return unsub
  }, [id])

  useEffect(() => {
    if (!id) return
    const unsub = subscribeToPresence(id, setPresence)
    return unsub
  }, [id])

  useEffect(() => {
    if (!CURSOR_DEBUG) return
    console.log('[CURSOR] Board mounted', { boardId: id, userId: user?.uid, hasUser: !!user })
    if (!user?.uid) console.error('[CURSOR] userId is null/undefined!')
    if (!id) console.error('[CURSOR] boardId is null/undefined!')
  }, [CURSOR_DEBUG, id, user?.uid])

  useEffect(() => {
    if (!CURSOR_DEBUG) return
    const unsub = subscribeToRtdbConnection((connected) => {
      console.log(connected ? '[RTDB] ✓ Connected' : '[RTDB] ✗ NOT connected')
    })
    return unsub
  }, [CURSOR_DEBUG])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight })
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect?.width && rect?.height) {
        setDimensions({ width: rect.width, height: rect.height })
      } else {
        updateSize()
      }
    })
    ro.observe(el)
    window.addEventListener('resize', updateSize)
    updateSize()
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const pushUndo = useCallback(
    (action: UndoAction) => {
      undoStackRef.current = undoStackRef.current.slice(-(MAX_STACK_SIZE - 1)).concat(action)
      redoStackRef.current = []
      if (id) saveUndoStacks(id, undoStackRef.current, redoStackRef.current)
    },
    [id]
  )

  const handleUndo = useCallback(
    async () => {
      const action = undoStackRef.current.pop()
      if (!action || !id || !canEdit) return
      try {
        if (action.type === 'create') {
          await deleteObject(id, action.objectId)
          redoStackRef.current.push(action)
        } else if (action.type === 'update') {
          await updateObject(id, action.objectId, action.from as ObjectUpdates)
          redoStackRef.current.push({ ...action, from: action.to, to: action.from })
        } else if (action.type === 'delete') {
          const docData = objectToFirestoreDoc(action.deleted)
          await restoreObject(id, action.objectId, docData)
          redoStackRef.current.push(action)
        } else if (action.type === 'deleteComment') {
          const { id: _id, boardId: _boardId, ...docData } = action.deleted
          await restoreComment(id, action.commentId, docData)
          redoStackRef.current.push(action)
        }
        saveUndoStacks(id, undoStackRef.current, redoStackRef.current)
      } catch (err) {
        console.error('[undo]', err)
        undoStackRef.current.push(action)
      }
    },
    [id, canEdit]
  )

  const handleRedo = useCallback(async () => {
    const action = redoStackRef.current.pop()
    if (!action || !id || !canEdit) return
    try {
      if (action.type === 'create') {
        const newId = await createObject(id, action.createInput)
        undoStackRef.current.push({ ...action, objectId: newId })
      } else if (action.type === 'update') {
        await updateObject(id, action.objectId, action.to as ObjectUpdates)
        undoStackRef.current.push({ ...action, from: action.to, to: action.from })
      } else if (action.type === 'delete') {
        await deleteObject(id, action.objectId)
        undoStackRef.current.push(action)
      } else if (action.type === 'deleteComment') {
        await deleteComment(id, action.commentId)
        undoStackRef.current.push(action)
      }
      saveUndoStacks(id, undoStackRef.current, redoStackRef.current)
    } catch (err) {
      console.error('[redo]', err)
      redoStackRef.current.push(action)
    }
  }, [id, canEdit])

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
          selectedIds.forEach((oid) => {
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
  }, [id, canEdit, selectedIds, objects, pushUndo, handleUndo, handleRedo])

  const cursorLayerEl = useMemo(
    () => <CursorLayer boardId={id} viewport={viewport} currentUserId={user?.uid ?? ''} />,
    [id, viewport, user?.uid]
  )

  const lastCursorUpdateRef = useRef(0)
  const CURSOR_THROTTLE_MS = 100

  const flushCursorUpdate = useCallback(
    (stageX: number, stageY: number) => {
      if (CURSOR_DEBUG) console.log('[CURSOR] flushCursorUpdate called', { stageX, stageY })
      if (!id || editingText != null) {
        if (CURSOR_DEBUG) console.log('[CURSOR] Skipping - no id or editingText', { id: !!id, editingText: !!editingText })
        return
      }
      const v = viewportRef.current
      const canvas = stageToCanvas(stageX, stageY, v)
      if (CURSOR_DEBUG) console.log('[CURSOR] Converted to canvas:', canvas)
      updateCursor(id, canvas.x, canvas.y)
    },
    [id, editingText]
  )

  const handleStageMouseMove = useCallback(
    (e: { target: { getStage: () => unknown } }) => {
      if (!id) return
      const now = Date.now()
      if (now - lastCursorUpdateRef.current < CURSOR_THROTTLE_MS) return
      lastCursorUpdateRef.current = now
      const stage = e.target.getStage() as { getPointerPosition: () => { x: number; y: number } | null } | null
      if (!stage?.getPointerPosition) return
      const pos = stage.getPointerPosition()
      if (!pos) return
      flushCursorUpdate(pos.x, pos.y)
    },
    [id, flushCursorUpdate]
  )

  // Document-level mousemove fallback: Stage doesn't receive events when cursor is over
  // overlays (toolbar, header). This ensures cursor tracking works across the board area.
  useEffect(() => {
    if (!id) return
    if (CURSOR_DEBUG) console.log('[CURSOR] Setting up document mousemove listener')
    const handler = (e: MouseEvent) => {
      if (CURSOR_DEBUG && Math.random() < 0.01) console.log('[CURSOR] Document mousemove', e.clientX, e.clientY)
      if (editingText != null) return
      const now = Date.now()
      if (now - lastCursorUpdateRef.current < CURSOR_THROTTLE_MS) return
      lastCursorUpdateRef.current = now
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const stageX = e.clientX - rect.left
      const stageY = e.clientY - rect.top
      if (stageX < 0 || stageY < 0 || stageX > rect.width || stageY > rect.height) return
      flushCursorUpdate(stageX, stageY)
    }
    document.addEventListener('mousemove', handler)
    if (CURSOR_DEBUG) console.log('[CURSOR] Document listener attached')
    return () => {
      document.removeEventListener('mousemove', handler)
      if (CURSOR_DEBUG) console.log('[CURSOR] Document listener removed')
    }
  }, [id, editingText, flushCursorUpdate])

  const getViewportCenter = useCallback(() => {
    const w = dimensions.width
    const h = dimensions.height
    return {
      x: (w / 2 - viewport.x) / viewport.scale,
      y: (h / 2 - viewport.y) / viewport.scale,
    }
  }, [dimensions, viewport])

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
        setObjects((prev) => {
          const o = prev[objectId]
          if (!o || !('position' in o)) return prev
          return { ...prev, [objectId]: { ...o, position: { x, y } } }
        })
        await updateObject(id, objectId, to)
      }
    },
    [id, canEdit, objects, pushUndo]
  )

  const handleObjectClick = useCallback(
    (objectId: string, e: { ctrlKey: boolean }) => {
      setSelectedIds((prev) => {
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
    []
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
          setViewport((prev) => ({
            ...prev,
            x: dimensions.width / 2 - avgX * prev.scale,
            y: dimensions.height / 2 - avgY * prev.scale,
          }))
        }
      }
      return { success: true, message: result.message }
    },
    [id, canEdit, objects, pushUndo, dimensions]
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
      setObjects((prev) => {
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
    [id, canEdit, objects, pushUndo]
  )

  /**
   * Background click: payload has canvas coords (x,y) from stageToCanvas - SINGLE conversion at click.
   * All object creation uses these canvas coords directly. Never convert back.
   */
  const handleBackgroundClick = useCallback(
    async (payload: BackgroundClickPayload) => {
      if (
        activeTool === 'pointer' &&
        (justClosedStickyEditorRef.current || justClosedTextEditorRef.current)
      ) {
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
        (activeTool === 'sticky' ||
          activeTool === 'rectangle' ||
          activeTool === 'circle' ||
          activeTool === 'triangle' ||
          activeTool === 'triangle-inverted' ||
          activeTool === 'diamond' ||
          activeTool === 'star' ||
          activeTool === 'pentagon' ||
          activeTool === 'hexagon' ||
          activeTool === 'plus' ||
          activeTool === 'parallelogram-right' ||
          activeTool === 'parallelogram-left' ||
          activeTool === 'cylinder-vertical' ||
          activeTool === 'cylinder-horizontal' ||
          activeTool === 'tab-shape' ||
          activeTool === 'trapezoid' ||
          activeTool === 'circle-cross') &&
        canEdit
      ) {
        const basePos = { x: canvasX - 50, y: canvasY - 50 }
        const baseDims = { width: 100, height: 100 }
        const baseStyle = {
          fillColor: 'transparent' as const,
          strokeColor: '#000000' as const,
          strokeWidth: 2 as const,
        }
        let input: Parameters<typeof createObject>[1] | null = null
        if (activeTool === 'sticky') {
          input = {
            type: 'sticky',
            position: { x: canvasX - 100, y: canvasY - 100 },
            dimensions: { width: 200, height: 200 },
            fillColor: '#fef08a',
          }
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
        const input = {
          type: 'emoji' as const,
          position: { x: canvasX - 16, y: canvasY - 16 },
          emoji,
        }
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
  }, [canEdit])

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
    [id, canEdit, objects, pushUndo]
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
        const newContent = trimmed
        pushUndo({ type: 'update', objectId, from: { content: oldContent }, to: { content: newContent } })
        await updateObject(id, objectId, { content: newContent })
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
  }, [])

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
    // Placeholder: convert text box to mind map nodes (future feature)
    console.log('Create mind map from text box')
  }, [])


  const handleCommentSave = useCallback(
    async (text: string) => {
      if (!id || !canEdit || !commentModalPos) return
      await createComment(id, commentModalPos, text)
      setCommentModalPos(null)
    },
    [id, canEdit, commentModalPos]
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
    [id, commentThread, pushUndo]
  )

  const handleZoomIn = useCallback(() => {
    const center = getViewportCenter()
    const newScale = Math.min(4, viewport.scale * 1.2)
    const w = dimensions.width
    const h = dimensions.height
    setViewport({
      x: w / 2 - center.x * newScale,
      y: h / 2 - center.y * newScale,
      scale: newScale,
    })
  }, [viewport, dimensions, getViewportCenter])

  const handleZoomOut = useCallback(() => {
    const center = getViewportCenter()
    const newScale = Math.max(0.1, viewport.scale / 1.2)
    const w = dimensions.width
    const h = dimensions.height
    setViewport({
      x: w / 2 - center.x * newScale,
      y: h / 2 - center.y * newScale,
      scale: newScale,
    })
  }, [viewport, dimensions, getViewportCenter])

  const handleToolSelect = useCallback((tool: WhiteboardTool) => {
    justClosedStickyEditorRef.current = false
    justClosedTextEditorRef.current = false
    setArrowPreview(null)
    setActiveTool(tool)
  }, [])

  const penStyles: PenStyles =
    activeTool === 'pen'
      ? penToolStyles
      : activeTool === 'highlighter'
        ? highlighterToolStyles
        : { ...penToolStyles, size: eraserSize, color: '#000000', opacity: 100, strokeType: 'solid' }

  const handlePenStylesChange = useCallback(
    (updates: Partial<PenStyles>) => {
      if (activeTool === 'pen') {
        setPenToolStyles((prev) => ({ ...prev, ...updates }))
      } else if (activeTool === 'highlighter') {
        setHighlighterToolStyles((prev) => ({ ...prev, ...updates }))
      } else if (activeTool === 'eraser' && 'size' in updates) {
        setEraserSize(updates.size ?? eraserSize)
      }
    },
    [activeTool, eraserSize]
  )

  const penDrawingActive = (activeTool === 'pen' || activeTool === 'highlighter') && canEdit
  const eraserActive = activeTool === 'eraser' && canEdit

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

  const CONNECTION_TOOLS = ['arrow-straight', 'arrow-curved', 'arrow-curved-cw', 'arrow-elbow-bidirectional', 'arrow-double'] as const
  const isConnectionTool = (t: string): t is (typeof CONNECTION_TOOLS)[number] =>
    CONNECTION_TOOLS.includes(t as (typeof CONNECTION_TOOLS)[number])
  const arrowToolActive = isConnectionTool(activeTool) && canEdit

  const handleArrowDragStart = useCallback(
    (pos: { x: number; y: number }) => {
      if (!arrowToolActive) return
      setArrowPreview({
        startX: pos.x,
        startY: pos.y,
        endX: pos.x,
        endY: pos.y,
        type: activeTool,
      })
    },
    [arrowToolActive, activeTool]
  )

  const handleArrowDragMove = useCallback(
    (pos: { x: number; y: number }) => {
      setArrowPreview((prev) =>
        prev ? { ...prev, endX: pos.x, endY: pos.y } : null
      )
    },
    []
  )

  const handleArrowDragEnd = useCallback(
    async (pos: { x: number; y: number }) => {
      const preview = arrowPreview
      setArrowPreview(null)
      justFinishedArrowDragRef.current = true
      if (!id || !canEdit || !preview) return
      const distance = Math.sqrt(
        (pos.x - preview.startX) ** 2 + (pos.y - preview.startY) ** 2
      )
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

  const currentPenStroke: CurrentPenStroke | null =
    penDrawingActive && currentPenPoints.length >= 2
      ? {
          points: currentPenPoints,
          color: penStyles.color,
          strokeWidth: penStyles.size,
          isHighlighter: activeTool === 'highlighter',
          opacity: penStyles.opacity / 100,
          strokeType: penStyles.strokeType,
        }
      : null

  const canvasCursor = penDrawingActive || arrowToolActive ? 'crosshair' : eraserActive ? ERASER_CURSOR : undefined

  const handleEmojiSelect = useCallback((emoji: string) => {
    setPendingEmoji(emoji)
  }, [])

  const handleBoardNameChange = useCallback(
    async (name: string) => {
      if (!id || !board || board.ownerId !== user?.uid) return
      await updateBoard(id, { name })
      setBoard((b) => (b ? { ...b, name } : null))
    },
    [id, board, user?.uid]
  )

  const editingSticky = editingStickyId ? objects[editingStickyId] : null
  const isSticky = editingSticky?.type === 'sticky'

  if (!user) return null
  if (loading) {
    return (
      <div className="board-page-loading">
        Loading board…
      </div>
    )
  }
  if (pendingInvite && board) {
    return (
      <div className="board-page-denied board-page-invite">
        <p>You&apos;ve been invited to <strong>{board.name || 'Untitled Board'}</strong>.</p>
        <p className="board-page-invite-sub">Accept the invite to view and collaborate.</p>
        <div className="board-page-denied-actions">
          <button
            type="button"
            className="board-page-btn-primary"
            onClick={async () => {
              try {
                await acceptInvite(id, pendingInvite.id)
                setPendingInvite(null)
                window.location.reload()
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to accept invite')
              }
            }}
          >
            Accept invite
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }
  if (accessDenied) {
    return (
      <div className="board-page-denied">
        <p>You don&apos;t have access to this board{board ? ` (${board.name || 'Untitled Board'})` : ''}.</p>
        <p className="board-page-denied-hint">
          Ask the owner to invite you or enable &quot;Anyone with the link can view/edit&quot; in Share settings.
        </p>
        <button type="button" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    )
  }
  if (!board) return null

  return (
    <div className="board-page">
      <WhiteboardNav
        boardName={board.name || 'Untitled Board'}
        onBoardNameChange={handleBoardNameChange}
        onShareClick={() => setShareModalOpen(true)}
        canEdit={canEdit}
        canShare={board.ownerId === user.uid}
        publicAccess={board.publicAccess ?? 'none'}
      />

      <div ref={containerRef} className="board-canvas-container" data-testid="canvas">
        <InfiniteCanvas
          width={dimensions.width}
          height={dimensions.height}
          viewport={viewport}
          onViewportChange={setViewport}
          onMouseMove={handleStageMouseMove}
          onBackgroundClick={handleBackgroundClick}
          showGrid={showGrid}
          creationToolActive={activeTool !== 'pointer'}
          editingTextOpen={editingText != null}
          cursorLayer={cursorLayerEl}
          penDrawingActive={penDrawingActive}
          eraserActive={eraserActive}
          onPenStrokeStart={handlePenStrokeStart}
          onPenStrokeMove={handlePenStrokeMove}
          onPenStrokeEnd={handlePenStrokeEnd}
          onEraserMove={handleEraserMove}
          cursor={canvasCursor}
          arrowToolActive={arrowToolActive}
          onArrowDragStart={handleArrowDragStart}
          onArrowDragMove={handleArrowDragMove}
          onArrowDragEnd={handleArrowDragEnd}
        >
          <ObjectLayer
            objects={objects}
            viewport={viewport}
            arrowPreview={arrowPreview}
            selectedIds={selectedIds}
            isPointerTool={activeTool === 'pointer'}
            onObjectDragEnd={handleObjectDragEnd}
            onObjectClick={handleObjectClick}
            onObjectResizeEnd={handleObjectResizeEnd}
            onStickyDoubleClick={handleStickyDoubleClick}
            onTextDoubleClick={handleTextDoubleClick}
            canEdit={canEdit}
            currentPenStroke={currentPenStroke}
          />
          <CommentLayer
            comments={comments}
            isPointerTool={activeTool === 'pointer'}
            onCommentClick={(comment) => {
              setCommentModalPos(null)
              setCommentThread(comment)
            }}
          />
        </InfiniteCanvas>

        <WhiteboardToolbar
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          onEmojiSelect={handleEmojiSelect}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canEdit={canEdit}
        />

        {(activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') && (
          <PenStylingToolbar
            penStyles={penStyles}
            onPenStylesChange={handlePenStylesChange}
            activeTool={activeTool}
          />
        )}

        <WhiteboardControls
          showGrid={showGrid}
          onGridToggle={() => {
            setShowGrid((v) => {
              const next = !v
              try {
                localStorage.setItem('vellum:showGrid', String(next))
              } catch {
                /* ignore */
              }
              return next
            })
          }}
          zoom={viewport.scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />

        {isSticky && editingStickyId && editingSticky && (
          <StickyTextEditor
            sticky={editingSticky}
            viewport={viewport}
            onSave={(content) => handleStickySave(editingStickyId, content)}
            onCancel={() => setEditingStickyId(null)}
          />
        )}

        {editingText && (
          <>
            <TextFormatToolbar
              textBoxId={editingText.id}
              currentFormat={editingText.textStyle}
              position={{ x: editingText.screenX, y: editingText.screenY }}
              onFormatChange={handleTextFormatChange}
              onCreateMindMap={handleCreateMindMap}
            />
            <TextOverlayTextarea
              editingText={editingText}
              onCommit={handleTextCommit}
              onCancel={handleTextCancel}
            />
          </>
        )}

        <CommentModal
          position={commentModalPos}
          viewport={viewport}
          canvasWidth={dimensions.width}
          canvasHeight={dimensions.height}
          containerRef={containerRef}
          onSave={handleCommentSave}
          onCancel={() => setCommentModalPos(null)}
        />

        <CommentThreadModal
          comment={comments.find((c) => c.id === commentThread?.id) ?? commentThread}
          currentUserId={user.uid}
          onReply={handleCommentReply}
          onDelete={handleCommentDelete}
          onClose={() => setCommentThread(null)}
        />

        {shareModalOpen && (
          <InviteModal
            boardId={id}
            onClose={() => setShareModalOpen(false)}
            onBoardUpdated={async () => {
              const b = await getBoard(id)
              if (b) setBoard(b)
            }}
          />
        )}

        <AIChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={handleAICommand}
          onClearConversation={() => clearConversation(id)}
          canEdit={canEdit}
        />

        {!isChatOpen && (
          <button
            type="button"
            className="ai-toggle-btn"
            onClick={() => setIsChatOpen(true)}
            aria-label="Open AI Assistant"
          >
            <img src={aiIcon} alt="" width={28} height={28} />
          </button>
        )}

      </div>
    </div>
  )
}
