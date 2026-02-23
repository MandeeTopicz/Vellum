/**
 * AI tool: createTimeline.
 */
import { clipLineToRectEdges, rectFromPosDims } from '../../utils/lineClip'
import { createObject } from '../objects'
import { getAdjustedPosition } from './shared'
import type { ToolExecutionContext } from './types'

/** createTimeline */
export async function executeCreateTimeline(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const events = Array.isArray(args.events) ? args.events : []
  let startX = typeof args.startX === 'number' ? args.startX : 500
  let startY = typeof args.startY === 'number' ? args.startY : 500
  const gap = 200
  const checkpointW = 120
  const checkpointH = 60
  const lineYOffset = 24
  const dotSize = 12
  const contentH = 90
  const contentGap = 16
  const layoutW = events.length > 0 ? (events.length - 1) * gap + checkpointW : checkpointW
  const layoutH = checkpointH + lineYOffset + dotSize + contentGap + contentH
  const adjusted = getAdjustedPosition(ctx, startX, startY, layoutW, layoutH)
  startX = adjusted.x
  startY = adjusted.y

  for (let i = 0; i < events.length; i++) {
    const e = events[i] as { date?: string; label?: string }
    const date = (e?.date ?? '') as string
    const label = (e?.label ?? `Event ${i + 1}`) as string
    const text = date ? `${date}: ${label}` : label
    const checkpointInput = {
      type: 'sticky' as const,
      position: { x: startX + i * gap, y: startY },
      dimensions: { width: checkpointW, height: checkpointH },
      content: text,
      fillColor: '#fef08a',
      cornerRadius: 12,
    }
    const checkpointId = await createObject(boardId, checkpointInput)
    createdItems.push({ objectId: checkpointId, createInput: checkpointInput })

    const contentInput = {
      type: 'sticky' as const,
      position: {
        x: startX + i * gap,
        y: startY + checkpointH + lineYOffset + dotSize + contentGap,
      },
      dimensions: { width: checkpointW, height: contentH },
      content: '',
      fillColor: '#dbeafe',
      cornerRadius: 8,
    }
    const contentId = await createObject(boardId, contentInput)
    createdItems.push({ objectId: contentId, createInput: contentInput })
  }

  if (events.length > 1) {
    const lineY = startY + checkpointH + lineYOffset
    const firstX = startX + checkpointW / 2
    const lastX = startX + (events.length - 1) * gap + checkpointW / 2
    const firstRect = rectFromPosDims(startX, startY, checkpointW, checkpointH)
    const lastRect = rectFromPosDims(startX + (events.length - 1) * gap, startY, checkpointW, checkpointH)
    const { start, end } = clipLineToRectEdges(
      { x: firstX, y: lineY },
      { x: lastX, y: lineY },
      firstRect,
      lastRect
    )
    const lineInput = {
      type: 'line' as const,
      start,
      end,
      strokeColor: '#94a3b8',
      strokeWidth: 2,
    }
    const lineId = await createObject(boardId, lineInput)
    createdItems.push({ objectId: lineId, createInput: lineInput })

    for (let i = 0; i < events.length; i++) {
      const centerX = startX + i * gap + checkpointW / 2
      const dotInput = {
        type: 'circle' as const,
        position: { x: centerX - dotSize / 2, y: lineY - dotSize / 2 },
        dimensions: { width: dotSize, height: dotSize },
        fillColor: '#64748b',
        strokeColor: '#475569',
      }
      const dotId = await createObject(boardId, dotInput)
      createdItems.push({ objectId: dotId, createInput: dotInput })
    }
  }

  actions.push(`Created timeline with ${events.length} events`)
}
