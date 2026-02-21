/**
 * AI tool: createStickyGrid – batch create a grid of sticky notes.
 * Used for prompts like "100 sticky notes in a grid", "10x10 grid", "10 rows of 10 columns".
 */
import { createObject } from '../objects'
import { DEFAULT_STICKY_SIZE } from '../../types/objects'
import { DEFAULT_TEXT_STYLE } from '../../types'
import { STICKY_COLORS } from './shared'
import type { ToolExecutionContext } from './types'

const STICKY_WIDTH = DEFAULT_STICKY_SIZE.width
const STICKY_HEIGHT = DEFAULT_STICKY_SIZE.height
const DEFAULT_GAP_X = STICKY_WIDTH + 20
const DEFAULT_GAP_Y = STICKY_HEIGHT + 20
const MAX_NOTES = 300

/**
 * Creates a grid of sticky notes in a single batch.
 * Params: rows, cols, startX, startY, gapX, gapY, text, labels?, selectAndGroup?
 */
export async function executeCreateStickyGrid(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const rows = Math.max(1, Math.min(50, Math.floor(Number(args.rows) || 1)))
  const cols = Math.max(1, Math.min(50, Math.floor(Number(args.cols) || 1)))
  const startX = typeof args.startX === 'number' ? args.startX : 50
  const startY = typeof args.startY === 'number' ? args.startY : 50
  const gapX = typeof args.gapX === 'number' ? args.gapX : DEFAULT_GAP_X
  const gapY = typeof args.gapY === 'number' ? args.gapY : DEFAULT_GAP_Y
  const text = String(args.text ?? 'Note')
  const labels = Array.isArray(args.labels) ? (args.labels as string[]) : null

  let totalToCreate = rows * cols
  const capWarning = totalToCreate > MAX_NOTES
  if (totalToCreate > MAX_NOTES) {
    totalToCreate = MAX_NOTES
  }

  const fillColor = STICKY_COLORS.yellow ?? '#fef08a'

  for (let i = 0; i < totalToCreate; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = startX + col * gapX
    const y = startY + row * gapY
    const label = labels && i < labels.length ? labels[i] : text

    const createInput = {
      type: 'sticky' as const,
      position: { x, y },
      dimensions: { width: STICKY_WIDTH, height: STICKY_HEIGHT },
      content: label,
      fillColor,
      cornerRadius: 12,
      textStyle: { ...DEFAULT_TEXT_STYLE },
    }
    const objectId = await createObject(boardId, createInput)
    createdItems.push({ objectId, createInput })
  }

  const actualRows = Math.ceil(totalToCreate / cols)
  const msg = capWarning
    ? `Created ${totalToCreate} sticky notes (${actualRows}x${cols}). Capped at 300.`
    : `Created ${totalToCreate} sticky notes (${actualRows}x${cols}).`
  actions.push(msg)
}
