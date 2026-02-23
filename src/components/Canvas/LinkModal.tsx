/**
 * LinkModal – add link URL or upload file to selected objects.
 * Shown when user clicks Link button in toolbar with objects selected.
 */
import { useState, useRef } from 'react'
import { uploadBoardFile } from '../../services/storage'
import './LinkModal.css'

interface LinkModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyLink: (url: string, contentType?: 'image' | 'document') => void
  boardId: string
}

export default function LinkModal({
  isOpen,
  onClose,
  onApplyLink,
  boardId,
}: LinkModalProps) {
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleApply = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    const finalUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')
        ? trimmed
        : `https://${trimmed}`
    onApplyLink(finalUrl)
    setUrl('')
    setError(null)
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !boardId) return
    if (file.size === 0) {
      setError('File is empty. Please choose a different file.')
      e.target.value = ''
      return
    }
    e.target.value = ''
    setError(null)
    setUploading(true)
    try {
      const fileUrl = await uploadBoardFile(boardId, file)
      const contentType = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'document' : undefined
      onApplyLink(fileUrl, contentType)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg.includes('403') || msg.includes('Forbidden') ? 'Upload failed: permission denied. Sign in and ensure storage rules are deployed.' : msg)
    } finally {
      setUploading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="link-modal-overlay" onClick={handleOverlayClick}>
      <div className="link-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add Link</h3>
        <div className="link-modal-section">
          <label htmlFor="link-url">URL</label>
          <input
            id="link-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="link-modal-input"
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
        </div>
        <div className="link-modal-divider">or</div>
        <div className="link-modal-section">
          <label htmlFor="link-file-upload" className="link-modal-file-label">
            Upload file from computer
          </label>
          <input
            id="link-file-upload"
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="link-modal-file-input"
            disabled={uploading}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          />
          <label
            htmlFor="link-file-upload"
            className={`link-modal-upload-btn ${uploading ? 'disabled' : ''}`}
          >
            {uploading ? 'Uploading…' : 'Choose file'}
          </label>
        </div>
        {error && <p className="link-modal-error">{error}</p>}
        <div className="link-modal-actions">
          <button type="button" className="link-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="link-btn-apply"
            onClick={handleApply}
            disabled={!url.trim()}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
