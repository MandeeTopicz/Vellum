import { useState, useRef, useEffect } from 'react'
import './CommentModal.css'

interface CommentModalProps {
  position: { x: number; y: number } | null
  onSave: (text: string) => void
  onCancel: () => void
}

export default function CommentModal({ position, onSave, onCancel }: CommentModalProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  if (!position) return null

  return (
    <div className="comment-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="comment-modal">
        <h3>Add Comment</h3>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment..."
          rows={4}
        />
        <div className="comment-modal-actions">
          <button type="button" className="comment-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="comment-btn-save"
            onClick={() => {
              const trimmed = text.trim()
              if (trimmed) onSave(trimmed)
              onCancel()
            }}
            disabled={!text.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
