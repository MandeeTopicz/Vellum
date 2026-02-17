import { useState, useRef, useEffect } from 'react'
import aiIcon from '../../assets/ai-icon.png'
import pointerIcon from '../../assets/pointer-icon.png'
import formatsIcon from '../../assets/formats-icon.png'
import stickyIcon from '../../assets/sticky-icon.png'
import templatesIcon from '../../assets/templates-icon.png'
import textIcon from '../../assets/text-icon.png'
import shapesIcon from '../../assets/shapes-icon.png'
import emojiIcon from '../../assets/emoji-icon.png'
import commentIcon from '../../assets/comment-icon.png'
import linkIcon from '../../assets/link-icon.png'
import redoIcon from '../../assets/redo-icon.png'
import undoIcon from '../../assets/undo-icon.png'
import pencilIcon from '../../assets/pencil-icon.png'
import './WhiteboardToolbar.css'

export type WhiteboardTool =
  | 'pointer'
  | 'sticky'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'text'
  | 'pen'
  | 'emoji'
  | 'comment'

interface WhiteboardToolbarProps {
  activeTool: WhiteboardTool
  onToolSelect: (tool: WhiteboardTool) => void
  onEmojiSelect?: (emoji: string) => void
  onUndo?: () => void
  onRedo?: () => void
  canEdit: boolean
}

export default function WhiteboardToolbar({
  activeTool,
  onToolSelect,
  onEmojiSelect,
  onUndo,
  onRedo,
  canEdit,
}: WhiteboardToolbarProps) {
  const [formatsOpen, setFormatsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [penOpen, setPenOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const formatsRef = useRef<HTMLDivElement>(null)
  const templatesRef = useRef<HTMLDivElement>(null)
  const shapesRef = useRef<HTMLDivElement>(null)
  const penRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const closeAllDropdowns = () => {
    setFormatsOpen(false)
    setTemplatesOpen(false)
    setShapesOpen(false)
    setPenOpen(false)
    setEmojiOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        formatsRef.current?.contains(e.target as Node) ||
        templatesRef.current?.contains(e.target as Node) ||
        shapesRef.current?.contains(e.target as Node) ||
        penRef.current?.contains(e.target as Node) ||
        emojiRef.current?.contains(e.target as Node)
      )
        return
      closeAllDropdowns()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const shapeTypes = ['rectangle', 'circle', 'triangle', 'line'] as const

  return (
    <div className="whiteboard-toolbar">
      <span className="toolbar-icon-wrap" title="AI Template Generator - Coming Soon">
        <button
          type="button"
          className="toolbar-icon-btn disabled"
          disabled
        >
          <img src={aiIcon} alt="AI" width={20} height={20} />
        </button>
      </span>

      <button
        type="button"
        className={`toolbar-icon-btn ${activeTool === 'pointer' ? 'active' : ''}`}
        onClick={() => {
          closeAllDropdowns()
          onToolSelect('pointer')
        }}
        title="Select"
      >
        <img src={pointerIcon} alt="Select" width={20} height={20} />
      </button>

      <div className="toolbar-dropdown" ref={formatsRef}>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={() => {
            closeAllDropdowns()
            setFormatsOpen((v) => !v)
          }}
          title="Formats & Flows"
        >
          <img src={formatsIcon} alt="Formats & Flows" width={20} height={20} />
        </button>
        {formatsOpen && (
          <div className="toolbar-dropdown-panel">
            <p className="toolbar-coming-soon">Coming Soon</p>
            <p className="toolbar-dropdown-hint">Doc, Slides, Table, Timeline, Kanban, Flow Chart</p>
          </div>
        )}
      </div>

      <div className="toolbar-dropdown" ref={templatesRef}>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={() => {
            closeAllDropdowns()
            setTemplatesOpen((v) => !v)
          }}
          title="Templates"
        >
          <img src={templatesIcon} alt="Templates" width={20} height={20} />
        </button>
        {templatesOpen && (
          <div className="toolbar-dropdown-panel">
            <p className="toolbar-coming-soon">Templates Coming Soon</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`toolbar-icon-btn ${activeTool === 'sticky' ? 'active' : ''}`}
        onClick={() => {
          closeAllDropdowns()
          onToolSelect('sticky')
        }}
        disabled={!canEdit}
        title="Sticky Note"
      >
        <img src={stickyIcon} alt="Sticky Note" width={20} height={20} />
      </button>

      <button
        type="button"
        className={`toolbar-icon-btn ${activeTool === 'text' ? 'active' : ''}`}
        onClick={() => {
          closeAllDropdowns()
          onToolSelect('text')
        }}
        disabled={!canEdit}
        title="Text Box"
      >
        <img src={textIcon} alt="Text Box" width={20} height={20} />
      </button>

      <div className="toolbar-dropdown" ref={shapesRef}>
        <button
          type="button"
          className={`toolbar-icon-btn ${shapeTypes.includes(activeTool as typeof shapeTypes[number]) ? 'active' : ''}`}
          onClick={() => {
            closeAllDropdowns()
            setShapesOpen((v) => !v)
          }}
          disabled={!canEdit}
          title="Shapes"
        >
          <img src={shapesIcon} alt="Shapes" width={20} height={20} />
        </button>
        {shapesOpen && (
          <div className="toolbar-dropdown-panel">
            {shapeTypes.map((shape) => (
              <button
                key={shape}
                type="button"
                className="toolbar-dropdown-item"
                onClick={() => {
                  onToolSelect(shape)
                  setShapesOpen(false)
                }}
              >
                {shape.charAt(0).toUpperCase() + shape.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-dropdown" ref={penRef}>
        <button
          type="button"
          className={`toolbar-icon-btn ${activeTool === 'pen' ? 'active' : ''}`}
          onClick={() => {
            closeAllDropdowns()
            setPenOpen((v) => !v)
            if (!penOpen) onToolSelect('pen')
          }}
          disabled={!canEdit}
          title="Pen"
        >
          <img src={pencilIcon} alt="Pen" width={20} height={20} />
        </button>
        {penOpen && (
          <div className="toolbar-dropdown-panel">
            <button type="button" className="toolbar-dropdown-item" disabled>
              Pen (Coming Soon)
            </button>
            <button type="button" className="toolbar-dropdown-item" disabled>
              Highlighter (Coming Soon)
            </button>
            <button type="button" className="toolbar-dropdown-item" disabled>
              Eraser (Coming Soon)
            </button>
            <button type="button" className="toolbar-dropdown-item" disabled>
              Lasso (Coming Soon)
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-dropdown" ref={emojiRef}>
        <button
          type="button"
          className={`toolbar-icon-btn ${activeTool === 'emoji' ? 'active' : ''}`}
          onClick={() => {
            closeAllDropdowns()
            setEmojiOpen((v) => !v)
          }}
          disabled={!canEdit}
          title="Stickers / Emojis"
        >
          <img src={emojiIcon} alt="Stickers / Emojis" width={20} height={20} />
        </button>
        {emojiOpen && (
          <div className="toolbar-dropdown-panel toolbar-emoji-panel">
            <p className="toolbar-coming-soon">Emoji Picker Coming Soon</p>
            <div className="toolbar-emoji-preview">
              {['😀', '👍', '❤️', '🔥', '⭐'].map((e) => (
                <button
                  key={e}
                  type="button"
                  className="toolbar-emoji-btn"
                  onClick={() => {
                    onToolSelect('emoji')
                    onEmojiSelect?.(e)
                    setEmojiOpen(false)
                  }}
                  title={`Place ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`toolbar-icon-btn ${activeTool === 'comment' ? 'active' : ''}`}
        onClick={() => {
          closeAllDropdowns()
          onToolSelect('comment')
        }}
        disabled={!canEdit}
        title="Comment"
      >
        <img src={commentIcon} alt="Comment" width={20} height={20} />
      </button>

      <span className="toolbar-icon-wrap" title="Upload - Coming Soon">
        <button
          type="button"
          className="toolbar-icon-btn disabled"
          disabled
        >
          <img src={linkIcon} alt="Upload" width={20} height={20} />
        </button>
      </span>

      <div className="toolbar-divider" />

      <button
        type="button"
        className="toolbar-icon-btn"
        title="Undo (⌘Z)"
        onClick={() => onUndo?.()}
        disabled={!canEdit}
      >
        <img src={undoIcon} alt="Undo" width={20} height={20} />
      </button>
      <button
        type="button"
        className="toolbar-icon-btn"
        title="Redo (⌘⇧Z)"
        onClick={() => onRedo?.()}
        disabled={!canEdit}
      >
        <img src={redoIcon} alt="Redo" width={20} height={20} />
      </button>
    </div>
  )
}
