/**
 * ContextMenu – right-click menu for the whiteboard.
 * Shows Copy, Paste when no object is selected; full menu (Copy, Paste, Duplicate, Delete, Arrange)
 * when an object is selected.
 */
import { useState, useEffect, useRef } from 'react'
import './ContextMenu.css'

interface ContextMenuProps {
  position: { x: number; y: number }
  hasSelection: boolean
  canPaste: boolean
  /** Canvas coords where paste should place objects; when from right-click, pass this */
  pasteTargetCanvasPos?: { x: number; y: number }
  onClose: () => void
  onCopy: () => void
  onPaste: (targetCanvasPos?: { x: number; y: number }) => void
  onDuplicate?: () => void
  onDelete?: () => void
  onSendToFront?: () => void
  onBringToBack?: () => void
  /** Open link for linked object (single selection) */
  onOpenLink?: () => void
  /** Reset rotation to 0 (single selection, when rotation !== 0) */
  onResetRotation?: () => void
  /** Open link editor for selected object(s) */
  onLinkClick?: () => void
}

export function ContextMenu({
  position,
  hasSelection,
  canPaste,
  pasteTargetCanvasPos,
  onClose,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onSendToFront,
  onBringToBack,
  onOpenLink,
  onResetRotation,
  onLinkClick,
}: ContextMenuProps) {
  const [showArrangeSubmenu, setShowArrangeSubmenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = () => {
    setShowArrangeSubmenu(false)
    onClose()
  }

  const runAndClose = (fn: () => void) => {
    fn()
    close()
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10001,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="context-menu-item"
        onMouseDown={(e) => {
          e.preventDefault()
          runAndClose(onCopy)
        }}
      >
        Copy
      </button>
      <button
        type="button"
        className="context-menu-item"
        disabled={!canPaste}
        onMouseDown={(e) => {
          e.preventDefault()
          if (canPaste) runAndClose(() => onPaste(pasteTargetCanvasPos))
        }}
      >
        Paste
      </button>
      {hasSelection && (
        <>
          <button
            type="button"
            className="context-menu-item"
            onMouseDown={(e) => {
              e.preventDefault()
              onDuplicate && runAndClose(onDuplicate)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="context-menu-item"
            onMouseDown={(e) => {
              e.preventDefault()
              onDelete && runAndClose(onDelete)
            }}
          >
            Delete
          </button>
          {onOpenLink && (
            <button
              type="button"
              className="context-menu-item"
              onMouseDown={(e) => {
                e.preventDefault()
                runAndClose(onOpenLink)
              }}
            >
              Open link
            </button>
          )}
          {onResetRotation && (
            <button
              type="button"
              className="context-menu-item"
              onMouseDown={(e) => {
                e.preventDefault()
                runAndClose(onResetRotation)
              }}
            >
              Reset rotation
            </button>
          )}
          {onLinkClick && (
            <button
              type="button"
              className="context-menu-item"
              onMouseDown={(e) => {
                e.preventDefault()
                runAndClose(onLinkClick)
              }}
            >
              {onOpenLink ? 'Edit link' : 'Add link'}
            </button>
          )}
          {(onSendToFront || onBringToBack) && (
            <div
              className="context-menu-submenu-trigger"
              onMouseEnter={() => setShowArrangeSubmenu(true)}
              onMouseLeave={() => setShowArrangeSubmenu(false)}
            >
              <span>Arrange</span>
              <span className="context-menu-arrow">›</span>
              {showArrangeSubmenu && (
                <div className="context-menu-submenu">
                  {onSendToFront && (
                    <button
                      type="button"
                      className="context-menu-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        runAndClose(onSendToFront)
                      }}
                    >
                      Bring to Front
                    </button>
                  )}
                  {onBringToBack && (
                    <button
                      type="button"
                      className="context-menu-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        runAndClose(onBringToBack)
                      }}
                    >
                      Send to Back
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
