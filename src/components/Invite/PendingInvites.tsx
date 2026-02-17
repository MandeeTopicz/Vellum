import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { acceptInvite, rejectInvite } from '../../services/invites'
import type { BoardInvite } from '../../types'
import './PendingInvites.css'

interface PendingInvitesProps {
  invites: BoardInvite[]
  onClose: () => void
  onAccept: (boardId?: string) => void
  onReject: () => void
  onOpen?: () => void
}

export default function PendingInvites({
  invites,
  onClose,
  onAccept,
  onReject,
  onOpen,
}: PendingInvitesProps) {
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  useEffect(() => {
    onOpen?.()
  }, [onOpen])
  const navigate = useNavigate()

  async function handleAccept(inv: BoardInvite) {
    setError(null)
    setAcceptingId(inv.id)
    try {
      await acceptInvite(inv.boardId, inv.id)
      onAccept(inv.boardId)
      onClose()
      navigate(`/board/${inv.boardId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invite'
      console.error('[PendingInvites] accept failed:', err)
      setError(msg)
      onAccept()
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleReject(inv: BoardInvite) {
    setError(null)
    try {
      await rejectInvite(inv.boardId, inv.id)
      onReject()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invite')
      onReject()
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
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
          {error && (
            <p className="invite-error" role="alert">
              {error}
            </p>
          )}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccept(inv)
                      }}
                      disabled={acceptingId === inv.id}
                    >
                      {acceptingId === inv.id ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="btn-reject"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReject(inv)
                      }}
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
