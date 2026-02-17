import type { Board } from '../../types'
import './BoardList.css'

interface BoardListProps {
  ownedBoards: Board[]
  sharedBoards: Board[]
  currentUserId: string
  onOpen: (boardId: string) => void
  onShare: (boardId: string) => void
  onDelete: (boardId: string) => void
}

export default function BoardList({
  ownedBoards,
  sharedBoards,
  currentUserId,
  onOpen,
  onShare,
  onDelete,
}: BoardListProps) {
  const allBoards = [
    ...ownedBoards.map((b) => ({ ...b, isOwner: true })),
    ...sharedBoards.map((b) => ({ ...b, isOwner: false })),
  ].sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? 0
    const bMs = b.updatedAt?.toMillis?.() ?? 0
    return bMs - aMs
  })

  if (allBoards.length === 0) {
    return (
      <div className="board-list-empty">
        <p>No boards yet. Create one to get started.</p>
      </div>
    )
  }

  return (
    <div className="board-list-section">
      <h2 className="board-list-heading">Your Boards</h2>
      <div className="board-grid">
        {allBoards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            isOwner={board.isOwner}
            currentUserId={currentUserId}
            onOpen={onOpen}
            onShare={onShare}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

interface BoardCardProps {
  board: Board & { isOwner?: boolean }
  isOwner: boolean
  currentUserId: string
  onOpen: (boardId: string) => void
  onShare: (boardId: string) => void
  onDelete: (boardId: string) => void
}

function BoardCard({
  board,
  isOwner,
  currentUserId,
  onOpen,
  onShare,
  onDelete,
}: BoardCardProps) {
  const canDelete = board.ownerId === currentUserId

  return (
    <article className="board-card">
      <button
        type="button"
        className="board-card-main"
        onClick={() => onOpen(board.id)}
      >
        <h3 className="board-card-name">{board.name || 'Untitled Board'}</h3>
        <span className="board-card-meta">
          Updated {formatDate(board.updatedAt)}
        </span>
      </button>
      <div className="board-card-actions">
        {isOwner && (
          <button
            type="button"
            className="board-card-share"
            onClick={(e) => {
              e.stopPropagation()
              onShare(board.id)
            }}
            title="Share board"
          >
            Share
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="board-card-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(board.id)
            }}
            title="Delete board"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  )
}

function formatDate(t: { toMillis?: () => number } | undefined): string {
  if (!t?.toMillis) return ''
  const d = new Date(t.toMillis())
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString()
}
