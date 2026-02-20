/**
 * AI tool: createConnector.
 */
import { createObject } from '../objects'
import { resolveColor } from './shared'
import type { ToolExecutionContext } from './types'

/** createConnector */
export async function executeCreateConnector(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const fromX = typeof args.fromX === 'number' ? args.fromX : 0
  const fromY = typeof args.fromY === 'number' ? args.fromY : 0
  const toX = typeof args.toX === 'number' ? args.toX : fromX + 100
  const toY = typeof args.toY === 'number' ? args.toY : fromY
  const strokeColor = resolveColor(args.color as string | undefined, '#1f2937')
  const useArrow = args.style === 'arrow'
  const arrowType = args.arrowType ?? 'straight'
  const connectionType = useArrow
    ? arrowType === 'curved'
      ? 'arrow-curved'
      : arrowType === 'elbow'
        ? 'arrow-elbow-bidirectional'
        : 'arrow-straight'
    : 'line'
  const createInput = {
    type: 'line' as const,
    start: { x: fromX, y: fromY },
    end: { x: toX, y: toY },
    strokeColor,
    strokeWidth: 2,
    connectionType: connectionType as 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-elbow-bidirectional' | 'arrow-double',
  }
  const objectId = await createObject(boardId, createInput)
  createdItems.push({ objectId, createInput })
  actions.push(`Created connector from (${fromX},${fromY}) to (${toX},${toY})`)
}
