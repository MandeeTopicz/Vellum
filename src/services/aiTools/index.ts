/**
 * AI tools: exports all tool handlers and shared utilities.
 */
export { toContextObject } from './shared'
export type { ToolExecutionContext, ToolHandler } from './types'

import { executeCreateStickyNote, executeCreateShape, executeCreateTextBox } from './createObject'
import { executeChangeColor, executeMoveObjects, executeArrangeInGrid, executeGroupObjects } from './updateObject'
import { executeDeleteObjects } from './deleteObject'
import { executeCreateConnector } from './createConnector'
import { executeCreateTemplate } from './createTemplate'
import { executeGetBoardState, executeSuggestLayout, executeAnalyzeBoardLayout } from './analyzeBoardTool'
import { executeCreateFlowchartNode } from './createFlowchartNode'
import { executeCreateFlowchart } from './createFlowchart'
import { executeCreateOrgChart } from './createOrgChart'
import { executeCreateMindMap } from './createMindMap'
import { executeCreateKanbanBoard } from './createKanbanBoard'
import { executeCreateTimeline } from './createTimeline'
import { executeDuplicateObjects } from './duplicateObjects'
import type { ToolHandler } from './types'

/** Map of tool name to handler */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  createStickyNote: executeCreateStickyNote,
  createShape: executeCreateShape,
  createTextBox: executeCreateTextBox,
  changeColor: executeChangeColor,
  moveObjects: executeMoveObjects,
  arrangeInGrid: executeArrangeInGrid,
  groupObjects: executeGroupObjects,
  deleteObjects: executeDeleteObjects,
  createConnector: executeCreateConnector,
  createTemplate: executeCreateTemplate,
  createFlowchartNode: executeCreateFlowchartNode,
  createFlowchart: executeCreateFlowchart,
  createOrgChart: executeCreateOrgChart,
  createMindMap: executeCreateMindMap,
  createKanbanBoard: executeCreateKanbanBoard,
  createTimeline: executeCreateTimeline,
  duplicateObjects: executeDuplicateObjects,
  getBoardState: executeGetBoardState,
  suggestLayout: executeSuggestLayout,
  analyzeBoardLayout: executeAnalyzeBoardLayout,
}
