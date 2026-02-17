import { useState } from 'react'
import type { BoardComment } from '../../services/comments'
import './CommentThreadModal.css'

interface CommentThreadModalProps {
  comment: BoardComment | null
  onReply: (text: string) => void
  onClose: () => void
}

export default function CommentThreadModal({ comment, onReply, onClose }: CommentThreadModalProps) {
  const [replyText, setReplyText] = useState('')

  if (!comment) return null

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
          <button type="button" className="comment-thread-close" onClick={onClose}>
            ×
          </button>
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
            className="comment-btn-save"
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
