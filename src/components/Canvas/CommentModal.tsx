import { useState, useRef, useEffect } from 'react'
import type { Viewport } from './InfiniteCanvas'
import { canvasToStage } from '../../utils/coordinates'
import './CommentModal.css'

interface CommentModalProps {
  position: { x: number; y: number } | null
  viewport: Viewport
  canvasWidth: number
  canvasHeight: number
  containerRef: React.RefObject<HTMLElement | null>
  onSave: (text: string) => void
  onCancel: () => void
}

export default function CommentModal({
  position,
  viewport,
  canvasWidth,
  canvasHeight,
  containerRef,
  onSave,
  onCancel,
}: CommentModalProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText('')
  }, [position])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [position])

  if (!position) return null

  const { x: stageX, y: stageY } = canvasToStage(position.x, position.y, viewport)
  const rect = containerRef.current?.getBoundingClientRect()
  const baseLeft = rect ? rect.left + stageX : stageX
  const baseTop = rect ? rect.top + stageY : stageY
  const offset = 12
  const maxLeft = rect ? rect.left + canvasWidth : canvasWidth
  const maxTop = rect ? rect.top + canvasHeight : canvasHeight
  let left = baseLeft + offset
  let top = baseTop
  if (left + 280 > maxLeft) left = baseLeft - 280 - offset
  if (top + 180 > maxTop) top = maxTop - 180
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
