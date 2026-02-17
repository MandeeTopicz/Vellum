import { useRef, useEffect } from 'react'
import type { StickyObject, Viewport } from './InfiniteCanvas'

interface StickyTextEditorProps {
  sticky: StickyObject
  viewport: Viewport
  onSave: (content: string) => void
  onCancel: () => void
}

export default function StickyTextEditor({
  sticky,
  viewport,
  onSave,
  onCancel,
}: StickyTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const screenX = viewport.x + sticky.position.x * viewport.scale
  const screenY = viewport.y + sticky.position.y * viewport.scale
  const screenW = sticky.dimensions.width * viewport.scale
  const screenH = sticky.dimensions.height * viewport.scale

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        zIndex: 1000,
        padding: 4,
        boxSizing: 'border-box',
      }}
    >
      <textarea
        ref={textareaRef}
        defaultValue={sticky.content}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onCancel()
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          padding: 8,
          margin: 0,
          border: '2px solid #646cff',
          borderRadius: 4,
          fontSize: sticky.textStyle.fontSize,
          fontFamily: sticky.textStyle.fontFamily,
          color: sticky.textStyle.fontColor,
          fontWeight: sticky.textStyle.bold ? 'bold' : 'normal',
          fontStyle: sticky.textStyle.italic ? 'italic' : 'normal',
          textAlign: sticky.textStyle.textAlign,
          resize: 'none',
          outline: 'none',
          background: sticky.fillColor,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
