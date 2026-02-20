/**
 * AI Agent service – processes natural language commands via Firebase Cloud Function.
 * Sends prompts to OpenAI, executes tool calls via aiTools, and returns created/updated items.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'
import type { CreateObjectInput } from './objects'
import type { BoardObject } from '../types'
import { toContextObject, TOOL_HANDLERS } from './aiTools'

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
      for (let i = 0; i < data.toolCalls.length; i++) {
        const call = data.toolCalls[i]
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
        }
        const handler = TOOL_HANDLERS[fn.name]
        if (handler) {
          try {
            await handler(ctx)
          } catch (toolErr) {
            console.error('[AI] Tool execution failed for', fn.name, ':', toolErr)
          }
        } else {
          console.warn('[AI] Unknown tool call:', fn.name)
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
