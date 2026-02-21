import { useState, useEffect } from 'react'
import { createInvite } from '../../services/invites'
import { getBoard, getBoardMembers, updateBoard } from '../../services/board'
import { Timestamp } from 'firebase/firestore'
import { subscribeToCursors, type CursorPosition } from '../../services/presence'
import { auth } from '../../services/firebase'
import type { Board, BoardMember } from '../../types'
import type { BoardMemberRole, PublicAccessLevel } from '../../types'
import './InviteModal.css'

/** Time window (ms) for considering a user "active" based on cursor movement */
const ACTIVE_THRESHOLD_MS = 30 * 1000

interface InviteModalProps {
  boardId: string
  onClose: () => void
  onBoardUpdated?: () => void
}

export default function InviteModal({ boardId, onClose, onBoardUpdated }: InviteModalProps) {
  const [tab, setTab] = useState<'email' | 'link'>('email')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<BoardMemberRole>('edit')
  const [members, setMembers] = useState<BoardMember[]>([])
  const [board, setBoard] = useState<Board | null>(null)
  const [cursors, setCursors] = useState<CursorPosition[]>([])
  const [, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [publicAccess, setPublicAccess] = useState<PublicAccessLevel>('none')
  const [publicSaving, setPublicSaving] = useState(false)

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/board/${boardId}` : ''
  const isPublicEnabled = publicAccess === 'view' || publicAccess === 'edit'

  useEffect(() => {
    getBoardMembers(boardId).then(setMembers)
    getBoard(boardId).then((b) => {
      if (b) {
        setBoard(b)
        setPublicAccess(b.publicAccess ?? 'none')
      }
    })
  }, [boardId])

  useEffect(() => {
    const unsub = subscribeToCursors(boardId, setCursors)
    return unsub
  }, [boardId])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  /** Members plus owner if not already in members */
  const displayMembers = ((): BoardMember[] => {
    const memberIds = new Set(members.map((m) => m.userId))
    if (!board) return members
    const ownerId = board.ownerId
    if (!memberIds.has(ownerId)) {
      const user = auth.currentUser
      if (user?.uid === ownerId) {
        return [
          {
            userId: ownerId,
            email: user.email ?? '',
            displayName: user.displayName ?? null,
            role: 'edit',
            addedAt: Timestamp.fromMillis(0),
          },
          ...members,
        ]
      }
    }
    return members
  })()

  /** Whether the user has recent cursor activity */
  function isUserActive(userId: string): boolean {
    const cursor = cursors.find((c) => c.userId === userId)
    const lastUpdated = cursor?.lastUpdated
    if (!lastUpdated) return false
    return Date.now() - lastUpdated < ACTIVE_THRESHOLD_MS
  }

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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setError('Failed to copy link')
    }
  }

  async function handlePublicAccessChange(enabled: boolean, level?: PublicAccessLevel) {
    setError(null)
    setSuccess(null)
    setPublicSaving(true)
    try {
      const newValue: PublicAccessLevel = enabled ? (level ?? 'edit') : 'none'
      await updateBoard(boardId, { publicAccess: newValue })
      setPublicAccess(newValue)
      onBoardUpdated?.()
      setSuccess(enabled ? 'Link is now public. Anyone with the link can access.' : 'Public link disabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update link access')
    } finally {
      setPublicSaving(false)
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
        <div className="invite-tabs">
          <button
            type="button"
            className={`invite-tab ${tab === 'email' ? 'active' : ''}`}
            onClick={() => setTab('email')}
          >
            Invite by Email
          </button>
          <button
            type="button"
            className={`invite-tab ${tab === 'link' ? 'active' : ''}`}
            onClick={() => setTab('link')}
          >
            Share Link
          </button>
        </div>
        {tab === 'email' && (
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
              <option value="view">Can View</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {error && <p className="invite-error">{error}</p>}
          {success && <p className="invite-success">{success}</p>}
        </form>
        )}
        {tab === 'link' && (
          <div className="invite-link-section">
            <p className="invite-link-intro">Share this link so others can access the board. Enable the option below for the link to work.</p>
            <div className="invite-link-row">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="invite-link-input"
              />
              <button
                type="button"
                className="invite-copy-btn"
                onClick={handleCopyLink}
              >
                {linkCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <div className="invite-public-toggle">
              <label className="invite-toggle-label">
                <input
                  type="checkbox"
                  checked={isPublicEnabled}
                  onChange={(e) =>
                    handlePublicAccessChange(
                      e.target.checked,
                      e.target.checked ? (publicAccess === 'none' ? 'edit' : publicAccess) : undefined
                    )
                  }
                  disabled={publicSaving}
                />
                <span>Anyone with the link can</span>
              </label>
              {isPublicEnabled && (
                <select
                  value={publicAccess}
                  onChange={(e) => handlePublicAccessChange(true, e.target.value as PublicAccessLevel)}
                  disabled={publicSaving}
                  className="invite-public-select"
                >
                  <option value="view">view</option>
                  <option value="edit">edit</option>
                </select>
              )}
            </div>
            {!isPublicEnabled && (
              <p className="invite-link-enable-hint">Turn on the option above to let anyone with the link open this board.</p>
            )}
            {isPublicEnabled && (
              <p className="invite-link-success-hint">
                Public link is on. Anyone with the link can {publicAccess === 'edit' ? 'view and edit' : 'view'} this board.
              </p>
            )}
            {tab === 'link' && error && <p className="invite-error">{error}</p>}
            {tab === 'link' && success && <p className="invite-success">{success}</p>}
          </div>
        )}
        <div className="invite-members">
          <h3>Board members</h3>
          {displayMembers.length === 0 ? (
            <p className="invite-muted">Only you so far. Send an invite to add others.</p>
          ) : (
            <ul className="members-list">
              {displayMembers.map((m) => {
                const active = isUserActive(m.userId)
                return (
                  <li key={m.userId} className="members-list-item">
                    <span className="member-email">{m.displayName || m.email}</span>
                    <span
                      className={`member-status ${active ? 'member-status-active' : 'member-status-inactive'}`}
                      aria-label={active ? 'Active on board' : 'Inactive'}
                    >
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
