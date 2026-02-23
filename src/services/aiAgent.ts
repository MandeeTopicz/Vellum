/**
 * AI Agent service – processes natural language commands via Firebase Cloud Function.
 * Sends prompts to OpenAI, executes tool calls via aiTools, and returns created/updated items.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'
import type { CreateObjectInput } from './objects'
import { deleteAllObjects, batchUpdatePositions } from './objects'
import type { BoardObject } from '../types'
import { toContextObject, TOOL_HANDLERS, executeCreateStickyGrid } from './aiTools'
import { wrapCreatedItemsInFrame } from './templateInsert'

/** Trigger phrases for CLEAR_BOARD intent (case-insensitive substring match) */
const CLEAR_BOARD_TRIGGERS = [
  'clear board',
  'clear the board',
  'clear canvas',
  'reset board',
  'delete everything',
  'delete all',
  'remove all',
  'remove everything',
  'wipe the board',
  'wipe canvas',
  'erase everything',
  'remove all elements',
  'delete all objects',
  'clear the whiteboard',
  'clear all',
]

function isClearBoardIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim()
  return CLEAR_BOARD_TRIGGERS.some((phrase) => lower.includes(phrase))
}

const STICKY_WIDTH = 200
const STICKY_HEIGHT = 160
const DEFAULT_GAP_X = STICKY_WIDTH + 20
const DEFAULT_GAP_Y = STICKY_HEIGHT + 20
const MAX_STICKY_GRID = 300

/** Result of parsing a sticky-grid intent */
interface StickyGridParse {
  rows: number
  cols: number
  total: number
}

/** Detects and parses CREATE_STICKY_GRID intent from prompt. Returns parsed params or null. */
function parseStickyGridIntent(prompt: string): StickyGridParse | null {
  const lower = prompt.toLowerCase().trim()
  const hasSticky = /\bsticky|stickies|notes?\b/i.test(prompt)
  const hasGridHint =
    /\bgrid\b|rows?|columns?|cols?\b|\d+\s*[x×]\s*\d+/.test(lower)
  if (!hasSticky || !hasGridHint) return null

  let rows: number | null = null
  let cols: number | null = null
  let total: number | null = null

  // "10 rows of 10 columns" / "10 rows and 10 columns" / "10 rows, 10 columns"
  const rowsColsMatch = lower.match(
    /(\d+)\s*rows?\s*(?:of|and|,)\s*(\d+)\s*col(?:umn)s?/i
  )
  if (rowsColsMatch) {
    rows = Math.floor(Number(rowsColsMatch[1]))
    cols = Math.floor(Number(rowsColsMatch[2]))
  }

  // "10 columns, 10 rows"
  if (!rowsColsMatch) {
    const colsRowsMatch = lower.match(
      /(\d+)\s*col(?:umn)s?\s*(?:,|and|of)\s*(\d+)\s*rows?/i
    )
    if (colsRowsMatch) {
      cols = Math.floor(Number(colsRowsMatch[1]))
      rows = Math.floor(Number(colsRowsMatch[2]))
    }
  }

  // "10x10" / "10 x 10" / "4x6" / "10 by 10"
  if (rows == null || cols == null) {
    const gridMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)/)
    if (gridMatch) {
      const a = Math.floor(Number(gridMatch[1]))
      const b = Math.floor(Number(gridMatch[2]))
      rows = a
      cols = b
    }
  }
  if (rows == null || cols == null) {
    const byMatch = lower.match(/(\d+)\s+by\s+(\d+)/)
    if (byMatch) {
      rows = Math.floor(Number(byMatch[1]))
      cols = Math.floor(Number(byMatch[2]))
    }
  }

  // "100 sticky notes" / "30 stickies" / "50 notes" / "create a grid of 100 sticky notes"
  const totalMatch = lower.match(
    /(\d+)\s*(?:sticky|stickies|notes?)|(?:grid|create|make|add)\s+(?:a\s+)?(?:grid\s+of\s+)?(\d+)\s*(?:sticky|stickies|notes?)/i
  )
  if (totalMatch && total == null) {
    total = Math.floor(Number(totalMatch[1] || totalMatch[2]))
  }

  // "30 sticky notes, 10 columns" or "10 columns, 30 sticky notes" -> total=30, cols=10
  const colsOnlyMatch = lower.match(
    /(\d+)\s*(?:sticky|stickies|notes?).*?(\d+)\s*col(?:umn)s?/i
  )
  if (colsOnlyMatch && cols == null) {
    total = total ?? Math.floor(Number(colsOnlyMatch[1]))
    cols = Math.floor(Number(colsOnlyMatch[2]))
  }

  // Derive missing values
  if (rows != null && cols != null) {
    total = rows * cols
  } else if (total != null && cols != null) {
    rows = Math.ceil(total / cols)
  } else if (total != null && rows != null) {
    cols = Math.ceil(total / rows)
  } else if (total != null) {
    cols = total >= 50 ? 10 : Math.ceil(Math.sqrt(total))
    rows = Math.ceil(total / cols)
    total = rows * cols
  } else {
    return null
  }

  if (rows < 1 || cols < 1 || total < 1) return null
  return { rows, cols, total: Math.min(total, rows * cols) }
}

/** Trigger phrases for REARRANGE_STICKY_GRID intent (modify existing stickies, don't create) */
const REARRANGE_TRIGGERS = [
  /\brearrange\b/i,
  /\breorganize\b/i,
  /\borganize\b/i,
  /\barrange\b/i,
  /\blayout\b/i,
  /\bmove\s+(?:all\s+)?(?:the\s+)?(?:sticky|stickies|notes?)\b/i,
  /\bput\s+(?:all\s+)?(?:the\s+)?(?:sticky|stickies|notes?)\s+in\b/i,
]

function isRearrangeIntent(prompt: string): boolean {
  return REARRANGE_TRIGGERS.some((re) => re.test(prompt))
}

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

/** Clear stored conversation history for a board (or all boards if boardId omitted). */
export function clearConversation(boardId?: string) {
  if (boardId) conversationHistoryByBoard.delete(boardId)
  else conversationHistoryByBoard.clear()
}

const ACKNOWLEDGMENTS = [
  'thank you', 'thanks', 'ty', 'thx', 'perfect', 'great', 'awesome', 'nice', 'good',
  'looks good', 'love it', 'amazing', 'okay', 'ok', 'got it', "that's good", "thats good",
  'cool', 'sounds good',
]

/**
 * Processes a natural language AI command. Calls Cloud Function, executes tool calls via aiTools.
 * @param boardId - The board ID
 * @param userPrompt - The user's natural language command
 * @param objectsList - Current objects on the board
 * @param viewportCenter - Optional viewport center in canvas coords
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
  const actions: string[] = []
  const createdItems: { objectId: string; createInput: CreateObjectInput }[] = []

  const lowerPrompt = userPrompt.toLowerCase().trim()
  const stripped = lowerPrompt.replace(/[!?.]+$/, '').trim()

  if (isClearBoardIntent(userPrompt)) {
    const deleted = await deleteAllObjects(boardId)
    const msg = `Deleted ${deleted} object(s)`
    actions.push(msg)
    return { success: true, message: msg, actions }
  }

  const stickyGridParse = parseStickyGridIntent(userPrompt)

  // Rearrange existing stickies into grid (takes precedence over create when both match)
  if (stickyGridParse && isRearrangeIntent(userPrompt)) {
    const stickies = objectsList.filter(
      (o): o is BoardObject & { type: 'sticky'; position: { x: number; y: number } } =>
        o.type === 'sticky' && 'position' in o && o.position != null
    )
    if (stickies.length > 0) {
      let { rows, cols } = stickyGridParse
      rows = Math.max(1, Math.min(50, rows))
      cols = Math.max(1, Math.min(50, cols))
      const count = Math.min(stickies.length, rows * cols)
      const actualRows = Math.ceil(count / cols)

      const vc = viewportCenter ?? { x: 1000, y: 1000 }
      const gridWidth = (cols - 1) * DEFAULT_GAP_X + STICKY_WIDTH
      const gridHeight = (actualRows - 1) * DEFAULT_GAP_Y + STICKY_HEIGHT
      const startX = vc.x - gridWidth / 2
      const startY = vc.y - gridHeight / 2

      const sorted = [...stickies].sort((a, b) => {
        const ay = a.position.y
        const by = b.position.y
        if (Math.abs(ay - by) > 20) return ay - by
        return a.position.x - b.position.x
      })

      const updates = sorted.slice(0, count).map((s, i) => {
        const row = Math.floor(i / cols)
        const col = i % cols
        const x = startX + col * DEFAULT_GAP_X
        const y = startY + row * DEFAULT_GAP_Y
        return { objectId: s.objectId, x, y }
      })

      await batchUpdatePositions(boardId, updates)
      const msg = `Rearranged ${count} sticky notes into ${actualRows}×${cols} grid.`
      actions.push(msg)
      return { success: true, message: msg, actions }
    }
  }

  if (stickyGridParse) {
    let { rows, cols, total } = stickyGridParse
    const capWarning = total > MAX_STICKY_GRID
    if (total > MAX_STICKY_GRID) {
      total = MAX_STICKY_GRID
      cols = Math.min(cols, 30)
      rows = Math.ceil(total / cols)
    }
    const vc = viewportCenter ?? { x: 1000, y: 1000 }
    const gridWidth = (cols - 1) * DEFAULT_GAP_X + STICKY_WIDTH
    const gridHeight = (rows - 1) * DEFAULT_GAP_Y + STICKY_HEIGHT
    const startX = vc.x - gridWidth / 2
    const startY = vc.y - gridHeight / 2
    const objectsMap = new Map(objectsList.map((o) => [o.objectId, o]))
    const ctx = {
      boardId,
      args: { rows, cols, startX, startY, gapX: DEFAULT_GAP_X, gapY: DEFAULT_GAP_Y, text: 'Note' },
      objectsMap,
      objectsList,
      createdItems,
      actions,
    }
    await executeCreateStickyGrid(ctx)
    const msg = capWarning
      ? `Created ${total} sticky notes (${rows}x${cols}). Capped at 300.`
      : `Created ${total} sticky notes (${rows}x${cols}).`
    return { success: true, message: msg, actions, createdItems }
  }

  if (ACKNOWLEDGMENTS.some((ack) => stripped === ack)) {
    return { success: true, message: "You're welcome! Let me know if you need anything else.", actions }
  }

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

    if (!data || !data.success) {
      return { success: false, message: 'AI request failed', actions }
    }

    if (Array.isArray(data.updatedHistory)) {
      conversationHistoryByBoard.set(boardId, data.updatedHistory)
    }

    if (data.toolCalls && data.toolCalls.length > 0) {
      let skipWrap = false
      let callsToExecute = data.toolCalls
      const getToolName = (tc: (typeof data.toolCalls)[0]) =>
        (tc?.function as { name?: string } | undefined)?.name
      const hasDuplicateColumn = callsToExecute.some((tc) => getToolName(tc) === 'duplicateColumn')
      const hasSpawnTemplate = callsToExecute.some((tc) => getToolName(tc) === 'spawnTemplate')
      if (hasDuplicateColumn) {
        callsToExecute = callsToExecute.filter(
          (tc) =>
            getToolName(tc) !== 'spawnTemplate' && getToolName(tc) !== 'createKanbanBoard'
        )
        if (callsToExecute.length < data.toolCalls.length) {
          console.log(
            '[AI] duplicateColumn in batch — skipping spawnTemplate/createKanbanBoard to avoid creating new board'
          )
        }
      } else if (hasSpawnTemplate && callsToExecute.length > 1) {
        callsToExecute = callsToExecute.filter((tc) => getToolName(tc) === 'spawnTemplate')
        console.log('[AI] spawnTemplate present with other tools — executing only spawnTemplate to avoid duplicate boards')
      }
      for (let i = 0; i < callsToExecute.length; i++) {
        const call = callsToExecute[i]
        const fn = call?.function
        if (!fn) continue

        let args: Record<string, unknown>
        try {
          args = (JSON.parse(fn.arguments ?? '{}') ?? {}) as Record<string, unknown>
        } catch {
          continue
        }

        const ctx = {
          boardId,
          args,
          objectsMap,
          objectsList,
          createdItems,
          actions,
          viewportCenter,
          get skipWrap() {
            return skipWrap
          },
          set skipWrap(v: boolean) {
            skipWrap = v
          },
        }
        const handler = TOOL_HANDLERS[fn.name]
        if (handler) {
          try {
            await handler(ctx)
          } catch (toolErr) {
            const msg = toolErr instanceof Error ? toolErr.message : String(toolErr)
            console.error('[AI] Tool execution failed for', fn.name, ':', toolErr)
            actions.push(`[${fn.name} failed] ${msg}`)
          }
        } else {
          console.warn('[AI] Unknown tool call:', fn.name)
        }
      }

      if (createdItems.length >= 2 && !skipWrap) {
        const wrapped = await wrapCreatedItemsInFrame(boardId, createdItems)
        return {
          success: true,
          message: (data.content ?? '').trim() || actions.join('. ') || 'Done',
          actions,
          createdItems: wrapped,
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

    return {
      success: true,
      message: (data.content ?? '').trim() || 'Done',
      actions,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: msg.includes('unauthenticated') ? 'Please log in' : `AI error: ${msg}`,
      actions,
    }
  }
}

/**
 * Generate a template on a board from a user prompt.
 */
export async function generateTemplateFromPrompt(boardId: string, prompt: string): Promise<void> {
  const enhancedPrompt = `Create a complete template for: ${prompt}. Include all necessary elements, labels, and structure. Add example content where helpful. Position elements in an organized, readable layout. Make it ready to use.`
  const result = await processAICommand(boardId, enhancedPrompt, [], { x: 1000, y: 1000 })
  if (!result.success) throw new Error(result.message || 'Failed to generate template')
}
