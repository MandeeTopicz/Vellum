/**
 * AI tool: createMindMap.
 */
import { createObject } from '../objects'
import type { ToolExecutionContext } from './types'

/** createMindMap */
export async function executeCreateMindMap(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const centerTopic = (args.centerTopic ?? 'Topic') as string
  const branches = Array.isArray(args.branches) ? (args.branches as string[]) : []
  const centerX = typeof args.centerX === 'number' ? args.centerX : 500
  const centerY = typeof args.centerY === 'number' ? args.centerY : 500
  const centerW = 160
  const centerH = 80

  const centerInput = {
    type: 'sticky' as const,
    position: { x: centerX - centerW / 2, y: centerY - centerH / 2 },
    dimensions: { width: centerW, height: centerH },
    content: centerTopic,
    fillColor: '#fef08a',
  }
  const centerId = await createObject(boardId, centerInput)
  createdItems.push({ objectId: centerId, createInput: centerInput })

  const centerRadius = Math.min(centerW, centerH) / 2
  const branchRadius = 180
  const branchW = 120
  const branchH = 60

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
    const lineAngle = Math.atan2(branchCenterY - centerY, branchCenterX - centerX)
    const lineStartX = centerX + centerRadius * Math.cos(lineAngle)
    const lineStartY = centerY + centerRadius * Math.sin(lineAngle)
    const lineInput = {
      type: 'line' as const,
      start: { x: lineStartX, y: lineStartY },
      end: { x: branchCenterX, y: branchCenterY },
      strokeColor: '#94a3b8',
      strokeWidth: 2,
    }
    const lineId = await createObject(boardId, lineInput)
    createdItems.push({ objectId: lineId, createInput: lineInput })
  }
  actions.push(`Created mind map with center and ${branches.length} branches`)
}
