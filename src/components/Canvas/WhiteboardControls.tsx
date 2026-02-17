import gridIcon from '../../assets/grid-icon.png'
import './WhiteboardControls.css'

interface WhiteboardControlsProps {
  showGrid: boolean
  onGridToggle: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
}

export default function WhiteboardControls({
  showGrid,
  onGridToggle,
  zoom,
  onZoomIn,
  onZoomOut,
}: WhiteboardControlsProps) {
  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="whiteboard-controls">
      <button
        type="button"
        className={`whiteboard-control-btn ${showGrid ? 'active' : ''}`}
        onClick={onGridToggle}
        title={showGrid ? 'Hide grid' : 'Show grid'}
      >
        <img src={gridIcon} alt="" width={18} height={18} />
      </button>
      <div className="whiteboard-zoom">
        <button
          type="button"
          className="whiteboard-zoom-btn"
          onClick={onZoomOut}
          title="Zoom out"
          disabled={zoomPercent <= 10}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="whiteboard-zoom-value">{zoomPercent}%</span>
        <button
          type="button"
          className="whiteboard-zoom-btn"
          onClick={onZoomIn}
          title="Zoom in"
          disabled={zoomPercent >= 400}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
