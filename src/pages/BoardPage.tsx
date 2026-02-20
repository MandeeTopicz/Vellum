import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
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
import WhiteboardControls from '../components/Canvas/WhiteboardControls'
import StickyTextEditor from '../components/Canvas/StickyTextEditor'
import TextOverlayTextarea from '../components/Canvas/TextOverlayTextarea'
import TextFormatToolbar from '../components/Canvas/TextFormatToolbar'
import CommentModal from '../components/Canvas/CommentModal'
import CommentThreadModal from '../components/Canvas/CommentThreadModal'
import InviteModal from '../components/Invite/InviteModal'
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
    setViewport,
    dimensions,
    containerRef,
    handleUndo,
    handleRedo,
    setIsZooming,
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
          onViewportChange={setViewport}
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
