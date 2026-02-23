/**
 * Inserts templates into a board. Used by dashboard "Start with a template"
 * and mirrors the whiteboard Templates modal behavior.
 * Composed templates are wrapped in a frame so they move as one unit.
 */
import { createObject, updateObject } from './objects'
import type { CreateObjectInput, ObjectUpdates } from './objects'
import type { BoardObject } from '../types'
import { buildComposedTemplate, centerCreateInputsAt, wrapComposedTemplateInFrame, getCreateInputsBbox, TEMPLATE_FORMAT_MAP } from '../utils/templates'
import { isNestableType } from '../utils/frames'

const FRAME_PADDING = 24
import { executeCreateKanbanBoard, executeCreateFlowchart, executeCreateMindMap } from './aiTools'

/** Default canvas center for placing templates on a fresh board */
const DEFAULT_CENTER_X = 600
const DEFAULT_CENTER_Y = 400

/**
 * Inserts a composed template wrapped in a frame. Creates frame first, then children with parentId.
 * Returns created items for undo/selection.
 * @param displayOrderBase - Max displayOrder on board; frame gets base+1, children base+2, etc. Omit for new boards.
 */
export async function insertComposedTemplateWithFrame(
  boardId: string,
  templateKey: string,
  composed: CreateObjectInput[],
  centerX: number,
  centerY: number,
  displayOrderBase: number = 0
): Promise<Array<{ objectId: string; createInput: CreateObjectInput }>> {
  const created: Array<{ objectId: string; createInput: CreateObjectInput }> = []
  const framePadding = templateKey === 'swot' ? 48 : undefined
  const { frameInput, childInputs } = wrapComposedTemplateInFrame(composed, undefined, framePadding)
  const [centeredFrame] = centerCreateInputsAt([frameInput], centerX, centerY)
  const frameWithOrder = { ...centeredFrame, displayOrder: displayOrderBase + 1 }
  const frameId = await createObject(boardId, frameWithOrder)
  created.push({ objectId: frameId, createInput: frameWithOrder })
  const framePos = 'position' in centeredFrame ? centeredFrame.position : { x: 0, y: 0 }
  const origFrameX = 'position' in frameInput ? frameInput.position.x : 0
  const origFrameY = 'position' in frameInput ? frameInput.position.y : 0
  const dx = framePos.x - origFrameX
  const dy = framePos.y - origFrameY

  let childIndex = 0
  for (const inp of childInputs) {
    const childDisplayOrder = displayOrderBase + 2 + childIndex
    if (inp.type === 'line') {
      const offsetLine: CreateObjectInput = {
        ...inp,
        start: { x: inp.start.x + dx, y: inp.start.y + dy },
        end: { x: inp.end.x + dx, y: inp.end.y + dy },
      }
      const id = await createObject(boardId, { ...offsetLine, displayOrder: childDisplayOrder })
      created.push({ objectId: id, createInput: offsetLine })
      childIndex++
    } else if (inp.type === 'pen') {
      const offsetPen: CreateObjectInput = {
        ...inp,
        points: inp.points.map(([x, y]) => [x + dx, y + dy] as [number, number]),
      }
      const id = await createObject(boardId, { ...offsetPen, displayOrder: childDisplayOrder })
      created.push({ objectId: id, createInput: offsetPen })
      childIndex++
    } else if ('position' in inp && isNestableType(inp.type) && 'localX' in inp && 'localY' in inp) {
      const withParent = { ...inp, parentId: frameId, position: { x: inp.localX, y: inp.localY }, displayOrder: childDisplayOrder }
      const id = await createObject(boardId, withParent as CreateObjectInput)
      created.push({ objectId: id, createInput: withParent as CreateObjectInput })
      childIndex++
    } else {
      const id = await createObject(boardId, { ...inp, displayOrder: childDisplayOrder })
      created.push({ objectId: id, createInput: inp })
      childIndex++
    }
  }
  return created
}

/**
 * Wraps already-created objects in a frame so the template moves as one unit.
 * Use for AI-generated templates (flowchart, mind map, timeline, org chart, etc.).
 * @param boardId - Board ID
 * @param createdItems - Items created by AI tools with objectId and createInput
 * @param title - Optional frame title
 * @returns Updated createdItems including the frame (frame first)
 */
export async function wrapCreatedItemsInFrame(
  boardId: string,
  createdItems: Array<{ objectId: string; createInput: CreateObjectInput }>,
  title?: string
): Promise<Array<{ objectId: string; createInput: CreateObjectInput }>> {
  if (createdItems.length === 0) return createdItems

  const inputs = createdItems.map((c) => c.createInput)
  const bbox = getCreateInputsBbox(inputs)
  if (!bbox) return createdItems

  const frameX = bbox.minX - FRAME_PADDING
  const frameY = bbox.minY - FRAME_PADDING
  const frameW = bbox.width + FRAME_PADDING * 2
  const frameH = bbox.height + FRAME_PADDING * 2

  const frameInput: CreateObjectInput = {
    type: 'frame',
    position: { x: frameX, y: frameY },
    dimensions: { width: frameW, height: frameH },
    title: title ?? undefined,
  }
  const frameId = await createObject(boardId, frameInput)

  for (let i = 0; i < createdItems.length; i++) {
    const { objectId, createInput } = createdItems[i]
    if (createInput.type === 'line' || createInput.type === 'pen') continue
    if (!('position' in createInput) || !isNestableType(createInput.type)) continue
    const localX = createInput.position.x - frameX
    const localY = createInput.position.y - frameY
    await updateObject(boardId, objectId, {
      parentId: frameId,
      localX,
      localY,
    } as ObjectUpdates)
  }

  return [
    { objectId: frameId, createInput: frameInput },
    ...createdItems,
  ]
}

/** Result of inserting a template (for undo/selection) */
export type InsertTemplateResult = Array<{ objectId: string; createInput: CreateObjectInput }>

/**
 * Inserts a template into an existing board at the given center.
 * Composed templates are wrapped in a frame so they move as one unit.
 * @param boardId - Board ID
 * @param templateKey - Template id (e.g. 'project-review', 'kanban-board', 'swot')
 * @param centerX - X center for placement (default 600)
 * @param centerY - Y center for placement (default 400)
 * @param displayOrderBase - Max displayOrder on board so new template renders on top (default 0)
 * @returns Created items for undo/selection
 */
export async function insertTemplateIntoBoard(
  boardId: string,
  templateKey: string,
  centerX: number = DEFAULT_CENTER_X,
  centerY: number = DEFAULT_CENTER_Y,
  displayOrderBase: number = 0
): Promise<InsertTemplateResult> {
  const composed = buildComposedTemplate(templateKey)
  if (composed.length > 0) {
    return insertComposedTemplateWithFrame(boardId, templateKey, composed, centerX, centerY, displayOrderBase)
  }

  const format = TEMPLATE_FORMAT_MAP[templateKey]
  const kind = format || 'Doc'
  const createdItems: InsertTemplateResult = []
  const ctx = {
    boardId,
    args: { startX: centerX - 100, startY: centerY - 100 } as Record<string, unknown>,
    objectsMap: new Map<string, BoardObject>(),
    objectsList: [] as BoardObject[],
    createdItems,
    actions: [] as string[],
  }

  if (kind === 'Kanban') {
    ctx.args = {
      startX: centerX - 550,
      startY: centerY - 200,
      mainTitle: 'Kanban Board',
      columns: [
        { title: 'To Do', items: ['Task 1', 'Task 2', 'Task 3'] },
        { title: 'In Progress', items: [] },
        { title: 'Done', items: [] },
      ],
    }
    await executeCreateKanbanBoard(ctx)
  } else if (kind === 'Flow Chart') {
    ctx.args = {
      startX: centerX - 100,
      startY: centerY - 100,
      steps: [
        { label: 'Start', type: 'start' },
        { label: 'Process', type: 'process' },
        { label: 'Decision', type: 'decision' },
        { label: 'End', type: 'end' },
      ],
      orientation: 'vertical',
    }
    await executeCreateFlowchart(ctx)
  } else if (kind === 'Mind Map') {
    ctx.args = {
      centerX,
      centerY,
      centerTopic: 'Main Topic',
      branches: ['Branch 1', 'Branch 2', 'Branch 3'],
    }
    await executeCreateMindMap(ctx)
  } else {
    const docInput: CreateObjectInput = {
      type: 'text',
      position: { x: centerX - 100, y: centerY - 80 },
      dimensions: { width: 400, height: 120 },
      content: 'Document\n\nAdd your content here.',
    }
    const objectId = await createObject(boardId, docInput)
    createdItems.push({ objectId, createInput: docInput })
  }
  return createdItems
}
