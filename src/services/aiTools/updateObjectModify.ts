/**
 * AI tools: updateObjectStyle, updateObjectText.
 * Modify existing board objects without distorting layout.
 */
import { updateObject } from '../objects'
import { resolveColor } from './shared'
import type { ToolExecutionContext } from './types'

/**
 * Change visual style of one or more objects.
 * Maps AI style params to ObjectUpdates.
 */
export async function executeUpdateObjectStyle(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectIds = Array.isArray(args.objectIds) ? (args.objectIds as string[]) : []
  const style = (args.style ?? {}) as Record<string, unknown>
  if (objectIds.length === 0) return

  const updates: Record<string, unknown> = {}
  const textStyleUpdates: Record<string, unknown> = {}
  if (style.color != null || style.fill != null) {
    const hex = resolveColor(String(style.color ?? style.fill ?? ''), '#3b82f6')
    updates.fillColor = hex
  }
  if (style.fontColor != null) {
    textStyleUpdates.fontColor = resolveColor(String(style.fontColor), '#1a1a1a')
  }
  if (typeof style.fontSize === 'number') {
    textStyleUpdates.fontSize = style.fontSize
  }
  if (Object.keys(textStyleUpdates).length > 0) {
    updates.textStyle = textStyleUpdates
  }
  if (typeof style.opacity === 'number') {
    updates.opacity = Math.max(0, Math.min(1, style.opacity))
  }
  if (style.strokeColor != null) {
    updates.strokeColor = resolveColor(String(style.strokeColor), '#000000')
  }
  if (typeof style.strokeWidth === 'number') {
    updates.strokeWidth = Math.max(0, style.strokeWidth)
  }

  if (Object.keys(updates).length === 0) {
    actions.push('No valid style properties provided')
    return
  }

  for (const objectId of objectIds) {
    const obj = objectsMap.get(objectId)
    if (!obj) continue
    const toApply: Record<string, unknown> = { ...updates }
    if (toApply.textStyle != null && 'textStyle' in obj) {
      const existing = (obj as unknown as { textStyle?: Record<string, unknown> }).textStyle ?? {}
      toApply.textStyle = { ...existing, ...(toApply.textStyle as Record<string, unknown>) }
    }
    await updateObject(boardId, objectId, toApply as Parameters<typeof updateObject>[2])
  }
  actions.push(`Updated style of ${objectIds.length} object(s)`)
}

/**
 * Update text content of a text box, sticky note, or shape label.
 */
export async function executeUpdateObjectText(ctx: ToolExecutionContext): Promise<void> {
  const { boardId, args, objectsMap, actions } = ctx
  const objectId = String(args.objectId ?? '')
  const text = String(args.text ?? '')
  if (!objectId || text === '') {
    actions.push('objectId and text are required')
    return
  }

  const obj = objectsMap.get(objectId)
  if (!obj) {
    actions.push(`Object ${objectId} not found`)
    return
  }
  if (!('content' in obj)) {
    actions.push(`Object ${objectId} does not support text content`)
    return
  }

  await updateObject(boardId, objectId, { content: text })
  actions.push(`Updated text of object ${objectId}`)
}
