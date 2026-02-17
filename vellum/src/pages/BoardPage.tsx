import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import { getBoard, getCurrentUserRole, canCurrentUserEdit } from '../services/board'
import {
  subscribeToObjects,
  createObject,
  updateObject,
} from '../services/objects'
import {
  setUserPresence,
  subscribeToPresence,
  subscribeToCursors,
  updateCursor,
} from '../services/presence'
import { useAuth } from '../context/AuthContext'
import type { Board as BoardType } from '../types'
import type { ObjectsMap } from '../types'
import type { PresenceUser } from '../services/presence'
import type { CursorPosition } from '../services/presence'
import InfiniteCanvas, { type Viewport } from '../components/Canvas/InfiniteCanvas'
import ObjectLayer from '../components/Canvas/ObjectLayer'
import CursorLayer from '../components/Canvas/CursorLayer'
import Toolbar from '../components/Canvas/Toolbar'
import StickyTextEditor from '../components/Canvas/StickyTextEditor'
import type { ToolType } from '../components/Canvas/Toolbar'
import './BoardPage.css'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [board, setBoard] = useState<BoardType | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [objects, setObjects] = useState<ObjectsMap>({})
  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [cursors, setCursors] = useState<CursorPosition[]>([])
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const id = boardId ?? ''

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
          return
        }
        const role = await getCurrentUserRole(id)
        if (cancelled) return
        if (role === null) {
          setAccessDenied(true)
          setBoard(null)
          return
        }
        setBoard(b)
        setAccessDenied(false)
        const edit = await canCurrentUserEdit(id)
        if (!cancelled) setCanEdit(edit)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, user])

  useEffect(() => {
    if (!id || !user) return
    setUserPresence(id)
  }, [id, user])

  useEffect(() => {
    if (!id) return
    const unsub = subscribeToObjects(id, setObjects)
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
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 800, height: 600 }
      setDimensions({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleStageMouseMove = useCallback(
    (e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } } }) => {
      if (!id) return
      const stage = e.target.getStage()
      if (!stage) return
      const pos = stage.getPointerPosition()
      if (!pos) return
      const worldX = (pos.x - viewport.x) / viewport.scale
      const worldY = (pos.y - viewport.y) / viewport.scale
      updateCursor(id, worldX, worldY)
    },
    [id, viewport]
  )

  const getViewportCenter = useCallback(() => {
    const w = dimensions.width
    const h = dimensions.height
    const worldX = (w / 2 - viewport.x) / viewport.scale
    const worldY = (h / 2 - viewport.y) / viewport.scale
    return { x: worldX, y: worldY }
  }, [dimensions, viewport])

  const handleObjectDragEnd = useCallback(
    async (objectId: string, x: number, y: number) => {
      if (!id || !canEdit) return
      await updateObject(id, objectId, { position: { x, y } })
    },
    [id, canEdit]
  )

  const handleStickyDoubleClick = useCallback((objectId: string) => {
    if (!canEdit) return
    setEditingStickyId(objectId)
  }, [canEdit])

  const handleStickySave = useCallback(
    async (objectId: string, content: string) => {
      if (!id || !canEdit) return
      await updateObject(id, objectId, { content })
      setEditingStickyId(null)
    },
    [id, canEdit]
  )

  if (!user) return null
  if (loading) {
    return (
      <div className="board-page-loading">
        Loading board…
      </div>
    )
  }
  if (accessDenied) {
    return (
      <div className="board-page-denied">
        <p>You don&apos;t have access to this board.</p>
        <button type="button" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    )
  }
  if (!board) return null

  const editingSticky = editingStickyId ? objects[editingStickyId] : null
  const isSticky = editingSticky?.type === 'sticky'

  return (
    <div className="board-page">
      <header className="board-page-header">
        <button type="button" className="btn-back" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
        <h1 className="board-page-title">{board.name || 'Untitled Board'}</h1>
        <div className="board-page-presence">
          <span className="presence-label">Online:</span>
          {presence.map((u) => (
            <span
              key={u.userId}
              className="presence-user"
              style={{ color: u.color }}
              title={u.email}
            >
              {u.displayName || u.email || u.userId.slice(0, 8)}
            </span>
          ))}
        </div>
      </header>

      <div ref={containerRef} className="board-canvas-container">
        <InfiniteCanvas
          width={dimensions.width}
          height={dimensions.height}
          viewport={viewport}
          onViewportChange={setViewport}
          onMouseMove={handleStageMouseMove}
          cursorLayer={
            <CursorLayer
              cursors={cursors}
              viewport={viewport}
              currentUserId={user.uid}
            />
          }
        >
          <ObjectLayer
            objects={objects}
            onObjectDragEnd={handleObjectDragEnd}
            onStickyDoubleClick={handleStickyDoubleClick}
            canEdit={canEdit}
          />
        </InfiniteCanvas>

        <Toolbar
          activeTool={activeTool}
          onToolSelect={(tool) => {
            setActiveTool(tool)
            if (tool === 'sticky' || tool === 'rectangle') {
              const center = getViewportCenter()
              if (tool === 'sticky') {
                createObject(id, {
                  type: 'sticky',
                  position: { x: center.x - 100, y: center.y - 100 },
                  dimensions: { width: 200, height: 200 },
                  fillColor: '#fef08a',
                })
              } else {
                createObject(id, {
                  type: 'rectangle',
                  position: { x: center.x - 75, y: center.y - 50 },
                  dimensions: { width: 150, height: 100 },
                  fillColor: '#3b82f6',
                })
              }
            }
          }}
          canEdit={canEdit}
        />
      </div>

      {isSticky && (
        <StickyTextEditor
          sticky={editingSticky}
          viewport={viewport}
          onSave={(content) => handleStickySave(editingStickyId!, content)}
          onCancel={() => setEditingStickyId(null)}
        />
      )}
    </div>
  )
}
