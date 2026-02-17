import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../../services/firebase'
import { subscribeToBoardsForUser, createBoard, deleteBoard, getBoard } from '../../services/board'
import { getMyPendingInvites } from '../../services/invites'
import type { Board } from '../../types'
import type { BoardInvite } from '../../types'
import { useAuth } from '../../context/AuthContext'
import BoardList from './BoardList'
import CreateBoardModal from './CreateBoardModal'
import InviteModal from '../Invite/InviteModal'
import NotificationsDropdown from './NotificationsDropdown'
import AccountDropdown from './AccountDropdown'
import Sidebar from './Sidebar'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const boardsRef = useRef<HTMLDivElement>(null)
  const [boardsData, setBoardsData] = useState<{ owned: Board[]; shared: Board[] }>({ owned: [], shared: [] })
  const [pendingInvites, setPendingInvites] = useState<BoardInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [shareBoardId, setShareBoardId] = useState<string | null>(null)
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      setBoardsData({ owned: [], shared: [] })
      setPendingInvites([])
      return
    }
    setLoading(true)
    const unsubBoards = subscribeToBoardsForUser((data) => {
      setBoardsData(data)
      setLoading(false)
    })
    let cancelled = false
    getMyPendingInvites().then((invites) => {
      if (!cancelled) setPendingInvites(invites)
    })
    return () => {
      cancelled = true
      unsubBoards()
    }
  }, [user?.uid, user?.email])

  async function handleCreateBoard(name: string) {
    const id = await createBoard(name)
    navigate(`/board/${id}`)
  }

  async function handleOpenBoard(boardId: string) {
    navigate(`/board/${boardId}`)
  }

  async function handleInviteAccepted(boardId?: string) {
    getMyPendingInvites().then(setPendingInvites)
    if (boardId) {
      const board = await getBoard(boardId)
      if (board) {
        setBoardsData((prev) => {
          const exists = prev.owned.some((b) => b.id === boardId) || prev.shared.some((b) => b.id === boardId)
          if (exists) return prev
          return { ...prev, shared: [board, ...prev.shared] }
        })
      }
    }
  }

  function handleDashboardClick() {
    boardsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleDeleteBoard(boardId: string) {
    if (!confirm('Delete this board? This cannot be undone.')) return
    try {
      await deleteBoard(boardId)
    } catch (err) {
      console.error('Failed to delete board:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete board')
    }
  }

  const displayName = user?.displayName || user?.email || 'User'

  return (
    <div className="dashboard">
      <header className="dashboard-topnav">
        <span className="dashboard-brand">Vellum</span>
        <div className="dashboard-topnav-actions">
          <span className="dashboard-user">{displayName}</span>
          <NotificationsDropdown
            invites={pendingInvites}
            onAccept={handleInviteAccepted}
            onReject={() => getMyPendingInvites().then(setPendingInvites)}
            onRefresh={() => getMyPendingInvites().then(setPendingInvites)}
          />
          <AccountDropdown />
          <button type="button" className="dashboard-logout" onClick={() => signOut()}>
            Log Out
          </button>
        </div>
      </header>

      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((v) => !v)}
        onCreateBoard={() => setCreateBoardOpen(true)}
        onDashboardClick={handleDashboardClick}
      />

      <main
        className="dashboard-main"
        style={{ left: sidebarExpanded ? 300 : 72 }}
      >
        <section className="dashboard-ai-placeholder">
          <h2 className="dashboard-ai-title">Need help drafting a template?</h2>
          <p className="dashboard-ai-subtext">
            Under construction – come back for an AI template and feature generator
          </p>
        </section>

        <section className="dashboard-template-section">
          <div className="dashboard-template-row">
            <button
              type="button"
              className="dashboard-template-blank"
              onClick={() => setCreateBoardOpen(true)}
            >
              <span className="dashboard-template-blank-icon">+</span>
              <span className="dashboard-template-blank-text">Start from Scratch</span>
            </button>
            <div className="dashboard-template-recent">
              <h3 className="dashboard-template-recent-title">Recently Used Templates</h3>
              <div className="dashboard-template-tiles">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="dashboard-template-tile-slot" aria-hidden />
                ))}
              </div>
              <p className="dashboard-template-recent-message">
                {!loading && (boardsData.owned.length > 0 || boardsData.shared.length > 0)
                  ? "Templates coming soon – we're building AI-powered templates for you"
                  : 'No templates yet – create your first board to get started!'}
              </p>
            </div>
          </div>
        </section>

        <section ref={boardsRef} className="dashboard-boards">
          {loading ? (
            <p className="dashboard-loading">Loading boards…</p>
          ) : (
            <BoardList
              ownedBoards={boardsData.owned}
              sharedBoards={boardsData.shared}
              currentUserId={user?.uid ?? ''}
              onOpen={handleOpenBoard}
              onShare={setShareBoardId}
              onDelete={handleDeleteBoard}
              onCreateBoard={() => setCreateBoardOpen(true)}
            />
          )}
        </section>
      </main>

      {createBoardOpen && (
        <CreateBoardModal
          onClose={() => setCreateBoardOpen(false)}
          onCreate={handleCreateBoard}
        />
      )}

      {shareBoardId && (
        <InviteModal
          boardId={shareBoardId}
          onClose={() => setShareBoardId(null)}
        />
      )}
    </div>
  )
}
