/**
 * AI tool: deleteObjects.
 */
import { deleteObject } from '../objects'
import type { ToolExecutionContext } from './types'

/** deleteObjects */
export async function executeDeleteObjects(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  for (const objectId of objectIds) {
    await deleteObject(boardId, objectId)
  }
  actions.push(`Deleted ${objectIds.length} object(s)`)
}
