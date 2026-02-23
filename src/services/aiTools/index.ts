/**
 * AI tools: exports all tool handlers and shared utilities.
 */
export { toContextObject } from './shared'
export type { ToolExecutionContext, ToolHandler } from './types'

import { executeCreateStickyNote, executeCreateShape, executeCreateTextBox } from './createObject'
import { executeChangeColor, executeMoveObjects, executeArrangeInGrid, executeGroupObjects, executeResizeObject } from './updateObject'
import { executeDeleteObjects } from './deleteObject'
import { executeCreateConnector } from './createConnector'
import { executeCreateTemplate } from './createTemplate'
import { executeGetBoardState, executeSuggestLayout, executeAnalyzeBoardLayout } from './analyzeBoardTool'
import { executeGetBoardSummary } from './getBoardSummary'
import { executeCreateFlowchartNode } from './createFlowchartNode'
import { executeCreateFlowchart } from './createFlowchart'
import { executeCreateOrgChart } from './createOrgChart'
import { executeCreateMindMap } from './createMindMap'
import { executeCreateKanbanBoard } from './createKanbanBoard'
import { executeCreateTimeline } from './createTimeline'
import { executeCreateStickyGrid } from './createStickyGrid'
import { executeSpawnTemplate } from './spawnTemplate'

export { executeCreateKanbanBoard, executeCreateFlowchart, executeCreateMindMap, executeCreateTimeline, executeCreateStickyGrid, executeSpawnTemplate }
import { executeDuplicateObjects } from './duplicateObjects'
import { executeUpdateObjectStyle, executeUpdateObjectText } from './updateObjectModify'
import { executeDuplicateColumn } from './duplicateColumn'
import { executeConvertPenStrokesToText } from './convertPenStrokesToText'
import type { ToolHandler } from './types'

/** Map of tool name to handler */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  createStickyNote: executeCreateStickyNote,
  createShape: executeCreateShape,
  createTextBox: executeCreateTextBox,
  changeColor: executeChangeColor,
  moveObjects: executeMoveObjects,
  resizeObject: executeResizeObject,
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
  createStickyGrid: executeCreateStickyGrid,
  spawnTemplate: executeSpawnTemplate,
  duplicateObjects: executeDuplicateObjects,
  getBoardState: executeGetBoardState,
  getBoardSummary: executeGetBoardSummary,
  suggestLayout: executeSuggestLayout,
  analyzeBoardLayout: executeAnalyzeBoardLayout,
  updateObjectStyle: executeUpdateObjectStyle,
  updateObjectText: executeUpdateObjectText,
  duplicateColumn: executeDuplicateColumn,
  convertPenStrokesToText: executeConvertPenStrokesToText,
}
