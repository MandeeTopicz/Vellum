/**
 * AI tool: createStickyNote, createShape, createTextBox.
 */
import { createObject } from '../objects'
import { DEFAULT_STICKY_SIZE, DEFAULT_SHAPE_SIZE, DEFAULT_LINE_LENGTH, type BoardObjectType } from '../../types/objects'
import { DEFAULT_TEXT_STYLE } from '../../types'
import { resolveColor, STICKY_COLORS } from './shared'
import type { ToolExecutionContext } from './types'

/** createStickyNote */
export async function executeCreateStickyNote(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const text: string = String(args.text ?? '')
  const x: number = typeof args.x === 'number' ? args.x : 500
  const y: number = typeof args.y === 'number' ? args.y : 500
  const width = typeof args.width === 'number' ? args.width : DEFAULT_STICKY_SIZE.width
  const height = typeof args.height === 'number' ? args.height : DEFAULT_STICKY_SIZE.height
  const fillColor =
    typeof args.fillColor === 'string'
      ? (resolveColor(args.fillColor, '#fef08a') ?? args.fillColor)
      : STICKY_COLORS[String(args.color ?? 'yellow')] ?? STICKY_COLORS.yellow
  const cornerRadius = typeof args.cornerRadius === 'number' ? args.cornerRadius : 12
  const textAlign: 'left' | 'center' | 'right' = args.alignment === 'center' || args.alignment === 'right' ? args.alignment : 'left'
  const fontSize = typeof args.fontSize === 'number' ? args.fontSize : DEFAULT_TEXT_STYLE.fontSize
  const isBold = args.isBold === true

  const createInput = {
    type: 'sticky' as const,
    position: { x, y },
    dimensions: { width, height },
    content: text,
    fillColor,
    cornerRadius,
    textStyle: { ...DEFAULT_TEXT_STYLE, textAlign, fontSize, bold: isBold },
  }
  const objectId = await createObject(boardId, createInput)
  createdItems.push({ objectId, createInput })
  actions.push(`Created sticky at (${x}, ${y}): "${text}"`)
}

/** createShape */
export async function executeCreateShape(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const shapeType = (args.shapeType ?? 'rectangle') as BoardObjectType
  const x: number = typeof args.x === 'number' ? args.x : 500
  const y: number = typeof args.y === 'number' ? args.y : 500
  const w = typeof args.width === 'number' ? args.width : DEFAULT_SHAPE_SIZE.width
  const h = typeof args.height === 'number' ? args.height : DEFAULT_SHAPE_SIZE.height
  const fillColor =
    typeof args.fillColor === 'string' ? (resolveColor(args.fillColor, 'transparent') ?? args.fillColor) : 'transparent'
  const strokeColor =
    typeof args.strokeColor === 'string'
      ? (resolveColor(args.strokeColor, '#000000') ?? args.strokeColor)
      : resolveColor(args.color as string | undefined, '#000000')
  const cornerRadius = typeof args.cornerRadius === 'number' ? args.cornerRadius : 12
  const useTopLeft = typeof args.width === 'number' || typeof args.height === 'number'
  const pos = useTopLeft ? { x, y } : { x: x - w / 2, y: y - h / 2 }

  type ShapeCreateInput = Parameters<typeof createObject>[1]
  let createInput: ShapeCreateInput
  if (shapeType === 'line') {
    createInput = {
      type: 'line',
      start: { x: x - DEFAULT_LINE_LENGTH / 2, y },
      end: { x: x + DEFAULT_LINE_LENGTH / 2, y },
      strokeColor,
      strokeWidth: 2,
    }
  } else if (['rectangle', 'circle', 'triangle', 'diamond', 'star', 'pentagon', 'hexagon', 'octagon', 'arrow'].includes(shapeType)) {
    const shape = shapeType as 'rectangle' | 'circle' | 'triangle' | 'diamond' | 'star' | 'pentagon' | 'hexagon' | 'octagon' | 'arrow'
    createInput = {
      type: shape,
      position: pos,
      dimensions: { width: w, height: h },
      fillColor,
      strokeColor,
      strokeWidth: 2,
      ...(shape === 'rectangle' && { cornerRadius }),
    }
  } else {
    createInput = {
      type: 'rectangle',
      position: pos,
      dimensions: { width: w, height: h },
      fillColor,
      strokeColor,
      strokeWidth: 2,
      cornerRadius,
    }
  }
  const objectId = await createObject(boardId, createInput)
  createdItems.push({ objectId, createInput })
  actions.push(`Created ${shapeType} at (${x}, ${y})`)
}

/** createTextBox */
export async function executeCreateTextBox(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, createdItems, actions } = ctx
  const text: string = String(args.text ?? '')
  const x: number = typeof args.x === 'number' ? args.x : 500
  const y: number = typeof args.y === 'number' ? args.y : 500
  const width = typeof args.width === 'number' ? args.width : 200
  const height = typeof args.height === 'number' ? args.height : 60
  const fontSize = typeof args.fontSize === 'number' ? args.fontSize : 16
  const fontColor = resolveColor(args.color as string | undefined, '#1a1a1a')
  const isBold = args.isBold === true
  const textAlign: 'left' | 'center' | 'right' =
    args.alignment === 'center' || args.alignment === 'right' || args.alignment === 'left'
      ? args.alignment
      : fontSize >= 24 || (isBold && text.length < 50)
        ? 'center'
        : 'left'
  const textStyle = { ...DEFAULT_TEXT_STYLE, fontSize, fontColor, bold: isBold, textAlign }
  const createInput = {
    type: 'text' as const,
    position: { x, y },
    dimensions: { width, height },
    content: text,
    textStyle,
  }
  const objectId = await createObject(boardId, createInput)
  createdItems.push({ objectId, createInput })
  actions.push(`Created text box at (${x}, ${y})`)
}
