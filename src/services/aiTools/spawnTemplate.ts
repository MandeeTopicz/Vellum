/**
 * Spawns a premade template on the board.
 * Reuses insertTemplateIntoBoard from templateInsert (same as Templates modal).
 */
import type { ToolHandler } from './types'
import { insertTemplateIntoBoard } from '../templateInsert'

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
 * Places a premade template on the board at the given center.
 * @param ctx - Tool execution context
 */
export const executeSpawnTemplate: ToolHandler = async (ctx) => {
  const { boardId, args, createdItems, actions, objectsList } = ctx
  const templateId = String(args.templateId ?? '')
  const x = typeof args.x === 'number' ? args.x : 1000
  const y = typeof args.y === 'number' ? args.y : 1000

  console.log('[spawnTemplate] EXECUTION', Date.now(), args.templateId, {
    x: args.x,
    y: args.y,
    mappedKey: TEMPLATE_ID_TO_KEY[templateId] ?? templateId,
  })

  const templateKey = TEMPLATE_ID_TO_KEY[templateId] ?? templateId
  const maxDisplayOrder = objectsList.reduce((max, o) => {
    const order = o.displayOrder ?? 0
    return Math.max(max, order)
  }, 0)
  const created = await insertTemplateIntoBoard(boardId, templateKey, x, y, maxDisplayOrder)
  createdItems.push(...created)
  ctx.skipWrap = true
  actions.push(`Spawned ${templateKey} template at (${Math.round(x)}, ${Math.round(y)})`)
}
