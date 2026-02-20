/**
 * AI tool: getBoardState, suggestLayout, analyzeBoardLayout (read-only / analysis).
 */
import type { ToolExecutionContext } from './types'

/** getBoardState */
export async function executeGetBoardState(ctx: ToolExecutionContext): Promise<void> {
  const { objectsList, actions } = ctx
  actions.push(`Board has ${objectsList.length} object(s)`)
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
