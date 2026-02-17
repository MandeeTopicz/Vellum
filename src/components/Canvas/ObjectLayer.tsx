import { Group, Rect, Text, Line, Ellipse } from 'react-konva'
import type {
  ObjectsMap,
  StickyObject,
  RectangleObject,
  CircleObject,
  TriangleObject,
  LineObject,
  TextObject,
  EmojiObject,
} from '../../types'
import type { Viewport } from './InfiniteCanvas'

interface ObjectLayerProps {
  objects: ObjectsMap
  viewport: Viewport
  selectedIds: Set<string>
  isPointerTool: boolean
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onObjectClick: (objectId: string, e: { ctrlKey: boolean }) => void
  onStickyDoubleClick: (objectId: string) => void
  onTextDoubleClick: (objectId: string) => void
  canEdit: boolean
}

/** Convert stage/screen coordinates to canvas/world coordinates */
function screenToCanvas(screenX: number, screenY: number, viewport: Viewport) {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  }
}

export default function ObjectLayer({
  objects,
  viewport,
  selectedIds,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onStickyDoubleClick,
  onTextDoubleClick,
  canEdit,
}: ObjectLayerProps) {
  const objectList = Object.values(objects).sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0
    const bMs = b.createdAt?.toMillis?.() ?? 0
    return aMs - bMs
  })

  return (
    <>
      {objectList.map((obj) => {
        if (obj.type === 'sticky') {
          return (
            <StickyShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onStickyDoubleClick={onStickyDoubleClick}
            />
          )
        }
        if (obj.type === 'rectangle') {
          return (
            <RectangleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        if (obj.type === 'circle') {
          return (
            <CircleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        if (obj.type === 'triangle') {
          return (
            <TriangleShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        if (obj.type === 'line') {
          return (
            <LineShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        if (obj.type === 'text') {
          return (
            <TextShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onTextDoubleClick={onTextDoubleClick}
            />
          )
        }
        if (obj.type === 'emoji') {
          return (
            <EmojiShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selectedIds.has(obj.objectId)}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
            />
          )
        }
        return null
      })}
    </>
  )
}

const shapeHandlers = (
  objectId: string,
  viewport: Viewport,
  canEdit: boolean,
  onObjectDragEnd: (objectId: string, x: number, y: number) => void,
  onObjectClick: (objectId: string, e: { ctrlKey: boolean }) => void,
  isPointerTool: boolean
) => ({
  draggable: canEdit && isPointerTool,
  onDragEnd: (e: { target: { getAbsolutePosition: () => { x: number; y: number }; position: (p: { x: number; y: number }) => void } }) => {
    const node = e.target
    const absPos = node.getAbsolutePosition()
    const canvasPos = screenToCanvas(absPos.x, absPos.y, viewport)
    onObjectDragEnd(objectId, canvasPos.x, canvasPos.y)
    node.position({ x: canvasPos.x, y: canvasPos.y })
  },
  onClick: (e: { evt: MouseEvent }) => onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey }),
})

function StickyShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onStickyDoubleClick,
}: {
  obj: StickyObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onStickyDoubleClick: (id: string) => void
}) {
  const { objectId, position, dimensions, content, fillColor, textStyle } = obj
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
      onDblClick={canEdit ? () => onStickyDoubleClick(objectId) : undefined}
    >
      <Rect
        width={dimensions.width}
        height={dimensions.height}
        fill={fillColor}
        stroke={selected ? '#4f46e5' : '#d1d5db'}
        strokeWidth={selected ? 3 : 1}
        shadowColor="black"
        shadowBlur={6}
        shadowOffset={{ x: 1, y: 2 }}
        shadowOpacity={0.12}
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
        fontStyle={textStyle.bold && textStyle.italic ? 'bold italic' : textStyle.bold ? 'bold' : textStyle.italic ? 'italic' : 'normal'}
        align={textStyle.textAlign}
        verticalAlign="top"
        padding={4}
        listening={false}
      />
    </Group>
  )
}

function RectangleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
}: {
  obj: RectangleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, position, dimensions } = obj
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
      <Rect
        width={dimensions.width}
        height={dimensions.height}
        fill="transparent"
        stroke={selected ? '#4f46e5' : 'black'}
        strokeWidth={selected ? 3 : 2}
      />
    </Group>
  )
}

function CircleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
}: {
  obj: CircleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, position, dimensions } = obj
  const rx = dimensions.width / 2
  const ry = dimensions.height / 2
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
      <Ellipse
        x={rx}
        y={ry}
        radiusX={rx}
        radiusY={ry}
        fill="transparent"
        stroke={selected ? '#4f46e5' : 'black'}
        strokeWidth={selected ? 3 : 2}
      />
    </Group>
  )
}

function TriangleShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
}: {
  obj: TriangleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, position, dimensions } = obj
  const points = [0, dimensions.height, dimensions.width / 2, 0, dimensions.width, dimensions.height]
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
      <Line
        points={points}
        fill="transparent"
        stroke={selected ? '#4f46e5' : 'black'}
        strokeWidth={selected ? 3 : 2}
        closed
      />
    </Group>
  )
}

function LineShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
}: {
  obj: LineObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, start, end, strokeColor, strokeWidth } = obj
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const points = [start.x - minX, start.y - minY, end.x - minX, end.y - minY]
  return (
    <Group
      x={minX}
      y={minY}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
      <Line
        points={points}
        stroke={selected ? '#4f46e5' : strokeColor ?? '#000'}
        strokeWidth={selected ? 3 : strokeWidth ?? 2}
      />
    </Group>
  )
}

function TextShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onTextDoubleClick,
}: {
  obj: TextObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onTextDoubleClick: (id: string) => void
}) {
  const { objectId, position, dimensions, content, textStyle } = obj
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
      onDblClick={canEdit ? () => onTextDoubleClick(objectId) : undefined}
    >
      <Rect
        width={dimensions.width}
        height={dimensions.height}
        fill="transparent"
        stroke={selected ? '#4f46e5' : '#d1d5db'}
        strokeWidth={selected ? 3 : 1}
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
        align={textStyle.textAlign}
        verticalAlign="top"
        padding={4}
        listening={false}
      />
    </Group>
  )
}

function EmojiShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
}: {
  obj: EmojiObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, position, emoji, fontSize = 32 } = obj
  return (
    <Group
      x={position.x}
      y={position.y}
      {...shapeHandlers(objectId, viewport, canEdit, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
      <Text
        text={emoji}
        fontSize={fontSize}
        listening={false}
      />
      {selected && (
        <Rect
          x={-4}
          y={-4}
          width={fontSize + 8}
          height={fontSize + 8}
          stroke="#4f46e5"
          strokeWidth={2}
          fill="transparent"
          listening={false}
        />
      )}
    </Group>
  )
}
