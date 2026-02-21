/**
 * TemplatesModal – full-screen overlay for selecting and inserting templates.
 * Shows categories, search, and a grid of template cards.
 */
import { useEffect, useRef } from 'react'
import { TEMPLATE_CATEGORIES, getTemplatesForCategory } from '../../utils/templates'
import TemplatePreviewThumbnail from './TemplatePreviewThumbnail'
import './TemplatesModal.css'

interface TemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  category: string
  onCategoryChange: (category: string) => void
  search: string
  onSearchChange: (value: string) => void
  onInsertTemplate: (key: string) => void
}

export function TemplatesModal({
  isOpen,
  onClose,
  category,
  onCategoryChange,
  search,
  onSearchChange,
  onInsertTemplate,
}: TemplatesModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const templates = getTemplatesForCategory(category)
  const searchLower = search.trim().toLowerCase()
  const filteredTemplates =
    searchLower === ''
      ? templates
      : templates.filter(
          (t) =>
            t.title.toLowerCase().includes(searchLower) || t.id.toLowerCase().includes(searchLower)
        )

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleCardClick = async (templateId: string) => {
    onInsertTemplate(templateId)
    onClose()
  }

  return (
    <div
      className="templates-modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Templates"
    >
      <div
        className="templates-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="templates-modal-header">
          <h2 className="templates-modal-title">Templates</h2>
          <button
            type="button"
            className="templates-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="templates-modal-body">
          <aside className="templates-modal-sidebar">
            {TEMPLATE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`templates-modal-category ${category === cat ? 'active' : ''}`}
                onClick={() => onCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </aside>

          <div className="templates-modal-main">
            <input
              ref={searchInputRef}
              type="search"
              className="templates-modal-search"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search templates"
            />

            <div className="templates-modal-grid">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="templates-modal-card"
                  onClick={() => handleCardClick(template.id)}
                >
                  <div className="templates-modal-card-preview">
                    <TemplatePreviewThumbnail templateKey={template.id} width={160} height={100} />
                  </div>
                  <div className="templates-modal-card-title">{template.title}</div>
                </button>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <p className="templates-modal-empty">No templates match your search.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
