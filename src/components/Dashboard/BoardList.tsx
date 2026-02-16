import type { Board } from '../../types'
import './BoardList.css'

interface BoardListProps {
  boards: Board[]
  currentUserId: string
  onOpen: (boardId: string) => void
  onShare: (boardId: string) => void
}

export default function BoardList({
  boards,
  currentUserId,
  onOpen,
  onShare,
}: BoardListProps) {
  if (boards.length === 0) {
    return (
      <div className="board-list-empty">
        <p>No boards yet. Create one to get started.</p>
      </div>
    )
  }

  return (
    <ul className="board-list">
      {boards.map((board) => (
        <BoardRow
          key={board.id}
          board={board}
          currentUserId={currentUserId}
          onOpen={onOpen}
          onShare={onShare}
        />
      ))}
    </ul>
  )
}

interface BoardRowProps {
  board: Board
  currentUserId: string
  onOpen: (boardId: string) => void
  onShare: (boardId: string) => void
}

function BoardRow({
  board,
  currentUserId,
  onOpen,
  onShare,
}: BoardRowProps) {
  const isOwner = board.ownerId === currentUserId

  return (
    <li className="board-row">
      <button
        type="button"
        className="board-row-main"
        onClick={() => onOpen(board.id)}
      >
        <span className="board-name">{board.name || 'Untitled Board'}</span>
        <span className="board-meta">
          Updated {formatDate(board.updatedAt)}
        </span>
      </button>
      {isOwner && (
        <button
          type="button"
          className="board-row-share"
          onClick={(e) => {
            e.stopPropagation()
            onShare(board.id)
          }}
          title="Share board"
        >
          Share
        </button>
      )}
    </li>
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
