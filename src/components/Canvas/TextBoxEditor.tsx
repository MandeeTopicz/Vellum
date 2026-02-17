import { useRef, useEffect } from 'react'
import type { TextObject } from '../../types'
import type { Viewport } from './InfiniteCanvas'

interface TextBoxEditorProps {
  text: TextObject
  viewport: Viewport
  onSave: (content: string) => void
  onCancel: () => void
}

export default function TextBoxEditor({
  text,
  viewport,
  onSave,
  onCancel,
}: TextBoxEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const screenX = viewport.x + text.position.x * viewport.scale
  const screenY = viewport.y + text.position.y * viewport.scale
  const screenW = text.dimensions.width * viewport.scale
  const screenH = text.dimensions.height * viewport.scale

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
        defaultValue={text.content}
        onBlur={(e) => onSave(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          width: '100%',
          height: '100%',
          padding: 8,
          margin: 0,
          border: '2px solid #4f46e5',
          borderRadius: 4,
          fontSize: text.textStyle.fontSize,
          fontFamily: text.textStyle.fontFamily,
          color: text.textStyle.fontColor,
          fontWeight: text.textStyle.bold ? 'bold' : 'normal',
          fontStyle: text.textStyle.italic ? 'italic' : 'normal',
          textAlign: text.textStyle.textAlign,
          resize: 'none',
          outline: 'none',
          background: 'transparent',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
