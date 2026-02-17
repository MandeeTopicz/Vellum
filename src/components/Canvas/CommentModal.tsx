import { useState, useRef, useEffect } from 'react'
import type { Viewport } from './InfiniteCanvas'
import './CommentModal.css'

interface CommentModalProps {
  position: { x: number; y: number } | null
  viewport: Viewport
  canvasWidth: number
  canvasHeight: number
  onSave: (text: string) => void
  onCancel: () => void
}

export default function CommentModal({
  position,
  viewport,
  canvasWidth,
  canvasHeight,
  onSave,
  onCancel,
}: CommentModalProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  if (!position) return null

  const screenX = viewport.x + position.x * viewport.scale
  const screenY = viewport.y + position.y * viewport.scale
  const offset = 12
  let left = screenX + offset
  let top = screenY
  if (left + 280 > canvasWidth) left = screenX - 280 - offset
  if (top + 180 > canvasHeight) top = canvasHeight - 180
  if (top < 8) top = 8

  return (
    <div className="comment-modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="comment-modal comment-modal-inline"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Add Comment</h3>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
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
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
