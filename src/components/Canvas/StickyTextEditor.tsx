import { useRef, useEffect } from 'react'
import type { StickyObject } from '../../types'
import type { Viewport } from './InfiniteCanvas'
import { canvasToStage } from '../../utils/coordinates'

interface StickyTextEditorProps {
  sticky: StickyObject
  viewport: Viewport
  onSave: (content: string) => void
  onCancel: () => void
  /** World position for frame children; when set, used instead of sticky.position for placement */
  worldPosition?: { x: number; y: number }
}

export default function StickyTextEditor({
  sticky,
  viewport,
  onSave,
  onCancel,
  worldPosition,
}: StickyTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pos = worldPosition ?? sticky.position

  const { x: screenX, y: screenY } = canvasToStage(pos.x, pos.y, viewport)
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
          border: '2px solid #8093F1',
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
