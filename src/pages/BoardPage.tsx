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
  subscribeToCursors,
  updateCursor,
} from '../services/presence'
import { useAuth } from '../context/AuthContext'
import type { Board as BoardType } from '../types'
import type { ObjectsMap, LineObject, BoardObject } from '../types'
import type { BoardComment } from '../services/comments'
import type { PresenceUser } from '../services/presence'
import type { CursorPosition } from '../services/presence'
import InfiniteCanvas, { type Viewport } from '../components/Canvas/InfiniteCanvas'
import ObjectLayer, { type ObjectResizeUpdates } from '../components/Canvas/ObjectLayer'
import CursorLayer from '../components/Canvas/CursorLayer'
import CommentLayer from '../components/Canvas/CommentLayer'
import WhiteboardToolbar from '../components/Canvas/WhiteboardToolbar'
import type { WhiteboardTool } from '../components/Canvas/WhiteboardToolbar'
import WhiteboardNav from '../components/Canvas/WhiteboardNav'
import WhiteboardControls from '../components/Canvas/WhiteboardControls'
import StickyTextEditor from '../components/Canvas/StickyTextEditor'
import TextBoxEditor from '../components/Canvas/TextBoxEditor'
import CommentModal from '../components/Canvas/CommentModal'
import CommentThreadModal from '../components/Canvas/CommentThreadModal'
import InviteModal from '../components/Invite/InviteModal'
import { getPendingInviteForBoard, acceptInvite } from '../services/invites'
import type { BoardInvite } from '../types'
import './BoardPage.css'

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
  const [cursors, setCursors] = useState<CursorPosition[]>([])
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [activeTool, setActiveTool] = useState<WhiteboardTool>('pointer')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [commentModalPos, setCommentModalPos] = useState<{ x: number; y: number } | null>(null)
  const [commentThread, setCommentThread] = useState<BoardComment | null>(null)
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
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
  const justClosedTextEditorRef = useRef(false)
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  const id = boardId ?? ''

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
    if (!id) return
    const unsub = subscribeToCursors(id, setCursors)
    return unsub
  }, [id])

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
    () => <CursorLayer cursors={cursors} viewport={viewport} currentUserId={user?.uid ?? ''} />,
    [cursors, viewport, user?.uid]
  )

  const handleStageMouseMove = useCallback(
    (e: { target: { getStage: () => unknown } }) => {
      if (!id) return
      const stage = e.target.getStage() as { getPointerPosition: () => { x: number; y: number } | null } | null
      if (!stage?.getPointerPosition) return
      const pos = stage.getPointerPosition()
      if (!pos) return
      const v = viewportRef.current
      const worldX = (pos.x - v.x) / v.scale
      const worldY = (pos.y - v.y) / v.scale
      updateCursor(id, worldX, worldY)
    },
    [id]
  )

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

  const handleBackgroundClick = useCallback(
    async (worldPos: { x: number; y: number }) => {
      setSelectedIds(new Set())
      if (activeTool === 'comment' && canEdit) {
        setCommentModalPos(worldPos)
      }
      if (
        (activeTool === 'sticky' || activeTool === 'rectangle' || activeTool === 'circle' ||
          activeTool === 'triangle' || activeTool === 'line' || activeTool === 'text') &&
        canEdit
      ) {
        const center = worldPos
        let input: Parameters<typeof createObject>[1] | null = null
        if (activeTool === 'sticky') {
          input = {
            type: 'sticky',
            position: { x: center.x - 100, y: center.y - 100 },
            dimensions: { width: 200, height: 200 },
            fillColor: '#fef08a',
          }
        } else if (activeTool === 'rectangle') {
          input = {
            type: 'rectangle',
            position: { x: center.x - 75, y: center.y - 50 },
            dimensions: { width: 150, height: 100 },
          }
        } else if (activeTool === 'circle') {
          input = {
            type: 'circle',
            position: { x: center.x - 50, y: center.y - 50 },
            dimensions: { width: 100, height: 100 },
          }
        } else if (activeTool === 'triangle') {
          input = {
            type: 'triangle',
            position: { x: center.x - 50, y: center.y - 40 },
            dimensions: { width: 100, height: 80 },
          }
        } else if (activeTool === 'line') {
          input = {
            type: 'line',
            start: { x: center.x - 50, y: center.y },
            end: { x: center.x + 50, y: center.y },
          }
        } else if (activeTool === 'text') {
          if (justClosedTextEditorRef.current) {
            justClosedTextEditorRef.current = false
            return
          }
          input = {
            type: 'text',
            position: { x: center.x - 100, y: center.y - 20 },
            dimensions: { width: 200, height: 40 },
            content: '',
          }
        }
        if (input) {
          const objectId = await createObject(id, input)
          pushUndo({ type: 'create', objectId, createInput: input })
          if (activeTool === 'text') {
            setEditingTextId(objectId)
          }
        }
      }
      if (activeTool === 'emoji' && canEdit) {
        const emoji = pendingEmoji ?? '😀'
        const input = {
          type: 'emoji' as const,
          position: { x: worldPos.x - 16, y: worldPos.y - 16 },
          emoji,
        }
        const objectId = await createObject(id, input)
        pushUndo({ type: 'create', objectId, createInput: input })
      }
    },
    [id, activeTool, canEdit, pendingEmoji, pushUndo]
  )

  const handleStickyDoubleClick = useCallback((objectId: string) => {
    if (!canEdit) return
    setEditingStickyId(objectId)
  }, [canEdit])

  const handleTextDoubleClick = useCallback((objectId: string) => {
    if (!canEdit) return
    setEditingTextId(objectId)
  }, [canEdit])

  const handleStickySave = useCallback(
    async (objectId: string, content: string) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      const oldContent = obj && obj.type === 'sticky' ? obj.content : ''
      pushUndo({ type: 'update', objectId, from: { content: oldContent }, to: { content } })
      await updateObject(id, objectId, { content })
      setEditingStickyId(null)
    },
    [id, canEdit, objects, pushUndo]
  )

  const handleTextSave = useCallback(
    async (objectId: string, content: string) => {
      if (!id || !canEdit) return
      const obj = objects[objectId]
      const oldContent = obj && obj.type === 'text' ? obj.content : ''
      pushUndo({ type: 'update', objectId, from: { content: oldContent }, to: { content } })
      await updateObject(id, objectId, { content })
      justClosedTextEditorRef.current = true
      setEditingTextId(null)
    },
    [id, canEdit, objects, pushUndo]
  )

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
    setActiveTool(tool)
  }, [])

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

  const editingSticky = editingStickyId ? objects[editingStickyId] : null
  const editingText = editingTextId ? objects[editingTextId] : null
  const isSticky = editingSticky?.type === 'sticky'
  const isText = editingText?.type === 'text'

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

      <div ref={containerRef} className="board-canvas-container">
        <InfiniteCanvas
          width={dimensions.width}
          height={dimensions.height}
          viewport={viewport}
          onViewportChange={setViewport}
          onMouseMove={handleStageMouseMove}
          onBackgroundClick={handleBackgroundClick}
          showGrid={showGrid}
          cursorLayer={cursorLayerEl}
        >
          <ObjectLayer
            objects={objects}
            viewport={viewport}
            selectedIds={selectedIds}
            isPointerTool={activeTool === 'pointer'}
            onObjectDragEnd={handleObjectDragEnd}
            onObjectClick={handleObjectClick}
            onObjectResizeEnd={handleObjectResizeEnd}
            onStickyDoubleClick={handleStickyDoubleClick}
            onTextDoubleClick={handleTextDoubleClick}
            canEdit={canEdit}
          />
          <CommentLayer
            comments={comments}
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

        {isText && editingTextId && editingText && (
          <TextBoxEditor
            text={editingText}
            viewport={viewport}
            onSave={(content) => handleTextSave(editingTextId, content)}
            onCancel={() => setEditingTextId(null)}
          />
        )}

        <CommentModal
          position={commentModalPos}
          viewport={viewport}
          canvasWidth={dimensions.width}
          canvasHeight={dimensions.height}
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
      </div>
    </div>
  )
}
