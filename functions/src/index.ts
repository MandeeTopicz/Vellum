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

    const { boardId, userPrompt, viewportCenter, objects: boardObjects } = request.data as {
      boardId: string
      userPrompt: string
      objects?: Array<{ objectId: string; type: string; content?: string; position?: { x: number; y: number } }>
      viewportCenter?: { x: number; y: number }
    }

    if (!boardId || typeof userPrompt !== 'string') {
      throw new HttpsError('invalid-argument', 'boardId and userPrompt required')
    }

    const defaultX = Math.round(viewportCenter?.x ?? 1000)
    const defaultY = Math.round(viewportCenter?.y ?? 1000)

    const objectContext =
      Array.isArray(boardObjects) && boardObjects.length > 0
        ? `\n\nCurrent objects on the board (use these objectIds for changeColor, moveObjects, arrangeInGrid, groupObjects, duplicateObjects, deleteObjects): ${boardObjects.map((o) => `${o.objectId} (${o.type}${o.content ? `: "${String(o.content).slice(0, 30)}"` : ''})`).join(', ')}`
        : ''

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
              'When the user asks you to create or modify something, ALWAYS call the appropriate tool immediately. ' +
              'NEVER ask the user for clarification or missing information. ' +
              `If coordinates are not specified, default to x=${defaultX}, y=${defaultY} (current viewport center). ` +
              'If color is not specified, use a sensible default (yellow for sticky notes, blue for shapes). ' +
              'For changeColor, moveObjects, and arrangeInGrid you must use objectIds from the current board context provided in the user message. ' +
              'Always act — never respond with plain text asking for more details.',
          },
          { role: 'user', content: userPrompt + objectContext },
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
          {
            type: 'function',
            function: {
              name: 'changeColor',
              description: 'Change the color of one or more objects on the board',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to change',
                  },
                  newColor: {
                    type: 'string',
                    description: 'New color: hex (e.g. #3b82f6) or name (red, blue, green, yellow, etc.)',
                  },
                },
                required: ['objectIds', 'newColor'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'moveObjects',
              description: 'Move one or more objects to a new position',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to move',
                  },
                  newX: { type: 'number', description: 'New X position on the canvas' },
                  newY: { type: 'number', description: 'New Y position on the canvas' },
                },
                required: ['objectIds', 'newX', 'newY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'arrangeInGrid',
              description: 'Arrange objects in a grid layout',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to arrange',
                  },
                  columns: { type: 'number', description: 'Number of columns in the grid' },
                  spacing: {
                    type: 'number',
                    description: 'Space between objects in pixels (default 50)',
                  },
                },
                required: ['objectIds', 'columns'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createTemplate',
              description: 'Create a pre-defined template: SWOT (2x2 quadrants), retrospective (4 columns), or journey map (horizontal steps)',
              parameters: {
                type: 'object',
                properties: {
                  templateType: {
                    type: 'string',
                    enum: ['swot', 'retrospective', 'journeyMap'],
                    description: 'Type of template to create',
                  },
                  startX: { type: 'number', description: 'Top-left X position for the template' },
                  startY: { type: 'number', description: 'Top-left Y position for the template' },
                },
                required: ['templateType', 'startX', 'startY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createTextBox',
              description: 'Create a standalone text box on the whiteboard',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text content' },
                  x: { type: 'number', description: 'X position on the canvas' },
                  y: { type: 'number', description: 'Y position on the canvas' },
                  fontSize: { type: 'number', description: 'Font size (default 16)' },
                  color: { type: 'string', description: 'Text color (hex or name)' },
                },
                required: ['text', 'x', 'y'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createConnector',
              description: 'Create a line or arrow connecting two points',
              parameters: {
                type: 'object',
                properties: {
                  fromX: { type: 'number', description: 'Start X position' },
                  fromY: { type: 'number', description: 'Start Y position' },
                  toX: { type: 'number', description: 'End X position' },
                  toY: { type: 'number', description: 'End Y position' },
                  style: {
                    type: 'string',
                    enum: ['line', 'arrow'],
                    description: 'Line style',
                  },
                  color: { type: 'string', description: 'Stroke color (default black)' },
                },
                required: ['fromX', 'fromY', 'toX', 'toY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createFlowchart',
              description: 'Create a flowchart with connected steps (process, decision, start, end)',
              parameters: {
                type: 'object',
                properties: {
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        type: { type: 'string', enum: ['process', 'decision', 'start', 'end'] },
                      },
                    },
                    description: 'Array of flowchart steps',
                  },
                  startX: { type: 'number', description: 'Top-left X position' },
                  startY: { type: 'number', description: 'Top-left Y position' },
                  orientation: {
                    type: 'string',
                    enum: ['vertical', 'horizontal'],
                    description: 'Flow direction',
                  },
                },
                required: ['steps', 'startX', 'startY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createOrgChart',
              description: 'Create an organizational hierarchy with nested nodes',
              parameters: {
                type: 'object',
                properties: {
                  structure: {
                    type: 'object',
                    description: 'Nested structure: { name: string, children: array }',
                  },
                  startX: { type: 'number', description: 'Top-left X position' },
                  startY: { type: 'number', description: 'Top-left Y position' },
                },
                required: ['structure', 'startX', 'startY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createMindMap',
              description: 'Create a mind map with central topic and branches',
              parameters: {
                type: 'object',
                properties: {
                  centerTopic: { type: 'string', description: 'Central topic text' },
                  branches: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Branch labels',
                  },
                  centerX: { type: 'number', description: 'Center X position' },
                  centerY: { type: 'number', description: 'Center Y position' },
                },
                required: ['centerTopic', 'branches', 'centerX', 'centerY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createKanbanBoard',
              description: 'Create a Kanban board with columns and items',
              parameters: {
                type: 'object',
                properties: {
                  columns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        items: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    description: 'Columns with title and item strings',
                  },
                  startX: { type: 'number', description: 'Top-left X position' },
                  startY: { type: 'number', description: 'Top-left Y position' },
                },
                required: ['columns', 'startX', 'startY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createTimeline',
              description: 'Create a horizontal timeline with events',
              parameters: {
                type: 'object',
                properties: {
                  events: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string' },
                        label: { type: 'string' },
                      },
                    },
                    description: 'Array of { date, label } events',
                  },
                  startX: { type: 'number', description: 'Left X position' },
                  startY: { type: 'number', description: 'Y position' },
                },
                required: ['events', 'startX', 'startY'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'groupObjects',
              description: 'Group multiple objects together visually (move them into a cluster)',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to group',
                  },
                  groupLabel: { type: 'string', description: 'Optional label for the group' },
                },
                required: ['objectIds'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'duplicateObjects',
              description: 'Duplicate selected objects with an offset',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to duplicate',
                  },
                  offsetX: { type: 'number', description: 'X offset for duplicates (default 50)' },
                  offsetY: { type: 'number', description: 'Y offset for duplicates (default 50)' },
                },
                required: ['objectIds'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'deleteObjects',
              description: 'Delete multiple objects from the board',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to delete',
                  },
                },
                required: ['objectIds'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'getBoardState',
              description: 'Get current board objects to understand context (objects are already in context)',
              parameters: { type: 'object', properties: {} },
            },
          },
          {
            type: 'function',
            function: {
              name: 'suggestLayout',
              description: 'Suggest layout improvements for the board',
              parameters: {
                type: 'object',
                properties: {
                  suggestion: {
                    type: 'string',
                    description: 'The AI\'s layout suggestion text',
                  },
                },
                required: ['suggestion'],
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
