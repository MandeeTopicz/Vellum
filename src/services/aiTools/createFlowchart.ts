/**
 * AI tool: createFlowchart.
 */
import { clipLineToRectEdges, rectFromPosDims } from '../../utils/lineClip'
import { createObject } from '../objects'
import { getAdjustedPosition } from './shared'
import type { ToolExecutionContext } from './types'

/** createFlowchart */
export async function executeCreateFlowchart(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const steps = Array.isArray(args.steps) ? args.steps : []
  let startX = typeof args.startX === 'number' ? args.startX : 500
  let startY = typeof args.startY === 'number' ? args.startY : 500
  const orient = args.orientation === 'horizontal' ? 'horizontal' : 'vertical'
  const boxW = 120
  const boxH = 50
  const gap = 60
  const layoutW = orient === 'vertical' ? boxW : steps.length * (boxW + gap) - gap
  const layoutH = orient === 'vertical' ? steps.length * (boxH + gap) - gap : boxH
  const adjusted = getAdjustedPosition(ctx, startX, startY, layoutW, layoutH)
  startX = adjusted.x
  startY = adjusted.y
  let cx = startX
  let cy = startY

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as { label?: string; type?: string }
    const label = (s?.label ?? `Step ${i + 1}`) as string
    const stepType = (s?.type ?? 'process') as string
    const fillColor = stepType === 'start' ? '#dcfce7' : stepType === 'end' ? '#fee2e2' : stepType === 'decision' ? '#fef08a' : '#dbeafe'
    const createInput = { type: 'sticky' as const, position: { x: cx, y: cy }, dimensions: { width: boxW, height: boxH }, content: label, fillColor }
    const objectId = await createObject(boardId, createInput)
    createdItems.push({ objectId, createInput })
    if (orient === 'vertical') cy += boxH + gap
    else cx += boxW + gap
  }

  for (let i = 0; i < steps.length - 1; i++) {
    const fromCenter =
      orient === 'vertical'
        ? { x: startX + boxW / 2, y: startY + boxH + i * (boxH + gap) }
        : { x: startX + boxW + i * (boxW + gap), y: startY + boxH / 2 }
    const toCenter =
      orient === 'vertical'
        ? { x: startX + boxW / 2, y: startY + (i + 1) * (boxH + gap) }
        : { x: startX + (i + 1) * (boxW + gap), y: startY + boxH / 2 }
    const rectFrom =
      orient === 'vertical'
        ? rectFromPosDims(startX, startY + i * (boxH + gap), boxW, boxH)
        : rectFromPosDims(startX + i * (boxW + gap), startY, boxW, boxH)
    const rectTo =
      orient === 'vertical'
        ? rectFromPosDims(startX, startY + (i + 1) * (boxH + gap), boxW, boxH)
        : rectFromPosDims(startX + (i + 1) * (boxW + gap), startY, boxW, boxH)
    const { start, end } = clipLineToRectEdges(fromCenter, toCenter, rectFrom, rectTo)
    const lineInput = { type: 'line' as const, start, end, strokeColor: '#64748b', strokeWidth: 2 }
    const lineId = await createObject(boardId, lineInput)
    createdItems.push({ objectId: lineId, createInput: lineInput })
  }
  actions.push(`Created flowchart with ${steps.length} steps`)
}
