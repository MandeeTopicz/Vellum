import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import OpenAI from 'openai'

const openaiApiKey = defineSecret('OPENAI_API_KEY')

export const processAICommand = onCall(
  {
    secrets: [openaiApiKey],
    cors: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'https://vellum-6f172.web.app',
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }

    const { boardId, userPrompt, viewportCenter } = request.data as {
      boardId: string
      userPrompt: string
      objects?: unknown[]
      viewportCenter?: { x: number; y: number }
    }

    if (!boardId || typeof userPrompt !== 'string') {
      throw new HttpsError('invalid-argument', 'boardId and userPrompt required')
    }

    const defaultX = Math.round(viewportCenter?.x ?? 1000)
    const defaultY = Math.round(viewportCenter?.y ?? 1000)

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    })

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a whiteboard assistant. The canvas is 2000x2000px with (0,0) at the top-left and (2000,2000) at the bottom-right. ' +
              'When the user asks you to create something, ALWAYS call the appropriate tool immediately. ' +
              'NEVER ask the user for clarification or missing information. ' +
              `If coordinates are not specified, default to x=${defaultX}, y=${defaultY} (current viewport center). ` +
              'If color is not specified, use a sensible default (yellow for sticky notes, blue for shapes). ' +
              'Always act — never respond with plain text asking for more details.',
          },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'createStickyNote',
              description: 'Create a sticky note on the whiteboard',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text content of the sticky note' },
                  x: { type: 'number', description: 'X position on the canvas (0-2000)' },
                  y: { type: 'number', description: 'Y position on the canvas (0-2000)' },
                  color: {
                    type: 'string',
                    enum: ['yellow', 'pink', 'blue', 'green', 'orange'],
                    description: 'Background color of the sticky note',
                  },
                },
                required: ['text', 'x', 'y'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createShape',
              description: 'Create a geometric shape (rectangle, circle, or triangle) on the whiteboard',
              parameters: {
                type: 'object',
                properties: {
                  shapeType: {
                    type: 'string',
                    enum: ['rectangle', 'circle', 'triangle'],
                    description: 'The type of shape to create',
                  },
                  x: { type: 'number', description: 'X position on the canvas (0-2000)' },
                  y: { type: 'number', description: 'Y position on the canvas (0-2000)' },
                  color: {
                    type: 'string',
                    description: 'Fill color name (e.g. "red", "blue", "green") or hex code',
                  },
                },
                required: ['shapeType', 'x', 'y'],
              },
            },
          },
        ],
        tool_choice: 'auto',
      })

      const message = response.choices[0]?.message

      return {
        success: true,
        toolCalls: message?.tool_calls ?? [],
        content: message?.content ?? null,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new HttpsError('internal', msg)
    }
  }
)
