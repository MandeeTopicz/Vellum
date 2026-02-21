/**
 * StyleToolbar – floating toolbar for styling selected objects.
 * Three buttons: Border (empty square + black border), Fill (gray square with line = no fill), More (⋮).
 */
import { useState, useEffect, useRef } from 'react'
import type { BoardObject } from '../../types'

const PRESET_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000']

interface StyleToolbarProps {
  selectedObject: BoardObject
  onUpdate: (updates: Partial<BoardObject>) => void
  position: { x: number; y: number }
  /** Copy selected objects to clipboard */
  onCopy?: () => void
  /** Paste from clipboard */
  onPaste?: () => void
  /** Duplicate selected objects */
  onDuplicate?: () => void
  /** Delete selected objects */
  onDelete?: () => void
  /** Bring selected to front (top of z-order) */
  onSendToFront?: () => void
  /** Send selected to back (bottom of z-order) */
  onBringToBack?: () => void
  /** Whether paste is available (clipboard has content) */
  canPaste?: boolean
}

function hasFillColor(obj: BoardObject): obj is BoardObject & { fillColor?: string } {
  return 'fillColor' in obj
}

function hasStroke(obj: BoardObject): boolean {
  return 'strokeColor' in obj || 'strokeWidth' in obj || obj.type === 'line'
}

function hasCornerRadius(obj: BoardObject): boolean {
  return (obj.type === 'rectangle' || obj.type === 'sticky') && 'cornerRadius' in obj
}

export function StyleToolbar({
  selectedObject,
  onUpdate,
  position,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSendToFront,
  onBringToBack,
  canPaste = false,
}: StyleToolbarProps) {
  const [showBorderDropdown, setShowBorderDropdown] = useState(false)
  const [showFillDropdown, setShowFillDropdown] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showArrangeSubmenu, setShowArrangeSubmenu] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const closeAll = () => {
    setShowBorderDropdown(false)
    setShowFillDropdown(false)
    setShowMoreMenu(false)
    setShowArrangeSubmenu(false)
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        !target.closest('.toolbar-popup') &&
        toolbarRef.current &&
        !toolbarRef.current.contains(target)
      ) {
        closeAll()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const strokeColor = hasStroke(selectedObject)
    ? ((selectedObject as { strokeColor?: string }).strokeColor || '#000000')
    : undefined
  const strokeWidth =
    'strokeWidth' in selectedObject
      ? ((selectedObject as { strokeWidth?: number }).strokeWidth ?? 2)
      : undefined
  const strokeStyle =
    'strokeStyle' in selectedObject
      ? ((selectedObject as { strokeStyle?: string }).strokeStyle || 'solid')
      : undefined
  const strokeOpacity =
    'strokeOpacity' in selectedObject
      ? ((selectedObject as { strokeOpacity?: number }).strokeOpacity ?? 1)
      : 1
  const fillOpacity =
    'opacity' in selectedObject
      ? ((selectedObject as { opacity?: number }).opacity ?? 1)
      : 1
  const fillColor = hasFillColor(selectedObject)
    ? (selectedObject.fillColor || '#ffffff')
    : undefined
  const cornerRadius = hasCornerRadius(selectedObject)
    ? ((selectedObject as { cornerRadius?: number }).cornerRadius ?? 12)
    : undefined

  const showBorder = hasStroke(selectedObject)
  const showFill = hasFillColor(selectedObject)
  const showStrokeStyle = showBorder && selectedObject.type !== 'line'
  const showCornersControl = hasCornerRadius(selectedObject)

  const TOOLBAR_WIDTH = 180
  const halfWidth = TOOLBAR_WIDTH / 2
  const adjustedX = Math.max(
    halfWidth,
    Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - halfWidth : position.x)
  )
  const adjustedY = Math.max(80, position.y - 60)

  return (
    <div
      ref={toolbarRef}
      className="style-toolbar toolbar-popup"
      style={{
        position: 'absolute',
        left: adjustedX,
        top: adjustedY,
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '8px',
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: 1000,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Border Color Icon - hollow square div with thick border */}
      {showBorder && (
        <div style={{ position: 'relative' }} className="toolbar-popup">
          <button
            type="button"
            title="Border Color"
            onClick={() => {
              setShowFillDropdown(false)
              setShowMoreMenu(false)
              setShowBorderDropdown((s) => !s)
            }}
            style={{
              width: '40px',
              height: '40px',
              border: showBorderDropdown ? '2px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                border: `3px solid ${strokeColor === 'transparent' ? '#9ca3af' : strokeColor ?? '#000000'}`,
                borderRadius: cornerRadius && cornerRadius > 0 ? '3px' : 0,
                boxSizing: 'border-box',
              }}
            />
          </button>
          {showBorderDropdown && (
            <div
              className="toolbar-popup"
              style={{
                position: 'absolute',
                top: '44px',
                left: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1001,
                minWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {strokeWidth !== undefined && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                    Thickness
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={strokeWidth}
                    onChange={(e) => onUpdate({ strokeWidth: parseInt(e.target.value, 10) } as Partial<BoardObject>)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {showStrokeStyle && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                    Style
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="Solid"
                      onClick={() => onUpdate({ strokeStyle: 'solid' } as Partial<BoardObject>)}
                      style={{
                        padding: '8px 12px',
                        border: strokeStyle === 'solid' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: strokeStyle === 'solid' ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div style={{ width: '32px', height: '2px', backgroundColor: '#000000' }} />
                    </button>
                    <button
                      type="button"
                      title="Dashed"
                      onClick={() => onUpdate({ strokeStyle: 'dashed' } as Partial<BoardObject>)}
                      style={{
                        padding: '8px 12px',
                        border: strokeStyle === 'dashed' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: strokeStyle === 'dashed' ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{ width: '6px', height: '2px', backgroundColor: '#000000' }} />
                      ))}
                    </button>
                    <button
                      type="button"
                      title="Dotted"
                      onClick={() => onUpdate({ strokeStyle: 'dotted' } as Partial<BoardObject>)}
                      style={{
                        padding: '8px 12px',
                        border: strokeStyle === 'dotted' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: strokeStyle === 'dotted' ? '#eff6ff' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: '2px',
                            height: '2px',
                            borderRadius: '50%',
                            backgroundColor: '#000000',
                          }}
                        />
                      ))}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                  Border Opacity
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(strokeOpacity * 100)}
                  onChange={(e) =>
                    onUpdate({ strokeOpacity: parseInt(e.target.value, 10) / 100 } as Partial<BoardObject>)
                  }
                  style={{ width: '100%' }}
                />
              </div>
              {showCornersControl && cornerRadius !== undefined && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                    Corner Radius
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={cornerRadius}
                    onChange={(e) =>
                      onUpdate({ cornerRadius: parseInt(e.target.value, 10) } as Partial<BoardObject>)
                    }
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              {strokeColor !== undefined && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                    Color
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => onUpdate({ strokeColor: 'transparent' } as Partial<BoardObject>)}
                      title="None"
                      style={{
                        width: '28px',
                        height: '28px',
                        background:
                          'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 50% / 12px 12px',
                        border: strokeColor === 'transparent' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#000000' }}>∅</span>
                    </button>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onUpdate({ strokeColor: color } as Partial<BoardObject>)}
                        title={color}
                        style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: color,
                          border:
                            strokeColor === color
                              ? '2px solid #3b82f6'
                              : color === '#ffffff'
                                ? '1px solid #d1d5db'
                                : '1px solid transparent',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={strokeColor === 'transparent' ? '#000000' : strokeColor}
                    onChange={(e) => onUpdate({ strokeColor: e.target.value } as Partial<BoardObject>)}
                    style={{ width: '100%', height: '32px', cursor: 'pointer' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fill Color Icon - filled square div, or white square with SVG red line when empty */}
      {showFill && (
        <div style={{ position: 'relative' }} className="toolbar-popup">
          <button
            type="button"
            title="Fill Color"
            onClick={() => {
              setShowBorderDropdown(false)
              setShowMoreMenu(false)
              setShowFillDropdown((s) => !s)
            }}
            style={{
              width: '40px',
              height: '40px',
              border: showFillDropdown ? '2px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                backgroundColor:
                  fillColor && fillColor !== 'transparent' ? fillColor : 'white',
                border: '2px solid #000000',
                borderRadius: '2px',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {(!fillColor || fillColor === 'transparent') && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                  }}
                  viewBox="0 0 22 22"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="22"
                    y2="22"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </div>
          </button>
          {showFillDropdown && (
            <div
              className="toolbar-popup"
              style={{
                position: 'absolute',
                top: '44px',
                left: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1001,
                minWidth: '180px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                Fill Opacity
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(fillOpacity * 100)}
                onChange={(e) =>
                  onUpdate({ opacity: parseInt(e.target.value, 10) / 100 } as Partial<BoardObject>)
                }
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>
                Color
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => onUpdate({ fillColor: 'transparent' } as Partial<BoardObject>)}
                  title="None"
                  style={{
                    width: '28px',
                    height: '28px',
                    background:
                      'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 50% / 12px 12px',
                    border: fillColor === 'transparent' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#000000' }}>∅</span>
                </button>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onUpdate({ fillColor: color } as Partial<BoardObject>)}
                    title={color}
                    style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: color,
                      border:
                        fillColor === color
                          ? '2px solid #3b82f6'
                          : color === '#ffffff'
                            ? '1px solid #d1d5db'
                            : '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={fillColor === 'transparent' ? '#ffffff' : fillColor ?? '#ffffff'}
                onChange={(e) => onUpdate({ fillColor: e.target.value } as Partial<BoardObject>)}
                style={{ width: '100%', height: '32px', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      )}

      {/* More button – three dots */}
      <div style={{ position: 'relative' }} className="toolbar-popup">
        <button
          type="button"
          title="More options"
          onClick={() => {
            setShowBorderDropdown(false)
            setShowFillDropdown(false)
            setShowArrangeSubmenu(false)
            setShowMoreMenu((s) => !s)
          }}
          style={{
            width: '36px',
            height: '36px',
            border: showMoreMenu ? '2px solid #3b82f6' : '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: showMoreMenu ? '#eff6ff' : 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: '#374151',
                }}
              />
            ))}
          </div>
        </button>
        {showMoreMenu && (
          <div
            className="toolbar-popup"
            style={{
              position: 'absolute',
              top: '44px',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1001,
              minWidth: '160px',
              padding: '4px',
            }}
          >
            {onCopy && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onCopy()
                  closeAll()
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#000000',
                  borderRadius: '4px',
                }}
              >
                Copy
              </button>
            )}
            {onPaste && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (canPaste) onPaste()
                  closeAll()
                }}
                disabled={!canPaste}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: canPaste ? 'pointer' : 'not-allowed',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#000000',
                  borderRadius: '4px',
                  opacity: canPaste ? 1 : 0.5,
                }}
              >
                Paste
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDuplicate()
                  closeAll()
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#000000',
                  borderRadius: '4px',
                }}
              >
                Duplicate
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete()
                  closeAll()
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#000000',
                  borderRadius: '4px',
                }}
              >
                Delete
              </button>
            )}
            {(onSendToFront || onBringToBack) && (
              <div
                style={{ position: 'relative' }}
                onMouseEnter={() => setShowArrangeSubmenu(true)}
                onMouseLeave={() => setShowArrangeSubmenu(false)}
              >
                <div
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#000000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  Arrange
                  <span style={{ fontSize: '10px', color: '#000000' }}>›</span>
                </div>
                {showArrangeSubmenu && (
                  <div
                    className="toolbar-popup"
                    style={{
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      marginLeft: '4px',
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 1002,
                      minWidth: '140px',
                      padding: '4px',
                    }}
                  >
                    {onSendToFront && (
                      <button
                        type="button"
                        onClick={() => {
                          onSendToFront()
                          closeAll()
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: '#000000',
                          borderRadius: '4px',
                        }}
                      >
                        Bring to Front
                      </button>
                    )}
                    {onBringToBack && (
                      <button
                        type="button"
                        onClick={() => {
                          onBringToBack()
                          closeAll()
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: '#000000',
                          borderRadius: '4px',
                        }}
                      >
                        Send to Back
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
