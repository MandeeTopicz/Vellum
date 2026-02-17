import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BoardComment } from '../../services/comments'
import './CommentThreadModal.css'

interface CommentThreadModalProps {
  comment: BoardComment | null
  currentUserId: string | null
  onReply: (text: string) => void
  onDelete?: () => void
  onClose: () => void
}

export default function CommentThreadModal({
  comment,
  currentUserId,
  onReply,
  onDelete,
  onClose,
}: CommentThreadModalProps) {
  const [replyText, setReplyText] = useState('')

  if (!comment) return null

  const isCreator = currentUserId != null && comment.authorId === currentUserId

  const handleReply = () => {
    const trimmed = replyText.trim()
    if (trimmed) {
      onReply(trimmed)
      setReplyText('')
    }
  }

  return (
    <div className="comment-thread-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="comment-thread-modal">
        <div className="comment-thread-header">
          <h3>Comment</h3>
          <div className="comment-thread-header-actions">
            {isCreator && onDelete && (
              <button
                type="button"
                className="comment-btn-delete"
                onClick={onDelete}
                title="Delete comment"
                aria-label="Delete comment"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button type="button" className="comment-btn-done" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
        <div className="comment-thread-main">
          <div className="comment-thread-author">{comment.authorName || 'Anonymous'}</div>
          <p className="comment-thread-text">{comment.text}</p>
        </div>
        {comment.replies.length > 0 && (
          <div className="comment-thread-replies">
            {comment.replies.map((r, i) => (
              <div key={i} className="comment-thread-reply">
                <span className="comment-thread-reply-author">{r.authorName || 'Anonymous'}</span>
                <p>{r.text}</p>
              </div>
            ))}
          </div>
        )}
        <div className="comment-thread-input">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
          />
          <button
            type="button"
            className="comment-btn-reply"
            onClick={handleReply}
            disabled={!replyText.trim()}
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}
