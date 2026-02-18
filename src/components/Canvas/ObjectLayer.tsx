import { memo, useRef, useEffect, useMemo } from 'react'
import { Group, Rect, Text, Line, Ellipse, Transformer } from 'react-konva'
import type Konva from 'konva'
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

export type ObjectResizeUpdates =
  | { position: { x: number; y: number }; dimensions: { width: number; height: number } }
  | { start: { x: number; y: number }; end: { x: number; y: number } }

interface ObjectLayerProps {
  objects: ObjectsMap
  viewport: Viewport
  selectedIds: Set<string>
  isPointerTool: boolean
  onObjectDragEnd: (objectId: string, x: number, y: number) => void
  onObjectClick: (objectId: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
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

const MIN_SIZE = 20

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function viewportEqual(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale
}

function ObjectLayerInner({
  objects,
  viewport,
  selectedIds,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
  onStickyDoubleClick,
  onTextDoubleClick,
  canEdit,
}: ObjectLayerProps) {
  const objectList = useMemo(
    () =>
      Object.values(objects).sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() ?? 0
        const bMs = b.createdAt?.toMillis?.() ?? 0
        return aMs - bMs
      }),
    [objects]
  )

  return (
    <>
      {objectList.map((obj) => {
        const selected = selectedIds.has(obj.objectId)
        const resizable =
          canEdit &&
          onObjectResizeEnd &&
          (obj.type === 'sticky' ||
            obj.type === 'rectangle' ||
            obj.type === 'circle' ||
            obj.type === 'triangle' ||
            obj.type === 'line' ||
            obj.type === 'text')
        if (obj.type === 'sticky') {
          return (
            <StickyShape
              key={obj.objectId}
              obj={obj}
              viewport={viewport}
              canEdit={canEdit}
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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
              selected={selected}
              isPointerTool={isPointerTool}
              onObjectDragEnd={onObjectDragEnd}
              onObjectClick={onObjectClick}
              onObjectResizeEnd={resizable ? onObjectResizeEnd : undefined}
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

function objectLayerPropsEqual(prev: ObjectLayerProps, next: ObjectLayerProps): boolean {
  if (prev.objects !== next.objects) return false
  if (!setsEqual(prev.selectedIds, next.selectedIds)) return false
  if (!viewportEqual(prev.viewport, next.viewport)) return false
  if (prev.isPointerTool !== next.isPointerTool) return false
  if (prev.canEdit !== next.canEdit) return false
  if (prev.onObjectDragEnd !== next.onObjectDragEnd) return false
  if (prev.onObjectClick !== next.onObjectClick) return false
  if (prev.onObjectResizeEnd !== next.onObjectResizeEnd) return false
  if (prev.onStickyDoubleClick !== next.onStickyDoubleClick) return false
  if (prev.onTextDoubleClick !== next.onTextDoubleClick) return false
  return true
}

const ObjectLayer = memo(ObjectLayerInner, objectLayerPropsEqual)

export default ObjectLayer

const shapeHandlers = (
  objectId: string,
  viewport: Viewport,
  canEdit: boolean,
  selected: boolean,
  onObjectDragEnd: (objectId: string, x: number, y: number) => void,
  onObjectClick: (objectId: string, e: { ctrlKey: boolean }) => void,
  isPointerTool: boolean
) => ({
  draggable: canEdit && isPointerTool && selected,
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
  onObjectResizeEnd,
  onStickyDoubleClick,
}: {
  obj: StickyObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
  onStickyDoubleClick: (id: string) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions, content, fillColor, textStyle } = obj

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
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

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onDblClick={canEdit ? () => onStickyDoubleClick(objectId) : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
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
          perfectDrawEnabled={false}
        />
        <Text
          x={4}
          y={4}
          width={dimensions.width - 8}
          height={dimensions.height - 8}
          text={content || ''}
          fontSize={textStyle.fontSize}
          fontFamily={textStyle.fontFamily}
          fill={textStyle.fontColor}
          fontStyle={textStyle.bold && textStyle.italic ? 'bold italic' : textStyle.bold ? 'bold' : textStyle.italic ? 'italic' : 'normal'}
          align={textStyle.textAlign}
          verticalAlign="top"
          padding={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
  onObjectResizeEnd,
}: {
  obj: RectangleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions } = obj

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
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
      onObjectResizeEnd(objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          stroke={selected ? '#4f46e5' : 'black'}
          strokeWidth={selected ? 3 : 2}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
  onObjectResizeEnd,
}: {
  obj: CircleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions } = obj
  const rx = dimensions.width / 2
  const ry = dimensions.height / 2

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const ellipse = node.findOne('Ellipse')
    if (ellipse) {
      const w = Math.max(MIN_SIZE, dimensions.width * scaleX)
      const h = Math.max(MIN_SIZE, dimensions.height * scaleY)
      const nrx = w / 2
      const nry = h / 2
      ellipse.setAttrs({ x: nrx, y: nry, radiusX: nrx, radiusY: nry })
      onObjectResizeEnd(objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Ellipse
          x={rx}
          y={ry}
          radiusX={rx}
          radiusY={ry}
          fill="transparent"
          stroke={selected ? '#4f46e5' : 'black'}
          strokeWidth={selected ? 3 : 2}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
  onObjectResizeEnd,
}: {
  obj: TriangleObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions } = obj
  const points = [0, dimensions.height, dimensions.width / 2, 0, dimensions.width, dimensions.height]

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const line = node.findOne('Line') as Konva.Line | undefined
    if (line) {
      const w = Math.max(MIN_SIZE, dimensions.width * scaleX)
      const h = Math.max(MIN_SIZE, dimensions.height * scaleY)
      const newPoints = [0, h, w / 2, 0, w, h]
      line.points(newPoints)
      onObjectResizeEnd(objectId, {
        position: { x: node.x(), y: node.y() },
        dimensions: { width: w, height: h },
      })
    }
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Line
          points={points}
          fill="transparent"
          stroke={selected ? '#4f46e5' : 'black'}
          strokeWidth={selected ? 3 : 2}
          closed
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
  onObjectResizeEnd,
}: {
  obj: LineObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, start, end, strokeColor, strokeWidth } = obj
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x) || MIN_SIZE
  const height = Math.abs(end.y - start.y) || MIN_SIZE
  const points = [start.x - minX, start.y - minY, end.x - minX, end.y - minY]

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const newStart = { x: node.x(), y: node.y() }
    const dx = (end.x - start.x) * scaleX
    const dy = (end.y - start.y) * scaleY
    let ndx = dx
    let ndy = dy
    if (Math.abs(ndx) < MIN_SIZE && Math.abs(ndy) < MIN_SIZE) {
      ndx = width >= height ? MIN_SIZE : 0
      ndy = width >= height ? 0 : MIN_SIZE
    }
    const newEnd = { x: newStart.x + ndx, y: newStart.y + ndy }
    const line = node.findOne('Line') as Konva.Line | undefined
    if (line) {
      line.points([0, 0, newEnd.x - newStart.x, newEnd.y - newStart.y])
      onObjectResizeEnd(objectId, { start: newStart, end: newEnd })
    }
  }

  return (
    <>
      <Group
        ref={shapeRef}
        x={minX}
        y={minY}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Line
          points={points}
          stroke={selected ? '#4f46e5' : strokeColor ?? '#000'}
          strokeWidth={selected ? 3 : strokeWidth ?? 2}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
  onObjectResizeEnd,
  onTextDoubleClick,
}: {
  obj: TextObject
  viewport: Viewport
  canEdit: boolean
  selected: boolean
  isPointerTool: boolean
  onObjectDragEnd: (id: string, x: number, y: number) => void
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
  onObjectResizeEnd?: (objectId: string, updates: ObjectResizeUpdates) => void
  onTextDoubleClick: (id: string) => void
}) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const { objectId, position, dimensions, content, textStyle } = obj
  const fontSize = textStyle?.fontSize ?? 16

  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])

  const handleTransformEnd = () => {
    const node = shapeRef.current
    if (!node || !onObjectResizeEnd) return
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

  return (
    <>
      <Group
        ref={shapeRef}
        x={position.x}
        y={position.y}
        {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
        onDblClick={canEdit ? () => onTextDoubleClick(objectId) : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect
          width={dimensions.width}
          height={dimensions.height}
          fill="transparent"
          stroke={selected ? '#4f46e5' : 'transparent'}
          strokeWidth={selected ? 3 : 1}
          perfectDrawEnabled={false}
        />
        <Text
          x={4}
          y={4}
          width={dimensions.width - 8}
          height={dimensions.height - 8}
          text={content || ''}
          fontSize={fontSize}
          fontFamily={textStyle?.fontFamily ?? 'Arial'}
          fill={content ? (textStyle?.fontColor ?? '#1a1a1a') : '#9ca3af'}
          align={textStyle?.textAlign ?? 'left'}
          verticalAlign="top"
          padding={4}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(_, newBox) =>
            Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox
          }
        />
      )}
    </>
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
      {...shapeHandlers(objectId, viewport, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool)}
    >
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
          stroke="#4f46e5"
          strokeWidth={2}
          fill="transparent"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
}
