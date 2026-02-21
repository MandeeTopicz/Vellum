/**
 * Inserts templates into a board. Used by dashboard "Start with a template"
 * and mirrors the whiteboard Templates modal behavior.
 */
import { createObject, batchCreateObjects } from './objects'
import type { CreateObjectInput } from './objects'
import type { BoardObject } from '../types'
import { buildComposedTemplate, centerCreateInputsAt, TEMPLATE_FORMAT_MAP } from '../utils/templates'
import { executeCreateKanbanBoard, executeCreateFlowchart, executeCreateMindMap } from './aiTools'

/** Default canvas center for placing templates on a fresh board */
const DEFAULT_CENTER_X = 600
const DEFAULT_CENTER_Y = 400

/**
 * Inserts a template into an existing board at the given center.
 * Same behavior as whiteboard Templates modal insert.
 * @param boardId - Board ID
 * @param templateKey - Template id (e.g. 'project-review', 'kanban-board', 'swot')
 * @param centerX - X center for placement (default 600)
 * @param centerY - Y center for placement (default 400)
 */
export async function insertTemplateIntoBoard(
  boardId: string,
  templateKey: string,
  centerX: number = DEFAULT_CENTER_X,
  centerY: number = DEFAULT_CENTER_Y
): Promise<void> {
  const composed = buildComposedTemplate(templateKey)
  if (composed.length > 0) {
    const centered = centerCreateInputsAt(composed, centerX, centerY)
    await batchCreateObjects(boardId, centered)
    return
  }

  const format = TEMPLATE_FORMAT_MAP[templateKey]
  const kind = format || 'Doc'
  const createdItems: { objectId: string; createInput: CreateObjectInput }[] = []
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
    await createObject(boardId, docInput)
  }
}
