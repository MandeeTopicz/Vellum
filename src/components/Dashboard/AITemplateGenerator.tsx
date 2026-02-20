import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2 } from 'lucide-react'
import { createBoard } from '../../services/board'
import { generateTemplateFromPrompt } from '../../services/aiAgent'
import './AITemplateGenerator.css'

/**
 * AI-powered template generator for the dashboard. Creates boards from user prompts.
 */
export default function AITemplateGenerator() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('Please enter a description')
      return
    }

    try {
      setLoading(true)
      setError('')

      const boardName = `AI: ${prompt.substring(0, 50)}${prompt.length > 50 ? '…' : ''}`
      const boardId = await createBoard(boardName)

      await generateTemplateFromPrompt(boardId, prompt)

      navigate(`/board/${boardId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate template')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <div className="ai-template-generator">
      <div className="generator-header">
        <div className="generator-header-icon">
          <Sparkles size={28} color="#8093F1" />
        </div>
        <div>
          <h3 className="generator-title">AI Template Generator</h3>
          <p className="generator-subtitle">
            Describe what you want to create and AI will build it for you
          </p>
        </div>
      </div>

      <div className="generator-content">
        <div className="prompt-input-container">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: Create a project planning board for a mobile app launch with timeline, tasks, and team assignments..."
            className="prompt-input"
            rows={4}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="generator-error-message">
            <p>{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="generator-button"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="generator-spinner" />
              <span>Generating…</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>Generate Template</span>
            </>
          )}
        </button>

        <div className="example-prompts">
          <p className="examples-label">Try these examples:</p>
          <div className="example-chips">
            <button
              type="button"
              className="example-chip"
              onClick={() =>
                setPrompt(
                  'Create a weekly sprint planning board with backlog, in progress, and done columns'
                )
              }
              disabled={loading}
            >
              Sprint Planning
            </button>
            <button
              type="button"
              className="example-chip"
              onClick={() =>
                setPrompt(
                  'Build a product roadmap for Q1 2026 with milestones and features'
                )
              }
              disabled={loading}
            >
              Product Roadmap
            </button>
            <button
              type="button"
              className="example-chip"
              onClick={() =>
                setPrompt(
                  'Design a team retrospective board with what went well, what to improve, and action items'
                )
              }
              disabled={loading}
            >
              Retrospective
            </button>
            <button
              type="button"
              className="example-chip"
              onClick={() =>
                setPrompt(
                  'Create a customer journey map from awareness to purchase'
                )
              }
              disabled={loading}
            >
              Journey Map
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
