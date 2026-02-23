/**
 * Spawns a premade template on the board.
 * Reuses insertTemplateIntoBoard from templateInsert (same as Templates modal).
 * Uses collision-aware placement so templates never overlap existing objects.
 */
import type { ToolHandler } from './types'
import { insertTemplateIntoBoard } from '../templateInsert'
import { findNonOverlappingCenter } from '../../utils/objectBounds'
import { getTemplatePlacementDimensions } from '../../utils/templates'
import type { BoardObject } from '../../types'
import type { FramesByIdMap } from '../../utils/frames'

/** Maps AI tool templateId to actual template key used by insertTemplateIntoBoard */
const TEMPLATE_ID_TO_KEY: Record<string, string> = {
  kanban: 'kanban-board',
  swot: 'swot',
  standup: 'standup',
  'sprint-retrospective': 'retrospective',
  okr: 'weekly-okr',
  'project-review': 'project-review',
  flowchart: 'flowchart',
  'mind-map': 'mind-map',
  'project-budget-breakdown': 'sprint-backlog',
}

/**
 * Places a premade template on the board at a non-overlapping position.
 * @param ctx - Tool execution context
 */
export const executeSpawnTemplate: ToolHandler = async (ctx) => {
  const { boardId, args, createdItems, actions, objectsList } = ctx
  const templateId = String(args.templateId ?? '')
  let x = typeof args.x === 'number' ? args.x : 1000
  let y = typeof args.y === 'number' ? args.y : 1000

  const templateKey = TEMPLATE_ID_TO_KEY[templateId] ?? templateId
  const { width, height } = getTemplatePlacementDimensions(templateKey)
  const objectsMap: Record<string, BoardObject> = {}
  const framesById: FramesByIdMap = {}
  for (const o of objectsList) {
    objectsMap[o.objectId] = o
    if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
  }
  const adjusted = findNonOverlappingCenter(x, y, width, height, objectsMap, framesById, 80)
  x = adjusted.x
  y = adjusted.y

  console.log('[spawnTemplate] EXECUTION', Date.now(), args.templateId, {
    x: args.x,
    y: args.y,
    adjusted: { x, y },
    mappedKey: templateKey,
  })

  const maxDisplayOrder = objectsList.reduce((max, o) => {
    const order = o.displayOrder ?? 0
    return Math.max(max, order)
  }, 0)
  const created = await insertTemplateIntoBoard(boardId, templateKey, x, y, maxDisplayOrder)
  createdItems.push(...created)
  ctx.skipWrap = true
  actions.push(`Spawned ${templateKey} template at (${Math.round(x)}, ${Math.round(y)})`)
}
