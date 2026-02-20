import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
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

    const startTime = Date.now()
    const { boardId, userPrompt, viewportCenter, objects: boardObjects, conversationHistory } = request.data as {
      boardId: string
      userPrompt: string
      objects?: Array<{
        objectId: string
        type: string
        content?: string
        position?: { x: number; y: number }
        fillColor?: string
        dimensions?: { width: number; height: number }
      }>
      viewportCenter?: { x: number; y: number }
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!boardId || typeof userPrompt !== 'string') {
      logger.error('[AI ERROR] Invalid args', { boardId: !!boardId, hasUserPrompt: typeof userPrompt === 'string' })
      throw new HttpsError('invalid-argument', 'boardId and userPrompt required')
    }

    const objects = Array.isArray(boardObjects) ? boardObjects : []
    logger.info('[AI REQUEST]', {
      boardId,
      promptLength: userPrompt.length,
      objectCount: objects.length,
      timestamp: new Date().toISOString(),
    })

    const defaultX = Math.round(viewportCenter?.x ?? 1000)
    const defaultY = Math.round(viewportCenter?.y ?? 1000)
    const objectListStr =
      objects.length > 0
        ? objects
            .map(
              (o) =>
                `${o.objectId} ${o.type}${o.position ? ` at (${Math.round(o.position.x)},${Math.round(o.position.y)})` : ''}${o.fillColor ? ` color=${o.fillColor}` : ''}${o.content ? ` "${String(o.content).slice(0, 50)}"` : ''}`
            )
            .join('; ')
        : ''
    const objectContext =
      objects.length > 0
        ? `\n\nCurrent board state (${objects.length} objects). When user agrees to organize or improve, call arrangeInGrid, groupObjects, or moveObjects with these objectIds. All objectIds must come from this list.\nObjects: ${objectListStr}`
        : ''

    const systemPrompt =
      `You are an expert design assistant for collaborative whiteboards. The canvas is 2000x2000px with (0,0) top-left and (2000,2000) bottom-right. Default position: x=${defaultX}, y=${defaultY}. ` +
      'You can have natural conversations, ask clarifying questions, suggest alternatives, and remember what the user said. ' +
      'CRITICAL - ACKNOWLEDGMENTS: When the user says "Thank you", "Thanks", "Perfect", "Great", "Awesome", "Nice", "Good", "Looks good", "Love it", "Okay", "Ok", "Got it", "Cool", or similar praise/acknowledgment, DO NOT call any tools. Respond conversationally only (e.g. "You\'re welcome!", "Glad I could help!"). Do NOT delete, create, move, or modify anything. These are NOT action requests. If unsure, treat it as an acknowledgment. ' +
      'When the user asks "how does my board look?", "analyze this layout", or "what improvements do you suggest?", use analyzeBoardLayout. Look for: scattered objects that could be grouped; similar-colored items; lack of structure; overlapping areas; unused space; objects that could be connected. Offer to implement improvements. ' +
      'CRITICAL: When the user agrees to improvements (e.g. "yes", "organize them", "do it", "go ahead", "please"), you MUST call the action tools. Do NOT just describe what to do — actually execute. Use arrangeInGrid, groupObjects, moveObjects, createConnector with objectIds from the board context. ' +
      'FLOWCHART CREATION: When the user requests a flowchart with SPECIFIC SHAPES (cylinders, diamonds, rectangles, parallelograms, etc.): DO NOT use createTemplate or createFlowchart (those create sticky notes). Use createFlowchartNode to create each shape with the exact type requested, then createConnector to link them. Shape types: rectangle, diamond, cylinder-vertical, cylinder-horizontal, parallelogram-right, tab-shape, circle, trapezoid. Example: "Create a flowchart with 5 horizontal cylinders" → call createFlowchartNode 5 times with shapeType cylinder-horizontal, then createConnector between them. ' +
      'CIRCULAR FLOWCHART: When the user asks for a "circular flowchart" or "flowchart in a circle" with N elements (e.g. "Create a circular flowchart with 20 elements"): (1) Call createFlowchartNode exactly N times with shapeType rectangle (or requested type). Place nodes in a circle: center (e.g. defaultX, defaultY), radius ~300–400. For node i of N: angle = (i / N) * 2 * Math.PI - Math.PI/2 (start from top); x = centerX + radius*cos(angle); y = centerY + radius*sin(angle). Use width 100, height 50, text "Step 1", "Step 2", etc. (2) Then call createConnector N times: from each node center to the next node center (and last to first to close the circle). Compute fromX, fromY, toX, toY from the same circle math (center of each node). Use style "arrow". This produces a closed circular flowchart. ' +
      'createTemplate is ONLY for sticky-note templates: SWOT, retrospective, journeyMap, Kanban. Do NOT use createTemplate for flowcharts with specific shapes. ' +
      'TEMPLATE GENERATION FROM PROMPTS: When the user provides a template description (e.g. "Create a complete template for: ..." or "Customer Journey with two columns"), create a COMPLETE, STRUCTURED template. For multi-column layouts (Customer Journey, Kanban, etc.): prefer createKanbanBoard with mainTitle — it automatically centers the main title and column headers. Example: "Customer Journey" with columns "Touchpoints" and "Actions" → createKanbanBoard({ mainTitle: "Customer Journey", columns: [{ title: "Touchpoints", items: [...] }, { title: "Actions", items: [...] }], startX, startY }). (1) Analyze the request and determine best layout; (2) Create appropriate sections/columns; (3) Add example content; (4) Use proper shapes; (5) Position elements in an organized layout; (6) Add helpful example text. Always create a COMPLETE, USABLE template. ' +
      'TEMPLATE STYLING RULES: Use rounded corners (cornerRadius 12-16), smart sizing, and coordinated colors. MAIN TITLE: text at top center, width 300, height 60, fontSize 28, bold, alignment center. SECTION CONTAINERS: rectangles, width 350, height 550, fillColor #f3f4f6, strokeColor #e5e7eb, cornerRadius 16. SECTION HEADERS (column titles): sticky tiles width 310, height 40, fontSize 20-22, bold, alignment center — center the column title text within its tile. CONTENT CARDS: sticky notes, width 310, height 100-110, fillColor #fef08a (yellow for sprint/Kanban), cornerRadius 12, 12px gap, alignment left. Sprint/Kanban: yellow (#fef08a) cards. Roadmaps: blue (#bfdbfe) milestones. Retrospectives: mix #fef08a, #fbcfe8, #bbf7d0. Brainstorming: #e9d5ff, #fbcfe8. Position containers with 40px gaps. Headers small (40px height), content boxes large (100-110px height). ' +
      'MAIN TITLE POSITIONING: For multi-column templates (Kanban, Customer Journey, etc.), the main title MUST be centered above the columns. Formula: totalLayoutWidth = numColumns * columnWidth + (numColumns-1) * gapBetweenColumns; layoutCenterX = startX + totalLayoutWidth/2; titleX = layoutCenterX - (titleWidth/2). Example: 2 columns, startX=500, columnWidth=350, gap=40 → totalWidth=740, centerX=870, titleWidth=300 → titleX=720. Never place the main title at startX or aligned with the first column only — always center it. ' +
      'TEXT ALIGNMENT RULES: TITLES (main headers like "Customer Journey"): alignment center, fontSize 24-32, bold. Section headers (column names): alignment center, fontSize 20-22, bold — centered in their sticky tiles. Content cards: alignment left, fontSize 14-16. When calling createTextBox for main title, always pass alignment: "center" and position x using the centering formula. For createStickyNote used as column header, pass alignment: "center" and fontSize: 20 or 22. For content cards, use alignment "left". ' +
      'Available tools: createStickyNote, createShape, createFlowchartNode, changeColor, moveObjects, arrangeInGrid, createTemplate, createTextBox, createConnector, createFlowchart, createOrgChart, createMindMap, createKanbanBoard, createTimeline, groupObjects, duplicateObjects, deleteObjects, analyzeBoardLayout, getBoardState, suggestLayout. Use objectIds from the board context. Use sensible defaults for colors and positions.'

    const history = Array.isArray(conversationHistory) ? conversationHistory : []
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userPrompt + objectContext },
    ]

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    })

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'createStickyNote',
              description: 'Create a sticky note on the whiteboard. For templates: use width 310, height 110, fillColor #fef08a, cornerRadius 12.',
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
                  width: { type: 'number', description: 'Width (default 200, use 310 for template cards)' },
                  height: { type: 'number', description: 'Height (default 160, use 110 for template cards)' },
                  fillColor: { type: 'string', description: 'Hex fill color (e.g. #fef08a for yellow)' },
                  cornerRadius: { type: 'number', description: 'Rounded corner radius (default 12)' },
                  alignment: {
                    type: 'string',
                    enum: ['left', 'center', 'right'],
                    description: 'Text alignment. Use "center" for column headers (so titles are centered in their tiles), "left" for content cards.',
                  },
                  fontSize: { type: 'number', description: 'Font size (default 14). Use 20-22 for column headers.' },
                  isBold: { type: 'boolean', description: 'Bold text (true for column headers)' },
                },
                required: ['text', 'x', 'y'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createShape',
              description: 'Create a geometric shape. For template containers: use rectangle with width 350, height 550, fillColor #f3f4f6, strokeColor #e5e7eb, cornerRadius 16.',
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
                    description: 'Fill color name or hex code',
                  },
                  width: { type: 'number', description: 'Width (default 120, use 350 for template containers)' },
                  height: { type: 'number', description: 'Height (default 80, use 550 for template containers)' },
                  fillColor: { type: 'string', description: 'Hex fill (e.g. #f3f4f6 for light gray containers)' },
                  strokeColor: { type: 'string', description: 'Hex stroke (e.g. #e5e7eb)' },
                  cornerRadius: { type: 'number', description: 'Rounded corner radius (default 12, use 16 for containers)' },
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
              description: 'Create templates using STICKY NOTES ONLY: SWOT (2x2), retrospective (4 columns), journey map (horizontal steps), Kanban. DO NOT use for flowcharts with specific shapes (cylinders, diamonds, etc.) — use createFlowchartNode instead.',
              parameters: {
                type: 'object',
                properties: {
                  templateType: {
                    type: 'string',
                    enum: ['swot', 'retrospective', 'journeyMap'],
                    description: 'Template type — these use sticky notes only',
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
              description: 'Create a standalone text box. For main titles: use alignment center, fontSize 24-32, isBold true, width 300, height 60.',
              parameters: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text content' },
                  x: { type: 'number', description: 'X position on the canvas' },
                  y: { type: 'number', description: 'Y position on the canvas' },
                  fontSize: { type: 'number', description: 'Font size (default 16, use 24-32 for titles)' },
                  color: { type: 'string', description: 'Text color (hex or name)' },
                  width: { type: 'number', description: 'Width (default 200, use 300 for titles)' },
                  height: { type: 'number', description: 'Height (default 60)' },
                  isBold: { type: 'boolean', description: 'Bold text (true for titles)' },
                  alignment: {
                    type: 'string',
                    enum: ['left', 'center', 'right'],
                    description: 'Text alignment. Use "center" for main titles, "left" for section headers and content',
                  },
                },
                required: ['text', 'x', 'y'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createConnector',
              description: 'Create a line or arrow connecting two points or between flowchart nodes',
              parameters: {
                type: 'object',
                properties: {
                  fromX: { type: 'number', description: 'Start X position (or center of fromObjectId)' },
                  fromY: { type: 'number', description: 'Start Y position' },
                  toX: { type: 'number', description: 'End X position' },
                  toY: { type: 'number', description: 'End Y position' },
                  style: {
                    type: 'string',
                    enum: ['line', 'arrow'],
                    description: 'Line style (arrow draws arrowhead at end)',
                  },
                  arrowType: {
                    type: 'string',
                    enum: ['straight', 'curved', 'elbow'],
                    description: 'For arrows: straight line, curved bezier, or elbow (default straight)',
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
              name: 'createFlowchartNode',
              description: 'Create a single flowchart node with a specific shape type. Use for flowcharts with cylinders, diamonds, parallelograms, etc. Call multiple times then createConnector to link them.',
              parameters: {
                type: 'object',
                properties: {
                  shapeType: {
                    type: 'string',
                    enum: ['rectangle', 'diamond', 'cylinder-vertical', 'cylinder-horizontal', 'parallelogram-right', 'parallelogram-left', 'tab-shape', 'circle', 'trapezoid'],
                    description: 'The shape type for this flowchart node',
                  },
                  x: { type: 'number', description: 'X position (top-left of shape)' },
                  y: { type: 'number', description: 'Y position (top-left of shape)' },
                  text: { type: 'string', description: 'Text label for this node' },
                  width: { type: 'number', description: 'Width of the shape (default 120)' },
                  height: { type: 'number', description: 'Height of the shape (default 80)' },
                },
                required: ['shapeType', 'x', 'y', 'text'],
              },
            },
          },
          {
            type: 'function',
            function: {
              name: 'createFlowchart',
              description: 'Create a flowchart with connected steps using sticky notes (generic flowcharts). For flowcharts with specific shapes like cylinders or diamonds, use createFlowchartNode instead.',
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
              description: 'Create an organizational hierarchy: CEO at top, departments below. Pass structure: { name: "CEO", children: [{ name: "Engineering" }, { name: "Sales" }, { name: "Marketing" }] }. Children can also be strings.',
              parameters: {
                type: 'object',
                properties: {
                  structure: {
                    type: 'object',
                    description: 'Org structure: { name: "CEO", children: [{ name: "Dept1" }, { name: "Dept2" }] } or children as string array',
                    properties: {
                      name: { type: 'string', description: 'CEO/root name' },
                      children: {
                        type: 'array',
                        items: {
                          oneOf: [
                            { type: 'object', properties: { name: { type: 'string' } } },
                            { type: 'string' },
                          ],
                        },
                      },
                    },
                    required: ['name', 'children'],
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
              description: 'Create a Kanban board with columns and items. Use mainTitle for templates like Customer Journey — it will be centered above the columns. Column headers are centered in their tiles with larger font.',
              parameters: {
                type: 'object',
                properties: {
                  mainTitle: { type: 'string', description: 'Optional main title (e.g. "Customer Journey") — centered above all columns. Use for multi-column templates.' },
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
          {
            type: 'function',
            function: {
              name: 'analyzeBoardLayout',
              description: 'Analyze the current board state and provide suggestions for improvement. Use when the user asks how the board looks, to analyze layout, or for improvement suggestions.',
              parameters: {
                type: 'object',
                properties: {
                  analysis: {
                    type: 'string',
                    description: 'Detailed analysis of the board layout with specific observations (positions, colors, grouping, structure) and actionable suggestions',
                  },
                  suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of actionable improvement suggestions (e.g. "Arrange yellow stickies in a column", "Group the pink stickies")',
                  },
                },
                required: ['analysis', 'suggestions'],
              },
            },
          },
        ],
        tool_choice: 'auto',
      })

      const message = response.choices[0]?.message
      const assistantContent = message?.content ?? ''
      const toolCalls = message?.tool_calls ?? []
      const toolCallCount = toolCalls.length
      const duration = Date.now() - startTime
      const usage = response.usage
      const finishReason = response.choices[0]?.finish_reason ?? 'unknown'

      logger.info('[AI SUCCESS]', {
        boardId,
        duration: `${duration}ms`,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        toolCallCount,
        stopReason: finishReason,
      })

      const updatedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...history,
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: assistantContent },
      ]

      return {
        success: true,
        toolCalls,
        content: message?.content ?? null,
        updatedHistory,
      }
    } catch (err: unknown) {
      const duration = Date.now() - startTime
      const errorObj = err as { type?: string; message?: string }
      const msg = err instanceof Error ? err.message : String(err)

      logger.error('[AI ERROR]', {
        boardId,
        duration: `${duration}ms`,
        errorType: errorObj.type ?? 'unknown',
        errorMessage: msg,
        prompt: userPrompt.substring(0, 100),
      })

      throw new HttpsError('internal', msg)
    }
  }
)
