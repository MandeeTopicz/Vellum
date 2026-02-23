/**
 * Types for AI tool execution.
 */
import type { CreateObjectInput } from '../objects'
import type { BoardObject } from '../../types'

export interface ToolExecutionContext {
  boardId: string
  args: Record<string, unknown>
  objectsMap: Map<string, BoardObject>
  objectsList: BoardObject[]
  createdItems: { objectId: string; createInput: CreateObjectInput }[]
  actions: string[]
  /** Viewport center in canvas coords; used for non-overlapping placement */
  viewportCenter?: { x: number; y: number }
  /** When true, skip wrapping createdItems in a frame (e.g. spawnTemplate already provides a frame) */
  skipWrap?: boolean
}

export type ToolHandler = (ctx: ToolExecutionContext) => Promise<void>
