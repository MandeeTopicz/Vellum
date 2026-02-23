/**
 * AI tool: duplicateColumn.
 * Deterministic frontend function that adds a column to an existing frame.
 * The AI provides only frameId and columnLabel; all logic runs here.
 */
import { createObject, updateObject } from '../objects'
import { getLocalPos, getParentId } from '../../utils/frames'
import { objToCreateInput } from './shared'
import type { CreateObjectInput } from '../objects'
import type { BoardObject } from '../../types'
import type { ToolExecutionContext } from './types'

const COLUMN_GAP = 24

export interface AddColumnToFrameParams {
  boardId: string
  frameId: string
  columnLabel: string
  objectsMap: Map<string, BoardObject>
  objectsList: BoardObject[]
  createdItems: Array<{ objectId: string; createInput: CreateObjectInput }>
}

/**
 * Deterministic frontend function: add a column to an existing frame.
 * Handles positioning, duplication, and frame expansion.
 */
export async function addColumnToFrame(params: AddColumnToFrameParams): Promise<string> {
  const { boardId, frameId, columnLabel, objectsMap, objectsList, createdItems } = params

  const frame = objectsMap.get(frameId)
  if (!frame || frame.type !== 'frame') {
    throw new Error(`Frame ${frameId} not found`)
  }

  const children = objectsList.filter((o) => getParentId(o) === frameId)
  if (children.length === 0) {
    throw new Error('Frame has no children')
  }

  const withLocal = children.map((o) => {
    const pos = getLocalPos(o)
    return { obj: o, localX: pos?.x ?? 0, localY: pos?.y ?? 0 }
  })

  const maxX = Math.max(...withLocal.map((w) => w.localX))
  const tolerance = 50
  const rightmostColumn = withLocal.filter((w) => w.localX >= maxX - tolerance)
  if (rightmostColumn.length === 0) {
    throw new Error('Could not identify rightmost column')
  }

  const columnWidth = Math.max(
    ...rightmostColumn.map((w) => {
      const d = (w.obj as { dimensions?: { width: number } }).dimensions
      return d?.width ?? 200
    })
  )
  const offsetX = columnWidth + COLUMN_GAP

  const frameDims = (frame as { dimensions: { width: number; height: number } }).dimensions
  const newFrameWidth = frameDims.width + offsetX

  await updateObject(boardId, frameId, {
    dimensions: { width: newFrameWidth, height: frameDims.height },
  })

  const headerIndex = rightmostColumn.reduce(
    (best, w, i) => (w.localY < rightmostColumn[best].localY ? i : best),
    0
  )
  const headerObj = rightmostColumn[headerIndex].obj

  for (const { obj, localX, localY } of rightmostColumn) {
    const dup = objToCreateInput(obj, 0, 0)
    if (!dup) continue

    const newLocalX = localX + offsetX
    const newLocalY = localY

    const createInput: CreateObjectInput & { parentId?: string; localX?: number; localY?: number } = {
      ...dup,
      parentId: frameId,
      localX: newLocalX,
      localY: newLocalY,
    }
    if ('position' in dup && dup.position) {
      ;(createInput as { position?: { x: number; y: number } }).position = { x: newLocalX, y: newLocalY }
    }

    const isHeader = obj.objectId === headerObj.objectId
    if (isHeader && 'content' in createInput) {
      createInput.content = columnLabel
    }

    const newId = await createObject(boardId, createInput as CreateObjectInput)
    createdItems.push({ objectId: newId, createInput: createInput as CreateObjectInput })
  }

  return `Added column "${columnLabel}" with ${rightmostColumn.length} object(s)`
}

/**
 * AI tool handler: validates args and calls addColumnToFrame.
 */
export async function executeDuplicateColumn(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, objectsList, createdItems, actions } = ctx
  const frameId = typeof args.frameId === 'string' ? args.frameId.trim() : ''
  const columnLabel = String(args.columnLabel ?? 'New Column')

  if (!frameId) {
    actions.push('duplicateColumn requires frameId. Call getBoardState first to find the frame id.')
    return
  }

  try {
    const message = await addColumnToFrame({
      boardId,
      frameId,
      columnLabel,
      objectsMap,
      objectsList,
      createdItems,
    })
    actions.push(message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    actions.push(`duplicateColumn failed: ${msg}`)
  }
}
