/**
 * AI tool: deleteObjects. Handles objectIds or ["all"] to clear the board.
 * Uses Firestore as source of truth for "all".
 */
import { deleteObject, deleteAllObjects } from '../objects'
import type { ToolExecutionContext } from './types'

/** deleteObjects – deletes by IDs or all objects when objectIds includes "all" */
export async function executeDeleteObjects(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []

  if (objectIds.includes('all')) {
    const deleted = await deleteAllObjects(boardId)
    actions.push(`Deleted ${deleted} object(s)`)
    return
  }

  for (const objectId of objectIds) {
    await deleteObject(boardId, objectId)
  }
  actions.push(`Deleted ${objectIds.length} object(s)`)
}
