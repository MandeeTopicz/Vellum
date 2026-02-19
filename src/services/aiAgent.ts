/**
 * AI Agent service – processes natural language commands via Firebase Cloud Function.
 * Sends prompts to OpenAI, executes tool calls (createStickyNote, createShape, changeColor,
 * moveObjects, arrangeInGrid, createTemplate) on the board, and returns created/updated items.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'
import { createObject, updateObject, deleteObject, type CreateObjectInput } from './objects'
import { DEFAULT_STICKY_SIZE, DEFAULT_SHAPE_SIZE, type BoardObjectType } from '../types/objects'
import { DEFAULT_TEXT_STYLE } from '../types'
import type { BoardObject } from '../types'

const functions = getFunctions(firebaseApp)
type ConversationMessage = { role: 'user' | 'assistant'; content: string }
const processAICommandFn = httpsCallable<
  {
    boardId: string
    userPrompt: string
    objects: unknown[]
    viewportCenter?: { x: number; y: number }
    conversationHistory?: ConversationMessage[]
  },
  {
    success: boolean
    toolCalls: Array<{ function: { name: string; arguments: string } }>
    content: string | null
    updatedHistory?: ConversationMessage[]
  }
>(functions, 'processAICommand')

const conversationHistoryByBoard = new Map<string, ConversationMessage[]>()

/** Clear stored conversation history for a board (or all boards if boardId omitted). Call when user clicks Clear. */
export function clearConversation(boardId?: string) {
  if (boardId) {
    conversationHistoryByBoard.delete(boardId)
  } else {
    conversationHistoryByBoard.clear()
  }
}

const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef08a',
  pink: '#fce7f3',
  blue: '#dbeafe',
  green: '#dcfce7',
  orange: '#ffedd5',
}

const NAMED_COLORS: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
  gray: '#6b7280',
  black: '#1f2937',
  white: '#f9fafb',
}

/** @internal Resolves a color name or hex to a hex string */
function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  if (color.startsWith('#')) return color
  return NAMED_COLORS[color.toLowerCase()] ?? fallback
}

/** @internal Minimal object shape sent to Cloud Function for AI context (for analysis and tool use) */
function toContextObject(obj: BoardObject): {
  objectId: string
  type: string
  content?: string
  position?: { x: number; y: number }
  fillColor?: string
  dimensions?: { width: number; height: number }
} {
  const base: { objectId: string; type: string; content?: string; position?: { x: number; y: number }; fillColor?: string; dimensions?: { width: number; height: number } } = { objectId: obj.objectId, type: obj.type }
  if ('content' in obj && typeof obj.content === 'string') base.content = obj.content
  if ('position' in obj) base.position = obj.position
  if ('start' in obj) base.position = (obj as { start: { x: number; y: number } }).start
  if ('fillColor' in obj && typeof (obj as { fillColor?: string }).fillColor === 'string') base.fillColor = (obj as { fillColor: string }).fillColor
  if ('dimensions' in obj) base.dimensions = (obj as { dimensions: { width: number; height: number } }).dimensions
  return base
}

/** @internal Converts BoardObject to CreateObjectInput with position offset (for duplicate) */
function objToCreateInput(obj: BoardObject, dx: number, dy: number): CreateObjectInput | null {
  switch (obj.type) {
    case 'sticky':
      return {
        type: 'sticky',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        fillColor: obj.fillColor,
        textStyle: obj.textStyle,
      }
    case 'rectangle':
    case 'circle':
    case 'triangle':
      return {
        type: obj.type,
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        fillColor: obj.fillColor,
      }
    case 'line':
      return {
        type: 'line',
        start: { x: obj.start.x + dx, y: obj.start.y + dy },
        end: { x: obj.end.x + dx, y: obj.end.y + dy },
        strokeColor: obj.strokeColor,
        strokeWidth: obj.strokeWidth,
      }
    case 'text':
      return {
        type: 'text',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        dimensions: obj.dimensions,
        content: obj.content,
        textStyle: obj.textStyle,
      }
    case 'emoji':
      return {
        type: 'emoji',
        position: { x: obj.position.x + dx, y: obj.position.y + dy },
        emoji: obj.emoji,
        fontSize: obj.fontSize,
      }
    default:
      return null
  }
}

/**
 * Processes a natural language AI command (e.g. "Create a blue sticky at 500,500").
 * Calls the Cloud Function, executes returned tool calls, and returns created items for undo.
 * @param boardId - The board ID
 * @param userPrompt - The user's natural language command
 * @param objectsList - Current objects on the board (for context and tool execution)
 * @param viewportCenter - Optional viewport center in canvas coords (used as default position)
 * @returns Promise with success, message, actions, and createdItems for undo
 * @example
 * const result = await processAICommand(boardId, 'Create a yellow sticky note', Object.values(objects), { x: 1000, y: 1000 })
 * if (result.createdItems) result.createdItems.forEach(({ objectId, createInput }) => pushUndo({ type: 'create', objectId, createInput }))
 */
export async function processAICommand(
  boardId: string,
  userPrompt: string,
  objectsList: BoardObject[],
  viewportCenter?: { x: number; y: number }
): Promise<{
  success: boolean
  message: string
  actions: string[]
  createdItems?: { objectId: string; createInput: CreateObjectInput }[]
}> {
  console.log('[AI] Processing command:', userPrompt)
  const actions: string[] = []
  const createdItems: { objectId: string; createInput: CreateObjectInput }[] = []
  const objectsMap = new Map(objectsList.map((o) => [o.objectId, o]))

  try {
    const history = conversationHistoryByBoard.get(boardId) ?? []
    const result = await processAICommandFn({
      boardId,
      userPrompt,
      objects: objectsList.map(toContextObject),
      viewportCenter,
      conversationHistory: history,
    })
    const data = result.data

    console.log('[AI] Cloud function response:', data)
    console.log('[AI] Tool calls received:', data.toolCalls)

    if (!data || !data.success) {
      return { success: false, message: 'AI request failed', actions }
    }

    if (Array.isArray(data.updatedHistory)) {
      conversationHistoryByBoard.set(boardId, data.updatedHistory)
    }

    if (data.toolCalls && data.toolCalls.length > 0) {
      for (const call of data.toolCalls) {
        const fn = call.function
        console.log('[AI] Processing tool call:', fn?.name)
        console.log('[AI] Raw arguments:', fn?.arguments)

        if (!fn) {
          console.warn('[AI] Tool call missing function field, skipping')
          continue
        }

        const args = JSON.parse(fn.arguments ?? '{}')
        console.log('[AI] Parsed args:', args)

        if (fn.name === 'createStickyNote') {
          const text: string = args.text ?? ''
          const x: number = typeof args.x === 'number' ? args.x : 500
          const y: number = typeof args.y === 'number' ? args.y : 500
          const fillColor = STICKY_COLORS[args.color ?? 'yellow'] ?? STICKY_COLORS.yellow

          const createInput: CreateObjectInput = {
            type: 'sticky',
            position: { x, y },
            dimensions: DEFAULT_STICKY_SIZE,
            content: text,
            fillColor,
          }
          console.log('[AI] Creating sticky note with input:', createInput)
          const objectId = await createObject(boardId, createInput)
          createdItems.push({ objectId, createInput })
          actions.push(`Created sticky at (${x}, ${y}): "${text}"`)
          console.log('[AI] Sticky note created, id:', objectId)

        } else if (fn.name === 'createShape') {
          const shapeType = (args.shapeType ?? 'rectangle') as BoardObjectType
          const x: number = typeof args.x === 'number' ? args.x : 500
          const y: number = typeof args.y === 'number' ? args.y : 500
          const fillColor = resolveColor(args.color, '#3b82f6')

          const createInput: CreateObjectInput = {
            type: shapeType,
            position: { x, y },
            dimensions: DEFAULT_SHAPE_SIZE,
            fillColor,
          }
          console.log('[AI] Creating shape with input:', createInput)
          const objectId = await createObject(boardId, createInput)
          createdItems.push({ objectId, createInput })
          actions.push(`Created ${shapeType} at (${x}, ${y})`)
          console.log('[AI] Shape created, id:', objectId)

        } else if (fn.name === 'changeColor') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          const newColor = resolveColor(args.newColor, '#3b82f6')
          for (const objectId of objectIds) {
            await updateObject(boardId, objectId, { fillColor: newColor })
          }
          actions.push(`Changed color of ${objectIds.length} object(s) to ${newColor}`)

        } else if (fn.name === 'moveObjects') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          const newX = typeof args.newX === 'number' ? args.newX : 500
          const newY = typeof args.newY === 'number' ? args.newY : 500
          for (const objectId of objectIds) {
            const obj = objectsMap.get(objectId)
            if (!obj) continue
            if ('position' in obj) {
              await updateObject(boardId, objectId, { position: { x: newX, y: newY } })
            } else if ('start' in obj && 'end' in obj) {
              const line = obj as { start: { x: number; y: number }; end: { x: number; y: number } }
              const dx = newX - line.start.x
              const dy = newY - line.start.y
              await updateObject(boardId, objectId, {
                start: { x: newX, y: newY },
                end: { x: line.end.x + dx, y: line.end.y + dy },
              })
            }
          }
          actions.push(`Moved ${objectIds.length} object(s) to (${newX}, ${newY})`)

        } else if (fn.name === 'arrangeInGrid') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          const columns = typeof args.columns === 'number' ? Math.max(1, args.columns) : 2
          const spacing = typeof args.spacing === 'number' ? args.spacing : 50
          const objs = objectIds.map((id) => objectsMap.get(id)).filter(Boolean) as BoardObject[]
          if (objs.length > 0) {
            const cellW = Math.max(...objs.map((o) => ('dimensions' in o ? o.dimensions.width : 120))) + spacing
            const cellH = Math.max(...objs.map((o) => ('dimensions' in o ? o.dimensions.height : 80))) + spacing
            const startX = 'position' in objs[0] ? objs[0].position.x : 'start' in objs[0] ? (objs[0] as { start: { x: number } }).start.x : 0
            const startY = 'position' in objs[0] ? objs[0].position.y : 'start' in objs[0] ? (objs[0] as { start: { y: number } }).start.y : 0
            for (let i = 0; i < objs.length; i++) {
              const row = Math.floor(i / columns)
              const col = i % columns
              const x = startX + col * cellW
              const y = startY + row * cellH
              const o = objs[i]
              if ('position' in o) {
                await updateObject(boardId, o.objectId, { position: { x, y } })
              } else if ('start' in o && 'end' in o) {
                const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
                const dx = x - line.start.x
                const dy = y - line.start.y
                await updateObject(boardId, o.objectId, {
                  start: { x, y },
                  end: { x: line.end.x + dx, y: line.end.y + dy },
                })
              }
            }
            actions.push(`Arranged ${objs.length} object(s) in ${columns}-column grid`)
          }

        } else if (fn.name === 'createTemplate') {
          const templateType = (args.templateType ?? 'swot') as 'swot' | 'retrospective' | 'journeyMap'
          const startX = typeof args.startX === 'number' ? args.startX : 500
          const startY = typeof args.startY === 'number' ? args.startY : 500
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
              templates.push({
                label: `Step ${i + 1}`,
                x: startX + i * (w + gap),
                y: startY,
                color: 'yellow',
              })
            }
          }
          for (const t of templates) {
            const fillColor = STICKY_COLORS[t.color] ?? resolveColor(t.color, STICKY_COLORS.yellow)
            const createInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: t.x, y: t.y },
              dimensions: DEFAULT_STICKY_SIZE,
              content: t.label,
              fillColor,
            }
            const objectId = await createObject(boardId, createInput)
            createdItems.push({ objectId, createInput })
          }
          actions.push(`Created ${templateType} template with ${templates.length} stickies`)

        } else if (fn.name === 'createTextBox') {
          const text: string = args.text ?? ''
          const x: number = typeof args.x === 'number' ? args.x : 500
          const y: number = typeof args.y === 'number' ? args.y : 500
          const fontSize = typeof args.fontSize === 'number' ? args.fontSize : 16
          const fontColor = resolveColor(args.color, '#1a1a1a')
          const textStyle = { ...DEFAULT_TEXT_STYLE, fontSize, fontColor }
          const createInput: CreateObjectInput = {
            type: 'text',
            position: { x, y },
            dimensions: { width: 200, height: 60 },
            content: text,
            textStyle,
          }
          const objectId = await createObject(boardId, createInput)
          createdItems.push({ objectId, createInput })
          actions.push(`Created text box at (${x}, ${y})`)

        } else if (fn.name === 'createConnector') {
          const fromX = typeof args.fromX === 'number' ? args.fromX : 0
          const fromY = typeof args.fromY === 'number' ? args.fromY : 0
          const toX = typeof args.toX === 'number' ? args.toX : fromX + 100
          const toY = typeof args.toY === 'number' ? args.toY : fromY
          const strokeColor = resolveColor(args.color, '#1f2937')
          const createInput: CreateObjectInput = {
            type: 'line',
            start: { x: fromX, y: fromY },
            end: { x: toX, y: toY },
            strokeColor,
            strokeWidth: args.style === 'arrow' ? 3 : 2,
          }
          const objectId = await createObject(boardId, createInput)
          createdItems.push({ objectId, createInput })
          actions.push(`Created connector from (${fromX},${fromY}) to (${toX},${toY})`)

        } else if (fn.name === 'createFlowchart') {
          const steps = Array.isArray(args.steps) ? args.steps : []
          const startX = typeof args.startX === 'number' ? args.startX : 500
          const startY = typeof args.startY === 'number' ? args.startY : 500
          const orient = args.orientation === 'horizontal' ? 'horizontal' : 'vertical'
          const boxW = 120
          const boxH = 50
          const gap = 60
          let cx = startX
          let cy = startY
          for (let i = 0; i < steps.length; i++) {
            const s = steps[i] as { label?: string; type?: string }
            const label = (s?.label ?? `Step ${i + 1}`) as string
            const stepType = (s?.type ?? 'process') as string
            const fillColor = stepType === 'start' ? '#dcfce7' : stepType === 'end' ? '#fee2e2' : stepType === 'decision' ? '#fef08a' : '#dbeafe'
            const createInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: cx, y: cy },
              dimensions: { width: boxW, height: boxH },
              content: label,
              fillColor,
            }
            const objectId = await createObject(boardId, createInput)
            createdItems.push({ objectId, createInput })
            if (orient === 'vertical') cy += boxH + gap
            else cx += boxW + gap
          }
          for (let i = 0; i < steps.length - 1; i++) {
            const from = orient === 'vertical'
              ? { x: startX + boxW / 2, y: startY + boxH + i * (boxH + gap) }
              : { x: startX + boxW + i * (boxW + gap), y: startY + boxH / 2 }
            const to = orient === 'vertical'
              ? { x: startX + boxW / 2, y: startY + (i + 1) * (boxH + gap) }
              : { x: startX + (i + 1) * (boxW + gap), y: startY + boxH / 2 }
            const lineInput: CreateObjectInput = { type: 'line', start: from, end: to, strokeColor: '#64748b', strokeWidth: 2 }
            const lineId = await createObject(boardId, lineInput)
            createdItems.push({ objectId: lineId, createInput: lineInput })
          }
          actions.push(`Created flowchart with ${steps.length} steps`)

        } else if (fn.name === 'createOrgChart') {
          let structure = args.structure as { name?: string; title?: string; children?: unknown[]; departments?: unknown[] } | string | null | undefined
          if (typeof structure === 'string') {
            try {
              structure = JSON.parse(structure) as { name?: string; title?: string; children?: unknown[] }
            } catch {
              structure = null
            }
          }
          if (!structure || typeof structure !== 'object') {
            const ceo = args.ceo ?? args.root ?? args.ceoName
            const deps = args.departments ?? args.children
            if ((ceo != null || deps != null) && Array.isArray(deps)) {
              structure = {
                name: typeof ceo === 'string' ? ceo : 'CEO',
                children: deps.map((d: unknown) => (typeof d === 'string' ? { name: d } : d)),
              }
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
          const boxW = 140
          const boxH = 50
          const gapX = 40
          const gapY = 80
          if (structure && typeof structure === 'object') {
            const rootName = (structure.name ?? structure.title ?? 'CEO') as string
            const rootInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: startX, y: startY },
              dimensions: { width: boxW, height: boxH },
              content: rootName,
              fillColor: '#dbeafe',
            }
            const rootId = await createObject(boardId, rootInput)
            createdItems.push({ objectId: rootId, createInput: rootInput })
            let children = Array.isArray(structure.children)
              ? structure.children
              : Array.isArray(structure.departments)
                ? structure.departments
                : []
            children = children.map((ch: unknown) =>
              typeof ch === 'string' ? { name: ch } : ch
            )
            let childX = startX - (Math.max(0, children.length - 1) * (boxW + gapX)) / 2
            for (const ch of children) {
              const c = ch as { name?: string; title?: string }
              const childName = (c?.name ?? c?.title ?? 'Department') as string
              const childInput: CreateObjectInput = {
                type: 'sticky',
                position: { x: childX, y: startY + boxH + gapY },
                dimensions: { width: boxW, height: boxH },
                content: childName,
                fillColor: '#e0e7ff',
              }
              const childId = await createObject(boardId, childInput)
              createdItems.push({ objectId: childId, createInput: childInput })
              const lineInput: CreateObjectInput = {
                type: 'line',
                start: { x: startX + boxW / 2, y: startY + boxH },
                end: { x: childX + boxW / 2, y: startY + boxH + gapY },
                strokeColor: '#94a3b8',
                strokeWidth: 2,
              }
              const lineId = await createObject(boardId, lineInput)
              createdItems.push({ objectId: lineId, createInput: lineInput })
              childX += boxW + gapX
            }
            actions.push(`Created org chart with ${1 + children.length} nodes`)
          } else {
            console.warn('[AI] createOrgChart: invalid structure, using default. Raw args:', JSON.stringify(args))
            structure = { name: 'CEO', children: [{ name: 'Engineering' }, { name: 'Sales' }, { name: 'Marketing' }] }
            const rootInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: startX, y: startY },
              dimensions: { width: boxW, height: boxH },
              content: 'CEO',
              fillColor: '#dbeafe',
            }
            const rootId = await createObject(boardId, rootInput)
            createdItems.push({ objectId: rootId, createInput: rootInput })
            const children = structure.children as { name?: string }[]
            let childX = startX - (Math.max(0, children.length - 1) * (boxW + gapX)) / 2
            for (const ch of children) {
              const childName = (ch?.name ?? 'Department') as string
              const childInput: CreateObjectInput = {
                type: 'sticky',
                position: { x: childX, y: startY + boxH + gapY },
                dimensions: { width: boxW, height: boxH },
                content: childName,
                fillColor: '#e0e7ff',
              }
              const childId = await createObject(boardId, childInput)
              createdItems.push({ objectId: childId, createInput: childInput })
              const lineInput: CreateObjectInput = {
                type: 'line',
                start: { x: startX + boxW / 2, y: startY + boxH },
                end: { x: childX + boxW / 2, y: startY + boxH + gapY },
                strokeColor: '#94a3b8',
                strokeWidth: 2,
              }
              const lineId = await createObject(boardId, lineInput)
              createdItems.push({ objectId: lineId, createInput: lineInput })
              childX += boxW + gapX
            }
            actions.push(`Created org chart with ${1 + children.length} nodes (default structure)`)
          }

        } else if (fn.name === 'createMindMap') {
          const centerTopic = (args.centerTopic ?? 'Topic') as string
          const branches = Array.isArray(args.branches) ? (args.branches as string[]) : []
          const centerX = typeof args.centerX === 'number' ? args.centerX : 500
          const centerY = typeof args.centerY === 'number' ? args.centerY : 500
          const centerW = 160
          const centerH = 80
          const centerInput: CreateObjectInput = {
            type: 'sticky',
            position: { x: centerX - centerW / 2, y: centerY - centerH / 2 },
            dimensions: { width: centerW, height: centerH },
            content: centerTopic,
            fillColor: '#fef08a',
          }
          const centerId = await createObject(boardId, centerInput)
          createdItems.push({ objectId: centerId, createInput: centerInput })
          const centerRadius = Math.min(centerW, centerH) / 2
          const branchRadius = 180
          for (let i = 0; i < branches.length; i++) {
            const angle = (i / Math.max(1, branches.length)) * Math.PI * 1.5 - Math.PI / 4
            const branchCenterX = centerX + branchRadius * Math.cos(angle)
            const branchCenterY = centerY + branchRadius * Math.sin(angle)
            const branchW = 120
            const branchH = 60
            const bx = branchCenterX - branchW / 2
            const by = branchCenterY - branchH / 2
            const branchInput: CreateObjectInput = {
              type: 'sticky',
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
            const lineInput: CreateObjectInput = {
              type: 'line',
              start: { x: lineStartX, y: lineStartY },
              end: { x: branchCenterX, y: branchCenterY },
              strokeColor: '#94a3b8',
              strokeWidth: 2,
            }
            const lineId = await createObject(boardId, lineInput)
            createdItems.push({ objectId: lineId, createInput: lineInput })
          }
          actions.push(`Created mind map with center and ${branches.length} branches`)

        } else if (fn.name === 'createKanbanBoard') {
          const columns = Array.isArray(args.columns) ? args.columns : []
          const startX = typeof args.startX === 'number' ? args.startX : 500
          const startY = typeof args.startY === 'number' ? args.startY : 500
          const colW = 180
          const itemH = 50
          const gap = 16
          let colX = startX
          for (const col of columns) {
            const c = col as { title?: string; items?: string[] }
            const title = (c?.title ?? 'Column') as string
            const items = Array.isArray(c?.items) ? (c.items as string[]) : []
            const colInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: colX, y: startY },
              dimensions: { width: colW - 16, height: 40 },
              content: title,
              fillColor: '#3b82f6',
            }
            const colId = await createObject(boardId, colInput)
            createdItems.push({ objectId: colId, createInput: colInput })
            let itemY = startY + 50
            for (const item of items) {
              const itemInput: CreateObjectInput = {
                type: 'sticky',
                position: { x: colX + 8, y: itemY },
                dimensions: { width: colW - 32, height: 40 },
                content: item,
                fillColor: '#f1f5f9',
              }
              const itemId = await createObject(boardId, itemInput)
              createdItems.push({ objectId: itemId, createInput: itemInput })
              itemY += itemH + gap
            }
            colX += colW + gap
          }
          actions.push(`Created Kanban board with ${columns.length} columns`)

        } else if (fn.name === 'createTimeline') {
          const events = Array.isArray(args.events) ? args.events : []
          const startX = typeof args.startX === 'number' ? args.startX : 500
          const startY = typeof args.startY === 'number' ? args.startY : 500
          const gap = 140
          const stickyH = 60
          const lineYOffset = 20
          for (let i = 0; i < events.length; i++) {
            const e = events[i] as { date?: string; label?: string }
            const date = (e?.date ?? '') as string
            const label = (e?.label ?? `Event ${i + 1}`) as string
            const text = date ? `${date}: ${label}` : label
            const createInput: CreateObjectInput = {
              type: 'sticky',
              position: { x: startX + i * gap, y: startY },
              dimensions: { width: 120, height: stickyH },
              content: text,
              fillColor: '#fef08a',
            }
            const objectId = await createObject(boardId, createInput)
            createdItems.push({ objectId, createInput })
          }
          if (events.length > 1) {
            const lineY = startY + stickyH + lineYOffset
            const lineInput: CreateObjectInput = {
              type: 'line',
              start: { x: startX + 60, y: lineY },
              end: { x: startX + (events.length - 1) * gap + 60, y: lineY },
              strokeColor: '#94a3b8',
              strokeWidth: 2,
            }
            const lineId = await createObject(boardId, lineInput)
            createdItems.push({ objectId: lineId, createInput: lineInput })
          }
          actions.push(`Created timeline with ${events.length} events`)

        } else if (fn.name === 'groupObjects') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          const objs = objectIds.map((id) => objectsMap.get(id)).filter(Boolean) as BoardObject[]
          if (objs.length > 0) {
            const minX = Math.min(...objs.map((o) => ('position' in o ? o.position.x : 'start' in o ? (o as { start: { x: number } }).start.x : 0)))
            const minY = Math.min(...objs.map((o) => ('position' in o ? o.position.y : 'start' in o ? (o as { start: { y: number } }).start.y : 0)))
            const clusterGap = 20
            for (let i = 0; i < objs.length; i++) {
              const o = objs[i]
              const newX = minX + (i % 3) * 120
              const newY = minY + Math.floor(i / 3) * 100
              if ('position' in o) {
                await updateObject(boardId, o.objectId, { position: { x: newX, y: newY } })
              } else if ('start' in o && 'end' in o) {
                const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
                const dx = newX - line.start.x
                const dy = newY - line.start.y
                await updateObject(boardId, o.objectId, {
                  start: { x: newX, y: newY },
                  end: { x: line.end.x + dx, y: line.end.y + dy },
                })
              }
            }
            actions.push(`Grouped ${objs.length} object(s)`)
          }

        } else if (fn.name === 'duplicateObjects') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          const offsetX = typeof args.offsetX === 'number' ? args.offsetX : 50
          const offsetY = typeof args.offsetY === 'number' ? args.offsetY : 50
          for (const objectId of objectIds) {
            const obj = objectsMap.get(objectId)
            if (!obj) continue
            const dup = objToCreateInput(obj, offsetX, offsetY)
            if (dup) {
              const newId = await createObject(boardId, dup)
              createdItems.push({ objectId: newId, createInput: dup })
            }
          }
          actions.push(`Duplicated ${objectIds.length} object(s)`)

        } else if (fn.name === 'deleteObjects') {
          const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
          for (const objectId of objectIds) {
            await deleteObject(boardId, objectId)
          }
          actions.push(`Deleted ${objectIds.length} object(s)`)

        } else if (fn.name === 'getBoardState') {
          actions.push(`Board has ${objectsList.length} object(s)`)

        } else if (fn.name === 'suggestLayout') {
          const suggestion = (args.suggestion ?? '') as string
          if (suggestion) actions.push(`Suggestion: ${suggestion}`)

        } else if (fn.name === 'analyzeBoardLayout') {
          const analysis = (args.analysis ?? '') as string
          const suggestions = Array.isArray(args.suggestions) ? (args.suggestions as string[]) : []
          console.log('[AI Analysis]:', analysis)
          console.log('[AI Suggestions]:', suggestions)
          if (analysis) actions.push(analysis)
          suggestions.forEach((s) => actions.push(`• ${s}`))

        } else {
          console.warn('[AI] Unknown tool call name:', fn.name, '— skipping')
        }
      }

      const conversationalMessage = (data.content ?? '').trim()
      const fallbackMessage = actions.length > 0 ? actions.join('. ') : 'Done'
      return {
        success: true,
        message: conversationalMessage || fallbackMessage,
        actions,
        createdItems,
      }
    }

    console.log('[AI] No tool calls returned. Text response:', data.content)
    return {
      success: true,
      message: (data.content ?? '').trim() || 'Done',
      actions,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AI] Error:', err)
    return {
      success: false,
      message: msg.includes('unauthenticated') ? 'Please log in' : `AI error: ${msg}`,
      actions,
    }
  }
}
