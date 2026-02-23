import { useRef } from 'react'
import { Group, Ellipse, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { CircleObject } from '../../../types/objects'
import type { BaseShapeProps } from './shared'
import { stageToCanvas } from '../../../utils/coordinates'
import {
  shapeHandlers,
  useShapeTransform,
  boundBoxFunc,
  MIN_SIZE,
  computeNewBoundsFromSnapshot,
  areShapePropsEqual,
  type ResizeSnapshot,
} from './shared'
import React from 'react'

interface CircleShapeProps extends BaseShapeProps {
  obj: CircleObject
}

function CircleShapeInner({
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
}: CircleShapeProps) {
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null)
  const resizeStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  const resizeShiftKeyRef = useRef(false)
  const pos = displayPosition ?? obj.position
  const w = obj.dimensions?.width ?? 100
  const h = obj.dimensions?.height ?? 100
  const rotation = (obj as { rotation?: number }).rotation ?? 0

  const hasResizeHandler = !!onObjectResizeEnd
  useShapeTransform(selected, hasResizeHandler, trRef, groupRef)

  const applyBoundsToNode = (node: Konva.Group, b: ResizeSnapshot, ellipse: Konva.Ellipse) => {
    const nrx = b.width / 2
    const nry = b.height / 2
    ellipse.setAttrs({ x: nrx, y: nry, radiusX: nrx, radiusY: nry })
    node.position({ x: b.left + nrx, y: b.top + nry })
    node.offsetX(nrx)
    node.offsetY(nry)
    node.scaleX(1)
    node.scaleY(1)
  }

  const handleTransformStart = () => {
    resizeSnapshotRef.current = { left: pos.x, top: pos.y, width: w, height: h }
    const stage = groupRef.current?.getStage()
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
    const node = groupRef.current
    const tr = trRef.current
    const ellipse = node?.findOne('Ellipse') as Konva.Ellipse | undefined
    if (!snap || !start || !node || !ellipse || !tr) return
    const stage = node.getStage()
    const ptr = stage?.getPointerPosition()
    if (!ptr || !stage) return
    const canvas = stageToCanvas(ptr.x, ptr.y, viewportRef.current)
    const totalDx = canvas.x - start.x
    const totalDy = canvas.y - start.y
    const anchor = tr.getActiveAnchor?.() ?? null
    const newBounds = computeNewBoundsFromSnapshot(snap, totalDx, totalDy, anchor, resizeShiftKeyRef.current)
    applyBoundsToNode(node, newBounds, ellipse)
    tr.forceUpdate()
  }

  const handleTransformEnd = () => {
    const snap = resizeSnapshotRef.current
    const start = resizeStartPointerRef.current
    const node = groupRef.current
    const tr = trRef.current
    const ellipse = node?.findOne('Ellipse') as Konva.Ellipse | undefined
    resizeSnapshotRef.current = null
    resizeStartPointerRef.current = null
    if (!onObjectResizeEnd || !node || !ellipse) return
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
        applyBoundsToNode(node, newBounds, ellipse)
        node.rotation(rot)
        onObjectResizeEnd(obj.objectId, {
          position: { x: newBounds.left, y: newBounds.top },
          dimensions: { width: newBounds.width, height: newBounds.height },
          rotation: ((rot % 360) + 360) % 360,
        })
        return
      }
    }
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    node.rotation(0)
    const newWidth = Math.max(MIN_SIZE, w * scaleX)
    const newHeight = Math.max(MIN_SIZE, h * scaleY)
    const nrx = newWidth / 2
    const nry = newHeight / 2
    ellipse.setAttrs({ x: nrx, y: nry, radiusX: nrx, radiusY: nry })
    node.offsetX(nrx)
    node.offsetY(nry)
    node.rotation(rot)
    onObjectResizeEnd(obj.objectId, {
      position: { x: node.x() - nrx, y: node.y() - nry },
      dimensions: { width: newWidth, height: newHeight },
      rotation: ((rot % 360) + 360) % 360,
    })
  }

  const handlers = {
    ...shapeHandlers(obj.objectId, viewportRef, canEdit, selected, onObjectDragEnd, onObjectClick, isPointerTool, isSelecting, {
      ...(selectedIds && multiDragStartPositionsRef && onMultiDragStart && onMultiDragMove ? { selectedIds, multiDragStartPositionsRef, multiDragStartPointerRef, onMultiDragStart, onMultiDragMove } : {}),
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
      onObjectDragEnd(obj.objectId, topLeftX, topLeftY)
      node.position({ x: topLeftX + w / 2, y: topLeftY + h / 2 })
    },
  }

  const rx = w / 2
  const ry = h / 2
  const strokeStyle = (obj as { strokeStyle?: 'solid' | 'dashed' | 'dotted' }).strokeStyle ?? 'solid'
  const opacity = (obj as { opacity?: number }).opacity ?? 1
  const dash = strokeStyle === 'dashed' ? [10, 5] : strokeStyle === 'dotted' ? [2, 4] : undefined

  return (
    <>
      <Group
        ref={groupRef}
        x={dragPreviewPosition?.x ?? (pos.x + w / 2)}
        y={dragPreviewPosition?.y ?? (pos.y + h / 2)}
        offsetX={w / 2}
        offsetY={h / 2}
        rotation={rotation}
        opacity={opacity}
        {...handlers}
        onTransformStart={onObjectResizeEnd ? handleTransformStart : undefined}
        onTransform={onObjectResizeEnd ? handleTransform : undefined}
        onTransformEnd={onObjectResizeEnd ? handleTransformEnd : undefined}
      >
        <Ellipse
          x={rx}
          y={ry}
          radiusX={rx}
          radiusY={ry}
          fill={obj.fillColor ?? 'transparent'}
          stroke={selected && isPointerTool ? '#8093F1' : (obj.strokeColor ?? '#000000')}
          strokeWidth={selected && isPointerTool ? 3 : (obj.strokeWidth ?? 2)}
          dash={dash}
          perfectDrawEnabled={false}
        />
      </Group>
      {selected && isPointerTool && hasResizeHandler && canEdit && (
        <Transformer ref={trRef} rotateEnabled={true} rotateAnchorOffset={16} boundBoxFunc={boundBoxFunc} />
      )}
    </>
  )
}

export const CircleShape = React.memo(CircleShapeInner, areShapePropsEqual)