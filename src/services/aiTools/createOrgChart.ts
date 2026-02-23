/**
 * AI tool: createOrgChart.
 */
import { clipLineToRectEdges, rectFromPosDims } from '../../utils/lineClip'
import { createObject } from '../objects'
import type { ToolExecutionContext } from './types'

const boxW = 140
const boxH = 50
const gapX = 40
const gapY = 80

type OrgNode = { name?: string; title?: string; children?: unknown[]; departments?: unknown[] }

/** createOrgChart */
export async function executeCreateOrgChart(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  let structure = args.structure as OrgNode | string | null | undefined
  if (typeof structure === 'string') {
    try {
      structure = JSON.parse(structure) as OrgNode
    } catch {
      structure = null
    }
  }
  if (!structure || typeof structure !== 'object') {
    const ceo = args.ceo ?? args.root ?? args.ceoName
    const deps = args.departments ?? args.children
    if ((ceo != null || deps != null) && Array.isArray(deps)) {
      structure = { name: typeof ceo === 'string' ? ceo : 'CEO', children: deps.map((d: unknown) => (typeof d === 'string' ? { name: d } : d)) }
    }
  }
  if (structure && typeof structure === 'object' && !Array.isArray(structure)) {
    const hasChildren = Array.isArray(structure.children) && structure.children.length > 0
    const hasDepts = Array.isArray(structure.departments) && structure.departments.length > 0
    if (!hasChildren && !hasDepts && (structure.name || structure.title)) {
      structure = { ...structure, children: [{ name: 'Department 1' }, { name: 'Department 2' }, { name: 'Department 3' }] }
    }
  }

  const startX = typeof args.startX === 'number' ? args.startX : 500
  const startY = typeof args.startY === 'number' ? args.startY : 500

  if (!structure || typeof structure !== 'object' || Array.isArray(structure)) {
    structure = { name: 'CEO', children: [{ name: 'Engineering' }, { name: 'Sales' }, { name: 'Marketing' }] }
  }

  const rootName = (structure.name ?? structure.title ?? 'CEO') as string
  const rootInput = { type: 'sticky' as const, position: { x: startX, y: startY }, dimensions: { width: boxW, height: boxH }, content: rootName, fillColor: '#dbeafe' }
  const rootId = await createObject(boardId, rootInput)
  createdItems.push({ objectId: rootId, createInput: rootInput })

  let children = Array.isArray(structure.children) ? structure.children : Array.isArray(structure.departments) ? structure.departments : []
  children = children.map((ch: unknown) => (typeof ch === 'string' ? { name: ch } : ch))
  let childX = startX - (Math.max(0, children.length - 1) * (boxW + gapX)) / 2

  for (const ch of children) {
    const c = ch as { name?: string; title?: string }
    const childName = (c?.name ?? c?.title ?? 'Department') as string
    const childInput = { type: 'sticky' as const, position: { x: childX, y: startY + boxH + gapY }, dimensions: { width: boxW, height: boxH }, content: childName, fillColor: '#e0e7ff' }
    const childId = await createObject(boardId, childInput)
    createdItems.push({ objectId: childId, createInput: childInput })
    const rootRect = rectFromPosDims(startX, startY, boxW, boxH)
    const childRect = rectFromPosDims(childX, startY + boxH + gapY, boxW, boxH)
    const { start, end } = clipLineToRectEdges(
      { x: startX + boxW / 2, y: startY + boxH },
      { x: childX + boxW / 2, y: startY + boxH + gapY },
      rootRect,
      childRect
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
    childX += boxW + gapX
  }
  actions.push(`Created org chart with ${1 + children.length} nodes`)
}
