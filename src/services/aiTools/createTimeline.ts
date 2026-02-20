/**
 * AI tool: createTimeline.
 */
import { createObject } from '../objects'
import type { ToolExecutionContext } from './types'

/** createTimeline */
export async function executeCreateTimeline(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const events = Array.isArray(args.events) ? args.events : []
  const startX = typeof args.startX === 'number' ? args.startX : 500
  const startY = typeof args.startY === 'number' ? args.startY : 500
  const gap = 140
  const stickyH = 60
  const lineYOffset = 20

  for (let i = 0; i < events.length; i++) {
    const e = events[i] as { date?: string; label?: string }
    const date = (e?.date ?? '') as string
    const label = (e?.label ?? `Event ${i + 1}`) as string
    const text = date ? `${date}: ${label}` : label
    const createInput = {
      type: 'sticky' as const,
      position: { x: startX + i * gap, y: startY },
      dimensions: { width: 120, height: stickyH },
      content: text,
      fillColor: '#fef08a',
      cornerRadius: 12,
    }
    const objectId = await createObject(boardId, createInput)
    createdItems.push({ objectId, createInput })
  }
  if (events.length > 1) {
    const lineY = startY + stickyH + lineYOffset
    const lineInput = {
      type: 'line' as const,
      start: { x: startX + 60, y: lineY },
      end: { x: startX + (events.length - 1) * gap + 60, y: lineY },
      strokeColor: '#94a3b8',
      strokeWidth: 2,
    }
    const lineId = await createObject(boardId, lineInput)
    createdItems.push({ objectId: lineId, createInput: lineInput })
  }
  actions.push(`Created timeline with ${events.length} events`)
}
