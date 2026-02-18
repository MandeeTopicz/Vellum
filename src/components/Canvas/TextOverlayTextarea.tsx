import { useRef, useEffect } from 'react'

/** Editing state: screen coords only for placement. canvasX/canvasY captured at open. */
export interface EditingTextState {
  id: string | null
  screenX: number
  screenY: number
  canvasX: number
  canvasY: number
  value: string
  isNew: boolean
}

interface TextOverlayTextareaProps {
  editingText: EditingTextState
  onCommit: (value: string) => void
  onCancel: () => void
}

/**
 * Minimal text overlay: position fixed, screen coordinates only.
 * Does NOT move or resize on zoom/pan - coords frozen at open.
 * Placeholder only here (not on Konva).
 */
export default function TextOverlayTextarea({
  editingText,
  onCommit,
  onCancel,
}: TextOverlayTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onCommit(textareaRef.current?.value ?? '')
    }
  }

  const handleBlur = () => {
    onCommit(textareaRef.current?.value ?? '')
  }

  return (
    <textarea
      ref={textareaRef}
      defaultValue={editingText.value}
      placeholder="Text"
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: editingText.screenX,
        top: editingText.screenY,
        width: '200px',
        minHeight: '40px',
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        padding: 8,
        margin: 0,
        border: '2px solid #4f46e5',
        borderRadius: 4,
        resize: 'none',
        outline: 'none',
        background: '#fff',
        boxSizing: 'border-box',
        zIndex: 1000,
      }}
    />
  )
}
