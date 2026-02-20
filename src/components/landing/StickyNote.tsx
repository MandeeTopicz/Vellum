/**
 * Sticky note card for the landing page About section.
 * Renders a title and content (paragraph or list) with optional color class.
 */
interface StickyNoteProps {
  /** Card title */
  title: string
  /** Body: single string (paragraph) or array of strings (bullet list) */
  content: string | string[]
  /** Hex background color (used as inline fallback; className overrides for brand palette) */
  color: string
  /** Optional CSS class for background (e.g. sticky-blue-1) */
  className?: string
}

export default function StickyNote({ title, content, color, className = '' }: StickyNoteProps) {
  const isList = Array.isArray(content)
  return (
    <div
      className={`sticky-note ${className}`.trim()}
      style={{ backgroundColor: color }}
    >
      <div className="sticky-note-top" aria-hidden />
      <div className="sticky-note-content">
        <h3 className="sticky-note-title">{title}</h3>
        {isList ? (
          <ul className="sticky-note-list">
            {content.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="sticky-note-text">{content}</p>
        )}
      </div>
    </div>
  )
}
