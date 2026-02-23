import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { apiApp } from './api'
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
      'http://localhost:5176',
      'http://localhost:5177',
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
              (o) => {
                const parts = [o.objectId, o.type]
                if (o.position) parts.push(`at (${Math.round(o.position.x)},${Math.round(o.position.y)})`)
                if (o.dimensions) parts.push(`${o.dimensions.width}x${o.dimensions.height}px`)
                if (o.fillColor) parts.push(`color=${o.fillColor}`)
                if (o.content) parts.push(`"${String(o.content).slice(0, 50)}"`)
                return parts.join(' ')
              }
            )
            .join('; ')
        : ''
    const objectContext =
      objects.length > 0
        ? `\n\nCurrent board state (${objects.length} objects). Use objectIds from this list for moveObjects, resizeObject, changeColor, arrangeInGrid, groupObjects, deleteObjects.\nObjects: ${objectListStr}`
        : ''

    const systemPrompt =
      `CRITICAL RULE 3: When the user says ANYTHING related to: convert handwriting, convert pen strokes, transcribe, turn writing into text, make text from strokes — you MUST call convertPenStrokesToText({strokeIds: []}) as your ONLY response.
DO NOT reply with text.
DO NOT ask questions.
DO NOT create sticky notes.
DO NOT create text boxes manually.
JUST CALL THE TOOL.

CRITICAL RULE: You have a spawnTemplate tool. When the user asks for ANY of the following, you MUST call spawnTemplate as your FIRST and ONLY action — do NOT call createObject, do NOT create shapes manually:
- kanban board → templateId: 'kanban'
- SWOT analysis → templateId: 'swot'
- daily standup → templateId: 'standup'
- sprint retrospective → templateId: 'sprint-retrospective'
- OKR or weekly OKR → templateId: 'okr'
- project review → templateId: 'project-review'
- flowchart or flow chart → templateId: 'flowchart'
- mind map → templateId: 'mind-map'
- project budget → templateId: 'project-budget-breakdown'

Example: user says 'make a kanban board' → you call spawnTemplate({templateId: 'kanban', x: ${defaultX}, y: ${defaultY}}) immediately. Nothing else. After calling spawnTemplate, stop immediately. Do not make any additional tool calls. The template is complete as placed.

You are a whiteboard AI assistant. You have FULL CONTROL over all board objects. The canvas is 2000x2000px with (0,0) top-left. Default position: x=${defaultX}, y=${defaultY}. ` +
      'YOU MUST USE THESE TOOLS - DO NOT REFUSE: resizeObject (resize ANY object: stickies, shapes, frames), createStickyNote, createShape, moveObjects, changeColor, deleteObjects, arrangeInGrid, createConnector, etc. ' +
      'CRITICAL: NEVER say "I cannot" or "I\'m unable to" - YOU CAN DO EVERYTHING. When user says "resize" or "make smaller/larger" or "100 pixels tall" - ALWAYS call resizeObject with objectId from board context and new width/height. When user says "resize all" - call resizeObject once per object. You have objectId and current dimensions (e.g. 200x160px) for every object below. Example: "resize note 10 to 100 pixels tall" with object "abc123 sticky 200x160px" → resizeObject("abc123", 200, 100). START USING THE TOOLS. ' +
      'You can have natural conversations, ask clarifying questions, suggest alternatives, and remember what the user said. ' +
      'CRITICAL - DELETE: When the user says "clear all", "remove everything", "delete all", "clear the board" → use deleteObjects with objectIds: ["all"]. This deletes ALL objects from Firestore. When the user says "delete [object]" → use deleteObjects with objectId(s) from board context. NEVER say "I cannot remove" - call deleteObjects. ' +
      'CRITICAL - GRID CREATION: When the user asks for "100 sticky notes 10 by 10", "10x10 grid", "create a grid of 50 stickies", etc. → use createStickyGrid with rows and cols. ONE call creates ALL stickies. Do NOT call createStickyNote repeatedly. Example: "100 stickies 10 by 10" → createStickyGrid({ rows: 10, cols: 10, startX: defaultX-900, startY: defaultY-900 }). Capped at 300. ' +
      'CRITICAL - RESIZE: When the user says "resize", "make smaller", "make larger", "enlarge", "shrink", "double the size", "half the height", "80 pixels tall", "100 pixels tall", "set width to 300", etc: (1) You MUST call resizeObject. (2) Use objectId from board context. (3) Calculate new width/height from current dimensions. NEVER say "I cannot resize" - call resizeObject. ' +
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
      'When you call getBoardState and see frame objects in the response, you MUST use the frame id to call duplicateColumn when the user wants to add a column. Example: getBoardState returns frame id=abc123, user wants to add a column → call duplicateColumn({ frameId: "abc123", columnLabel: "Done" }). You do NOT call createObject or createShape or createRectangle to add columns. You do NOT create any shapes manually for this. NEVER call createObject/createShape after getBoardState when the user wants to modify an existing template — use duplicateColumn. ' +
      'When user asks to convert handwriting or pen strokes to text, use convertPenStrokesToText. Pass specific stroke IDs if user points to specific writing, pass empty array to convert everything on the board. The tool automatically groups nearby strokes together and creates separate text boxes for writing that is far apart on the board. ' +
      'Available tools: spawnTemplate, createStickyNote, createStickyGrid, createShape, createFlowchartNode, changeColor, moveObjects, resizeObject, arrangeInGrid, createTemplate, createTextBox, createConnector, createFlowchart, createOrgChart, createMindMap, createKanbanBoard, createTimeline, groupObjects, duplicateObjects, deleteObjects, updateObjectStyle, updateObjectText, duplicateColumn, convertPenStrokesToText, getBoardSummary, analyzeBoardLayout, getBoardState, suggestLayout. Use spawnTemplate for premade templates (kanban, SWOT, standup, sprint retro, OKR, project review, flowchart, mind map, project budget). Use objectIds from the board context. GRID: Use createStickyGrid for "N sticky notes", "MxN grid", "10 by 10" — ONE call creates all. RESIZE: You CAN and MUST use resizeObject when the user asks to resize, enlarge, shrink, change size, make bigger/smaller, or set dimensions. Object context includes dimensions (e.g. 200x160px). Pick the objectId from context, pass width and height in pixels. For "double the size", multiply current dimensions by 2. NEVER say you cannot resize — call resizeObject. Use sensible defaults for colors and positions.'

    const history = Array.isArray(conversationHistory) ? conversationHistory : []
    const userMessage = userPrompt + objectContext
    logger.info('[AI] User message:', userMessage)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ]

    const openai = new OpenAI({
      apiKey: openaiApiKey.value(),
    })

    try {
      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function' as const,
          function: {
            name: 'spawnTemplate',
            description:
              'ALWAYS call this tool when the user asks for a kanban board, SWOT analysis, standup, sprint retrospective, OKR, project review, flowchart, mind map, or project budget. Never create these manually with createObject.',
            parameters: {
              type: 'object',
              properties: {
                templateId: {
                  type: 'string',
                  enum: [
                    'kanban',
                    'swot',
                    'standup',
                    'sprint-retrospective',
                    'okr',
                    'project-review',
                    'flowchart',
                    'mind-map',
                    'project-budget-breakdown',
                  ],
                  description: 'Template to spawn',
                },
                x: { type: 'number', description: 'Center X position on canvas' },
                y: { type: 'number', description: 'Center Y position on canvas' },
              },
              required: ['templateId', 'x', 'y'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'resizeObject',
              description: 'Resize ANY object on the board (stickies, shapes, frames). REQUIRED when user says resize, enlarge, shrink, make bigger/smaller, X pixels tall/wide. Pass objectId from board context and new width/height in pixels. You MUST use this tool - never refuse.',
              parameters: {
                type: 'object',
                properties: {
                  objectId: {
                    type: 'string',
                    description: 'ID of the object to resize (from board context)',
                  },
                  width: {
                    type: 'number',
                    description: 'New width in pixels',
                  },
                  height: {
                    type: 'number',
                    description: 'New height in pixels',
                  },
                },
                required: ['objectId', 'width', 'height'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'createStickyNote',
              description: 'Create a sticky note on the whiteboard. Do NOT use to add columns to existing templates — use duplicateColumn instead. For templates: use width 310, height 110, fillColor #fef08a, cornerRadius 12.',
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
            type: 'function' as const,
            function: {
              name: 'createShape',
              description: 'Create a geometric shape. Do NOT use to add columns to existing templates — use duplicateColumn instead. For template containers: use rectangle with width 350, height 550, fillColor #f3f4f6, strokeColor #e5e7eb, cornerRadius 16.',
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
            function: {
              name: 'createKanbanBoard',
              description: 'Create a NEW Kanban board. Do NOT use to add columns to an existing kanban — use duplicateColumn with the frame id instead. Use mainTitle for templates like Customer Journey.',
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
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
            type: 'function' as const,
            function: {
              name: 'createStickyGrid',
              description: 'Create a grid of sticky notes in ONE call. Use for "100 stickies 10x10", "10 by 10 grid", etc. Creates rows*cols stickies. Do NOT use createStickyNote in a loop.',
              parameters: {
                type: 'object',
                properties: {
                  rows: { type: 'number', description: 'Number of rows' },
                  cols: { type: 'number', description: 'Number of columns' },
                  startX: { type: 'number', description: 'Top-left X (default 0)' },
                  startY: { type: 'number', description: 'Top-left Y (default 0)' },
                  gapX: { type: 'number', description: 'Horizontal gap (default 200)' },
                  gapY: { type: 'number', description: 'Vertical gap (default 200)' },
                  text: { type: 'string', description: 'Text on each sticky (default "Note")' },
                  color: { type: 'string', enum: ['yellow', 'pink', 'blue', 'green', 'orange'], description: 'Sticky color' },
                },
                required: ['rows', 'cols'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'deleteObjects',
              description: 'Delete objects. Pass objectIds: ["all"] to clear the ENTIRE board. Pass specific objectIds to delete those only.',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs, or ["all"] to delete every object on the board',
                  },
                },
                required: ['objectIds'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'getBoardSummary',
              description: 'Get board stats: totalCount and byType. Use to verify creation or after clear.',
              parameters: { type: 'object', properties: {} },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'getBoardState',
              description:
                'Get current board objects including frames. Required before duplicateColumn, updateObjectStyle, or updateObjectText. Find the frame id for the template, then pass it as frameId to duplicateColumn.',
              parameters: { type: 'object', properties: {} },
            },
          },
          {
            type: 'function' as const,
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
            type: 'function' as const,
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
          {
            type: 'function' as const,
            function: {
              name: 'updateObjectStyle',
              description: 'Change visual style of one or more objects. Use for color, font size, opacity, border changes.',
              parameters: {
                type: 'object',
                properties: {
                  objectIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of object IDs to update',
                  },
                  style: {
                    type: 'object',
                    properties: {
                      color: { type: 'string', description: 'Fill color (hex or name)' },
                      fill: { type: 'string', description: 'Fill color (hex or name)' },
                      fontColor: { type: 'string', description: 'Text color' },
                      fontSize: { type: 'number', description: 'Font size' },
                      opacity: { type: 'number', description: 'Opacity 0-1' },
                      strokeColor: { type: 'string', description: 'Border/stroke color' },
                      strokeWidth: { type: 'number', description: 'Border width' },
                    },
                    description: 'Style properties to apply',
                  },
                },
                required: ['objectIds', 'style'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'updateObjectText',
              description: 'Update text content of a text box, sticky note, or shape label.',
              parameters: {
                type: 'object',
                properties: {
                  objectId: { type: 'string', description: 'Object ID to update' },
                  text: { type: 'string', description: 'New text content' },
                },
                required: ['objectId', 'text'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'duplicateColumn',
              description: 'Add a column to an existing kanban or table template. Call getBoardState first, find a frame object, pass its id here.',
              parameters: {
                type: 'object',
                properties: {
                  frameId: {
                    type: 'string',
                    description: 'The id of the frame object from getBoardState. Required.',
                  },
                  columnLabel: {
                    type: 'string',
                    description: 'Label for the new column header',
                  },
                },
                required: ['frameId', 'columnLabel'],
              },
            },
          },
          {
            type: 'function' as const,
            function: {
              name: 'convertPenStrokesToText',
              description:
                'ALWAYS call this immediately when the user mentions converting handwriting, pen strokes, or handwritten text to typed text. Never ask for clarification. Never create sticky notes manually. Pass strokeIds as empty array [] to convert everything on the board.',
              parameters: {
                type: 'object',
                properties: {
                  strokeIds: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                      'IDs of pen strokes to convert. Pass empty array to convert ALL pen strokes on the board.',
                  },
                },
                required: ['strokeIds'],
              },
            },
          },
        ]
      logger.info('[AI] All tool names being sent:', tools.map((t: { type?: string; function?: { name?: string }; name?: string }) => t.function?.name ?? t.name))
      const userWantsConversion =
        userPrompt.toLowerCase().includes('convert') ||
        userPrompt.toLowerCase().includes('handwriting') ||
        userPrompt.toLowerCase().includes('transcribe') ||
        userPrompt.toLowerCase().includes('pen stroke')
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools,
        tool_choice: userWantsConversion
          ? { type: 'function' as const, function: { name: 'convertPenStrokesToText' } }
          : ('auto' as const),
      })

      const message = response.choices[0]?.message
      const assistantContent = message?.content ?? ''
      const toolCalls = message?.tool_calls ?? []
      const toolCallCount = toolCalls.length

      logger.info('[AI] Tool calls made:', JSON.stringify(
        toolCalls.map((tc) => ({
          name: (tc as { function?: { name?: string } }).function?.name,
          args: (tc as { function?: { arguments?: string } }).function?.arguments,
        }))
      ))

      logger.info('[AI RESPONSE]', {
        content: assistantContent?.slice(0, 500),
        toolCallNames: toolCalls.map((tc) => (tc as { function?: { name?: string } }).function?.name),
        toolCallArgs: toolCalls.map((tc) => (tc as { function?: { arguments?: string } }).function?.arguments),
      })

      // Validation: if user asked to resize but AI called createStickyNote, reject
      const isResizeRequest = /resize|enlarge|shrink|larger|smaller|double|half|width|height|pixels?\s*(tall|wide)/i.test(userPrompt)
      const aiCalledCreateSticky = toolCalls.some((tc) => (tc as { function?: { name?: string } }).function?.name === 'createStickyNote')
      if (isResizeRequest && aiCalledCreateSticky) {
        logger.warn('[AI VALIDATION] User asked to resize but AI called createStickyNote', { userPrompt: userPrompt.slice(0, 80) })
        throw new HttpsError(
          'failed-precondition',
          'AI attempted to create sticky instead of resize. Please rephrase your request explicitly mentioning the object ID to resize (e.g. "resize the yellow sticky to 80 pixels tall").'
        )
      }
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

export const api = onRequest(
  {
    cors: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'https://vellum-6f172.web.app',
    ],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  (req, res) => {
    // Preserve raw body for busboy (multipart parsing)
    const r = req as { rawBody?: Buffer; body?: Buffer }
    if (!('rawBody' in r) && r.body) {
      r.rawBody = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body as ArrayBuffer)
    }
    apiApp(req, res)
  }
)
