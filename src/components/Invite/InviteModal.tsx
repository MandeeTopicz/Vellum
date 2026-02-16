import { useState, useEffect } from 'react'
import { createInvite } from '../../services/invites'
import { getBoardMembers } from '../../services/board'
import type { BoardMember } from '../../types'
import type { BoardMemberRole } from '../../types'
import './InviteModal.css'

interface InviteModalProps {
  boardId: string
  onClose: () => void
}

export default function InviteModal({ boardId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<BoardMemberRole>('edit')
  const [members, setMembers] = useState<BoardMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    getBoardMembers(boardId).then(setMembers)
  }, [boardId])

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await createInvite({ boardId, email: email.trim(), role })
      setSuccess(`Invite sent to ${email.trim()}`)
      setEmail('')
      getBoardMembers(boardId).then(setMembers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal invite-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Share board</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSendInvite} className="invite-form">
          <div className="invite-form-row">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BoardMemberRole)}
            >
              <option value="edit">Can Edit</option>
              <option value="view">View Only</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {error && <p className="invite-error">{error}</p>}
          {success && <p className="invite-success">{success}</p>}
        </form>
        <div className="invite-members">
          <h3>Board members</h3>
          {members.length === 0 ? (
            <p className="invite-muted">Only you so far. Send an invite to add others.</p>
          ) : (
            <ul className="members-list">
              {members.map((m) => (
                <li key={m.userId} className="members-list-item">
                  <span className="member-email">{m.email}</span>
                  <span className="member-role">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
