/**
 * Renders an uploaded document (PDF, etc.) as a card with icon and filename.
 * Click opens the document in a new tab.
 */
import React from 'react'
import { Group, Rect, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { DocumentObject } from '../../../types'
import { stageToCanvas } from '../../../utils/coordinates'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  computeNewBoundsFromSnapshot,
  areShapePropsEqual,
  type BaseShapeProps,
  type ResizeSnapshot,
} from './shared'

export interface DocumentShapeProps extends BaseShapeProps {
  obj: DocumentObject
}

function truncateFilename(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name
  const ext = name.replace(/^.*\./, '')
  const base = name.slice(0, name.length - ext.length - 1)
  const keep = maxLen - ext.length - 4
  return keep > 0 ? `${base.slice(0, keep)}...${ext}` : `...${ext}`
}

function DocumentShapeInner({
  obj,
  viewportRef,
  canEdit,
  selected,
  isPointerTool,
  isSelecting = false,
  onObjectDragEnd,
  onObjectDragStart,
  onObjectClick,
  onObjectResizeEnd,
  displayPosition,
  selectedIds,
  multiDragStartPositionsRef,
  multiDragStartPointerRef,
  dragPreviewPosition,
  onMultiDragStart,
  onMultiDragMove,
  connectorToolActive,
  onConnectorHover,
  isPenStrokeActive,
}: DocumentShapeProps) {
  const shapeRef = React.useRef<Konva.Group>(null)
  const trRef = React.useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = React.useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = React.useRef(false)

  const { objectId, dimensions, url, fileName = 'Document' } = obj
  const pos = displayPosition ?? obj.position
  const w = dimensions.width
  const h = dimensions.height
  const rotation = obj.rotation ?? 0

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const handleClick = (e: { evt: MouseEvent; target: Konva.Node }) => {
    const stage = e.target.getStage()
    const pointerPos = stage?.getPointerPosition()
    const canvasPos = pointerPos ? stageToCanvas(pointerPos.x, pointerPos.y, viewportRef.current) : undefined
    onObjectClick(objectId, { ctrlKey: e.evt.ctrlKey, metaKey: e.evt.metaKey }, canvasPos)
    if (e.evt.ctrlKey || e.evt.metaKey) {
      window.open(url, '_blank', 'noopener')
    }
  }

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, rect: Konva.Rect) => {
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    rect.width(b.width)
    rect.height(b.height)
    node.position({ x: cx, y: cy })
    node.offsetX(b.width / 2)
    node.offsetY(b.height / 2)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: w, height: h }
    const stage = shapeRef.current?.getStage()
    const ptr = stage?.getPointerPosition()
    if (ptr && stage) {
      const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
      resizeStartPointerRef.current = { x: canvas.x, y: canvas.y }
    } else resizeStartPointerRef.current = null
  }

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    resizeShiftKeyRef.current = (e.evt as MouseEvent)?.shiftKey ?? false
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const rect = node?.findOne('Rect') as Konva.Rect | undefined
    const tr = trRef.current
    if (!snap || !start || !node || !rect || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const newBounds = computeNewBoundsFromSnapshot(snap, canvas.x - start.x, canvas.y - start.y, tr.getActiveAnchor?.() ?? null, resizeShiftKeyRef.current)
    applyBoundsToNode(node, newBounds, rect)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const tr = trRef.current
    const rect = node?.findOne('Rect') as Konva.Rect | undefined
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    if (!node || !onObjectResizeEnd || !rect) return
    const rot = node.rotation()
    if (snap && start && tr) {
      const stage = node.getStage()
      const ptr = stage?.getPointerPosition()
      if (ptr && stage) {
        const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
        const newBounds = computeNewBoundsFromSnapshot(snap, canvas.x - start.x, canvas.y - start.y, tr.getActiveAnchor?.() ?? null, resizeShiftKeyRef.current)
        applyBoundsToNode(node, newBounds, rect)
        node.rotation(rot)
        onObjectResizeEnd(objectId, { position: { x: newBounds.left, y: newBounds.top }, dimensions: { width: newBounds.width, height: newBounds.height }, rotation: ((rot % 360) + 360) % 360 })
        return
      }
    }
    node.scaleX(1)
    node.scaleY(1)
    const nw = Math.max(MIN_SIZE, rect.width() * node.scaleX())
    const nh = Math.max(MIN_SIZE, rect.height() * node.scaleY())
    rect.width(nw)
    rect.height(nh)
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    node.rotation(rot)
    onObjectResizeEnd(objectId, { position: { x: node.x() - nw / 2, y: node.y() - nh / 2 }, dimensions: { width: nw, height: nh }, rotation: ((rot % 360) + 360) % 360 })
  }

  const handlers = {
    ...shapeHandlers(objectId, viewportRef, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, isSelecting, {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove
        ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove }
        : {}),
      ...(onObjectDragStart && { onObjectDragStart }),
      ...(connectorToolActive && onConnectorHover && { connectorToolActive, onConnectorHover }),
      isPenStrokeActive,
    }),
    onClick: handleClick,
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
      const topLeftX = canvasPos.x - w / 2
      const topLeftY = canvasPos.y - h / 2
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position({ x: canvasPos.x, y: canvasPos.y })
    },
  }

  const label = truncateFilename(fileName, 20)
  const iconH = h * 0.5

  return (
    <>
      <Group
        ref={shapeRef}
        x={dragPreviewPosition?.x ?? pos.x + w / 2}
        y={dragPreviewPosition?.y ?? pos.y + h / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        {...handlers}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Rect width={w} height={h} fill="#f3f4f6" stroke={selected && isPointerTool ? '#8093F1' : '#d1d5db'} strokeWidth={selected && isPointerTool ? 3 : 1} cornerRadius={8} listening={false} />
        <Rect x={w * 0.1} y={h * 0.1} width={w * 0.8} height={iconH} fill="#dc2626" cornerRadius={4} listening={false} />
        <Text x={8} y={iconH + 8} width={w - 16} text={label} fontSize={12} fontFamily="Inter, sans-serif" fill="#374151" listening={false} ellipsis />
      </Group>
      {selected && isPointerTool && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={true} rotateAnchorOffset={16} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const DocumentShape = React.memo(DocumentShapeInner, areShapePropsEqual)
