import { useParams, useNavigate } from 'react-router-dom'
import { useMemo, memo, useState, useCallback, useRef } from 'react'
import { throttle } from '../utils/throttle'
import { useAuth } from '../context/AuthContext'
import { getBoard } from '../services/board'
import { acceptInvite } from '../services/invites'
import { clearConversation } from '../services/aiAgent'
import InfiniteCanvas from '../components/Canvas/InfiniteCanvas'
import CursorLayer from '../components/Canvas/CursorLayer'
import ObjectLayer from '../components/Canvas/ObjectLayer'
import { ActiveStrokeLine } from '../components/Canvas/shapes'
import CommentLayer from '../components/Canvas/CommentLayer'
import WhiteboardToolbar from '../components/Canvas/WhiteboardToolbar'
import PenStylingToolbar from '../components/Canvas/PenStylingToolbar'
import AIChatPanel from '../components/Canvas/AIChatPanel'
import WhiteboardNav from '../components/Canvas/WhiteboardNav'
import WhiteboardControlsBase from '../components/Canvas/WhiteboardControls'

const WhiteboardControls = memo(WhiteboardControlsBase)
import StickyTextEditor from '../components/Canvas/StickyTextEditor'
import TextOverlayTextarea from '../components/Canvas/TextOverlayTextarea'
import TextFormatToolbar from '../components/Canvas/TextFormatToolbar'
import CommentModal from '../components/Canvas/CommentModal'
import CommentThreadModal from '../components/Canvas/CommentThreadModal'
import LinkModal from '../components/Canvas/LinkModal'
import { StyleToolbar } from '../components/Canvas/StyleToolbar'
import { ContextMenu } from '../components/Canvas/ContextMenu'
import { Toast } from '../components/Toast'
import { TemplatesModal } from '../components/Canvas/TemplatesModal'
import InviteModal from '../components/Invite/InviteModal'
import { canvasToStage } from '../components/Canvas/InfiniteCanvas'
import { stageToCanvas } from '../utils/coordinates'
import { getConnectedLineIds, getLineAnchorStatus } from '../utils/connectedLines'
import { getParentId, resolveWorldPos, type FramesByIdMap } from '../utils/frames'
import type { LineObject } from '../types'
import type { BoardObject } from '../types'
import type { ObjectUpdates } from '../services/objects'
import type { BoardComment } from '../services/comments'
import { useBoardData } from '../hooks/useBoardData'
import { useBoardTools } from '../hooks/useBoardTools'
import { useBoardEvents } from '../hooks/useBoardEvents'
import aiIcon from '../assets/ai-icon.png'
import convertToTextIcon from '../assets/convert-to-text-icon.png'
import './BoardPage.css'

/**
 * Board page: whiteboard with tools, objects, comments, AI.
 * Composes useBoardData, useBoardTools, useBoardEvents.
 */
export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const data = useBoardData({
    boardId: boardId ?? '',
    user,
  })

  const {
    id,
    board,
    setBoard,
    objects,
    comments,
    loading,
    accessDenied,
    canEdit,
    canUndo,
    canRedo,
    pendingInvite,
    viewport,
    setViewport: _setViewport,
    onViewportChange,
    dimensions,
    containerRef,
    handleUndo,
    handleRedo,
    setIsZooming,
    setIsPanning,
  } = data

  const stableViewport = useMemo(
    () => ({ x: viewport.x, y: viewport.y, scale: viewport.scale }),
    [viewport.x, viewport.y, viewport.scale]
  )

  const tools = useBoardTools(canEdit)

  const handleContextMenu = useCallback(
    (p: { clientX: number; clientY: number }) => {
      tools.setContextMenuPos({ x: p.clientX, y: p.clientY })
    },
    [tools.setContextMenuPos]
  )
  const handleSelectionStart = useCallback(() => {
    tools.setSelectionActive(true)
    setIsSelecting(true)
  }, [tools.setSelectionActive])
  const handleSelectionEnd = useCallback(() => {
    tools.setSelectionActive(false)
    setIsSelecting(false)
  }, [tools.setSelectionActive])

  const handleCommentClick = useCallback(
    (comment: BoardComment) => {
      tools.setCommentModalPos(null)
      tools.setCommentThread(comment)
    },
    [tools.setCommentModalPos, tools.setCommentThread]
  )

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [multiDragPositions, setMultiDragPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const [multiDragLineEndpoints, setMultiDragLineEndpoints] = useState<Record<string, { start?: { x: number; y: number }; end?: { x: number; y: number } }> | null>(null)
  const multiDragStartPositionsRef = useRef<Record<string, { x: number; y: number }> | null>(null)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)
  const multiDragStartPointerRef = useRef<{ x: number; y: number } | null>(null)
  /** Snapshot of line start/end at drag start — avoids compounding errors during fast movement */
  const multiDragStartLineEndpointsRef = useRef<Record<string, { start: { x: number; y: number }; end: { x: number; y: number } }> | null>(null)
  const multiDragRafIdRef = useRef<number | null>(null)
  const clearMultiDragPositions = useCallback(() => {
    setMultiDragPositions(null)
    setMultiDragLineEndpoints(null)
    multiDragStartPositionsRef.current = null
    multiDragStartPointerRef.current = null
    multiDragStartLineEndpointsRef.current = null
    if (multiDragRafIdRef.current != null) {
      cancelAnimationFrame(multiDragRafIdRef.current)
      multiDragRafIdRef.current = null
    }
  }, [])
  const throttledSetMultiDragPositions = useMemo(
    () => throttle((p: Record<string, { x: number; y: number }>) => setMultiDragPositions(p), 16),
    []
  )

  const handleMultiDragMove = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const start = multiDragStartPositionsRef.current
      const lineSnap = multiDragStartLineEndpointsRef.current
      if (!start) return

      if (multiDragRafIdRef.current != null) cancelAnimationFrame(multiDragRafIdRef.current)
      multiDragRafIdRef.current = requestAnimationFrame(() => {
        multiDragRafIdRef.current = null
        const movingObjectIds = new Set(
          Object.keys(positions).filter((id) => objects[id]?.type !== 'line')
        )
        const framesById: FramesByIdMap = {}
        for (const o of Object.values(objects)) {
          if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
        }
        const nextPositions: Record<string, { x: number; y: number }> = {}
        const lineEndpoints: Record<string, { start?: { x: number; y: number }; end?: { x: number; y: number } }> = {}

        for (const [id, pos] of Object.entries(positions)) {
          const obj = objects[id]
          if (!obj) continue
          if (obj.type === 'line') {
            const line = obj as LineObject
            const status = getLineAnchorStatus(line, id, objects, movingObjectIds, framesById)
            const snap = lineSnap?.[id]
            const snapStart = snap?.start ?? line.start
            const snapEnd = snap?.end ?? line.end
            if (status.startConnected && status.endConnected) {
              const startPos = start[id]
              if (startPos) {
                const ldx = pos.x - startPos.x
                const ldy = pos.y - startPos.y
                lineEndpoints[id] = {
                  start: { x: snapStart.x + ldx, y: snapStart.y + ldy },
                  end: { x: snapEnd.x + ldx, y: snapEnd.y + ldy },
                }
              }
              nextPositions[id] = pos
            } else if (status.startConnected) {
              const startPos = start[id]
              if (startPos) {
                const ldx = pos.x - startPos.x
                const ldy = pos.y - startPos.y
                lineEndpoints[id] = { start: { x: snapStart.x + ldx, y: snapStart.y + ldy } }
              }
            } else if (status.endConnected) {
              const startPos = start[id]
              if (startPos) {
                const ldx = pos.x - startPos.x
                const ldy = pos.y - startPos.y
                lineEndpoints[id] = { end: { x: snapEnd.x + ldx, y: snapEnd.y + ldy } }
              }
            }
          } else {
            nextPositions[id] = pos
          }
        }
        throttledSetMultiDragPositions(nextPositions)
        setMultiDragLineEndpoints(Object.keys(lineEndpoints).length > 0 ? lineEndpoints : null)
      })
    },
    [objects, throttledSetMultiDragPositions]
  )

  const handleMultiDragStart = useCallback((positions: Record<string, { x: number; y: number }>) => {
    setMultiDragPositions(positions)
    setMultiDragLineEndpoints(null)
    const movingObjectIds = new Set(
      Object.keys(positions).filter((id) => objects[id]?.type !== 'line')
    )
    const framesById: FramesByIdMap = {}
    for (const o of Object.values(objects)) {
      if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
    }
    const lineSnap: Record<string, { start: { x: number; y: number }; end: { x: number; y: number } }> = {}
    for (const [id, obj] of Object.entries(objects)) {
      if (obj?.type !== 'line') continue
      const line = obj as LineObject
      const status = getLineAnchorStatus(line, id, objects, movingObjectIds, framesById)
      if (status.startConnected || status.endConnected) {
        lineSnap[id] = { start: { ...line.start }, end: { ...line.end } }
      }
    }
    multiDragStartLineEndpointsRef.current = Object.keys(lineSnap).length > 0 ? lineSnap : null
  }, [objects])

  /** Include frame children and lines whose start/end anchors connect to selected objects */
  const expandedSelectedIds = useMemo(() => {
    const sel = tools.selectedIds
    if (sel.size < 1) return sel
    const framesById: FramesByIdMap = {}
    for (const o of Object.values(objects)) {
      if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
    }
    /** Add all children of any selected frame so they move with the frame */
    const frameChildIds = new Set<string>()
    for (const o of Object.values(objects)) {
      const parentId = getParentId(o)
      if (parentId && sel.has(parentId)) frameChildIds.add(o.objectId)
    }
    /** Exclude frames from line anchor check — only lines whose endpoints touch frame children move (Fix 2) */
    const anchorIdsForLines = new Set<string>()
    for (const oid of [...sel, ...frameChildIds]) {
      const o = objects[oid]
      if (o?.type !== 'frame') anchorIdsForLines.add(oid)
    }
    const connectedLineIds = getConnectedLineIds(objects, anchorIdsForLines, framesById)
    const expanded = new Set([...sel, ...frameChildIds, ...connectedLineIds])
    if (expanded.size === sel.size) return sel
    return expanded
  }, [tools.selectedIds, objects])

  const events = useBoardEvents({
    data,
    tools,
    user,
    clearMultiDragPositions,
    expandedSelectedIds,
    showToast: (msg) => setToastMessage(msg),
  })

  const handleUploadFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      events.handleUploadFiles(e.target.files)
      e.target.value = ''
    },
    [events.handleUploadFiles]
  )

  const selectionIsPenOnly =
    tools.selectedIds.size > 0 &&
    Array.from(tools.selectedIds).every((oid) => objects[oid]?.type === 'pen')

  /** Convert to text only when pointer tool is active (never during pen/highlighter/eraser) */
  const DRAWING_TOOLS = ['pen', 'highlighter', 'eraser'] as const
  const showConvertToText =
    selectionIsPenOnly && !DRAWING_TOOLS.includes(tools.activeTool as (typeof DRAWING_TOOLS)[number])

  const cursorLayerEl = useMemo(
    () => <CursorLayer boardId={id} viewport={stableViewport} currentUserId={user?.uid ?? ''} />,
    [id, stableViewport, user?.uid]
  )

  const canvasChildren = useMemo(
    () => (
      <>
        <ObjectLayer
          objects={objects}
          viewport={stableViewport}
          canvasWidth={dimensions.width}
          canvasHeight={dimensions.height}
          arrowPreview={tools.arrowPreview}
          selectedIds={expandedSelectedIds}
          isPointerTool={tools.activeTool === 'pointer'}
          isSelecting={isSelecting}
          onObjectDragEnd={events.handleObjectDragEnd}
          onObjectDragStart={events.handleObjectDragStart}
          onObjectClick={events.handleObjectClick}
          onObjectResizeEnd={events.handleObjectResizeEnd}
          onStickyDoubleClick={events.handleStickyDoubleClick}
          onTextDoubleClick={events.handleTextDoubleClick}
          canEdit={canEdit}
          currentPenStroke={tools.currentPenStroke}
          isPenStrokeActive={tools.isPenStrokeActive}
          multiDragPositions={multiDragPositions}
          multiDragLineEndpoints={multiDragLineEndpoints}
          multiDragStartPositionsRef={multiDragStartPositionsRef}
          multiDragStartPointerRef={multiDragStartPointerRef}
          onMultiDragStart={handleMultiDragStart}
          onMultiDragMove={handleMultiDragMove}
          convertJustFinishedId={events.convertJustFinishedId}
          connectorToolActive={events.connectorToolActive}
          onConnectorHover={events.onConnectorHover}
          connectorSource={events.connectorSource}
          connectorPreviewEndPos={events.connectorPreviewEndPos}
          connectorHoveredObjectId={events.connectorHoveredObjectId}
          activeConnectorType={events.activeConnectorType}
        />
        <CommentLayer
          comments={comments}
          isPointerTool={tools.activeTool === 'pointer'}
          isSelecting={isSelecting}
          onCommentClick={handleCommentClick}
        />
      </>
    ),
    [
      objects,
      stableViewport,
      dimensions.width,
      dimensions.height,
      tools.arrowPreview,
      expandedSelectedIds,
      tools.activeTool,
      isSelecting,
      events.handleObjectDragEnd,
      events.handleObjectDragStart,
      events.handleObjectClick,
      events.handleObjectResizeEnd,
      events.handleStickyDoubleClick,
      events.handleTextDoubleClick,
      canEdit,
      tools.currentPenStroke,
      tools.isPenStrokeActive,
      multiDragPositions,
      multiDragLineEndpoints,
      multiDragStartPositionsRef,
      multiDragStartPointerRef,
      handleMultiDragStart,
      handleMultiDragMove,
      events.convertJustFinishedId,
      events.connectorToolActive,
      events.onConnectorHover,
      events.connectorSource,
      events.connectorPreviewEndPos,
      events.connectorHoveredObjectId,
      events.activeConnectorType,
      comments,
      handleCommentClick,
    ]
  )

  const editingSticky = tools.editingStickyId ? objects[tools.editingStickyId] : null
  const isSticky = editingSticky?.type === 'sticky'

  if (!user) return null

  if (loading) {
    return <div className="board-page-loading">Loading board…</div>
  }

  if (pendingInvite && board) {
    return (
      <div className="board-page-denied board-page-invite">
        <p>
          You&apos;ve been invited to <strong>{board.name || 'Untitled Board'}</strong>.
        </p>
        <p className="board-page-invite-sub">Accept the invite to view and collaborate.</p>
        <div className="board-page-denied-actions">
          <button
            type="button"
            className="board-page-btn-primary"
            onClick={async () => {
              try {
                await acceptInvite(id, pendingInvite.id)
                window.location.reload()
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to accept invite')
              }
            }}
          >
            Accept invite
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="board-page-denied">
        <p>You don&apos;t have access to this board{board ? ` (${board.name || 'Untitled Board'})` : ''}.</p>
        <p className="board-page-denied-hint">
          Ask the owner to invite you or enable &quot;Anyone with the link can view/edit&quot; in Share settings.
        </p>
        <button type="button" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  if (!board) return null

  return (
    <div className="board-page">
      <WhiteboardNav
        boardName={board.name || 'Untitled Board'}
        onBoardNameChange={events.handleBoardNameChange}
        onShareClick={() => tools.setShareModalOpen(true)}
        canEdit={canEdit}
        canShare={board.ownerId === user.uid}
        publicAccess={board.publicAccess ?? 'none'}
      />

      <div
        ref={containerRef}
        className="board-canvas-container"
        data-testid="canvas"
        onDrop={
          canEdit
            ? (e) => {
                e.preventDefault()
                const rect = containerRef.current?.getBoundingClientRect()
                if (!rect) return
                const canvasPos = stageToCanvas(e.clientX - rect.left, e.clientY - rect.top, stableViewport)
                events.handleCanvasFileDrop(Array.from(e.dataTransfer?.files ?? []), canvasPos)
              }
            : undefined
        }
        onDragOver={
          canEdit
            ? (e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }
            : undefined
        }
        onContextMenu={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('textarea') || target.closest('input') || target.closest('[contenteditable="true"]')) {
            return
          }
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <InfiniteCanvas
          width={dimensions.width}
          height={dimensions.height}
          viewport={stableViewport}
          onViewportChange={onViewportChange}
          onMouseMove={events.handleStageMouseMove}
          onBackgroundClick={events.handleBackgroundClick}
          showGrid={tools.showGrid}
          creationToolActive={tools.activeTool !== 'pointer'}
          editingTextOpen={tools.editingText != null}
          cursorLayer={cursorLayerEl}
          penDrawingActive={tools.penDrawingActive}
          eraserActive={tools.eraserActive}
          onPenStrokeStart={events.handlePenStrokeStart}
          onPenStrokeMove={events.handlePenStrokeMove}
          onPenStrokeEnd={events.handlePenStrokeEnd}
          onEraserMove={events.handleEraserMove}
          cursor={tools.canvasCursor}
          arrowToolActive={tools.arrowToolActive}
          onArrowDragStart={events.handleArrowDragStart}
          onArrowDragMove={events.handleArrowDragMove}
          onArrowDragEnd={events.handleArrowDragEnd}
          onZoomingChange={setIsZooming}
          onPanningChange={setIsPanning}
          onContextMenu={handleContextMenu}
          onSelectionBoxEnd={canEdit ? events.handleSelectionBoxEnd : undefined}
          lassoToolActive={tools.activeTool === 'lasso'}
          onLassoEnd={canEdit ? events.handleLassoEnd : undefined}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          activePenStrokeOverlay={
            tools.isPenStrokeActive && tools.penDrawingActive ? (
              <ActiveStrokeLine
                lineRef={tools.activeStrokeLineRef}
                stroke={tools.penStyles.color}
                strokeWidth={tools.penStyles.size}
                opacity={tools.penStyles.opacity / 100}
                strokeType={tools.penStyles.strokeType}
              />
            ) : undefined
          }
        >
          {canvasChildren}
        </InfiniteCanvas>

        <WhiteboardToolbar
          activeTool={tools.activeTool}
          activeConnectorType={tools.activeConnectorType}
          onToolSelect={tools.handleToolSelect}
          onEmojiSelect={tools.handleEmojiSelect}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          canEdit={canEdit}
          onPenDropdownOpen={() => tools.setPenStylesOpen(true)}
          onTemplatesClick={
            canEdit
              ? () => {
                  tools.setTemplatesModalOpen(true)
                  tools.handleToolSelect('pointer')
                }
              : undefined
          }
          onLinkClick={canEdit ? () => tools.setLinkModalOpen(true) : undefined}
          hasSelection={tools.selectedIds.size > 0}
        />

        <input
          ref={uploadFileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          aria-hidden
          onChange={handleUploadFileChange}
        />

        {(tools.activeTool === 'pen' || tools.activeTool === 'highlighter' || tools.activeTool === 'eraser') &&
          tools.penStylesOpen && (
            <PenStylingToolbar
              penStyles={tools.penStyles}
              onPenStylesChange={tools.handlePenStylesChange}
              activeTool={tools.activeTool}
            />
          )}

        <WhiteboardControls
          showGrid={tools.showGrid}
          onGridToggle={tools.toggleGrid}
          zoom={stableViewport.scale}
          onZoomIn={events.handleZoomIn}
          onZoomOut={events.handleZoomOut}
        />

        {isSticky && tools.editingStickyId && editingSticky && (() => {
          const framesById: FramesByIdMap = {}
          for (const o of Object.values(objects)) {
            if (o.type === 'frame') framesById[o.objectId] = o as FramesByIdMap[string]
          }
          const worldPos = getParentId(editingSticky)
            ? resolveWorldPos(editingSticky, framesById)
            : undefined
          return (
            <StickyTextEditor
              sticky={editingSticky}
              viewport={stableViewport}
              onSave={(content) => events.handleStickySave(tools.editingStickyId!, content)}
              onCancel={() => tools.setEditingStickyId(null)}
              worldPosition={worldPos ?? undefined}
            />
          )
        })()}

        {tools.editingText && (
          <>
            <TextFormatToolbar
              textBoxId={tools.editingText.id}
              currentFormat={tools.editingText.textStyle}
              position={{ x: tools.editingText.screenX, y: tools.editingText.screenY }}
              onFormatChange={events.handleTextFormatChange}
            />
            <TextOverlayTextarea
              editingText={tools.editingText}
              viewportScale={stableViewport.scale}
              onCommit={events.handleTextCommit}
              onCancel={events.handleTextCancel}
              onBeforeClose={() => { tools.justClosedTextEditorRef.current = true }}
              onValueChange={(v) => { tools.textareaValueRef.current = v }}
            />
          </>
        )}

        <CommentModal
          position={tools.commentModalPos}
          viewport={stableViewport}
          canvasWidth={dimensions.width}
          canvasHeight={dimensions.height}
          containerRef={containerRef}
          onSave={events.handleCommentSave}
          onCancel={() => tools.setCommentModalPos(null)}
        />

        <CommentThreadModal
          comment={comments.find((c) => c.id === tools.commentThread?.id) ?? tools.commentThread}
          currentUserId={user.uid}
          onReply={events.handleCommentReply}
          onDelete={events.handleCommentDelete}
          onClose={() => tools.setCommentThread(null)}
        />

        <LinkModal
          isOpen={tools.linkModalOpen}
          onClose={() => tools.setLinkModalOpen(false)}
          onApplyLink={events.handleAddLink}
          boardId={id}
        />

        {tools.selectedIds.size >= 1 && canEdit && showConvertToText && (() => {
          const selectedIds = Array.from(tools.selectedIds)
          const objs = selectedIds.map((id) => objects[id]).filter(Boolean) as BoardObject[]
          if (objs.length === 0) return null
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          objs.forEach((o) => {
            if (o.type === 'pen' && 'points' in o) {
              ;(o as { points: [number, number][] }).points.forEach((p) => {
                minX = Math.min(minX, p[0])
                minY = Math.min(minY, p[1])
                maxX = Math.max(maxX, p[0])
                maxY = Math.max(maxY, p[1])
              })
            }
          })
          const centerX = minX === Infinity ? 0 : (minX + maxX) / 2
          const topY = minY === Infinity ? 0 : minY
          const { x: stageX, y: stageY } = canvasToStage(centerX, topY - 40, stableViewport)
          const tl = canvasToStage(minX, minY, stableViewport)
          const br = canvasToStage(maxX, maxY, stableViewport)
          const overlayW = Math.max(1, br.x - tl.x)
          const overlayH = Math.max(1, br.y - tl.y)
          const isConverting = events.isConverting
          const convertButtonShake = events.convertButtonShake
          return (
            <>
              {isConverting && (
                <div
                  className="pen-convert-overlay"
                  style={{
                    left: tl.x,
                    top: tl.y,
                    width: overlayW,
                    height: overlayH,
                    zIndex: 999,
                  }}
                />
              )}
              <div
                className={`pen-convert-toolbar ${convertButtonShake ? 'pen-convert-btn-shake' : ''}`}
                style={{
                  position: 'absolute',
                  left: stageX,
                  top: stageY - 50,
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                }}
              >
                <button
                  type="button"
                  disabled={isConverting}
                  onClick={() => events.handleHandwritingRecognition()}
                  className={isConverting ? 'pen-convert-btn-loading' : ''}
                  style={{
                    padding: '8px 14px',
                    fontSize: 14,
                    color: '#000',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: isConverting ? 'not-allowed' : 'pointer',
                    opacity: isConverting ? 0.7 : 1,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {isConverting ? (
                    <>
                      <span className="pen-convert-spinner" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <img src={convertToTextIcon} alt="" width={18} height={18} style={{ flexShrink: 0 }} />
                      Convert to Text
                    </>
                  )}
                </button>
              </div>
            </>
          )
        })()}

        {tools.selectedIds.size >= 1 && canEdit && !selectionIsPenOnly && (() => {
          const selectedIds = Array.from(tools.selectedIds)
          const obj = objects[selectedIds[0]] as BoardObject | undefined
          if (!obj) return null
          const objs = selectedIds.map((id) => objects[id]).filter(Boolean) as BoardObject[]
          let centerX = 0
          let topY = 0
          const getCenterAndTop = (o: BoardObject): { x: number; y: number } => {
            if (o.type === 'emoji' && 'position' in o) {
              const fs = (o as { fontSize?: number }).fontSize ?? 32
              return { x: o.position.x + fs / 2, y: o.position.y + fs / 2 }
            }
            if ('position' in o && o.position) {
              const dims = 'dimensions' in o ? (o.dimensions ?? { width: 0, height: 0 }) : { width: 0, height: 0 }
              return { x: o.position.x + dims.width / 2, y: o.position.y }
            }
            if (o.type === 'line') {
              const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
              return { x: (line.start.x + line.end.x) / 2, y: Math.min(line.start.y, line.end.y) }
            }
            if (o.type === 'pen' && 'points' in o) {
              const pts = (o as { points: [number, number][] }).points
              if (pts.length === 0) return { x: 0, y: 0 }
              const xs = pts.map((p) => p[0])
              const ys = pts.map((p) => p[1])
              return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) }
            }
            return { x: 0, y: 0 }
          }
          if (objs.length === 1) {
            const { x, y } = getCenterAndTop(objs[0])
            centerX = x
            topY = y
          } else {
            let minX = Infinity
            let minY = Infinity
            let maxX = -Infinity
            let maxY = -Infinity
            objs.forEach((o) => {
              if ('position' in o && o.position && 'dimensions' in o) {
                const pos = o.position
                const dims = (o.dimensions ?? { width: 0, height: 0 }) as { width: number; height: number }
                minX = Math.min(minX, pos.x)
                minY = Math.min(minY, pos.y)
                maxX = Math.max(maxX, pos.x + dims.width)
                maxY = Math.max(maxY, pos.y + dims.height)
              } else if (o.type === 'line') {
                const line = o as { start: { x: number; y: number }; end: { x: number; y: number } }
                minX = Math.min(minX, line.start.x, line.end.x)
                minY = Math.min(minY, line.start.y, line.end.y)
                maxX = Math.max(maxX, line.start.x, line.end.x)
                maxY = Math.max(maxY, line.start.y, line.end.y)
              } else if (o.type === 'pen' && 'points' in o) {
                const pts = (o as { points: [number, number][] }).points
                pts.forEach((p) => {
                  minX = Math.min(minX, p[0])
                  minY = Math.min(minY, p[1])
                  maxX = Math.max(maxX, p[0])
                  maxY = Math.max(maxY, p[1])
                })
              } else if (o.type === 'emoji' && 'position' in o) {
                const pos = o.position
                const fs = (o as { fontSize?: number }).fontSize ?? 32
                minX = Math.min(minX, pos.x)
                minY = Math.min(minY, pos.y)
                maxX = Math.max(maxX, pos.x + fs)
                maxY = Math.max(maxY, pos.y + fs)
              }
            })
            centerX = (minX + maxX) / 2
            topY = minY
          }
          const { x: stageX, y: stageY } = canvasToStage(centerX, topY, stableViewport)
          return (
            <StyleToolbar
              selectedObject={obj}
              onUpdate={(updates) => {
                selectedIds.forEach((id) => events.handleObjectStyleUpdate(id, updates as ObjectUpdates))
              }}
              position={{ x: stageX, y: stageY }}
              onCopy={events.handleCopy}
              onPaste={events.handlePaste}
              onDuplicate={events.handleDuplicate}
              onDelete={events.handleDelete}
              onSendToFront={events.handleSendToFront}
              onBringToBack={events.handleBringToBack}
              canPaste={tools.copiedObjects.length > 0}
            />
          )
        })()}

        {tools.templatesModalOpen && (
          <TemplatesModal
            isOpen={tools.templatesModalOpen}
            onClose={() => tools.setTemplatesModalOpen(false)}
            category={tools.templatesCategory}
            onCategoryChange={tools.setTemplatesCategory}
            search={tools.templatesSearch}
            onSearchChange={tools.setTemplatesSearch}
            onInsertTemplate={events.insertTemplateByKey}
          />
        )}

        {tools.contextMenuPos && (() => {
          const rect = containerRef.current?.getBoundingClientRect()
          const pasteTargetCanvasPos =
            rect != null
              ? stageToCanvas(
                  tools.contextMenuPos.x - rect.left,
                  tools.contextMenuPos.y - rect.top,
                  stableViewport
                )
              : undefined
          return (
            <ContextMenu
              position={tools.contextMenuPos}
              hasSelection={tools.selectedIds.size > 0}
              canPaste={tools.copiedObjects.length > 0}
              pasteTargetCanvasPos={pasteTargetCanvasPos}
              onClose={() => tools.setContextMenuPos(null)}
              onCopy={events.handleCopy}
              onPaste={events.handlePaste}
              onDuplicate={events.handleDuplicate}
              onDelete={events.handleDelete}
              onSendToFront={events.handleSendToFront}
              onBringToBack={events.handleBringToBack}
              onConvertToText={events.handleHandwritingRecognition}
              selectionIsPenOnly={showConvertToText}
              onResetRotation={
                tools.selectedIds.size === 1
                  ? (() => {
                      const o = objects[Array.from(tools.selectedIds)[0]] as { rotation?: number } | undefined
                      const rot = o?.rotation ?? 0
                      if (rot === 0) return undefined
                      return () => events.handleObjectStyleUpdate(Array.from(tools.selectedIds)[0], { rotation: 0 })
                    })()
                  : undefined
              }
            />
          )
        })()}

        {tools.shareModalOpen && (
          <InviteModal
            boardId={id}
            onClose={() => tools.setShareModalOpen(false)}
            onBoardUpdated={async () => {
              const b = await getBoard(id)
              if (b) setBoard(b)
            }}
          />
        )}

        <AIChatPanel
          isOpen={tools.isChatOpen}
          onClose={() => tools.setIsChatOpen(false)}
          onSendMessage={events.handleAICommand}
          onClearConversation={() => clearConversation(id)}
          canEdit={canEdit}
        />

        {toastMessage && (
          <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        )}

        {!tools.isChatOpen && (
          <button
            type="button"
            className="ai-toggle-btn"
            onClick={() => tools.setIsChatOpen(true)}
            aria-label="Open AI Assistant"
          >
            <img src={aiIcon} alt="" width={28} height={28} />
          </button>
        )}
      </div>
    </div>
  )
}
