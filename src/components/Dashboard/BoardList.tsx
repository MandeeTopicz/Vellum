import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Board } from '../../types'
import { removeBoardMember } from '../../services/board'
import { fetchBoardScene } from '../../services/scene'
import type { BoardScene } from '../../services/scene'
import BoardCanvasThumbnail from './BoardCanvasThumbnail'
import QuickViewModal from './QuickViewModal'
import './BoardList.css'

type FilterOption = 'all' | 'created' | 'shared'
type SortOption = 'lastOpened' | 'name' | 'dateCreated' | 'dateModified'
type ViewMode = 'grid' | 'list'

interface BoardListProps {
  ownedBoards: Board[]
  sharedBoards: Board[]
  currentUserId: string
  onOpen: (boardId: string) => void
  onShare: (boardId: string) => void
  onDelete: (boardId: string) => void
  onCreateBoard: () => void
}

const COLORS = ['#8093F1', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2']

function hashToColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return COLORS[Math.abs(h) % COLORS.length]
}

function formatRelativeDate(t: { toMillis?: () => number } | undefined): string {
  if (!t?.toMillis) return '—'
  const d = new Date(t.toMillis())
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const sameDay = now.toDateString() === d.toDateString()
  if (sameDay) return 'Today'
  if (diff < 86400_000 * 2) return 'Yesterday'
  if (diff < 86400_000 * 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatModifiedDate(t: { toMillis?: () => number } | undefined): string {
  if (!t?.toMillis) return ''
  const d = new Date(t.toMillis())
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BoardList({
  ownedBoards,
  sharedBoards,
  currentUserId,
  onOpen,
  onShare,
  onDelete,
  onCreateBoard,
}: BoardListProps) {
  const [filter, setFilter] = useState<FilterOption>('all')
  const [sort, setSort] = useState<SortOption>('lastOpened')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [quickViewBoard, setQuickViewBoard] = useState<{ id: string; name: string; scene: BoardScene | null } | null>(null)
  const sceneCacheRef = useRef<Map<string, BoardScene | null>>(new Map())

  const allBoards = useMemo(() => {
    const owned = ownedBoards.map((b) => ({ ...b, isOwner: true }))
    const shared = sharedBoards.map((b) => ({ ...b, isOwner: false }))
    return [...owned, ...shared]
  }, [ownedBoards, sharedBoards])

  const filteredBoards = useMemo(() => {
    let list = allBoards
    if (filter === 'created') list = list.filter((b) => b.isOwner)
    else if (filter === 'shared') list = list.filter((b) => !b.isOwner)
    return list
  }, [allBoards, filter])

  const sortedBoards = useMemo(() => {
    return [...filteredBoards].sort((a, b) => {
      if (sort === 'name') {
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sort === 'dateCreated') {
        const aMs = a.createdAt?.toMillis?.() ?? 0
        const bMs = b.createdAt?.toMillis?.() ?? 0
        return bMs - aMs
      }
      if (sort === 'dateModified') {
        const aMs = a.updatedAt?.toMillis?.() ?? 0
        const bMs = b.updatedAt?.toMillis?.() ?? 0
        return bMs - aMs
      }
      const aMs = a.updatedAt?.toMillis?.() ?? 0
      const bMs = b.updatedAt?.toMillis?.() ?? 0
      return bMs - aMs
    })
  }, [filteredBoards, sort])

  const getOrFetchScene = useCallback(async (boardId: string): Promise<BoardScene | null> => {
    const cached = sceneCacheRef.current.get(boardId)
    if (cached !== undefined) return cached
    try {
      const scene = await fetchBoardScene(boardId)
      sceneCacheRef.current.set(boardId, scene)
      return scene
    } catch {
      sceneCacheRef.current.set(boardId, null)
      return null
    }
  }, [])

  const [sceneByBoard, setSceneByBoard] = useState<Record<string, BoardScene | null>>({})

  const boardIds = useMemo(() => sortedBoards.map((b) => b.id), [sortedBoards])

  const fetchSceneForBoard = useCallback((boardId: string) => {
    if (sceneCacheRef.current.has(boardId)) return
    getOrFetchScene(boardId).then((scene) => {
      setSceneByBoard((prev) => ({ ...prev, [boardId]: scene }))
    })
  }, [getOrFetchScene])

  useEffect(() => {
    boardIds.forEach(fetchSceneForBoard)
  }, [boardIds, fetchSceneForBoard])

  const handleQuickView = useCallback(
    async (board: { id: string; name: string }, e: React.MouseEvent) => {
      e.stopPropagation()
      const scene = await getOrFetchScene(board.id)
      setQuickViewBoard({ id: board.id, name: board.name || 'Untitled Board', scene })
    },
    [getOrFetchScene]
  )

  const toggleFavorite = (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(boardId)) next.delete(boardId)
      else next.add(boardId)
      return next
    })
  }

  const handleMenuAction = (
    boardId: string,
    action: 'share' | 'rename' | 'delete' | 'removeFromDashboard',
    isOwner: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    setOpenMenuId(null)
    if (action === 'share') onShare(boardId)
    if (action === 'delete') onDelete(boardId)
    if (action === 'removeFromDashboard') {
      removeBoardMember(boardId, currentUserId)
    }
    if (action === 'rename' && isOwner) {
      const name = prompt('Rename board:')
      if (name) {
        import('../../services/board').then(({ updateBoard }) => updateBoard(boardId, { name }))
      }
    }
  }

  return (
    <div className="board-list-section">
      <div className="board-list-header">
        <h2 className="board-list-heading">Your Boards</h2>
        <div className="board-list-header-actions">
          <button type="button" className="board-list-btn-secondary">
            Explore templates
          </button>
          <button type="button" className="board-list-btn-primary" onClick={onCreateBoard}>
            + Create new
          </button>
        </div>
      </div>

      <div className="board-list-filters">
        <div className="board-list-filters-left">
          <label className="board-list-filter-label">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterOption)}
              className="board-list-select"
            >
              <option value="all">All</option>
              <option value="shared">Shared with me</option>
              <option value="created">Created by me</option>
            </select>
          </label>
        </div>
        <div className="board-list-filters-right">
          <label className="board-list-filter-label">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="board-list-select"
            >
              <option value="lastOpened">Last opened</option>
              <option value="name">Name</option>
              <option value="dateCreated">Date created</option>
              <option value="dateModified">Date modified</option>
            </select>
          </label>
          <div className="board-list-view-toggle">
            <button
              type="button"
              className={`board-list-view-btn ${viewMode === 'grid' ? 'board-list-view-btn-active' : ''}`}
              title="Grid view"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={`board-list-view-btn ${viewMode === 'list' ? 'board-list-view-btn-active' : ''}`}
              title="List view"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="board-list-table-wrapper">
          <table className="board-list-table">
            <thead>
              <tr>
                <th className="board-list-th-name">Name</th>
                <th className="board-list-th-center">Online users</th>
                <th className="board-list-th-center">Last opened</th>
                <th className="board-list-th-center">Owner</th>
                <th className="board-list-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {sortedBoards.length === 0 ? null : sortedBoards.map((board, index) => {
                const isNearBottom = index >= sortedBoards.length - 3
                return (
                <tr
                  key={board.id}
                  className="board-list-row"
                  onClick={() => onOpen(board.id)}
                >
                  <td className="board-list-td-name">
                    <div className="board-list-name-cell">
                      <span
                        className="board-list-icon"
                        style={{ backgroundColor: hashToColor(board.id) }}
                      />
                      <div>
                        <span className="board-list-name">{board.name || 'Untitled Board'}</span>
                        <span className="board-list-subtitle">
                          Modified {formatModifiedDate(board.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="board-list-td-center">—</td>
                  <td className="board-list-td-center">{formatRelativeDate(board.updatedAt)}</td>
                  <td className="board-list-td-center">{board.isOwner ? 'You' : 'Shared'}</td>
                  <td className="board-list-td-actions">
                    <button
                      type="button"
                      className="board-list-action-btn"
                      onClick={(e) => toggleFavorite(board.id, e)}
                      title={favorites.has(board.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {favorites.has(board.id) ? (
                        <span className="board-list-star-filled">
                          <StarFilledIcon />
                        </span>
                      ) : (
                        <StarOutlineIcon />
                      )}
                    </button>
                    <div className="board-list-menu-wrapper">
                      <button
                        type="button"
                        className="board-list-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === board.id ? null : board.id)
                        }}
                        title="More actions"
                      >
                        <MoreIcon />
                      </button>
                      {openMenuId === board.id && (
                        <>
                          <div
                            className="board-list-menu-backdrop"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(null)
                            }}
                          />
                          <div className={`board-list-menu ${isNearBottom ? 'board-list-menu-up' : ''}`}>
                            {board.isOwner && (
                              <button
                                type="button"
                                className="board-list-menu-item"
                                onClick={(e) => handleMenuAction(board.id, 'share', board.isOwner, e)}
                              >
                                Share
                              </button>
                            )}
                            {board.isOwner && (
                              <button
                                type="button"
                                className="board-list-menu-item"
                                onClick={(e) => handleMenuAction(board.id, 'rename', board.isOwner, e)}
                              >
                                Rename
                              </button>
                            )}
                            {board.isOwner && (
                              <button
                                type="button"
                                className="board-list-menu-item board-list-menu-item-danger"
                                onClick={(e) => handleMenuAction(board.id, 'delete', board.isOwner, e)}
                              >
                                Delete
                              </button>
                            )}
                            {!board.isOwner && (
                              <button
                                type="button"
                                className="board-list-menu-item board-list-menu-item-danger"
                                onClick={(e) => handleMenuAction(board.id, 'removeFromDashboard', board.isOwner, e)}
                              >
                                Remove from Dashboard
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="board-list-grid">
          {sortedBoards.map((board) => (
              <div
                key={board.id}
                className="board-list-grid-card"
                onClick={() => onOpen(board.id)}
              >
                <div
                  className="board-list-grid-thumb"
                  onClick={(e) => handleQuickView(board, e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickView(board, e as unknown as React.MouseEvent)}
                  aria-label={`Quick view ${board.name || 'Untitled Board'}`}
                >
                  <BoardCanvasThumbnail
                    scene={sceneByBoard[board.id] ?? null}
                    width={280}
                    height={158}
                  />
                </div>
                <div className="board-list-grid-body">
                  <span className="board-list-grid-name">{board.name || 'Untitled Board'}</span>
                  <span className="board-list-grid-meta">
                    {board.isOwner ? 'You' : 'Shared'} · {formatRelativeDate(board.updatedAt)}
                  </span>
                </div>
                <div className="board-list-grid-actions">
                  <button
                    type="button"
                    className="board-list-action-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(board.id, e)
                    }}
                    title={favorites.has(board.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favorites.has(board.id) ? (
                      <span className="board-list-star-filled">
                        <StarFilledIcon />
                      </span>
                    ) : (
                      <StarOutlineIcon />
                    )}
                  </button>
                  <div className="board-list-menu-wrapper">
                    <button
                      type="button"
                      className="board-list-action-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === board.id ? null : board.id)
                      }}
                      title="More actions"
                    >
                      <MoreIcon />
                    </button>
                    {openMenuId === board.id && (
                      <>
                        <div
                          className="board-list-menu-backdrop"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(null)
                          }}
                        />
                        <div className="board-list-menu board-list-menu-up">
                          {board.isOwner && (
                            <button
                              type="button"
                              className="board-list-menu-item"
                              onClick={(e) => handleMenuAction(board.id, 'share', board.isOwner, e)}
                            >
                              Share
                            </button>
                          )}
                          {board.isOwner && (
                            <button
                              type="button"
                              className="board-list-menu-item"
                              onClick={(e) => handleMenuAction(board.id, 'rename', board.isOwner, e)}
                            >
                              Rename
                            </button>
                          )}
                          {board.isOwner && (
                            <button
                              type="button"
                              className="board-list-menu-item board-list-menu-item-danger"
                              onClick={(e) => handleMenuAction(board.id, 'delete', board.isOwner, e)}
                            >
                              Delete
                            </button>
                          )}
                          {!board.isOwner && (
                            <button
                              type="button"
                              className="board-list-menu-item board-list-menu-item-danger"
                              onClick={(e) => handleMenuAction(board.id, 'removeFromDashboard', board.isOwner, e)}
                            >
                              Remove from Dashboard
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
          ))}
        </div>
      )}

      <QuickViewModal
        open={!!quickViewBoard}
        boardName={quickViewBoard?.name ?? ''}
        scene={quickViewBoard?.scene ?? null}
        onClose={() => setQuickViewBoard(null)}
        onOpenBoard={quickViewBoard ? () => onOpen(quickViewBoard.id) : undefined}
      />

      {allBoards.length === 0 && (
        <div className="board-list-empty">
          <p>No boards yet. Create one to get started.</p>
        </div>
      )}
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function StarOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function StarFilledIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  )
}
