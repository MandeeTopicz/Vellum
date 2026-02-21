/**
 * Renders an emoji/sticker on the canvas.
 */
import { Group, Text, Rect } from 'react-konva'
import type { EmojiObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { shapeHandlers } from './shared'

interface EmojiShapeProps extends BaseShapeProps {
  obj: EmojiObject
}

export function EmojiShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  displayPosition,
}: EmojiShapeProps) {
  const { objectId, emoji, fontSize = 32 } = obj
  const pos = displayPosition ?? obj.position
  const handlers = shapeHandlers(
    objectId,
    viewport,
    canEdit,
    selected,
    onObjectDragEnd,
    onObjectClick,
    isPointerTool
  )
  return (
    <Group x={pos.x} y={pos.y} {...handlers}>
      <Text
        text={emoji}
        fontSize={fontSize}
        listening={false}
        perfectDrawEnabled={false}
      />
      {selected && (
        <Rect
          x={-4}
          y={-4}
          width={fontSize + 8}
          height={fontSize + 8}
          stroke="#8093F1"
          strokeWidth={2}
          fill="transparent"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
}
