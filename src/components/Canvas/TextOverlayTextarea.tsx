import { useRef, useEffect } from 'react'
import type { TextStyle } from '../../types/objects'

/** Editing state: screen coords only for placement. canvasX/canvasY captured at open. */
export interface EditingTextState {
  id: string | null
  screenX: number
  screenY: number
  canvasX: number
  canvasY: number
  value: string
  isNew: boolean
  /** Text formatting; used for toolbar and persisted on create/update */
  textStyle: TextStyle
}

interface TextOverlayTextareaProps {
  editingText: EditingTextState
  onCommit: (value: string) => void
  onCancel: () => void
  /** Called on every change so parent can track value for commit-before-close */
  onValueChange?: (value: string) => void
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
  onValueChange,
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
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active?.closest('.text-format-toolbar')) {
        return
      }
      onCommit(textareaRef.current?.value ?? '')
    })
  }

  const { textStyle } = editingText

  return (
    <div
      className="text-box-editor"
      style={{
        position: 'fixed',
        left: editingText.screenX,
        top: editingText.screenY,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        defaultValue={editingText.value}
        placeholder="Text"
        onChange={(e) => onValueChange?.(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '200px',
          minHeight: '40px',
          fontSize: `${textStyle.fontSize}px`,
          fontFamily: textStyle.fontFamily,
          fontWeight: textStyle.bold ? 'bold' : 'normal',
          fontStyle: textStyle.italic ? 'italic' : 'normal',
          textDecoration: textStyle.underline ? 'underline' : 'none',
          color: textStyle.fontColor,
          textAlign: textStyle.textAlign,
          padding: 8,
          margin: 0,
          border: '2px solid #8093F1',
          borderRadius: 4,
          resize: 'none',
          outline: 'none',
          background: '#fff',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
