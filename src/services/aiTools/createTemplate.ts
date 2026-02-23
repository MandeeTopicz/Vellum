/**
 * AI tool: createTemplate (swot, retrospective, journeyMap).
 */
import { createObject } from '../objects'
import { DEFAULT_STICKY_SIZE } from '../../types/objects'
import { resolveColor, STICKY_COLORS, getAdjustedPosition } from './shared'
import type { ToolExecutionContext } from './types'

/** createTemplate */
export async function executeCreateTemplate(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const templateType = (args.templateType ?? 'swot') as 'swot' | 'retrospective' | 'journeyMap'
  let startX = typeof args.startX === 'number' ? args.startX : 500
  let startY = typeof args.startY === 'number' ? args.startY : 500
  const w = DEFAULT_STICKY_SIZE.width
  const h = DEFAULT_STICKY_SIZE.height
  const gap = 24
  const templates: { label: string; x: number; y: number; color: string }[] = []

  if (templateType === 'swot') {
    templates.push(
      { label: 'Strengths', x: startX, y: startY, color: 'green' },
      { label: 'Weaknesses', x: startX + w + gap, y: startY, color: 'red' },
      { label: 'Opportunities', x: startX, y: startY + h + gap, color: 'blue' },
      { label: 'Threats', x: startX + w + gap, y: startY + h + gap, color: 'orange' }
    )
  } else if (templateType === 'retrospective') {
    const colW = w + gap
    templates.push(
      { label: 'Went well', x: startX, y: startY, color: 'green' },
      { label: "Didn't go well", x: startX + colW, y: startY, color: 'pink' },
      { label: 'Ideas', x: startX + colW * 2, y: startY, color: 'blue' },
      { label: 'Action items', x: startX + colW * 3, y: startY, color: 'orange' }
    )
  } else {
    for (let i = 0; i < 5; i++) {
      templates.push({ label: `Step ${i + 1}`, x: startX + i * (w + gap), y: startY, color: 'yellow' })
    }
  }

  const layoutW = templates.length > 0 ? Math.max(...templates.map((t) => t.x + w)) - startX : w * 2 + gap
  const layoutH = templates.length > 0 ? Math.max(...templates.map((t) => t.y + h)) - startY : h * 2 + gap
  const adjusted = getAdjustedPosition(ctx, startX, startY, layoutW, layoutH)
  const dx = adjusted.x - startX
  const dy = adjusted.y - startY
  startX = adjusted.x
  startY = adjusted.y
  for (const t of templates) {
    t.x += dx
    t.y += dy
  }

  for (const t of templates) {
    const fillColor = STICKY_COLORS[t.color] ?? resolveColor(t.color, STICKY_COLORS.yellow)
    const createInput = {
      type: 'sticky' as const,
      position: { x: t.x, y: t.y },
      dimensions: DEFAULT_STICKY_SIZE,
      content: t.label,
      fillColor,
      cornerRadius: 12,
    }
    const objectId = await createObject(boardId, createInput)
    createdItems.push({ objectId, createInput })
  }
  actions.push(`Created ${templateType} template with ${templates.length} stickies`)
}
