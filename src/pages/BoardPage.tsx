import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getBoard, getCurrentUserRole } from '../services/board'
import { useAuth } from '../context/AuthContext'
import type { Board as BoardType } from '../types'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [board, setBoard] = useState<BoardType | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = boardId ?? ''
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
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [boardId ?? '', user])

  if (!user) return null
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading board…
      </div>
    )
  }
  if (accessDenied) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>You don&apos;t have access to this board.</p>
        <button type="button" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    )
  }
  if (!board) return null

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="button" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
        <h1 style={{ margin: 0 }}>{board.name || 'Untitled Board'}</h1>
      </div>
      <p className="board-placeholder">
        Canvas and real-time collaboration will be implemented next.
      </p>
    </div>
  )
}
