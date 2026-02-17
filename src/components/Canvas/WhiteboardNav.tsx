import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import reactionIcon from '../../assets/reaction-icon.png'
import shareIcon from '../../assets/share-icon.png'
import './WhiteboardNav.css'

interface WhiteboardNavProps {
  boardName: string
  onBoardNameChange?: (name: string) => void
  onShareClick: () => void
  canEdit: boolean
  canShare: boolean
  publicAccess?: 'none' | 'view' | 'edit'
}

export default function WhiteboardNav({
  boardName,
  onBoardNameChange,
  onShareClick,
  canEdit,
  canShare,
  publicAccess = 'none',
}: WhiteboardNavProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(boardName)
  const inputRef = useRef<HTMLInputElement>(null)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const reactionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNameValue(boardName)
  }, [boardName])

  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reactionsRef.current?.contains(e.target as Node)) return
      setReactionsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥']

  return (
    <>
      <nav className="whiteboard-nav-left">
        <Link to="/dashboard" className="whiteboard-nav-brand">
          Vellum
        </Link>
        <div className="whiteboard-nav-board-name">
          {(publicAccess === 'view' || publicAccess === 'edit') && (
            <span className="whiteboard-nav-public-badge" title={publicAccess === 'edit' ? 'Anyone with the link can edit' : 'Anyone with the link can view'}>
              Public
            </span>
          )}
          {editingName && canEdit ? (
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                setEditingName(false)
                const trimmed = nameValue.trim()
                if (trimmed && trimmed !== boardName) onBoardNameChange?.(trimmed)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingName(false)
                  const trimmed = nameValue.trim()
                  if (trimmed && trimmed !== boardName) onBoardNameChange?.(trimmed)
                }
              }}
              className="whiteboard-nav-name-input"
            />
          ) : (
            <button
              type="button"
              className="whiteboard-nav-name-btn"
              onClick={() => canEdit && setEditingName(true)}
            >
              {boardName || 'Untitled Board'}
            </button>
          )}
        </div>
      </nav>

      <nav className="whiteboard-nav-right">
        <div className="whiteboard-nav-reactions" ref={reactionsRef}>
          <button
            type="button"
            className="whiteboard-nav-btn"
            onClick={() => setReactionsOpen((v) => !v)}
            title="Reactions"
          >
            <img src={reactionIcon} alt="Reactions" width={20} height={20} />
          </button>
          {reactionsOpen && (
            <div className="whiteboard-nav-reactions-panel">
              <p className="whiteboard-nav-reactions-label">Quick reactions</p>
              <div className="whiteboard-nav-reactions-grid">
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="whiteboard-nav-emoji-btn"
                    onClick={() => setReactionsOpen(false)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <p className="whiteboard-nav-coming-soon">Stickers, Timer, Voting - Coming Soon</p>
            </div>
          )}
        </div>
        {canShare && (
          <button
            type="button"
            className="whiteboard-nav-btn whiteboard-nav-share"
            onClick={onShareClick}
            title="Share"
          >
            <img src={shareIcon} alt="" width={20} height={20} />
            Share
          </button>
        )}
      </nav>
    </>
  )
}
