import { useState, useRef, useEffect } from 'react'
import pointerIcon from '../../assets/pointer-icon.png'
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
import ShapeIcon from './ShapeIcon'
import './WhiteboardToolbar.css'

/** All shape tool types (connections use two-click; others single-click) */
export type ShapeTool =
  | 'arrow-straight'
  | 'arrow-curved'
  | 'arrow-curved-cw'
  | 'arrow-elbow-bidirectional'
  | 'arrow-double'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'triangle-inverted'
  | 'pentagon'
  | 'hexagon'
  | 'plus'
  | 'star'
  | 'parallelogram-right'
  | 'parallelogram-left'
  | 'cylinder-vertical'
  | 'cylinder-horizontal'
  | 'tab-shape'
  | 'trapezoid'
  | 'circle-cross'

export type WhiteboardTool =
  | 'pointer'
  | 'sticky'
  | 'text'
  | ShapeTool
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'emoji'
  | 'comment'

interface WhiteboardToolbarProps {
  activeTool: WhiteboardTool
  onToolSelect: (tool: WhiteboardTool) => void
  onEmojiSelect?: (emoji: string) => void
  onUndo?: () => void
  onRedo?: () => void
  canEdit: boolean
  /** Opens Templates modal and deselects active tool */
  onTemplatesClick?: () => void
}

export default function WhiteboardToolbar({
  activeTool,
  onToolSelect,
  onEmojiSelect,
  onUndo,
  onRedo,
  canEdit,
  onTemplatesClick,
}: WhiteboardToolbarProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [penOpen, setPenOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const templatesRef = useRef<HTMLDivElement>(null)
  const shapesRef = useRef<HTMLDivElement>(null)
  const penRef = useRef<HTMLDivElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  const closeAllDropdowns = () => {
    setTemplatesOpen(false)
    setShapesOpen(false)
    setPenOpen(false)
    setEmojiOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
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

  const shapeCategories: Record<
    string,
    { label: string; shapes: { type: string; label: string }[] }
  > = {
    connections: {
      label: 'Connections',
      shapes: [
        { type: 'arrow-curved', label: 'Curved Arrow ↺' },
        { type: 'arrow-curved-cw', label: 'Curved Arrow ↻' },
        { type: 'arrow-elbow-bidirectional', label: 'Bidirectional Elbow Arrow' },
        { type: 'arrow-straight', label: 'Straight Arrow' },
        { type: 'arrow-double', label: 'Double Arrow' },
      ],
    },
    basic: {
      label: 'Basic',
      shapes: [
        { type: 'rectangle', label: 'Rectangle' },
        { type: 'circle', label: 'Circle' },
        { type: 'diamond', label: 'Diamond' },
        { type: 'triangle', label: 'Triangle' },
        { type: 'triangle-inverted', label: 'Inverted Triangle' },
        { type: 'pentagon', label: 'Pentagon' },
        { type: 'hexagon', label: 'Hexagon' },
        { type: 'plus', label: 'Plus' },
        { type: 'star', label: 'Star' },
      ],
    },
    flowchart: {
      label: 'Flowchart',
      shapes: [
        { type: 'parallelogram-right', label: 'Right Parallelogram' },
        { type: 'parallelogram-left', label: 'Left Parallelogram' },
        { type: 'cylinder-vertical', label: 'Vertical Cylinder' },
        { type: 'cylinder-horizontal', label: 'Horizontal Cylinder' },
        { type: 'tab-shape', label: 'Tab' },
        { type: 'trapezoid', label: 'Trapezoid' },
        { type: 'circle-cross', label: 'Circle Cross' },
      ],
    },
  }
  const allShapeTypes = Object.values(shapeCategories).flatMap((c) => c.shapes.map((s) => s.type))
  const isShapeTool = (t: WhiteboardTool): t is ShapeTool => allShapeTypes.includes(t)

  return (
    <div className="whiteboard-toolbar">
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

      <div className="toolbar-dropdown" ref={templatesRef}>
        <button
          type="button"
          className="toolbar-icon-btn"
          onClick={() => {
            closeAllDropdowns()
            if (onTemplatesClick) {
              onTemplatesClick()
            } else {
              setTemplatesOpen((v) => !v)
            }
          }}
          title="Templates"
          aria-label="Templates"
        >
          <img src={templatesIcon} alt="Templates" width={20} height={20} />
        </button>
        {templatesOpen && !onTemplatesClick && (
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
          onClick={(e) => {
            e.stopPropagation()
            closeAllDropdowns()
            onToolSelect(activeTool === 'text' ? 'pointer' : 'text')
          }}
        disabled={!canEdit}
        title="Text Box"
      >
        <img src={textIcon} alt="Text Box" width={20} height={20} />
      </button>

      <div className="toolbar-dropdown" ref={shapesRef}>
        <button
          type="button"
          className={`toolbar-icon-btn ${isShapeTool(activeTool) ? 'active' : ''}`}
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
          <div className="toolbar-dropdown-panel shape-selector-panel">
            {Object.entries(shapeCategories).map(([categoryKey, category]) => (
              <div key={categoryKey} className="shape-category">
                <div className="category-label">{category.label}</div>
                <div className="shape-grid">
                  {category.shapes.map((shape) => (
                    <button
                      key={shape.type}
                      type="button"
                      className={`shape-button ${activeTool === shape.type ? 'active' : ''}`}
                      onClick={() => {
                        onToolSelect(
                          shape.type as WhiteboardTool
                        )
                        setShapesOpen(false)
                      }}
                      title={shape.label}
                    >
                      <ShapeIcon type={shape.type} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-dropdown" ref={penRef}>
        <button
          type="button"
          className={`toolbar-icon-btn ${['pen', 'highlighter', 'eraser'].includes(activeTool) ? 'active' : ''}`}
          onClick={() => {
            closeAllDropdowns()
            setPenOpen((v) => !v)
          }}
          disabled={!canEdit}
          title="Pen"
        >
          <img src={pencilIcon} alt="Pen" width={20} height={20} />
        </button>
        {penOpen && (
          <div className="toolbar-dropdown-panel">
            <button
              type="button"
              className={`toolbar-dropdown-item ${activeTool === 'pen' ? 'active' : ''}`}
              onClick={() => {
                onToolSelect('pen')
                setPenOpen(false)
              }}
            >
              Pen
            </button>
            <button
              type="button"
              className={`toolbar-dropdown-item ${activeTool === 'highlighter' ? 'active' : ''}`}
              onClick={() => {
                onToolSelect('highlighter')
                setPenOpen(false)
              }}
            >
              Highlighter
            </button>
            <button
              type="button"
              className={`toolbar-dropdown-item ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={() => {
                onToolSelect('eraser')
                setPenOpen(false)
              }}
            >
              Eraser
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
