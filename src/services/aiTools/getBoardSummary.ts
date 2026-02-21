/**
 * AI tool: getBoardSummary – debug tool that returns total count and counts by type.
 * Uses Firestore as source of truth (same as renderer).
 */
import { getBoardSummary as fetchBoardSummary } from '../objects'
import type { ToolExecutionContext } from './types'

/** getBoardSummary – returns { totalCount, byType } from the board */
export async function executeGetBoardSummary(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, actions } = ctx
  const summary = await fetchBoardSummary(boardId)
  const byTypeStr = Object.entries(summary.byType)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ')
  actions.push(`Board summary: totalCount ${summary.totalCount} (${byTypeStr || 'empty'})`)
}
