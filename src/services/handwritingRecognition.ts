/**
 * Handwriting recognition service – exports pen strokes to an image and sends to the API.
 */
import type { PenObject } from '../types/objects'
import { getObjectBounds, unionBounds } from '../utils/objectBounds'
import { auth } from './firebase'

const PADDING = 20
const SCALE = 2 // Higher resolution for better OCR
const BG_COLOR = '#ffffff'

/**
 * Draw pen strokes on an offscreen canvas and return PNG as Blob.
 * @param penObjects - Array of pen objects to render
 * @returns Promise resolving to PNG Blob
 */
export async function penStrokesToImageBlob(penObjects: PenObject[]): Promise<Blob> {
  if (penObjects.length === 0) {
    throw new Error('No pen strokes to convert')
  }

  const boundsList = penObjects.map((obj) => getObjectBounds(obj))
  const union = unionBounds(boundsList)
  if (!union) throw new Error('Could not compute bounds')

  const w = Math.max(1, Math.ceil(union.right - union.left) + PADDING * 2)
  const h = Math.max(1, Math.ceil(union.bottom - union.top) + PADDING * 2)
  const canvas = document.createElement('canvas')
  canvas.width = w * SCALE
  canvas.height = h * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = BG_COLOR
  ctx.fillRect(0, 0, w, h)
  ctx.translate(PADDING - union.left, PADDING - union.top)

  for (const obj of penObjects) {
    const pts = obj.points
    if (pts.length < 2) continue

    ctx.strokeStyle = obj.color ?? '#000000'
    ctx.lineWidth = obj.strokeWidth ?? 2
    ctx.globalAlpha = obj.opacity ?? 1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1])
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
      0.95
    )
  })
}

/**
 * Returns the API base URL for handwriting recognition.
 * Uses VITE_OCR_API_URL if set. In production uses same-origin (Hosting rewrite forwards /handwriting-recognize).
 * In dev uses Cloud Functions URL. For emulators: VITE_OCR_API_URL=http://127.0.0.1:5001/vellum-6f172/us-central1/api
 */
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_OCR_API_URL
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID is required')
    return `https://us-central1-${projectId}.cloudfunctions.net/api`
  }
  return window.location.origin
}

/**
 * Send image to handwriting recognition API and return recognized text.
 * @param imageBlob - PNG image blob of pen strokes
 * @param token - Firebase ID token for Authorization
 * @returns Promise resolving to { text }
 * @throws On API error with message suitable for toast
 */
export async function recognizeHandwriting(imageBlob: Blob, token: string): Promise<{ text: string }> {
  const base = getApiBaseUrl()
  const url = `${base}/handwriting-recognize`

  const form = new FormData()
  form.append('image', imageBlob, 'handwriting.png')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error && typeof body.error === 'string') message = body.error
      else if (body?.message) message = body.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  const data = (await res.json()) as { text?: string }
  return { text: typeof data.text === 'string' ? data.text : '' }
}

/**
 * Get current user's ID token for API calls.
 * @returns Promise resolving to token or null if not authenticated
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}
