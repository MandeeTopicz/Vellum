import { memo, useRef, useEffect, useMemo } from 'react'
import { Group, Rect, Text, Line, Ellipse, Transformer, RegularPolygon, Star, Arrow, Path } from 'react-konva'
import type Konva from 'konva'
import type {
  ObjectsMap,
  StickyObject,
  RectangleObject,
  CircleObject,
  TriangleObject,
  LineObject,
  PolygonObject,
  StarObject,
  ArrowObject,
  PenObject,
  TextObject,
  EmojiObject,
  PlusObject,
  ParallelogramObject,
  CylinderObject,
  TabShapeObject,
  TrapezoidObject,
  CircleCrossObject,
} from '../../types'
import type { Viewport } from './InfiniteCanvas'
import { stageToCanvas } from '../../utils/coordinates'

export type ObjectResizeUpdates =
  | { position: { x: number; y: number }; dimensions: { width: number; height: number } }
  | { start: { x: number; y: number }; end: { x: number; y: number } }

/** In-progress pen stroke preview while drawing */
export interface CurrentPenStroke {
  points: [number, number][]
  color: string
  strokeWidth: number
  isHighlighter: boolean
  opacity: number
  strokeType?: 'solid' | 'dotted' | 'double'
}

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
  /** Preview stroke while pen/highlighter is drawing */
  currentPenStroke?: CurrentPenStroke | null
  /** Click-and-drag arrow preview during drag */
  arrowPreview?: {
    startX: number
    startY: number
    endX: number
    endY: number
    type: string
  } | null
}

const MIN_SIZE = 20
/** Minimum line selection box size - larger than MIN_SIZE for easier resizing at 100% zoom */
const MIN_LINE_HIT = 36

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function viewportEqual(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.scale === b.scale
}

const PREVIEW_STROKE = '#3b82f6'
const PREVIEW_PROPS = {
  stroke: PREVIEW_STROKE,
  strokeWidth: 2,
  opacity: 0.6,
  dash: [5, 5] as [number, number],
  listening: false,
  perfectDrawEnabled: false,
}

function ArrowPreview({
  startX,
  startY,
  endX,
  endY,
  type,
}: {
  startX: number
  startY: number
  endX: number
  endY: number
  type: string
}) {
  const points = [startX, startY, endX, endY]
  switch (type) {
    case 'arrow-straight':
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    case 'arrow-curved':
    case 'arrow-curved-cw': {
      const midX = (startX + endX) / 2
      const midY = (startY + endY) / 2
      const perpX = -(endY - startY) * 0.2
      const perpY = (endX - startX) * 0.2
      const sign = type === 'arrow-curved-cw' ? -1 : 1
      const controlX = midX + sign * perpX
      const controlY = midY + sign * perpY
      const curvePoints = [startX, startY, controlX, controlY, endX, endY]
      return (
        <Arrow
          points={curvePoints}
          tension={0.5}
          pointerLength={10}
          pointerWidth={10}
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    }
    case 'arrow-elbow-bidirectional':
    case 'arrow-elbow': {
      const deltaX = endX - startX
      const deltaY = endY - startY
      const elbowX = Math.abs(deltaX) > Math.abs(deltaY) ? endX : startX
      const elbowY = Math.abs(deltaX) > Math.abs(deltaY) ? startY : endY
      const elbowPoints = [startX, startY, elbowX, elbowY, endX, endY]
      return (
        <Arrow
          points={elbowPoints}
          pointerLength={10}
          pointerWidth={10}
          pointerAtBeginning
          pointerAtEnd
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    }
    case 'arrow-double':
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          pointerAtBeginning
          pointerAtEnd
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
    default:
      return (
        <Arrow
          points={points}
          pointerLength={10}
          pointerWidth={10}
          fill={PREVIEW_STROKE}
          {...PREVIEW_PROPS}
        />
      )
  }
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
  currentPenStroke,
  arrowPreview,
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
      {arrowPreview && (
        <ArrowPreview
          startX={arrowPreview.startX}
          startY={arrowPreview.startY}
          endX={arrowPreview.endX}
          endY={arrowPreview.endY}
          type={arrowPreview.type}
        />
      )}
      {currentPenStroke && currentPenStroke.points.length >= 2 && (
        <PenStrokePreview stroke={currentPenStroke} />
      )}
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
            obj.type === 'diamond' ||
            obj.type === 'star' ||
            obj.type === 'pentagon' ||
            obj.type === 'hexagon' ||
            obj.type === 'octagon' ||
            obj.type === 'arrow' ||
            obj.type === 'plus' ||
            obj.type === 'parallelogram' ||
            obj.type === 'cylinder' ||
            obj.type === 'tab-shape' ||
            obj.type === 'trapezoid' ||
            obj.type === 'circle-cross' ||
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
        if (obj.type === 'diamond' || obj.type === 'pentagon' || obj.type === 'hexagon' || obj.type === 'octagon') {
          return (
            <PolygonShape
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
        if (obj.type === 'star') {
          return (
            <StarShape
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
        if (obj.type === 'plus') {
          return (
            <PlusShape
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
        if (obj.type === 'parallelogram') {
          return (
            <ParallelogramShape
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
        if (obj.type === 'cylinder') {
          return (
            <CylinderShape
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
        if (obj.type === 'tab-shape') {
          return (
            <TabShape
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
        if (obj.type === 'trapezoid') {
          return (
            <TrapezoidShape
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
        if (obj.type === 'circle-cross') {
          return (
            <CircleCrossShape
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
        if (obj.type === 'arrow') {
          return (
            <ArrowShape
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
        if (obj.type === 'pen') {
          return (
            <PenShape
              key={obj.objectId}
              obj={obj}
              isPointerTool={isPointerTool}
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
  if (prev.currentPenStroke !== next.currentPenStroke) return false
  if (prev.arrowPreview !== next.arrowPreview) return false
  if (
    prev.arrowPreview &&
    next.arrowPreview &&
    (prev.arrowPreview.startX !== next.arrowPreview.startX ||
      prev.arrowPreview.startY !== next.arrowPreview.startY ||
      prev.arrowPreview.endX !== next.arrowPreview.endX ||
      prev.arrowPreview.endY !== next.arrowPreview.endY)
  )
    return false
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
  listening: isPointerTool,
  draggable: canEdit && isPointerTool && selected,
  onDragEnd: (e: { target: { getAbsolutePosition: () => { x: number; y: number }; position: (p: { x: number; y: number }) => void } }) => {
    const node = e.target
    const absPos = node.getAbsolutePosition()
    const canvasPos = stageToCanvas(absPos.x, absPos.y, viewport)
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
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
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
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
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
  const inverted = obj.inverted ?? false
  const points = inverted
    ? [0, 0, dimensions.width / 2, dimensions.height, dimensions.width, 0]
    : [0, dimensions.height, dimensions.width / 2, 0, dimensions.width, dimensions.height]

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
      const newPoints = inverted ? [0, 0, w / 2, h, w, 0] : [0, h, w / 2, 0, w, h]
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
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
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

const POLYGON_SIDES: Record<PolygonObject['type'], number> = {
  diamond: 4,
  pentagon: 5,
  hexagon: 6,
  octagon: 8,
}

function PolygonShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: PolygonObject
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
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const radius = Math.min(dimensions.width, dimensions.height) / 2
  const sides = POLYGON_SIDES[obj.type]
  const isDiamond = obj.type === 'diamond'
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)

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
    const w = Math.max(MIN_SIZE, dimensions.width * scaleX)
    const h = Math.max(MIN_SIZE, dimensions.height * scaleY)
    if (isDiamond) {
      const path = node.findOne('Path')
      if (path) path.setAttrs({ scaleX: w / 100, scaleY: h / 100 })
    } else {
      const poly = node.findOne('RegularPolygon')
      if (poly) {
        const r = Math.min(w, h) / 2
        poly.setAttrs({ x: w / 2, y: h / 2, radius: r })
      }
    }
    onObjectResizeEnd(objectId, {
      position: { x: node.x(), y: node.y() },
      dimensions: { width: w, height: h },
    })
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
        {isDiamond ? (
          <Path
            data="M50 0 L100 50 L50 100 L0 50 Z"
            scaleX={dimensions.width / 100}
            scaleY={dimensions.height / 100}
            fill={obj.fillColor ?? 'transparent'}
            stroke={stroke}
            strokeWidth={sw}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <RegularPolygon
            x={cx}
            y={cy}
            sides={sides}
            radius={radius}
            rotation={0}
            fill={obj.fillColor ?? 'transparent'}
            stroke={stroke}
            strokeWidth={sw}
            perfectDrawEnabled={false}
          />
        )}
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

function StarShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: StarObject
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
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const outerRadius = Math.min(dimensions.width, dimensions.height) / 2
  const innerRadius = outerRadius * 0.4

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
    const star = node.findOne('Star')
    if (star) {
      const w = Math.max(MIN_SIZE, dimensions.width * scaleX)
      const h = Math.max(MIN_SIZE, dimensions.height * scaleY)
      const or = Math.min(w, h) / 2
      const ir = or * 0.4
      star.setAttrs({ x: w / 2, y: h / 2, outerRadius: or, innerRadius: ir })
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
        <Star
          x={cx}
          y={cy}
          numPoints={5}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected ? 3 : (obj.strokeWidth ?? 2)}
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

function ArrowShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: ArrowObject
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
  const direction = obj.direction ?? 'right'
  const cy = dimensions.height / 2
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  const isOutline = direction === 'left' || direction === 'right'
  const pathDataLeft = 'M8 12 L2 12 L6 8 L6 10 L20 10 L20 14 L6 14 L6 16 Z'
  const pathDataRight = 'M16 12 L22 12 L18 8 L18 10 L4 10 L4 14 L18 14 L18 16 Z'
  const points = direction === 'left' ? [dimensions.width, cy, 0, cy] : [0, cy, dimensions.width, cy]

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
    const w = Math.max(MIN_SIZE, dimensions.width * scaleX)
    const h = Math.max(MIN_SIZE, dimensions.height * scaleY)
    if (isOutline) {
      const path = node.findOne('Path')
      if (path) path.setAttrs({ scaleX: w / 24, scaleY: h / 24 })
    } else {
      const arrow = node.findOne('Arrow')
      if (arrow) {
        const ncy = h / 2
        arrow.setAttrs({ points: direction === 'left' ? [w, ncy, 0, ncy] : [0, ncy, w, ncy] })
      }
    }
    onObjectResizeEnd(objectId, {
      position: { x: node.x(), y: node.y() },
      dimensions: { width: w, height: h },
    })
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
        {isOutline ? (
          <Path
            data={direction === 'left' ? pathDataLeft : pathDataRight}
            scaleX={dimensions.width / 24}
            scaleY={dimensions.height / 24}
            stroke={stroke}
            fill="transparent"
            strokeWidth={sw}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Arrow
            points={points}
            pointerLength={10}
            pointerWidth={10}
            fill={stroke}
            stroke={stroke}
            strokeWidth={sw}
            perfectDrawEnabled={false}
          />
        )}
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

function PlusShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: PlusObject
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
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
    }
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const ncx = w / 2
    const ncy = h / 2
    const lines = node.find('Line')
    if (lines.length >= 2) {
      ;(lines[0] as Konva.Line).points([0, ncy, w, ncy])
      ;(lines[1] as Konva.Line).points([ncx, 0, ncx, h])
    }
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        <Line points={[0, cy, dimensions.width, cy]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
        <Line points={[cx, 0, cx, dimensions.height]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
      )}
    </>
  )
}

function ParallelogramShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: ParallelogramObject
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
  const skew = dimensions.width * 0.2
  const pts =
    obj.shapeKind === 'right'
      ? [0, 0, dimensions.width, 0, dimensions.width - skew, dimensions.height, skew, dimensions.height]
      : [skew, 0, dimensions.width - skew, 0, dimensions.width, dimensions.height, 0, dimensions.height]
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) trRef.current.nodes([shapeRef.current])
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const sk = w * 0.2
    const newPts =
      obj.shapeKind === 'right'
        ? [0, 0, w, 0, w - sk, h, sk, h]
        : [sk, 0, w - sk, 0, w, h, 0, h]
    ;(node.findOne('Line') as Konva.Line)?.points(newPts)
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        <Line points={pts} fill={obj.fillColor ?? 'transparent'} stroke={stroke} strokeWidth={sw} closed listening={false} perfectDrawEnabled={false} />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
      )}
    </>
  )
}

function CylinderShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: CylinderObject
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
  const isVert = obj.shapeKind === 'vertical'
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  const rx = isVert ? dimensions.width / 2 : dimensions.height / 2
  const ry = isVert ? 0.15 * dimensions.height : dimensions.width / 8
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) trRef.current.nodes([shapeRef.current])
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const r2 = isVert ? h * 0.15 : w / 8
    const ellipses = node.find('Ellipse')
    if (ellipses.length >= 2) {
      if (isVert) {
        ellipses[0].setAttrs({ x: w / 2, y: r2, radiusX: w / 2, radiusY: r2 })
        ellipses[1].setAttrs({ x: w / 2, y: h - r2, radiusX: w / 2, radiusY: r2 })
      } else {
        ellipses[0].setAttrs({ x: h / 2, y: r2, radiusX: h / 2, radiusY: r2 })
        ellipses[1].setAttrs({ x: h / 2, y: w - r2, radiusX: h / 2, radiusY: r2 })
      }
    }
    const lines = node.find('Line')
    if (lines.length >= 2) {
      if (isVert) {
        ;(lines[0] as Konva.Line).points([0, r2, 0, h - r2])
        ;(lines[1] as Konva.Line).points([w, r2, w, h - r2])
      } else {
        ;(lines[0] as Konva.Line).points([0, r2, 0, w - r2])
        ;(lines[1] as Konva.Line).points([h, r2, h, w - r2])
        const inner = node.children?.[0]
        if (inner) inner.setAttrs({ offsetY: w })
      }
    }
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        {isVert ? (
          <>
            <Ellipse x={rx} y={ry} radiusX={rx} radiusY={ry} stroke={stroke} strokeWidth={sw} fill={obj.fillColor ?? 'transparent'} listening={false} perfectDrawEnabled={false} />
            <Line points={[0, ry, 0, dimensions.height - ry]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
            <Line points={[dimensions.width, ry, dimensions.width, dimensions.height - ry]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
            <Ellipse x={rx} y={dimensions.height - ry} radiusX={rx} radiusY={ry} stroke={stroke} strokeWidth={sw} fill={obj.fillColor ?? 'transparent'} listening={false} perfectDrawEnabled={false} />
          </>
        ) : (
          <Group rotation={-90} offsetX={0} offsetY={dimensions.width}>
            <Ellipse x={rx} y={ry} radiusX={rx} radiusY={ry} stroke={stroke} strokeWidth={sw} fill={obj.fillColor ?? 'transparent'} listening={false} perfectDrawEnabled={false} />
            <Line points={[0, ry, 0, dimensions.width - ry]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
            <Line points={[dimensions.height, ry, dimensions.height, dimensions.width - ry]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
            <Ellipse x={rx} y={dimensions.width - ry} radiusX={rx} radiusY={ry} stroke={stroke} strokeWidth={sw} fill={obj.fillColor ?? 'transparent'} listening={false} perfectDrawEnabled={false} />
          </Group>
        )}
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
      )}
    </>
  )
}

function TabShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: TabShapeObject
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
  const tabH = Math.min(dimensions.height * 0.2, 20)
  const pts = [0, tabH, dimensions.width * 0.2, tabH, dimensions.width * 0.3, 0, dimensions.width * 0.7, 0, dimensions.width * 0.8, tabH, dimensions.width, tabH, dimensions.width, dimensions.height, 0, dimensions.height]
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) trRef.current.nodes([shapeRef.current])
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const th = Math.min(h * 0.2, 20)
    const newPts = [0, th, w * 0.2, th, w * 0.3, 0, w * 0.7, 0, w * 0.8, th, w, th, w, h, 0, h]
    ;(node.findOne('Line') as Konva.Line)?.points(newPts)
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        <Line points={pts} fill={obj.fillColor ?? 'transparent'} stroke={stroke} strokeWidth={sw} closed listening={false} perfectDrawEnabled={false} />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
      )}
    </>
  )
}

function TrapezoidShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: TrapezoidObject
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
  const skew = dimensions.width * 0.2
  const pts = [skew, 0, dimensions.width - skew, 0, dimensions.width, dimensions.height, 0, dimensions.height]
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) trRef.current.nodes([shapeRef.current])
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const sk = w * 0.2
    ;(node.findOne('Line') as Konva.Line)?.points([sk, 0, w - sk, 0, w, h, 0, h])
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        <Line points={pts} fill={obj.fillColor ?? 'transparent'} stroke={stroke} strokeWidth={sw} closed listening={false} perfectDrawEnabled={false} />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
      )}
    </>
  )
}

function CircleCrossShape({
  obj,
  viewport,
  canEdit,
  selected,
  isPointerTool,
  onObjectDragEnd,
  onObjectClick,
  onObjectResizeEnd,
}: {
  obj: CircleCrossObject
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
  const cx = dimensions.width / 2
  const cy = dimensions.height / 2
  const r = Math.min(dimensions.width, dimensions.height) / 2
  const stroke = selected ? '#4f46e5' : (obj.strokeColor ?? '#000000')
  const sw = selected ? 3 : (obj.strokeWidth ?? 2)
  useEffect(() => {
    if (selected && onObjectResizeEnd && trRef.current && shapeRef.current) trRef.current.nodes([shapeRef.current])
  }, [selected, onObjectResizeEnd])
  const handleTransformEnd = () => {
    if (!shapeRef.current || !onObjectResizeEnd) return
    const node = shapeRef.current
    const sX = node.scaleX()
    const sY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    const w = Math.max(MIN_SIZE, dimensions.width * sX)
    const h = Math.max(MIN_SIZE, dimensions.height * sY)
    const nr = Math.min(w, h) / 2
    const ncx = w / 2
    const ncy = h / 2
    const ell = node.findOne('Ellipse') as Konva.Ellipse | undefined
    if (ell) ell.setAttrs({ x: ncx, y: ncy, radiusX: nr, radiusY: nr })
    const lines = node.find('Line')
    if (lines.length >= 2) {
      ;(lines[0] as Konva.Line).points([ncx, 0, ncx, h])
      ;(lines[1] as Konva.Line).points([0, ncy, w, ncy])
    }
    onObjectResizeEnd(objectId, { position: { x: node.x(), y: node.y() }, dimensions: { width: w, height: h } })
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
        <Ellipse x={cx} y={cy} radiusX={r} radiusY={r} stroke={stroke} strokeWidth={sw} fill={obj.fillColor ?? 'transparent'} listening={false} perfectDrawEnabled={false} />
        <Line points={[cx, 0, cx, dimensions.height]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
        <Line points={[0, cy, dimensions.width, cy]} stroke={stroke} strokeWidth={sw} listening={false} perfectDrawEnabled={false} />
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={false} boundBoxFunc={(_, newBox) => (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE ? _ : newBox)} />
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
  const { objectId, start, end, strokeColor, strokeWidth, connectionType } = obj
  const ct = connectionType ?? 'line'
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lineW = Math.abs(dx) || MIN_SIZE
  const lineH = Math.abs(dy) || MIN_SIZE
  const width = Math.max(lineW, MIN_LINE_HIT)
  const height = Math.max(lineH, MIN_LINE_HIT)
  const lx1 = start.x - minX
  const ly1 = start.y - minY
  const lx2 = end.x - minX
  const ly2 = end.y - minY
  const points = [lx1, ly1, lx2, ly2]
  const isArrow = ct !== 'line'
  const isElbowBidirectional = ct === 'arrow-elbow-bidirectional' || ct === 'arrow-elbow'
  const elbowX = Math.abs(dx) > Math.abs(dy) ? lx2 : lx1
  const elbowY = Math.abs(dx) > Math.abs(dy) ? ly1 : ly2
  const elbowPoints = [lx1, ly1, elbowX, elbowY, lx2, ly2]
  const curvePoints =
    ct === 'arrow-curved' || ct === 'arrow-curved-cw'
      ? (() => {
          const midX = (lx1 + lx2) / 2
          const midY = (ly1 + ly2) / 2
          const perpX = -(ly2 - ly1) * 0.2
          const perpY = (lx2 - lx1) * 0.2
          const sign = ct === 'arrow-curved-cw' ? -1 : 1
          return [lx1, ly1, midX + sign * perpX, midY + sign * perpY, lx2, ly2]
        })()
      : null

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
    const signX = end.x >= start.x ? 1 : -1
    const signY = end.y >= start.y ? 1 : -1
    let dx = width * scaleX * signX
    let dy = height * scaleY * signY
    if (Math.abs(dx) < MIN_SIZE && Math.abs(dy) < MIN_SIZE) {
      dx = lineW >= lineH ? (signX * MIN_SIZE) : 0
      dy = lineW >= lineH ? 0 : signY * MIN_SIZE
    }
    const newEnd = { x: newStart.x + dx, y: newStart.y + dy }
    const newLineW = Math.abs(dx) || MIN_SIZE
    const newLineH = Math.abs(dy) || MIN_SIZE
    const rect = node.findOne('Rect')
    if (rect) {
      rect.width(Math.max(newLineW, MIN_LINE_HIT))
      rect.height(Math.max(newLineH, MIN_LINE_HIT))
    }
    const line = node.findOne('Line') as Konva.Line | undefined
    const arrow = node.findOne('Arrow') as Konva.Arrow | undefined
    const shapeNode = line ?? arrow
    if (shapeNode) {
      let newPts: number[]
      if (ct === 'arrow-curved' || ct === 'arrow-curved-cw') {
        const midX = dx / 2
        const midY = dy / 2
        const perpX = -dy * 0.2
        const perpY = dx * 0.2
        const sign = ct === 'arrow-curved-cw' ? -1 : 1
        newPts = [0, 0, midX + sign * perpX, midY + sign * perpY, dx, dy]
      } else if (isElbowBidirectional) {
        const ex = Math.abs(dx) > Math.abs(dy) ? dx : 0
        const ey = Math.abs(dx) > Math.abs(dy) ? 0 : dy
        newPts = [0, 0, ex, ey, dx, dy]
      } else {
        newPts = [0, 0, dx, dy]
      }
      shapeNode.points(newPts)
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
        <Rect
          width={width}
          height={height}
          fill="transparent"
          stroke="transparent"
          listening={isPointerTool}
          perfectDrawEnabled={false}
        />
        {isArrow ? (
          <Arrow
            points={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? curvePoints! : isElbowBidirectional ? elbowPoints : points}
            tension={ct === 'arrow-curved' || ct === 'arrow-curved-cw' ? 0.5 : 0}
            pointerLength={10}
            pointerWidth={10}
            pointerAtBeginning={ct === 'arrow-double' || isElbowBidirectional}
            pointerAtEnd
            fill={selected ? '#4f46e5' : strokeColor ?? '#000'}
            stroke={selected ? '#4f46e5' : strokeColor ?? '#000'}
            strokeWidth={selected ? 3 : strokeWidth ?? 2}
            perfectDrawEnabled={false}
            listening={false}
          />
        ) : (
          <Line
            points={points}
            stroke={selected ? '#4f46e5' : strokeColor ?? '#000'}
            strokeWidth={selected ? 3 : strokeWidth ?? 2}
            perfectDrawEnabled={false}
            listening={false}
          />
        )}
      </Group>
      {selected && onObjectResizeEnd && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          anchorSize={12}
          anchorStrokeWidth={2}
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
          text={
            textStyle?.bulletList && content
              ? content
                  .split('\n')
                  .map((line) => (line.trim() ? `• ${line.trim()}` : ''))
                  .filter(Boolean)
                  .join('\n')
              : content || ''
          }
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

/**
 * Pen stroke: freehand line from points array.
 * Not draggable/resizable; only clickable for selection when pointer tool.
 */
/** Renders a pen stroke with optional solid/dotted/double style */
function renderPenStroke(
  flatPoints: number[],
  color: string,
  strokeWidth: number,
  opacity: number,
  strokeType: 'solid' | 'dotted' | 'double' | undefined
) {
  const baseProps = {
    points: flatPoints,
    stroke: color,
    strokeWidth,
    opacity,
    tension: 0.5,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    listening: false,
    perfectDrawEnabled: false,
  }
  if (strokeType === 'dotted') {
    return <Line {...baseProps} dash={[5, 5]} />
  }
  if (strokeType === 'double') {
    const offset = strokeWidth * 0.4
    const points: [number, number][] = []
    for (let i = 0; i < flatPoints.length; i += 2) {
      points.push([flatPoints[i], flatPoints[i + 1]])
    }
    const offsetPoints = (delta: number): number[] => {
      if (points.length < 2) return flatPoints
      const result: number[] = []
      for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)]
        const next = points[Math.min(points.length - 1, i + 1)]
        const dx = next[0] - prev[0]
        const dy = next[1] - prev[1]
        const len = Math.hypot(dx, dy) || 1
        const nx = -dy / len
        const ny = dx / len
        result.push(points[i][0] + nx * delta, points[i][1] + ny * delta)
      }
      return result
    }
    const w = strokeWidth * 0.6
    return (
      <Group>
        <Line {...baseProps} points={offsetPoints(-offset)} strokeWidth={w} />
        <Line {...baseProps} points={offsetPoints(offset)} strokeWidth={w} />
      </Group>
    )
  }
  return <Line {...baseProps} />
}

function PenStrokePreview({ stroke }: { stroke: CurrentPenStroke }) {
  const flatPoints = stroke.points.flat()
  const strokeType = stroke.strokeType ?? 'solid'
  return (
    <Group listening={false}>
      {renderPenStroke(
        flatPoints,
        stroke.color,
        stroke.strokeWidth,
        stroke.opacity,
        strokeType
      )}
    </Group>
  )
}

function PenShape({
  obj,
  isPointerTool,
  onObjectClick,
}: {
  obj: PenObject
  isPointerTool: boolean
  onObjectClick: (id: string, e: { ctrlKey: boolean }) => void
}) {
  const { objectId, points, color, strokeWidth, opacity = 1, strokeType } = obj
  const flatPoints = points.flat()
  if (flatPoints.length < 4) return null
  return (
    <Group
      listening={isPointerTool}
      onClick={(e) => isPointerTool && onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey })}
    >
      {renderPenStroke(flatPoints, color, strokeWidth, opacity, strokeType)}
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
