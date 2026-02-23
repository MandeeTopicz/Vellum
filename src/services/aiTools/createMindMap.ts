/**
 * AI tool: createMindMap.
 */
import { clipLineToRectEdges, rectFromPosDims } from '../../utils/lineClip'
import { createObject } from '../objects'
import { getAdjustedPosition } from './shared'
import type { ToolExecutionContext } from './types'

/** createMindMap */
export async function executeCreateMindMap(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const centerTopic = (args.centerTopic ?? 'Topic') as string
  const branches = Array.isArray(args.branches) ? (args.branches as string[]) : []
  let centerX = typeof args.centerX === 'number' ? args.centerX : 500
  let centerY = typeof args.centerY === 'number' ? args.centerY : 500
  const centerW = 160
  const centerH = 80
  const branchRadius = 180
  const branchW = 120
  const branchH = 60
  const layoutRadius = branchRadius + Math.max(branchW, branchH)
  const layoutSize = layoutRadius * 2
  const centerTopLeftX = centerX - centerW / 2
  const centerTopLeftY = centerY - centerH / 2
  const adjusted = getAdjustedPosition(ctx, centerTopLeftX, centerTopLeftY, layoutSize, layoutSize)
  centerX = adjusted.x + centerW / 2
  centerY = adjusted.y + centerH / 2

  const centerInput = {
    type: 'sticky' as const,
    position: { x: centerX - centerW / 2, y: centerY - centerH / 2 },
    dimensions: { width: centerW, height: centerH },
    content: centerTopic,
    fillColor: '#fef08a',
  }
  const centerId = await createObject(boardId, centerInput)
  createdItems.push({ objectId: centerId, createInput: centerInput })

  for (let i = 0; i < branches.length; i++) {
    const angle = (i / Math.max(1, branches.length)) * Math.PI * 1.5 - Math.PI / 4
    const branchCenterX = centerX + branchRadius * Math.cos(angle)
    const branchCenterY = centerY + branchRadius * Math.sin(angle)
    const bx = branchCenterX - branchW / 2
    const by = branchCenterY - branchH / 2
    const branchInput = {
      type: 'sticky' as const,
      position: { x: bx, y: by },
      dimensions: { width: branchW, height: branchH },
      content: branches[i],
      fillColor: '#dcfce7',
    }
    const branchId = await createObject(boardId, branchInput)
    createdItems.push({ objectId: branchId, createInput: branchInput })
    const centerRect = rectFromPosDims(centerX - centerW / 2, centerY - centerH / 2, centerW, centerH)
    const branchRect = rectFromPosDims(bx, by, branchW, branchH)
    const { start, end } = clipLineToRectEdges(
      { x: centerX, y: centerY },
      { x: branchCenterX, y: branchCenterY },
      centerRect,
      branchRect
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
  }
  actions.push(`Created mind map with center and ${branches.length} branches`)
}
