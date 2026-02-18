import { getFunctions, httpsCallable } from 'firebase/functions'
import { firebaseApp } from './firebase'
import { createObject, type CreateObjectInput } from './objects'
import { DEFAULT_STICKY_SIZE, DEFAULT_SHAPE_SIZE, type BoardObjectType } from '../types/objects'

const functions = getFunctions(firebaseApp)
const processAICommandFn = httpsCallable<
  { boardId: string; userPrompt: string; objects: unknown[]; viewportCenter?: { x: number; y: number } },
  { success: boolean; toolCalls: Array<{ function: { name: string; arguments: string } }>; content: string | null }
>(functions, 'processAICommand')

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

function resolveColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  if (color.startsWith('#')) return color
  return NAMED_COLORS[color.toLowerCase()] ?? fallback
}

export async function processAICommand(
  boardId: string,
  userPrompt: string,
  _objects: unknown[],
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

  try {
    const result = await processAICommandFn({ boardId, userPrompt, objects: [], viewportCenter })
    const data = result.data

    console.log('[AI] Cloud function response:', data)
    console.log('[AI] Tool calls received:', data.toolCalls)

    if (!data || !data.success) {
      return { success: false, message: 'AI request failed', actions }
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

        } else {
          console.warn('[AI] Unknown tool call name:', fn.name, '— skipping')
        }
      }

      return {
        success: true,
        message: actions.length > 0 ? actions.join('. ') : 'Done',
        actions,
        createdItems,
      }
    }

    console.log('[AI] No tool calls returned. Text response:', data.content)
    return {
      success: true,
      message: data.content ?? 'Done',
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
