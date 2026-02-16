import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../../services/firebase'
import { getBoardsForUser, createBoard } from '../../services/board'
import { getMyPendingInvites } from '../../services/invites'
import type { Board } from '../../types'
import type { BoardInvite } from '../../types'
import { useAuth } from '../../context/AuthContext'
import BoardList from './BoardList'
import InviteModal from '../Invite/InviteModal'
import PendingInvites from '../Invite/PendingInvites'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [boards, setBoards] = useState<Board[]>([])
  const [pendingInvites, setPendingInvites] = useState<BoardInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [shareBoardId, setShareBoardId] = useState<string | null>(null)
  const [invitesOpen, setInvitesOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [boardList, invites] = await Promise.all([
          getBoardsForUser(),
          getMyPendingInvites(),
        ])
        if (!cancelled) {
          setBoards(boardList)
          setPendingInvites(invites)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreateBoard() {
    const id = await createBoard('Untitled Board')
    navigate(`/board/${id}`)
  }

  async function handleOpenBoard(boardId: string) {
    navigate(`/board/${boardId}`)
  }

  function handleInviteAccepted() {
    setInvitesOpen(false)
    getBoardsForUser().then(setBoards)
    getMyPendingInvites().then(setPendingInvites)
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>CollabBoard</h1>
        <div className="dashboard-actions">
          <button
            type="button"
            className="btn-invites"
            onClick={() => setInvitesOpen(true)}
            title="Pending invites"
          >
            Invites
            {pendingInvites.length > 0 && (
              <span className="badge">{pendingInvites.length}</span>
            )}
          </button>
          <span className="user-email">{user?.email ?? ''}</span>
          <button type="button" className="btn-logout" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-toolbar">
          <button type="button" className="btn-primary" onClick={handleCreateBoard}>
            Create New Board
          </button>
        </div>

        {loading ? (
          <p className="dashboard-loading">Loading boards…</p>
        ) : (
          <BoardList
            boards={boards}
            currentUserId={user?.uid ?? ''}
            onOpen={handleOpenBoard}
            onShare={setShareBoardId}
          />
        )}
      </main>

      {shareBoardId && (
        <InviteModal
          boardId={shareBoardId}
          onClose={() => setShareBoardId(null)}
        />
      )}

      {invitesOpen && (
        <PendingInvites
          invites={pendingInvites}
          onClose={() => setInvitesOpen(false)}
          onAccept={handleInviteAccepted}
          onReject={() => getMyPendingInvites().then(setPendingInvites)}
        />
      )}
    </div>
  )
}
