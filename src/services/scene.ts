/**
 * Scene service – fetch board scene for preview thumbnails.
 * One-time fetch (no realtime), used by dashboard board tiles.
 */
import { getBoard } from './board'
import { getBoardObjectsOnce } from './objects'
import type { BoardObject } from '../types'

export interface BoardScene {
  objects: BoardObject[]
  appState?: { viewBackgroundColor?: string }
  updatedAt?: number
}

/**
 * Fetches board scene for preview: objects + app state + updatedAt.
 * Does not subscribe in realtime. Use for thumbnails and Quick View.
 * @param boardId - The board ID
 * @returns Promise resolving to scene or null if board not found
 */
export async function fetchBoardScene(boardId: string): Promise<BoardScene | null> {
  const [board, objects] = await Promise.all([getBoard(boardId), getBoardObjectsOnce(boardId)])
  if (!board) return null
  const updatedAt = board.updatedAt?.toMillis?.() ?? Date.now()
  return {
    objects,
    appState: { viewBackgroundColor: '#fafafa' },
    updatedAt,
  }
}
