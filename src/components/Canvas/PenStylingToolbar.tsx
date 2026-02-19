/**
 * PenStylingToolbar – secondary toolbar for pen/highlighter/eraser customization.
 * Shows color swatches, size slider, opacity slider, and stroke type buttons.
 */
import type { PenStrokeType } from '../../types'
import './PenStylingToolbar.css'

const PRESET_COLORS = [
  '#000000',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#eab308',
  '#f97316',
  '#a855f7',
  '#ec4899',
]

export interface PenStyles {
  color: string
  size: number
  opacity: number
  strokeType: PenStrokeType
}

interface PenStylingToolbarProps {
  penStyles: PenStyles
  onPenStylesChange: (styles: Partial<PenStyles>) => void
  activeTool: 'pen' | 'highlighter' | 'eraser'
}

export default function PenStylingToolbar({
  penStyles,
  onPenStylesChange,
  activeTool,
}: PenStylingToolbarProps) {
  const { color, size, opacity, strokeType } = penStyles
  const isEraser = activeTool === 'eraser'

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || /^#[0-9A-Fa-f]{1,6}$/.test(val)) {
      onPenStylesChange({ color: val || '#000000' })
    }
  }

  return (
    <div className="pen-styling-toolbar">
      {!isEraser && (
        <>
          <div className="pen-styling-section color-selector">
            <div className="preset-colors">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-button ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => onPenStylesChange({ color: c })}
                  title={c}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <div className="custom-color">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#000000'}
                onChange={(e) => onPenStylesChange({ color: e.target.value })}
                aria-label="Pick color"
              />
              <input
                type="text"
                value={color}
                onChange={handleHexChange}
                placeholder="#000000"
                maxLength={7}
                className="color-hex-input"
              />
            </div>
          </div>

          <div className="pen-styling-section stroke-type">
            <label>Stroke:</label>
            <div className="stroke-type-buttons">
              <button
                type="button"
                className={strokeType === 'solid' ? 'active' : ''}
                onClick={() => onPenStylesChange({ strokeType: 'solid' })}
                title="Solid line"
              >
                <svg width="40" height="6" viewBox="0 0 40 6">
                  <line x1="0" y1="3" x2="40" y2="3" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
              <button
                type="button"
                className={strokeType === 'dotted' ? 'active' : ''}
                onClick={() => onPenStylesChange({ strokeType: 'dotted' })}
                title="Dotted line"
              >
                <svg width="40" height="6" viewBox="0 0 40 6">
                  <line
                    x1="0"
                    y1="3"
                    x2="40"
                    y2="3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="2,2"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={strokeType === 'double' ? 'active' : ''}
                onClick={() => onPenStylesChange({ strokeType: 'double' })}
                title="Double line"
              >
                <svg width="40" height="8" viewBox="0 0 40 8">
                  <line x1="0" y1="2" x2="40" y2="2" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="0" y1="6" x2="40" y2="6" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </div>

          <div className="pen-styling-section opacity-control">
            <label>Opacity: {opacity}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => onPenStylesChange({ opacity: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      <div className="pen-styling-section size-control">
        <label>
          {isEraser ? 'Eraser size' : 'Size'}: {size}px
        </label>
        <input
          type="range"
          min="1"
          max="50"
          value={size}
          onChange={(e) => onPenStylesChange({ size: Number(e.target.value) })}
        />
        {!isEraser && (
          <div
            className="size-preview"
            style={{
              width: Math.min(size, 40),
              height: Math.min(size, 40),
              backgroundColor: color,
              opacity: opacity / 100,
              borderRadius: '50%',
            }}
          />
        )}
      </div>
    </div>
  )
}
