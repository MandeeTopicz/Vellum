/**
 * AI tool: changeColor, moveObjects, arrangeInGrid, groupObjects.
 */
import { updateObject } from '../objects'
import { resolveColor } from './shared'
import type { BoardObject } from '../../types'
import type { ToolExecutionContext } from './types'

/** changeColor */
export async function executeChangeColor(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const newColor = resolveColor(args.newColor as string | undefined, '#3b82f6')
  for (const objectId of objectIds) {
    await updateObject(boardId, objectId, { fillColor: newColor })
  }
  actions.push(`Changed color of ${objectIds.length} object(s) to ${newColor}`)
}

/** moveObjects */
export async function executeMoveObjects(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const newX = typeof args.newX === 'number' ? args.newX : 500
  const newY = typeof args.newY === 'number' ? args.newY : 500
  for (const objectId of objectIds) {
    const obj = objectsMap.get(objectId)
    if (!obj) continue
    if ('position' in obj) {
      await updateObject(boardId, objectId, { position: { x: newX, y: newY } })
    } else if ('start' in obj && 'end' in obj) {
      const line = obj as { start: { x: number; y: number }; end: { x: number; y: number } }
      const dx = newX - line.start.x
      const dy = newY - line.start.y
      await updateObject(boardId, objectId, {
        start: { x: newX, y: newY },
        end: { x: line.end.x + dx, y: line.end.y + dy },
      })
    }
  }
  actions.push(`Moved ${objectIds.length} object(s) to (${newX}, ${newY})`)
}

/** arrangeInGrid */
export async function executeArrangeInGrid(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const columns = typeof args.columns === 'number' ? Math.max(1, args.columns) : 2
  const spacing = typeof args.spacing === 'number' ? args.spacing : 50
  const objs = objectIds.map((id) => objectsMap.get(id)).filter(Boolean) as BoardObject[]
  if (objs.length === 0) return
  const cellW = Math.max(...objs.map((o) => ('dimensions' in o ? o.dimensions.width : 120))) + spacing
  const cellH = Math.max(...objs.map((o) => ('dimensions' in o ? o.dimensions.height : 80))) + spacing
  const startX = 'position' in objs[0] ? objs[0].position.x : 'start' in objs[0] ? (objs[0] as { start: { x: number } }).start.x : 0
  const startY = 'position' in objs[0] ? objs[0].position.y : 'start' in objs[0] ? (objs[0] as { start: { y: number } }).start.y : 0
  for (let i = 0; i < objs.length; i++) {
    const row = Math.floor(i / columns)
    const col = i % columns
    const x = startX + col * cellW
    const y = startY + row * cellH
    const o = objs[i]
    if ('position' in o) {
      await updateObject(boardId, o.objectId, { position: { x, y } })
    } else if ('start' in o && 'end' in o) {
      const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
      const dx = x - line.start.x
      const dy = y - line.start.y
      await updateObject(boardId, o.objectId, {
        start: { x, y },
        end: { x: line.end.x + dx, y: line.end.y + dy },
      })
    }
  }
  actions.push(`Arranged ${objs.length} object(s) in ${columns}-column grid`)
}

/** resizeObject - Resize an existing object by changing its width and height */
export async function executeResizeObject(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectId = typeof args.objectId === 'string' ? args.objectId : ''
  const width = Math.max(20, Number(args.width) || 200)
  const height = Math.max(20, Number(args.height) || 160)
  if (!objectId) return
  const obj = objectsMap.get(objectId)
  if (!obj) {
    actions.push(`Object ${objectId} not found`)
    return
  }
  if (!('dimensions' in obj)) {
    actions.push(`Object ${objectId} cannot be resized (no dimensions)`)
    return
  }
  await updateObject(boardId, objectId, { dimensions: { width, height } })
  actions.push(`Resized object to ${width}×${height}px`)
}

/** groupObjects */
export async function executeGroupObjects(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const objs = objectIds.map((id) => objectsMap.get(id)).filter(Boolean) as BoardObject[]
  if (objs.length === 0) return
  const minX = Math.min(...objs.map((o) => ('position' in o ? o.position.x : 'start' in o ? (o as { start: { x: number } }).start.x : 0)))
  const minY = Math.min(...objs.map((o) => ('position' in o ? o.position.y : 'start' in o ? (o as { start: { y: number } }).start.y : 0)))
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]
    const newX = minX + (i % 3) * 120
    const newY = minY + Math.floor(i / 3) * 100
    if ('position' in o) {
      await updateObject(boardId, o.objectId, { position: { x: newX, y: newY } })
    } else if ('start' in o && 'end' in o) {
      const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
      const dx = newX - line.start.x
      const dy = newY - line.start.y
      await updateObject(boardId, o.objectId, {
        start: { x: newX, y: newY },
        end: { x: line.end.x + dx, y: line.end.y + dy },
      })
    }
  }
  actions.push(`Grouped ${objs.length} object(s)`)
}
