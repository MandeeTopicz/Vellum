/**
 * Board data and Firestore subscriptions.
 * Manages objects, comments, presence, viewport, dimensions, undo/redo.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getBoard, getCurrentUserRole, canCurrentUserEdit } from '../services/board'
import {
  createObject,
  updateObject,
  deleteObject,
  restoreObject,
  subscribeToObjects,
  objectToFirestoreDoc,
  type ObjectUpdates,
} from '../services/objects'
import { deleteComment, restoreComment, subscribeToComments } from '../services/comments'
import { loadUndoStacks, saveUndoStacks, MAX_STACK_SIZE } from '../services/undoHistory'
import { setUserPresence, subscribeToPresence, subscribeToRtdbConnection, updateCursor } from '../services/presence'
import { getPendingInviteForBoard } from '../services/invites'
import type { Board as BoardType } from '../types'
import type { BoardComment } from '../services/comments'
import type { PresenceUser } from '../services/presence'
import type { ObjectsMap, BoardObject } from '../types'
import type { Viewport } from '../components/Canvas/InfiniteCanvas'
import { stageToCanvas } from '../utils/coordinates'
import { throttle } from '../utils/throttle'
import type { BoardInvite } from '../types'

const CURSOR_THROTTLE_MS = 100

export type UndoAction =
  | { type: 'create'; objectId: string; createInput: Parameters<typeof createObject>[1] }
  | { type: 'update'; objectId: string; from: Record<string, unknown>; to: Record<string, unknown> }
  | { type: 'delete'; objectId: string; deleted: BoardObject }
  | { type: 'deleteComment'; commentId: string; deleted: BoardComment }

export interface UseBoardDataParams {
  boardId: string
  user: { uid: string } | null
}

export function useBoardData({ boardId, user }: UseBoardDataParams) {
  const id = boardId
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
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }))
  const [isZooming, setIsZooming] = useState(false)

  const undoStackRef = useRef<UndoAction[]>([])
  const redoStackRef = useRef<UndoAction[]>([])

  const CURSOR_DEBUG = import.meta.env?.DEV === true

  useEffect(() => {
    if (!id) return
    loadUndoStacks(id).then((stacks) => {
      if (!stacks) return
      undoStackRef.current = (stacks.undoStack as UndoAction[]) ?? []
      redoStackRef.current = (stacks.redoStack as UndoAction[]) ?? []
    })
  }, [id])

  useEffect(() => {
    if (!id || !user) return
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
        if (user && b.ownerId === user.uid) {
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
    return () => { cancelled = true }
  }, [id, user?.uid])

  useEffect(() => {
    if (!id || !user) return
    setUserPresence(id)
  }, [id, user])

  useEffect(() => {
    if (!id || !user || isZooming) return
    if (containerRef.current) {
      const centerX = (dimensions.width / 2 - viewport.x) / viewport.scale
      const centerY = (dimensions.height / 2 - viewport.y) / viewport.scale
      updateCursor(id, centerX, centerY)
    }
  }, [id, user, dimensions, viewport, isZooming])

  useEffect(() => {
    if (!id) return
    return subscribeToObjects(id, setObjects)
  }, [id])

  useEffect(() => {
    if (!id) return
    return subscribeToComments(id, setComments)
  }, [id])

  useEffect(() => {
    if (!id) return
    return subscribeToPresence(id, setPresence)
  }, [id])

  useEffect(() => {
    if (!CURSOR_DEBUG) return
    return subscribeToRtdbConnection((connected) => {
      console.log(connected ? '[RTDB] ✓ Connected' : '[RTDB] ✗ NOT connected')
    })
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

  const throttledUpdateCursor = useMemo(
    () =>
      throttle((boardId: string, canvasX: number, canvasY: number) => {
        updateCursor(boardId, canvasX, canvasY)
      }, CURSOR_THROTTLE_MS),
    []
  )

  const flushCursorUpdate = useCallback(
    (stageX: number, stageY: number) => {
      if (isZooming || !id) return
      const v = viewportRef.current
      const canvas = stageToCanvas(stageX, stageY, v)
      throttledUpdateCursor(id, canvas.x, canvas.y)
    },
    [id, isZooming, throttledUpdateCursor]
  )

  return {
    id,
    board,
    setBoard,
    objects,
    setObjects,
    comments,
    loading,
    accessDenied,
    canEdit,
    pendingInvite,
    viewport,
    setViewport,
    dimensions,
    containerRef,
    isZooming,
    setIsZooming,
    pushUndo,
    handleUndo,
    handleRedo,
    viewportRef,
    flushCursorUpdate,
    CURSOR_DEBUG,
  }
}
