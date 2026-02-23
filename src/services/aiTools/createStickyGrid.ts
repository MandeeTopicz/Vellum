/**
 * AI tool: createStickyGrid – deterministic batch creation of a grid of sticky notes.
 * Uses nested loops and batch insert. Does NOT call createSticky repeatedly.
 */
import { batchCreateObjects } from '../objects'
import { DEFAULT_STICKY_SIZE } from '../../types/objects'
import { DEFAULT_TEXT_STYLE } from '../../types'
import { STICKY_COLORS, getAdjustedPosition } from './shared'
import type { CreateObjectInput } from '../objects'
import type { ToolExecutionContext } from './types'

const STICKY_WIDTH = DEFAULT_STICKY_SIZE.width
const STICKY_HEIGHT = DEFAULT_STICKY_SIZE.height
const DEFAULT_GAP_X = 200
const DEFAULT_GAP_Y = 200
const MAX_NOTES = 300

/**
 * Creates rows * cols sticky notes in a single batch using nested loops.
 * Deterministic and scoped to the current board.
 */
export async function executeCreateStickyGrid(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const rows = Math.max(1, Math.min(50, Math.floor(Number(args.rows) ?? 1)))
  const cols = Math.max(1, Math.min(50, Math.floor(Number(args.cols) ?? 1)))
  let startX = typeof args.startX === 'number' ? args.startX : 0
  let startY = typeof args.startY === 'number' ? args.startY : 0
  const gapX = typeof args.gapX === 'number' ? args.gapX : DEFAULT_GAP_X
  const gapY = typeof args.gapY === 'number' ? args.gapY : DEFAULT_GAP_Y
  const text = String(args.text ?? 'Note')
  const colorKey = typeof args.color === 'string' ? args.color : 'yellow'
  const fillColor = STICKY_COLORS[colorKey] ?? STICKY_COLORS.yellow ?? '#fef08a'

  let totalToCreate = rows * cols
  const capWarning = totalToCreate > MAX_NOTES
  if (totalToCreate > MAX_NOTES) {
    totalToCreate = MAX_NOTES
  }

  const layoutW = (cols - 1) * gapX + STICKY_WIDTH
  const layoutH = (rows - 1) * gapY + STICKY_HEIGHT
  const adjusted = getAdjustedPosition(ctx, startX, startY, layoutW, layoutH)
  startX = adjusted.x
  startY = adjusted.y

  const elements: CreateObjectInput[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (elements.length >= totalToCreate) break
      const x = startX + c * gapX
      const y = startY + r * gapY
      elements.push({
        type: 'sticky',
        position: { x, y },
        dimensions: { width: STICKY_WIDTH, height: STICKY_HEIGHT },
        content: text,
        fillColor,
        cornerRadius: 12,
        textStyle: { ...DEFAULT_TEXT_STYLE },
      })
    }
  }

  const ids = await batchCreateObjects(boardId, elements)

  for (let i = 0; i < ids.length; i++) {
    createdItems.push({ objectId: ids[i], createInput: elements[i] })
  }

  const actualRows = Math.ceil(ids.length / cols)
  const msg = capWarning
    ? `Created ${ids.length} sticky notes (${actualRows}x${cols}). Capped at ${MAX_NOTES}.`
    : `Created ${ids.length} sticky notes (${actualRows}x${cols}).`
  actions.push(msg)
}
