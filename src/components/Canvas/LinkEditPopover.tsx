/**
 * LinkEditPopover – modal to add/edit/remove URL links on selected objects.
 * Validates URL (http, https, mailto); auto-prepends https:// if missing scheme.
 */
import { useState, useEffect, useRef } from 'react'

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:']

/**
 * Sanitizes and validates URL. Returns null if invalid.
 * @param raw - Raw input string
 * @returns Valid URL or null
 */
function sanitizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let url = t
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) {
    url = `https://${t}`
  }
  try {
    const parsed = new URL(url)
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return null
    return url
  } catch {
    return null
  }
}

interface LinkEditPopoverProps {
  objectId: string
  currentUrl: string | null | undefined
  position: { x: number; y: number }
  onSave: (objectId: string, url: string | null) => void
  onClose: () => void
}

export function LinkEditPopover({
  objectId,
  currentUrl,
  position,
  onSave,
  onClose,
}: LinkEditPopoverProps) {
  const [urlInput, setUrlInput] = useState(currentUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleApply = () => {
    if (!urlInput.trim()) {
      onSave(objectId, null)
      onClose()
      return
    }
    const sanitized = sanitizeUrl(urlInput)
    if (!sanitized) {
      setError('Please enter a valid URL (e.g. https://example.com or mailto:user@example.com)')
      return
    }
    setError(null)
    onSave(objectId, sanitized)
    onClose()
  }

  const handleRemove = () => {
    onSave(objectId, null)
    onClose()
  }

  return (
    <div
      className="link-edit-popover toolbar-popup"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%) translateY(-12px)',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '280px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1001,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
        Link
      </div>
      <input
        ref={inputRef}
        type="url"
        placeholder="https://example.com"
        value={urlInput}
        onChange={(e) => {
          setUrlInput(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleApply()
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: '6px',
          border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
          fontSize: '14px',
          marginBottom: error ? '6px' : '10px',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: 'white',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            Remove link
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          style={{
            padding: '6px 14px',
            border: 'none',
            borderRadius: '6px',
            background: '#3b82f6',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
