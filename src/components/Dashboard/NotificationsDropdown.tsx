import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { acceptInvite, rejectInvite } from '../../services/invites'
import type { BoardInvite } from '../../types'
import './NotificationsDropdown.css'

interface NotificationsDropdownProps {
  invites: BoardInvite[]
  onAccept: (boardId?: string) => void
  onReject: () => void
  onRefresh: () => void
}

export default function NotificationsDropdown({
  invites,
  onAccept,
  onReject,
  onRefresh,
}: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) onRefresh()
  }, [open, onRefresh])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function handleAccept(inv: BoardInvite) {
    setError(null)
    setAcceptingId(inv.id)
    try {
      await acceptInvite(inv.boardId, inv.id)
      onAccept(inv.boardId)
      setOpen(false)
      navigate(`/board/${inv.boardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
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
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="notifications-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Notifications
        {invites.length > 0 && (
          <span className="notifications-badge">{invites.length}</span>
        )}
      </button>
      {open && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Pending invites</h3>
          </div>
          <div className="notifications-content">
            {error && <p className="notifications-error">{error}</p>}
            {invites.length === 0 ? (
              <p className="notifications-empty">No pending invites.</p>
            ) : (
              <ul className="notifications-list">
                {invites.map((inv) => (
                  <li key={`${inv.boardId}-${inv.id}`} className="notifications-item">
                    <div className="notifications-item-info">
                      <strong>{inv.invitedByName || inv.invitedBy}</strong>
                      <span>invited you to a board ({inv.role} access)</span>
                    </div>
                    <div className="notifications-item-actions">
                      <button
                        type="button"
                        className="notifications-btn-accept"
                        onClick={() => handleAccept(inv)}
                        disabled={acceptingId === inv.id}
                      >
                        {acceptingId === inv.id ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        className="notifications-btn-reject"
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
      )}
    </div>
  )
}
