import { Group, Rect, Text } from 'react-konva'
import type { ObjectsMap, StickyObject, RectangleObject } from '../../types'

interface ObjectLayerProps {
  objects: ObjectsMap
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onStickyDoubleClick: (objectId: string) => void
  canEdit: boolean
}

export default function ObjectLayer({
  objects,
  onObjectDragEnd,
  onStickyDoubleClick,
  canEdit,
}: ObjectLayerProps) {
  const objectList = Object.values(objects)

  return (
    <Group>
      {objectList.map((obj) => {
        if (obj.type === 'sticky') {
          return (
            <StickyShape
              key={obj.objectId}
              obj={obj}
              canEdit={canEdit}
              onDragEnd={(x, y) => onObjectDragEnd(obj.objectId, x, y)}
              onDoubleClick={() => onStickyDoubleClick(obj.objectId)}
            />
          )
        }
        if (obj.type === 'rectangle') {
          return (
            <RectangleShape
              key={obj.objectId}
              obj={obj}
              canEdit={canEdit}
              onDragEnd={(x, y) => onObjectDragEnd(obj.objectId, x, y)}
            />
          )
        }
        return null
      })}
    </Group>
  )
}

interface StickyShapeProps {
  obj: StickyObject
  canEdit: boolean
  onDragEnd: (x: number, y: number) => void
  onDoubleClick: () => void
}

function StickyShape({ obj, canEdit, onDragEnd, onDoubleClick }: StickyShapeProps) {
  const { position, dimensions, content, fillColor, textStyle } = obj

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable={canEdit}
      onDragEnd={(e) => {
        const node = e.target
        onDragEnd(node.x() + position.x, node.y() + position.y)
        node.position({ x: 0, y: 0 })
      }}
      onDblClick={canEdit ? onDoubleClick : undefined}
    >
      <Rect
        width={dimensions.width}
        height={dimensions.height}
        fill={fillColor}
        stroke="#e5e5e5"
        strokeWidth={1}
        shadowColor="black"
        shadowBlur={4}
        shadowOffset={{ x: 2, y: 2 }}
        shadowOpacity={0.15}
      />
      <Text
        x={4}
        y={4}
        width={dimensions.width - 8}
        height={dimensions.height - 8}
        text={content || 'Double-click to edit'}
        fontSize={textStyle.fontSize}
        fontFamily={textStyle.fontFamily}
        fill={textStyle.fontColor}
        fontStyle={
          textStyle.bold && textStyle.italic
            ? 'bold italic'
            : textStyle.bold
              ? 'bold'
              : textStyle.italic
                ? 'italic'
                : 'normal'
        }
        align={textStyle.textAlign}
        verticalAlign="top"
        padding={4}
        listening={false}
      />
    </Group>
  )
}

interface RectangleShapeProps {
  obj: RectangleObject
  canEdit: boolean
  onDragEnd: (x: number, y: number) => void
}

function RectangleShape({ obj, canEdit, onDragEnd }: RectangleShapeProps) {
  const { position, dimensions, fillColor } = obj

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable={canEdit}
      onDragEnd={(e) => {
        const node = e.target
        onDragEnd(node.x() + position.x, node.y() + position.y)
        node.position({ x: 0, y: 0 })
      }}
    >
      <Rect
        width={dimensions.width}
        height={dimensions.height}
        fill={fillColor}
        stroke="#94a3b8"
        strokeWidth={1}
      />
    </Group>
  )
}
