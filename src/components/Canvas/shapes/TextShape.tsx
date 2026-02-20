/**
 * Renders a text box on the canvas with formatting support.
 */
import { useRef } from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TextObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
} from './shared'

export interface TextShapeProps extends BaseShapeProps {
  obj: TextObject
  onTextDoubleClick: (objectId: string) => void
}

export function TextShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  onTextDoubleClick,
}: TextShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  const { objectId, position, dimensions, content, textStyle } = obj
  const fontSize = textStyle?.fontSize ?? 16

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const handleTransformEnd = () => {
    if (!onObjectResizeEnd || !groupRef.current) return
    const node = groupRef.current
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const rect = node.findOne('Rect')
    if (rect) {
      const w = Math.max(MIN_SIZE, rect.width() * scaleX)
      const h = Math.max(MIN_SIZE, rect.height() * scaleY)
      rect.width(w)
      rect.height(h)
      const text = node.findOne('Text')
      if (text) {
        text.width(w - 8)
        text.height(h - 8)
      }
      onObjectResizeEnd(objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  const handlers = shapeHandlers(
    objectId,
    viewport,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool
  )

  const displayText =
    textStyle?.bulletList && content
      ? content
          .split('\n')
          .map((line) => (line.trim() ? `• ${line.trim()}` : ''))
          .filter(Boolean)
          .join('\n')
      : content || ''

  return (
    <>
      <Group
        ref={groupRef}
        x={position.x}
        y={position.y}
        {...handlers}
        onDblClick={canEdit ? () => onTextDoubleClick(objectId) : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          stroke={selected ? '#8093F1' : 'transparent'}
          strokeWidth={selected ? 3 : 1}
          perfectDrawEnabled={false}
        />
        <Text
          x={4}
          y={4}
          width={dimensions.width - 8}
          height={dimensions.height - 8}
          text={displayText}
          fontSize={fontSize}
          fontFamily={textStyle?.fontFamily ?? 'Arial'}
          fontStyle={
            textStyle?.bold && textStyle?.italic
              ? 'bold italic'
              : textStyle?.bold
                ? 'bold'
                : textStyle?.italic
                  ? 'italic'
                  : 'normal'
          }
          fill={content ? (textStyle?.fontColor ?? '#1a1a1a') : '#9ca3af'}
          align={textStyle?.textAlign ?? 'left'}
          verticalAlign="top"
          padding={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}
