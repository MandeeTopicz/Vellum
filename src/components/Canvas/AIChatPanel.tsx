import { useState, useRef, useEffect, useCallback } from 'react'
import './AIChatPanel.css'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: 'pending' | 'success' | 'error'
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your AI design assistant. I can help you create sticky notes, shapes, templates, flowcharts, mind maps, Kanban boards, timelines, and more. Try asking me to 'Create a SWOT analysis' or 'Make a project timeline'!",
  timestamp: new Date(),
  status: 'success',
}

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  onSendMessage: (prompt: string) => Promise<{ success: boolean; message: string }>
  canEdit: boolean
}

export default function AIChatPanel({ isOpen, onClose, onSendMessage, canEdit }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isProcessing || !canEdit) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      status: 'success',
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsProcessing(true)

    const aiMessageId = (Date.now() + 1).toString()
    const pendingAIMessage: ChatMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
      status: 'pending',
    }
    setMessages((prev) => [...prev, pendingAIMessage])

    try {
      const result = await onSendMessage(text)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? { ...msg, content: result.message, status: result.success ? 'success' : 'error' }
            : msg
        )
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId ? { ...m, content: `Error: ${msg}`, status: 'error' as const } : m
        )
      )
    } finally {
      setIsProcessing(false)
    }
  }, [inputValue, isProcessing, canEdit, onSendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE])
  }

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (!isOpen) return null

  return (
    <>
      <div className={`ai-chat-panel ${isMinimized ? 'ai-chat-panel-minimized' : ''}`}>
        <div className="ai-chat-header">
          <h3 className="ai-chat-title">AI Assistant</h3>
          <div className="ai-chat-header-actions">
            <button
              type="button"
              className="ai-chat-header-btn"
              onClick={handleClear}
              title="Clear conversation"
              disabled={messages.length <= 1}
            >
              Clear
            </button>
            <button
              type="button"
              className="ai-chat-header-btn"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
            <button
              type="button"
              className="ai-chat-header-btn ai-chat-close"
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="chat-messages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.role === 'user' ? 'message-user' : 'message-assistant'} ${msg.status === 'error' ? 'message-error' : ''}`}
                  title={formatTime(msg.timestamp)}
                >
                  {msg.status === 'pending' && (
                    <span className="chat-typing-dots">
                      <span /> <span /> <span />
                    </span>
                  )}
                  {msg.status !== 'pending' && msg.content}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder={canEdit ? 'Ask AI to create something...' : 'Sign in to use AI'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!canEdit || isProcessing}
                rows={1}
              />
              <button
                type="button"
                className="chat-send-btn"
                onClick={handleSendMessage}
                disabled={!canEdit || isProcessing || !inputValue.trim()}
                title="Send"
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
