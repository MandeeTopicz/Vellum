/**
 * Renders an emoji/sticker on the canvas.
 * Uses a transparent hit Rect because Konva Text has unreliable hit detection for emojis.
 */
import React from 'react'
import { Group, Text, Rect } from 'react-konva'
import type Konva from 'konva'
import type { EmojiObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { areShapePropsEqual } from './shared'
import { stageToCanvas } from '../../../utils/coordinates'

interface EmojiShapeProps extends BaseShapeProps {
  obj: EmojiObject
}

function EmojiShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  displayPosition,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: EmojiShapeProps) {
  const { objectId, emoji, fontSize = 32 } = obj
  const pos = displayPosition ?? obj.position
  const canInteract = canEdit && (isPointerTool || connectorToolActive) && !isSelecting && !isPenStrokeActive

  return (
    <Group
      x={pos.x}
      y={pos.y}
      listening={canInteract}
      onMouseEnter={connectorToolActive && onConnectorHover ? () => onConnectorHover(objectId) : undefined}
      onMouseLeave={connectorToolActive && onConnectorHover ? () => onConnectorHover(null) : undefined}
    >
      <Rect
        x={0}
        y={0}
        width={fontSize}
        height={fontSize}
        fill="transparent"
        listening={canInteract}
        perfectDrawEnabled={false}
        draggable={canInteract}
        onClick={
          canInteract
            ? (e: { evt: MouseEvent; target: Konva.Node }) => {
                const stage = e.target.getStage()
                const pos = stage?.getPointerPosition()
                const canvasPos = pos ? stageToCanvas(pos.x, pos.y, viewportRef.current) : undefined
                onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey, metaKey: e.evt.metaKey }, canvasPos)
              }
            : undefined
        }
        onDragStart={
          canInteract && onObjectDragStart
            ? () => onObjectDragStart()
            : undefined
        }
        onDragEnd={
          canInteract
            ? (e: { target: Konva.Node }) => {
                const node = e.target
                const absPos = node.getAbsolutePosition()
                const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
                onObjectDragEnd(objectId, canvasPos.x, canvasPos.y)
                node.position({ x: 0, y: 0 })
              }
            : undefined
        }
      />
      <Text
        text={emoji}
        fontSize={fontSize}
        listening={false}
        perfectDrawEnabled={false}
      />
      {selected && isPointerTool && (
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

export const EmojiShape = React.memo(EmojiShapeInner, areShapePropsEqual)
