/**
 * QuickViewModal – full-screen overlay for larger read-only board preview.
 */
import { useMemo } from 'react'
import BoardCanvasThumbnail from './BoardCanvasThumbnail'
import type { BoardScene } from '../../services/scene'

interface QuickViewModalProps {
  open: boolean
  boardName: string
  scene: BoardScene | null
  onClose: () => void
  onOpenBoard?: () => void
}

const MAX_WIDTH = 900
const MAX_HEIGHT = 600

export default function QuickViewModal({
  open,
  boardName,
  scene,
  onClose,
  onOpenBoard,
}: QuickViewModalProps) {
  const { width, height } = useMemo(() => {
    const maxW = Math.min(MAX_WIDTH, typeof window !== 'undefined' ? window.innerWidth - 48 : MAX_WIDTH)
    const maxH = Math.min(MAX_HEIGHT, typeof window !== 'undefined' ? window.innerHeight - 160 : MAX_HEIGHT)
    return { width: maxW, height: maxH }
  }, [open])

  if (!open) return null

  return (
    <div
      className="quick-view-modal-backdrop"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="quick-view-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <h2 id="quick-view-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {boardName || 'Untitled Board'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            padding: 20,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BoardCanvasThumbnail
            scene={scene}
            width={width}
            height={height}
          />
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
            Read-only preview.
          </p>
          {onOpenBoard && (
            <button
              type="button"
              onClick={() => {
                onOpenBoard()
                onClose()
              }}
              style={{
                marginTop: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#8093F1',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Open board
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
