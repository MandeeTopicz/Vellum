/**
 * TextFormatToolbar – formatting controls shown above text box when editing.
 * Provides color picker, font, size, bold, bullet list, mind map, alignment.
 */
import { useState, useEffect, useRef } from 'react'
import {
  Bold,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Network,
  ChevronDown,
} from 'lucide-react'
import type { TextStyle } from '../../types/objects'
import './TextFormatToolbar.css'

interface TextFormatToolbarProps {
  textBoxId: string | null
  currentFormat: TextStyle
  position: { x: number; y: number }
  onFormatChange: (updates: Partial<TextStyle>) => void
  onCreateMindMap: () => void
}

const FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Comic Sans MS',
  'Impact',
  'Roboto',
  'Open Sans',
  'Inter, system-ui, sans-serif',
]

const PRESET_COLORS = [
  '#000000',
  '#374151',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
]

export default function TextFormatToolbar({
  textBoxId: _textBoxId,
  currentFormat,
  position,
  onFormatChange,
  onCreateMindMap,
}: TextFormatToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)
  const fontRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorRef.current?.contains(e.target as Node) === false &&
        fontRef.current?.contains(e.target as Node) === false
      ) {
        setShowColorPicker(false)
        setShowFontDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      className="text-format-toolbar"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 60,
        zIndex: 10000,
      }}
    >
      <div className="toolbar-section" ref={colorRef}>
        <button
          type="button"
          className="toolbar-button color-button"
          onClick={(e) => {
            e.stopPropagation()
            setShowColorPicker(!showColorPicker)
            setShowFontDropdown(false)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Text Color"
        >
          <div
            className="color-indicator"
            style={{ backgroundColor: currentFormat.fontColor }}
          />
        </button>
        {showColorPicker && (
          <div
            className="color-picker-dropdown"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="preset-colors">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFormatChange({ fontColor: color })
                    setShowColorPicker(false)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
            <div className="custom-color">
              <input
                type="color"
                value={currentFormat.fontColor}
                onChange={(e) => onFormatChange({ fontColor: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Custom color"
              />
              <input
                type="text"
                value={currentFormat.fontColor}
                onChange={(e) => onFormatChange({ fontColor: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="#000000"
                maxLength={7}
                aria-label="Hex color"
              />
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-section" ref={fontRef}>
        <button
          type="button"
          className="toolbar-button font-button"
          onClick={(e) => {
            e.stopPropagation()
            setShowFontDropdown(!showFontDropdown)
            setShowColorPicker(false)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="font-name">{currentFormat.fontFamily.split(',')[0]}</span>
          <ChevronDown size={14} strokeWidth={2} />
        </button>
        {showFontDropdown && (
          <div
            className="font-dropdown"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {FONTS.map((font) => (
              <button
                key={font}
                type="button"
                className={`font-option ${currentFormat.fontFamily === font ? 'active' : ''}`}
                style={{ fontFamily: font }}
                onClick={(e) => {
                  e.stopPropagation()
                  onFormatChange({ fontFamily: font })
                  setShowFontDropdown(false)
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {font.split(',')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="toolbar-section font-size-input"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          type="number"
          value={currentFormat.fontSize}
          onChange={(e) => onFormatChange({ fontSize: Number(e.target.value) || 14 })}
          min={8}
          max={72}
          aria-label="Font size"
        />
        <div className="size-arrows">
          <button
            type="button"
            className="size-arrow up"
            onClick={(e) => {
              e.stopPropagation()
              onFormatChange({ fontSize: Math.min(72, currentFormat.fontSize + 1) })
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Increase font size"
          >
            ▲
          </button>
          <button
            type="button"
            className="size-arrow down"
            onClick={(e) => {
              e.stopPropagation()
              onFormatChange({ fontSize: Math.max(8, currentFormat.fontSize - 1) })
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Decrease font size"
          >
            ▼
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`toolbar-button ${currentFormat.bold ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onFormatChange({ bold: !currentFormat.bold })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Bold"
      >
        <Bold size={20} strokeWidth={2} />
      </button>

      <button
        type="button"
        className={`toolbar-button ${currentFormat.bulletList ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onFormatChange({ bulletList: !currentFormat.bulletList })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Bullet List"
      >
        <List size={20} strokeWidth={2} />
      </button>

      <button
        type="button"
        className="toolbar-button"
        onClick={(e) => {
          e.stopPropagation()
          onCreateMindMap()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Convert to Mind Map"
      >
        <Network size={20} strokeWidth={2} />
      </button>

      <div className="toolbar-section alignment-buttons">
        <button
          type="button"
          className={`toolbar-button ${currentFormat.textAlign === 'left' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onFormatChange({ textAlign: 'left' })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Align Left"
        >
          <AlignLeft size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`toolbar-button ${currentFormat.textAlign === 'center' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onFormatChange({ textAlign: 'center' })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Align Center"
        >
          <AlignCenter size={20} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={`toolbar-button ${currentFormat.textAlign === 'right' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onFormatChange({ textAlign: 'right' })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Align Right"
        >
          <AlignRight size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
