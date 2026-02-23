/**
 * AI tool: createKanbanBoard.
 */
import { createObject } from '../objects'
import { DEFAULT_TEXT_STYLE } from '../../types'
import { getAdjustedPosition } from './shared'
import type { ToolExecutionContext } from './types'

/** createKanbanBoard */
export async function executeCreateKanbanBoard(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const columns = Array.isArray(args.columns) ? args.columns : []
  const mainTitle = typeof args.mainTitle === 'string' ? args.mainTitle : ''
  let startX = typeof args.startX === 'number' ? args.startX : 50
  let startY = typeof args.startY === 'number' ? args.startY : 150
  const containerW = 350
  const containerH = 550
  const headerH = 40
  const cardW = 310
  const cardH = 100
  const cardGap = 12
  const containerGap = 40
  const padding = 20
  const titleH = 60
  const titleW = 300

  const layoutW = columns.length * containerW + Math.max(0, columns.length - 1) * containerGap
  const titleOffset = mainTitle ? titleH + 24 : 0
  const layoutH = containerH + titleOffset
  const intendedTop = startY - titleOffset
  const adjusted = getAdjustedPosition(ctx, startX, intendedTop, layoutW, layoutH)
  startX = adjusted.x
  startY = adjusted.y + titleOffset

  if (mainTitle) {
    const totalLayoutWidth = columns.length * containerW + Math.max(0, columns.length - 1) * containerGap
    const layoutCenterX = startX + totalLayoutWidth / 2
    const titleX = layoutCenterX - titleW / 2
    const titleY = startY - titleH - 24
    const titleInput = {
      type: 'text' as const,
      position: { x: titleX, y: titleY },
      dimensions: { width: titleW, height: titleH },
      content: mainTitle,
      textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 28, bold: true, textAlign: 'center' as const },
    }
    const titleId = await createObject(boardId, titleInput)
    createdItems.push({ objectId: titleId, createInput: titleInput })
  }

  let colX = startX
  for (const col of columns) {
    const c = col as { title?: string; items?: string[] }
    const title = (c?.title ?? 'Column') as string
    const items = Array.isArray(c?.items) ? (c.items as string[]) : []
    const containerInput = {
      type: 'rectangle' as const,
      position: { x: colX, y: startY },
      dimensions: { width: containerW, height: containerH },
      fillColor: '#f3f4f6',
      strokeColor: '#e5e7eb',
      strokeWidth: 2,
      cornerRadius: 16,
    }
    const containerId = await createObject(boardId, containerInput)
    createdItems.push({ objectId: containerId, createInput: containerInput })
    const headerInput = {
      type: 'sticky' as const,
      position: { x: colX + padding, y: startY + padding },
      dimensions: { width: cardW, height: headerH },
      content: title,
      fillColor: '#ffffff',
      cornerRadius: 12,
      textStyle: { ...DEFAULT_TEXT_STYLE, textAlign: 'center' as const, fontSize: 20, bold: true },
    }
    const headerId = await createObject(boardId, headerInput)
    createdItems.push({ objectId: headerId, createInput: headerInput })
    let itemY = startY + padding + headerH + cardGap
    for (const item of items) {
      const itemInput = {
        type: 'sticky' as const,
        position: { x: colX + padding, y: itemY },
        dimensions: { width: cardW, height: cardH },
        content: item,
        fillColor: '#fef08a',
        cornerRadius: 12,
      }
      const itemId = await createObject(boardId, itemInput)
      createdItems.push({ objectId: itemId, createInput: itemInput })
      itemY += cardH + cardGap
    }
    colX += containerW + containerGap
  }
  actions.push(`Created Kanban board with ${columns.length} columns`)
}
