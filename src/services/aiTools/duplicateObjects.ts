/**
 * AI tool: duplicateObjects.
 */
import { createObject } from '../objects'
import { objToCreateInput } from './shared'
import type { ToolExecutionContext } from './types'

/** duplicateObjects */
export async function executeDuplicateObjects(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, createdItems, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const offsetX = typeof args.offsetX === 'number' ? args.offsetX : 50
  const offsetY = typeof args.offsetY === 'number' ? args.offsetY : 50
  for (const objectId of objectIds) {
    const obj = objectsMap.get(objectId)
    if (!obj) continue
    const dup = objToCreateInput(obj, offsetX, offsetY)
    if (dup) {
      const newId = await createObject(boardId, dup)
      createdItems.push({ objectId: newId, createInput: dup })
    }
  }
  actions.push(`Duplicated ${objectIds.length} object(s)`)
}
