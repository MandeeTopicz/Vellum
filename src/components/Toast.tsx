/**
 * Toast – transient notification for errors or success messages.
 */
import { useEffect } from 'react'
import './Toast.css'

interface ToastProps {
  message: string
  onDismiss: () => void
  /** Auto-dismiss after ms (default 4000). 0 = no auto-dismiss */
  duration?: number
}

export function Toast({ message, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (duration <= 0) return
    const id = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(id)
  }, [duration, onDismiss])

  return (
    <div className="toast" role="alert">
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
