/**
 * AI tool: getBoardState, suggestLayout, analyzeBoardLayout (read-only / analysis).
 */
import type { ToolExecutionContext } from './types'

/**
 * getBoardState — reports board objects including frames (id, type, position, dimensions).
 * Frames have type 'frame'; use frame objectId as frameId for duplicateColumn.
 */
export async function executeGetBoardState(ctx: ToolExecutionContext): Promise<void> {
  const { objectsList, actions } = ctx
  actions.push(`Board has ${objectsList.length} object(s)`)
  const frames = objectsList.filter((o) => o.type === 'frame')
  console.log(
    '[getBoardState] frame objects:',
    frames.map((o) => ({ id: o.objectId, type: o.type }))
  )
  if (frames.length > 0) {
    const frameList = frames
      .map((f) => {
        const pos = 'position' in f ? (f as { position: { x: number; y: number } }).position : undefined
        const dims = 'dimensions' in f ? (f as { dimensions: { width: number; height: number } }).dimensions : undefined
        const x = pos ? Math.round(pos.x) : 0
        const y = pos ? Math.round(pos.y) : 0
        const w = dims?.width ?? 0
        const h = dims?.height ?? 0
        return `id=${f.objectId} type=frame x=${x} y=${y} width=${w} height=${h}`
      })
      .join('; ')
    actions.push(`Frames: ${frameList}`)
    actions.push('To add a column to a frame, call duplicateColumn with the frameId from the Frames list above.')
  }
}

/** suggestLayout */
export async function executeSuggestLayout(ctx: ToolExecutionContext): Promise<void> {
  const { args, actions } = ctx
  const suggestion = (args.suggestion ?? '') as string
  if (suggestion) actions.push(`Suggestion: ${suggestion}`)
}

/** analyzeBoardLayout */
export async function executeAnalyzeBoardLayout(ctx: ToolExecutionContext): Promise<void> {
  const { args, actions } = ctx
  const analysis = (args.analysis ?? '') as string
  const suggestions = Array.isArray(args.suggestions) ? (args.suggestions as string[]) : []
  if (analysis) actions.push(analysis)
  suggestions.forEach((s) => actions.push(`• ${s}`))
}
