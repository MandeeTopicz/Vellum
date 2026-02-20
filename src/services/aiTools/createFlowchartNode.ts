/**
 * AI tool: createFlowchartNode.
 */
import { createObject } from '../objects'
import type { ToolExecutionContext } from './types'

const baseStyle = { fillColor: 'transparent' as const, strokeColor: '#000000' as const, strokeWidth: 2 as const }

/** createFlowchartNode */
export async function executeCreateFlowchartNode(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const shapeType = (args.shapeType ?? 'rectangle') as string
  const x = typeof args.x === 'number' ? args.x : 500
  const y = typeof args.y === 'number' ? args.y : 500
  const w = typeof args.width === 'number' ? args.width : 120
  const h = typeof args.height === 'number' ? args.height : 80
  const text = (args.text ?? '') as string

  let createInput: Parameters<typeof createObject>[1]
  if (shapeType === 'cylinder-vertical') {
    createInput = { type: 'cylinder', position: { x, y }, dimensions: { width: w, height: h }, shapeKind: 'vertical', ...baseStyle }
  } else if (shapeType === 'cylinder-horizontal') {
    createInput = { type: 'cylinder', position: { x, y }, dimensions: { width: w, height: h }, shapeKind: 'horizontal', ...baseStyle }
  } else if (shapeType === 'parallelogram-right') {
    createInput = { type: 'parallelogram', position: { x, y }, dimensions: { width: w, height: h }, shapeKind: 'right', ...baseStyle }
  } else if (shapeType === 'parallelogram-left') {
    createInput = { type: 'parallelogram', position: { x, y }, dimensions: { width: w, height: h }, shapeKind: 'left', ...baseStyle }
  } else if (['rectangle', 'diamond', 'circle', 'tab-shape', 'trapezoid'].includes(shapeType)) {
    createInput = { type: shapeType as 'rectangle' | 'diamond' | 'circle' | 'tab-shape' | 'trapezoid', position: { x, y }, dimensions: { width: w, height: h }, ...baseStyle }
  } else {
    createInput = { type: 'rectangle', position: { x, y }, dimensions: { width: w, height: h }, ...baseStyle }
  }

  const objectId = await createObject(boardId, createInput)
  createdItems.push({ objectId, createInput })

  if (text) {
    const textW = Math.min(140, w - 16)
    const textH = 30
    const textX = x + (w - textW) / 2
    const textY = y + (h - textH) / 2
    const textInput = { type: 'text' as const, position: { x: textX, y: textY }, dimensions: { width: textW, height: textH }, content: text }
    const textId = await createObject(boardId, textInput)
    createdItems.push({ objectId: textId, createInput: textInput })
  }
  actions.push(`Created ${shapeType} node${text ? `: "${text}"` : ''}`)
}
