import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../../services/firebase'
import { subscribeToBoardsForUser, createBoard, deleteBoard, getBoard } from '../../services/board'
import { getMyPendingInvites } from '../../services/invites'
import { insertTemplateIntoBoard } from '../../services/templateInsert'
import type { Board } from '../../types'
import type { BoardInvite } from '../../types'
import { useAuth } from '../../context/AuthContext'
import BoardList from './BoardList'
import AITemplateGenerator from './AITemplateGenerator'
import CreateBoardModal from './CreateBoardModal'
import TemplatePreviewThumbnail from '../Canvas/TemplatePreviewThumbnail'
import InviteModal from '../Invite/InviteModal'
import NotificationsDropdown from './NotificationsDropdown'
import Sidebar from './Sidebar'
import '../Canvas/TemplatesModal.css'
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [templateCreating, setTemplateCreating] = useState<string | null>(null)

  const DASHBOARD_TEMPLATES = [
    { id: 'project-review', title: 'Project Review' },
    { id: 'kanban-board', title: 'Kanban' },
    { id: 'swot', title: 'SWOT Analysis' },
    { id: 'journeyMap', title: 'Journey Map' },
    { id: 'retrospective', title: 'Retrospective' },
    { id: 'mind-map', title: 'Mind Map' },
  ] as const

  async function handleTemplateClick(templateKey: string) {
    try {
      setTemplateCreating(templateKey)
      const template = DASHBOARD_TEMPLATES.find((t) => t.id === templateKey)
      const boardName = template?.title ?? 'Untitled Board'
      const id = await createBoard(boardName)
      await insertTemplateIntoBoard(id, templateKey)
      navigate(`/board/${id}`)
    } catch (err) {
      console.error('[Dashboard] template create failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to create board')
    } finally {
      setTemplateCreating(null)
    }
  }

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
    try {
      await deleteBoard(boardId)
    } catch (err) {
      console.error('Failed to delete board:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete board')
    }
  }

  const displayName = user?.displayName || user?.email || 'User'

  return (
    <div className="dashboard gradient-background">
      <header className="dashboard-topnav">
        <span className="dashboard-brand-wrap">
          <img src="/letter-v.png" alt="" className="vellum-logo-icon" aria-hidden />
          <span className="dashboard-brand">Vellum</span>
        </span>
        <div className="dashboard-topnav-actions">
          <span className="dashboard-user">{displayName}</span>
          <NotificationsDropdown
            invites={pendingInvites}
            onAccept={handleInviteAccepted}
            onReject={() => getMyPendingInvites().then(setPendingInvites)}
            onRefresh={() => getMyPendingInvites().then(setPendingInvites)}
          />
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
        style={{ left: sidebarExpanded ? 300 : 48 }}
      >
        <section className="dashboard-ai-section">
          <AITemplateGenerator />
        </section>

        <section className="dashboard-template-section">
          <div className="dashboard-template-wrap">
            <div className="dashboard-template-tile">
            <h3 className="dashboard-template-section-title">Start with a template</h3>
            <div className="dashboard-template-scroll">
              <button
                type="button"
                className="dashboard-template-card dashboard-template-blank-card"
                onClick={() => setCreateBoardOpen(true)}
              >
                <div className="dashboard-template-card-preview">
                  <span className="dashboard-template-blank-icon">+</span>
                </div>
                <div className="dashboard-template-card-title">Start from scratch</div>
              </button>
              {DASHBOARD_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="dashboard-template-card templates-modal-card"
                  onClick={() => handleTemplateClick(template.id)}
                  disabled={!!templateCreating}
                >
                  <div className="dashboard-template-card-preview templates-modal-card-preview">
                    <TemplatePreviewThumbnail
                      templateKey={template.id}
                      width={160}
                      height={100}
                    />
                  </div>
                  <div className="dashboard-template-card-title templates-modal-card-title">
                    {templateCreating === template.id ? 'Creating…' : template.title}
                  </div>
                </button>
              ))}
            </div>
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
