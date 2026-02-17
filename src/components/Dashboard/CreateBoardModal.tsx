import { useState, useRef, useEffect } from 'react'
import './CreateBoardModal.css'

interface CreateBoardModalProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export default function CreateBoardModal({ onClose, onCreate }: CreateBoardModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a board name')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onCreate(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal create-board-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Create New Board</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="create-board-form">
          <label htmlFor="board-name">Board name</label>
          <input
            ref={inputRef}
            id="board-name"
            type="text"
            placeholder="Enter board name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          {error && <p className="create-board-error">{error}</p>}
          <div className="create-board-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
