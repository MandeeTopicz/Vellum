/**
 * Board tool state: activeTool, selection, pen/eraser/arrow state.
 */
import { useState, useCallback, useRef, useMemo } from 'react'
import type Konva from 'konva'
import type { WhiteboardTool } from '../components/Canvas/WhiteboardToolbar'
import type { BoardObject } from '../types'
import type { PenStyles } from '../components/Canvas/PenStylingToolbar'
import type { EditingTextState } from '../components/Canvas/TextOverlayTextarea'
import type { BoardComment } from '../services/comments'
import type { CurrentPenStroke } from '../components/Canvas/shapes'

const ERASER_CURSOR =
  "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\"><circle cx=\"16\" cy=\"16\" r=\"10\" fill=\"none\" stroke=\"%23333\" stroke-width=\"2\"/></svg>') 16 16, crosshair"

const CONNECTION_TOOLS = ['arrow-straight', 'arrow-curved', 'arrow-curved-cw', 'arrow-elbow-bidirectional', 'arrow-double'] as const
export type ConnectorType = (typeof CONNECTION_TOOLS)[number]
const isConnectionTool = (t: string): t is ConnectorType =>
  CONNECTION_TOOLS.includes(t as ConnectorType)

const PERSISTENT_DRAWING_TOOLS = ['pen', 'highlighter', 'eraser'] as const

export function useBoardTools(canEdit: boolean) {
  const [activeTool, setActiveToolState] = useState<WhiteboardTool>('pointer')
  const [selectedIds, setSelectedIdsRaw] = useState<Set<string>>(new Set())
  const isSelectionActiveRef = useRef(false)
  const setSelectionActive = useCallback((v: boolean) => {
    isSelectionActiveRef.current = v
  }, [])
  const setSelectedIds = useCallback(
    (value: React.SetStateAction<Set<string>>, options?: { force?: boolean }) => {
      const isDrawing = PERSISTENT_DRAWING_TOOLS.includes(activeTool as (typeof PERSISTENT_DRAWING_TOOLS)[number])
      if (!options?.force && isDrawing && !isSelectionActiveRef.current) return
      setSelectedIdsRaw(value)
    },
    [activeTool]
  )
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState<EditingTextState | null>(null)
  const [showGrid, setShowGrid] = useState(() => {
    try {
      const v = localStorage.getItem('vellum:showGrid')
      return v === null ? true : v === 'true'
    } catch {
      return true
    }
  })
  const [commentModalPos, setCommentModalPos] = useState<{ x: number; y: number } | null>(null)
  const [commentThread, setCommentThread] = useState<BoardComment | null>(null)
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [currentPenPoints, setCurrentPenPoints] = useState<[number, number][]>([])
  const [arrowPreview, setArrowPreview] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
    type: string
  } | null>(null)
  const [penToolStyles, setPenToolStyles] = useState<PenStyles>({
    color: '#000000',
    size: 3,
    opacity: 100,
    strokeType: 'solid',
  })
  const [highlighterToolStyles, setHighlighterToolStyles] = useState<PenStyles>({
    color: '#eab308',
    size: 24,
    opacity: 35,
    strokeType: 'solid',
  })
  const [eraserSize, setEraserSize] = useState(10)
  const [copiedObjects, setCopiedObjects] = useState<BoardObject[]>([])
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false)
  const [templatesSearch, setTemplatesSearch] = useState('')
  const [templatesCategory, setTemplatesCategory] = useState('Meetings & Workshops')
  const [penStylesOpen, setPenStylesOpen] = useState(true)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [activeConnectorType, setActiveConnectorType] = useState<ConnectorType>('arrow-straight')

  const currentPenPointsRef = useRef<[number, number][]>([])
  const activeStrokeLineRef = useRef<Konva.Line | null>(null)
  const [isPenStrokeActive, setIsPenStrokeActive] = useState(false)
  const justClosedStickyEditorRef = useRef(false)
  const justClosedTextEditorRef = useRef(false)
  const justFinishedArrowDragRef = useRef(false)
  const justFinishedObjectDragRef = useRef(false)
  const justFinishedPenStrokeRef = useRef(false)
  /** Holds current textarea value while editing; used to commit before closing on background click */
  const textareaValueRef = useRef('')

  const penDrawingActive = (activeTool === 'pen' || activeTool === 'highlighter') && canEdit
  const eraserActive = activeTool === 'eraser' && canEdit
  const connectorToolActive = activeTool === 'connector' && canEdit
  const arrowToolActive = isConnectionTool(activeTool) && canEdit && !connectorToolActive

  const penStyles: PenStyles =
    activeTool === 'pen'
      ? penToolStyles
      : activeTool === 'highlighter'
        ? highlighterToolStyles
        : { ...penToolStyles, size: eraserSize, color: '#000000', opacity: 100, strokeType: 'solid' }

  const currentPenStroke: CurrentPenStroke | null = useMemo(() => {
    if (!penDrawingActive || currentPenPoints.length < 2) return null
    return {
      points: currentPenPoints,
      color: penStyles.color,
      strokeWidth: penStyles.size,
      isHighlighter: activeTool === 'highlighter',
      opacity: penStyles.opacity / 100,
      strokeType: penStyles.strokeType,
    }
  }, [penDrawingActive, currentPenPoints, penStyles, activeTool])

  const lassoActive = activeTool === 'lasso' && canEdit
  const canvasCursor =
    penDrawingActive || arrowToolActive || connectorToolActive || lassoActive ? 'crosshair' : eraserActive ? ERASER_CURSOR : undefined

  const handleToolSelect = useCallback((tool: WhiteboardTool) => {
    justClosedStickyEditorRef.current = false
    justClosedTextEditorRef.current = false
    setArrowPreview(null)
    if (isConnectionTool(tool)) {
      setActiveToolState('connector' as WhiteboardTool)
      setActiveConnectorType(tool)
    } else {
      setActiveToolState(tool)
    }
    if (['pen', 'highlighter', 'eraser'].includes(tool)) {
      setPenStylesOpen(true)
    }
  }, [])

  const handlePenStylesChange = useCallback(
    (updates: Partial<PenStyles>) => {
      if (activeTool === 'pen') {
        setPenToolStyles((prev) => ({ ...prev, ...updates }))
      } else if (activeTool === 'highlighter') {
        setHighlighterToolStyles((prev) => ({ ...prev, ...updates }))
      } else if (activeTool === 'eraser' && 'size' in updates) {
        setEraserSize(updates.size ?? eraserSize)
      }
    },
    [activeTool, eraserSize]
  )

  const handleEmojiSelect = useCallback((emoji: string) => {
    setPendingEmoji(emoji)
  }, [])

  const handleGridToggle = useCallback(() => {
    setShowGrid((v) => {
      const next = !v
      try {
        localStorage.setItem('vellum:showGrid', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return {
    activeTool,
    setActiveTool: setActiveToolState,
    selectedIds,
    setSelectedIds,
    editingStickyId,
    setEditingStickyId,
    editingText,
    setEditingText,
    showGrid,
    toggleGrid: handleGridToggle,
    commentModalPos,
    setCommentModalPos,
    commentThread,
    setCommentThread,
    pendingEmoji,
    isChatOpen,
    setIsChatOpen,
    shareModalOpen,
    setShareModalOpen,
    currentPenPoints,
    setCurrentPenPoints,
    currentPenPointsRef,
    activeStrokeLineRef,
    isPenStrokeActive,
    setIsPenStrokeActive,
    arrowPreview,
    setArrowPreview,
    penToolStyles,
    highlighterToolStyles,
    eraserSize,
    penDrawingActive,
    eraserActive,
    connectorToolActive,
    activeConnectorType,
    arrowToolActive,
    penStyles,
    currentPenStroke,
    canvasCursor,
    handleToolSelect,
    handlePenStylesChange,
    handleEmojiSelect,
    justClosedStickyEditorRef,
    justClosedTextEditorRef,
    justFinishedArrowDragRef,
    justFinishedObjectDragRef,
    justFinishedPenStrokeRef,
    textareaValueRef,
    copiedObjects,
    setCopiedObjects,
    contextMenuPos,
    setContextMenuPos,
    templatesModalOpen,
    setTemplatesModalOpen,
    templatesSearch,
    setTemplatesSearch,
    templatesCategory,
    setTemplatesCategory,
    penStylesOpen,
    setPenStylesOpen,
    linkModalOpen,
    setLinkModalOpen,
    setSelectionActive,
  }
}
