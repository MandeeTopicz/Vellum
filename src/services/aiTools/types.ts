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
}

export type ToolHandler = (ctx: ToolExecutionContext) => Promise<void>
