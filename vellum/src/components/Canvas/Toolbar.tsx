import './Toolbar.css'

export type ToolType = 'sticky' | 'rectangle' | 'select'

interface ToolbarProps {
  activeTool: ToolType
  onToolSelect: (tool: ToolType) => void
  canEdit: boolean
}

export default function Toolbar({
  activeTool,
  onToolSelect,
  canEdit,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        type="button"
        className={`toolbar-btn ${activeTool === 'sticky' ? 'active' : ''}`}
        onClick={() => onToolSelect('sticky')}
        disabled={!canEdit}
        title="Add sticky note"
      >
        Sticky Note
      </button>
      <button
        type="button"
        className={`toolbar-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
        onClick={() => onToolSelect('rectangle')}
        disabled={!canEdit}
        title="Add rectangle"
      >
        Rectangle
      </button>
    </div>
  )
}
