import { useParams, useNavigate } from 'react-router-dom'
import { useMemo, memo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getBoard } from '../services/board'
import { acceptInvite } from '../services/invites'
import { clearConversation } from '../services/aiAgent'
import InfiniteCanvas from '../components/Canvas/InfiniteCanvas'
import CursorLayer from '../components/Canvas/CursorLayer'
import ObjectLayer from '../components/Canvas/ObjectLayer'
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
import { StyleToolbar } from '../components/Canvas/StyleToolbar'
import { ContextMenu } from '../components/Canvas/ContextMenu'
import { TemplatesModal } from '../components/Canvas/TemplatesModal'
import InviteModal from '../components/Invite/InviteModal'
import { canvasToStage } from '../components/Canvas/InfiniteCanvas'
import { stageToCanvas } from '../utils/coordinates'
import type { BoardObject } from '../types'
import type { ObjectUpdates } from '../services/objects'
import { useBoardData } from '../hooks/useBoardData'
import { useBoardTools } from '../hooks/useBoardTools'
import { useBoardEvents } from '../hooks/useBoardEvents'
import aiIcon from '../assets/ai-icon.png'
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

  const tools = useBoardTools(canEdit)

  const events = useBoardEvents({
    data,
    tools,
    user,
  })

  const cursorLayerEl = useMemo(
    () => <CursorLayer boardId={id} viewport={viewport} currentUserId={user?.uid ?? ''} />,
    [id, viewport, user?.uid]
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

      <div ref={containerRef} className="board-canvas-container" data-testid="canvas">
        <InfiniteCanvas
          width={dimensions.width}
          height={dimensions.height}
          viewport={viewport}
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
          onContextMenu={(p) => tools.setContextMenuPos({ x: p.clientX, y: p.clientY })}
          onSelectionBoxEnd={canEdit ? events.handleSelectionBoxEnd : undefined}
        >
          <ObjectLayer
            objects={objects}
            viewport={viewport}
            canvasWidth={dimensions.width}
            canvasHeight={dimensions.height}
            arrowPreview={tools.arrowPreview}
            selectedIds={tools.selectedIds}
            isPointerTool={tools.activeTool === 'pointer'}
            onObjectDragEnd={events.handleObjectDragEnd}
            onObjectClick={events.handleObjectClick}
            onObjectResizeEnd={events.handleObjectResizeEnd}
            onStickyDoubleClick={events.handleStickyDoubleClick}
            onTextDoubleClick={events.handleTextDoubleClick}
            canEdit={canEdit}
            currentPenStroke={tools.currentPenStroke}
          />
          <CommentLayer
            comments={comments}
            isPointerTool={tools.activeTool === 'pointer'}
            onCommentClick={(comment) => {
              tools.setCommentModalPos(null)
              tools.setCommentThread(comment)
            }}
          />
        </InfiniteCanvas>

        <WhiteboardToolbar
          activeTool={tools.activeTool}
          onToolSelect={tools.handleToolSelect}
          onEmojiSelect={tools.handleEmojiSelect}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canEdit={canEdit}
          onTemplatesClick={
            canEdit
              ? () => {
                  tools.setTemplatesModalOpen(true)
                  tools.handleToolSelect('pointer')
                }
              : undefined
          }
        />

        {(tools.activeTool === 'pen' || tools.activeTool === 'highlighter' || tools.activeTool === 'eraser') && (
          <PenStylingToolbar
            penStyles={tools.penStyles}
            onPenStylesChange={tools.handlePenStylesChange}
            activeTool={tools.activeTool}
          />
        )}

        <WhiteboardControls
          showGrid={tools.showGrid}
          onGridToggle={tools.toggleGrid}
          zoom={viewport.scale}
          onZoomIn={events.handleZoomIn}
          onZoomOut={events.handleZoomOut}
        />

        {isSticky && tools.editingStickyId && editingSticky && (
          <StickyTextEditor
            sticky={editingSticky}
            viewport={viewport}
            onSave={(content) => events.handleStickySave(tools.editingStickyId!, content)}
            onCancel={() => tools.setEditingStickyId(null)}
          />
        )}

        {tools.editingText && (
          <>
            <TextFormatToolbar
              textBoxId={tools.editingText.id}
              currentFormat={tools.editingText.textStyle}
              position={{ x: tools.editingText.screenX, y: tools.editingText.screenY }}
              onFormatChange={events.handleTextFormatChange}
              onCreateMindMap={events.handleCreateMindMap}
            />
            <TextOverlayTextarea
              editingText={tools.editingText}
              onCommit={events.handleTextCommit}
              onCancel={events.handleTextCancel}
              onValueChange={(v) => { tools.textareaValueRef.current = v }}
            />
          </>
        )}

        <CommentModal
          position={tools.commentModalPos}
          viewport={viewport}
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

        {tools.selectedIds.size >= 1 && canEdit && (() => {
          const selectedIds = Array.from(tools.selectedIds)
          const obj = objects[selectedIds[0]] as BoardObject | undefined
          if (!obj) return null
          const objs = selectedIds.map((id) => objects[id]).filter(Boolean) as BoardObject[]
          let centerX = 0
          let topY = 0
          const getCenterAndTop = (o: BoardObject): { x: number; y: number } => {
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
              }
            })
            centerX = (minX + maxX) / 2
            topY = minY
          }
          const { x: stageX, y: stageY } = canvasToStage(centerX, topY, viewport)
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
                  viewport
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
