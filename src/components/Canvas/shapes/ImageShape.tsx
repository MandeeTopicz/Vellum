/**
 * Renders an uploaded or linked image on the canvas.
 * Uses Konva Image, resizable and movable like other objects.
 */
import React, { useRef } from 'react'
import { Group, Image as KonvaImage, Rect, Transformer } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { ImageObject } from '../../../types'
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

export interface ImageShapeProps extends BaseShapeProps {
  obj: ImageObject
}

function ImageShapeInner({
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
}: ImageShapeProps) {
  const shapeRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)

  const [img] = useImage(obj.url, 'anonymous')
  const { objectId, dimensions } = obj
  const pos = displayPosition ?? obj.position
  const w = dimensions.width
  const h = dimensions.height
  const rotation = obj.rotation ?? 0

  useShapeTransform(selected, !!onObjectResizeEnd, trRef, shapeRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, imgNode: Konva.Image) => {
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    imgNode.width(b.width)
    imgNode.height(b.height)
    node.position({ x: cx, y: cy })
    node.offsetX(b.width / 2)
    node.offsetY(b.height / 2)
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: w, height: h }
    const stage = shapeRef.current?.getStage()
    const ptr = stage?.getPointerPosition()
    if (ptr && stage) {
      const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
      resizeStartPointerRef.current = { x: canvas.x, y: canvas.y }
    } else {
      resizeStartPointerRef.current = null
    }
  }

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    resizeShiftKeyRef.current = (e.evt as MouseEvent)?.shiftKey ?? false
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const tr = trRef.current
    const imgNode = node?.findOne('Image') as Konva.Image | undefined
    if (!snap || !start || !node || !imgNode || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const totalDx = canvas.x - start.x
    const totalDy = canvas.y - start.y
    const anchor = tr.getActiveAnchor?.() ?? null
    const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, resizeShiftKeyRef.current)
    applyBoundsToNode(node, newBounds, imgNode)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = shapeRef.current
    const tr = trRef.current
    const imgNode = node?.findOne('Image') as Konva.Image | undefined
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    if (!node || !onObjectResizeEnd || !imgNode) return
    const rot = node.rotation()
    if (snap && start && tr) {
      const stage = node.getStage()
      const ptr = stage?.getPointerPosition()
      if (ptr && stage) {
        const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
        const totalDx = canvas.x - start.x
        const totalDy = canvas.y - start.y
        const anchor = tr.getActiveAnchor?.() ?? null
        const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, resizeShiftKeyRef.current)
        applyBoundsToNode(node, newBounds, imgNode)
        node.rotation(rot)
        onObjectResizeEnd(objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: newBounds.width, height: newBounds.height },
          rotation: ((rot % 360) + 360) % 360,
        })
        return
      }
    }
    node.scaleX(1)
    node.scaleY(1)
    node.rotation(0)
    const nw = Math.max(MIN_SIZE, imgNode.width() * node.scaleX())
    const nh = Math.max(MIN_SIZE, imgNode.height() * node.scaleY())
    imgNode.width(nw)
    imgNode.height(nh)
    node.offsetX(nw / 2)
    node.offsetY(nh / 2)
    node.rotation(rot)
    const cx = node.x()
    const cy = node.y()
    onObjectResizeEnd(objectId, {
      position: { x: cx - nw / 2, y: cy - nh / 2 },
      dimensions: { width: nw, height: nh },
      rotation: ((rot % 360) + 360) % 360,
    })
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
    onDragEnd: (e: { target: Konva.Node }) => {
      const node = e.target
      const absPos = node.getAbsolutePosition()
      const canvasPos = stageToCanvas(absPos.x, absPos.y, viewportRef.current)
      const topLeftX = canvasPos.x - w / 2
      const topLeftY = canvasPos.y - h / 2
      onObjectDragEnd(objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + w / 2, y: topLeftY + h / 2 })
    },
  }

  if (!img) {
    return (
      <Group
        x={pos.x + w / 2}
        y={pos.y + h / 2}
        offsetX={w / 2}
        offsetY={h / 2}
        {...handlers}
      >
        {/* Placeholder must have listening=true for hit detection while image loads */}
        <Rect width={w} height={h} fill="#e5e7eb" listening={true} perfectDrawEnabled={false} />
      </Group>
    )
  }

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
        {/* Invisible hit area: Konva Image hit detection is unreliable; Rect ensures clicks register */}
        <Rect
          width={w}
          height={h}
          fill="transparent"
          listening={true}
          perfectDrawEnabled={false}
        />
        <KonvaImage
          image={img}
          width={w}
          height={h}
          listening={false}
          perfectDrawEnabled={false}
        />
        {selected && isPointerTool && (
          <Rect
            width={w}
            height={h}
            stroke="#8093F1"
            strokeWidth={3}
            fill="transparent"
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
      </Group>
      {selected && isPointerTool && onObjectResizeEnd && (
        <Transformer ref={trRef} rotateEnabled={true} rotateAnchorOffset={16} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const ImageShape = React.memo(ImageShapeInner, areShapePropsEqual)
