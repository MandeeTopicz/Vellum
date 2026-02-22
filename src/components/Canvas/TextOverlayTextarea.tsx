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
  /** Canvas-space dimensions (for initial textarea size and persistence) */
  dimensions: { width: number; height: number }
}

const MIN_WIDTH = 100
const MIN_HEIGHT = 40

interface TextOverlayTextareaProps {
  editingText: EditingTextState
  /** Viewport scale to convert screen pixels to canvas dimensions */
  viewportScale: number
  onCommit: (value: string, dimensions: { width: number; height: number }) => void
  onCancel: () => void
  /** Called synchronously on blur, before commit — allows parent to block the next canvas click from creating */
  onBeforeClose?: () => void
  /** Called on every change so parent can track value for commit-before-close */
  onValueChange?: (value: string) => void
}

/**
 * Minimal text overlay: position fixed, screen coordinates only.
 * Does NOT move or resize on zoom/pan - coords frozen at open.
 * Placeholder only here (not on Konva).
 */
function getCanvasDimensions(
  el: HTMLTextAreaElement,
  viewportScale: number
): { width: number; height: number } {
  return {
    width: Math.max(MIN_WIDTH, el.offsetWidth / viewportScale),
    height: Math.max(MIN_HEIGHT, el.scrollHeight / viewportScale),
  }
}

export default function TextOverlayTextarea({
  editingText,
  viewportScale,
  onCommit,
  onCancel,
  onBeforeClose,
  onValueChange,
}: TextOverlayTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.max(MIN_HEIGHT, el.scrollHeight)}px`
  }

  const commit = () => {
    const el = textareaRef.current
    const value = el?.value ?? ''
    const dimensions = el
      ? getCanvasDimensions(el, viewportScale)
      : editingText.dimensions
    onCommit(value, dimensions)
  }

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.focus()
      autoResize(el)
    }
  }, [editingText.id])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  }

  const handleBlur = () => {
    onBeforeClose?.()
    requestAnimationFrame(() => {
      const active = document.activeElement
      if (active?.closest('.text-format-toolbar')) {
        return
      }
      commit()
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange?.(e.target.value)
    autoResize(e.target)
  }

  const { textStyle, dimensions } = editingText
  const widthPx = Math.max(MIN_WIDTH, dimensions.width * viewportScale)

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
        onChange={handleChange}
        onInput={(e) => autoResize(e.target as HTMLTextAreaElement)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: `${widthPx}px`,
          minWidth: `${MIN_WIDTH}px`,
          minHeight: `${MIN_HEIGHT}px`,
          overflow: 'hidden',
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
