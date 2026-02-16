import { useNavigate } from 'react-router-dom'
import { acceptInvite, rejectInvite } from '../../services/invites'
import type { BoardInvite } from '../../types'
import './PendingInvites.css'

interface PendingInvitesProps {
  invites: BoardInvite[]
  onClose: () => void
  onAccept: () => void
  onReject: () => void
}

export default function PendingInvites({
  invites,
  onClose,
  onAccept,
  onReject,
}: PendingInvitesProps) {
  const navigate = useNavigate()

  async function handleAccept(inv: BoardInvite) {
    try {
      await acceptInvite(inv.boardId, inv.id)
      onAccept()
      onClose()
      navigate(`/board/${inv.boardId}`, { replace: true })
    } catch {
      onAccept()
    }
  }

  async function handleReject(inv: BoardInvite) {
    try {
      await rejectInvite(inv.boardId, inv.id)
      onReject()
    } catch {
      onReject()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal pending-invites-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Pending invites</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pending-invites-content">
          {invites.length === 0 ? (
            <p className="invite-muted">No pending invites.</p>
          ) : (
            <ul className="pending-invites-list">
              {invites.map((inv) => (
                <li key={`${inv.boardId}-${inv.id}`} className="pending-invite-item">
                  <div className="pending-invite-info">
                    <strong>{inv.invitedByName || inv.invitedBy}</strong>
                    <span className="invite-detail">
                      invited you to a board ({inv.role} access)
                    </span>
                  </div>
                  <div className="pending-invite-actions">
                    <button
                      type="button"
                      className="btn-accept"
                      onClick={() => handleAccept(inv)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-reject"
                      onClick={() => handleReject(inv)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
