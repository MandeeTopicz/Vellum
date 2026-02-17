import './Sidebar.css'

interface SidebarProps {
  expanded: boolean
  onToggle: () => void
  onCreateBoard: () => void
  onDashboardClick: () => void
}

export default function Sidebar({
  expanded,
  onToggle,
  onCreateBoard,
  onDashboardClick,
}: SidebarProps) {
  return (
    <aside className={`dashboard-sidebar ${expanded ? 'dashboard-sidebar-expanded' : 'dashboard-sidebar-collapsed'}`}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <span className="sidebar-toggle-icon" aria-hidden>
          {expanded ? '←' : '☰'}
        </span>
      </button>
      {expanded && (
        <nav className="sidebar-nav">
          <button
            type="button"
            className="sidebar-btn sidebar-btn-primary"
            onClick={onCreateBoard}
          >
            Create Board
          </button>
          <button
            type="button"
            className="sidebar-btn"
            onClick={onDashboardClick}
          >
            Dashboard
          </button>
        </nav>
      )}
    </aside>
  )
}
