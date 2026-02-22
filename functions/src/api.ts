/**
 * Express API routes for HTTP Cloud Functions.
 * Handles endpoints such as POST /api/handwriting-recognize.
 * These routes run server-side only and are not bundled to the client.
 *
 * Multipart uploads use busboy + rawBody (Cloud Run) or req.pipe (fallback).
 * The handwriting route is registered BEFORE any body-parsing middleware.
 */

import * as express from 'express'
import type { Request, Response, NextFunction } from 'express'
import * as Busboy from 'busboy'
import * as admin from 'firebase-admin'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { logger } from 'firebase-functions'

if (!admin.apps.length) admin.initializeApp()

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const PARSE_TIMEOUT_MS = 15000
const ALLOWED_MIMETYPES = ['image/png', 'image/jpeg', 'image/jpg']

const visionClient = new ImageAnnotatorClient()

/** Error codes for consistent responses */
const ERROR_CODES = {
  MALFORMED_MULTIPART: 'MALFORMED_MULTIPART',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MISSING_FILE: 'MISSING_FILE',
  UNSUPPORTED_CONTENT_TYPE: 'UNSUPPORTED_CONTENT_TYPE',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const

/** Request with rawBody (Firebase/Cloud Run) */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer
}

export interface ParsedFile {
  buffer: Buffer
  filename: string
  mimetype: string
  size: number
}

/** Consistent error response shape */
function errResponse(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ error, code, status })
}

/** Generate or read requestId for observability */
function getRequestId(req: Request): string {
  const id = req.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return id
}

/**
 * Parses multipart/form-data for field "file" only.
 * - Uses req.rawBody when available (Cloud Run), else req.pipe(busboy).
 * - Resolves exactly once; rejects exactly once; guards against double-settle.
 * - Accepts only first "file" field; ignores non-"file" fields.
 * - Destroys stream and cleans buffers on size limit exceeded.
 */
function parseMultipartFile(req: RequestWithRawBody, requestId: string): Promise<ParsedFile | null> {
  const contentType = req.headers['content-type'] || ''
  const ct = contentType.toLowerCase()
  const isMultipart = ct.startsWith('multipart/form-data')

  if (!isMultipart) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const clearTimeoutGuard = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    timeoutId = setTimeout(() => {
      clearTimeoutGuard()
      settle(() => reject(new Error('MALFORMED_MULTIPART')))
    }, PARSE_TIMEOUT_MS)
    let fileData: ParsedFile | null = null
    let busboyError: Error | null = null
    let fileReceived = false // Only accept first "file" or "image" field

    const bb = Busboy({
      headers: { 'content-type': req.headers['content-type'] as string },
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    })

    bb.on('file', (fieldname: string, stream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      if (fieldname !== 'file' && fieldname !== 'image') {
        stream.resume()
        return
      }
      if (fileReceived) {
        stream.resume()
        return
      }
      fileReceived = true

      const mt = (info.mimeType || '').toLowerCase()
      if (!ALLOWED_MIMETYPES.includes(mt)) {
        busboyError = new Error('UNSUPPORTED_CONTENT_TYPE')
        stream.resume()
        return
      }

      const chunks: Buffer[] = []
      let accumulatedSize = 0
      let sizeExceeded = false

      stream.on('data', (chunk: Buffer) => {
        if (sizeExceeded) return
        accumulatedSize += chunk.length
        if (accumulatedSize > MAX_FILE_SIZE_BYTES) {
          sizeExceeded = true
          busboyError = new Error('FILE_TOO_LARGE')
          chunks.length = 0
          const s = stream as import('stream').Readable
          if (s.destroy) s.destroy()
          else s.resume()
          return
        }
        chunks.push(chunk)
      })

      stream.on('end', () => {
        if (busboyError || sizeExceeded) return
        const buffer = Buffer.concat(chunks)
        const finalSize = buffer.length
        if (finalSize !== accumulatedSize) {
          busboyError = new Error('MALFORMED_MULTIPART')
          return
        }
        fileData = {
          buffer,
          filename: info.filename,
          mimetype: info.mimeType || 'application/octet-stream',
          size: finalSize,
        }
      })

      stream.on('error', (err: Error) => {
        if (!busboyError) busboyError = err
      })
    })

    bb.on('finish', () => {
      clearTimeoutGuard()
      settle(() => {
        if (busboyError) {
          const msg = busboyError.message
          if (msg === 'FILE_TOO_LARGE') {
            reject(new Error('FILE_TOO_LARGE'))
          } else if (msg === 'UNSUPPORTED_CONTENT_TYPE') {
            reject(new Error('UNSUPPORTED_CONTENT_TYPE'))
          } else if (/unexpected end of form/i.test(msg) || msg.includes('Multipart')) {
            reject(new Error('MALFORMED_MULTIPART'))
          } else {
            reject(new Error('MALFORMED_MULTIPART'))
          }
        } else if (fileData) {
          resolve(fileData)
        } else {
          resolve(null)
        }
      })
    })

    bb.on('error', (err: Error) => {
      clearTimeoutGuard()
      busboyError = busboyError || err
      logger.error('[handwriting-recognize] busboy error', { requestId, code: 'MALFORMED_MULTIPART', status: 400 })
      settle(() => {
        const msg = err.message
        if (msg === 'FILE_TOO_LARGE') {
          reject(new Error('FILE_TOO_LARGE'))
        } else if (msg === 'UNSUPPORTED_CONTENT_TYPE') {
          reject(new Error('UNSUPPORTED_CONTENT_TYPE'))
        } else if (/unexpected end of form/i.test(msg) || msg.includes('Multipart')) {
          reject(new Error('MALFORMED_MULTIPART'))
        } else {
          reject(new Error('MALFORMED_MULTIPART'))
        }
      })
    })

    const rawBody = req.rawBody
    if (!rawBody || rawBody.length === 0) {
      clearTimeoutGuard()
      settle(() => reject(new Error('MALFORMED_MULTIPART')))
      return
    }
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody as ArrayBuffer)
    try {
      bb.end(buf)
    } catch (err) {
      clearTimeoutGuard()
      settle(() => reject(new Error('MALFORMED_MULTIPART')))
    }
  })
}

/**
 * Extracts and verifies Firebase ID token from Authorization: Bearer or X-Firebase-ID-Token.
 * Does not log the full token.
 */
async function requireAuth(req: Request, requestId: string): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization
  const altToken = (req.headers['x-firebase-id-token'] as string | undefined)?.trim()
  const hasAuthHeader = !!authHeader
  const hasBearerPrefix = !!authHeader?.startsWith('Bearer ')
  const authHeaderLen = authHeader?.length ?? 0
  const hasAltHeader = !!altToken
  const altHeaderLen = altToken?.length ?? 0
  const token = hasBearerPrefix && authHeader ? authHeader.slice(7).trim() : (altToken ?? '')
  const tokenLen = token.length
  const tokenPrefix = token.length >= 10 ? token.slice(0, 10) : ''
  logger.info('[requireAuth]', {
    requestId,
    hasAuthHeader,
    hasBearerPrefix,
    authHeaderLen,
    hasAltHeader,
    altHeaderLen,
    tokenLen,
    tokenPrefix,
  })
  if (!token) {
    return null
  }
  try {
    return await admin.auth().verifyIdToken(token, true)
  } catch (err: unknown) {
    const errCode = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : undefined
    const errMessage = err instanceof Error ? err.message : String(err)
    logger.warn('[requireAuth] verifyIdToken failed', {
      requestId,
      errCode,
      errMessage: errMessage.slice(0, 200),
    })
    return null
  }
}

const app = express()

/** Auth-only debug endpoint: GET /auth-test (Express mounted at /api by Firebase). */
const authTestHandler = async (req: Request, res: Response) => {
  const requestId = getRequestId(req)
  const decoded = await requireAuth(req, requestId)
  if (!decoded) {
    errResponse(res, 401, 'Unauthorized: valid Firebase ID token required', ERROR_CODES.UNAUTHORIZED)
    return
  }
  res.status(200).json({
    ok: true,
    uid: decoded.uid,
    aud: decoded.aud,
    iss: decoded.iss,
    auth_time: decoded.auth_time,
    iat: decoded.iat,
    exp: decoded.exp,
  })
}
app.get('/auth-test', authTestHandler)

// IMPORTANT: Register handwriting route BEFORE any body-parsing middleware.
// This ensures no middleware consumes the request body before busboy.
app.post('/handwriting-recognize', async (req: RequestWithRawBody, res: Response) => {
  const startTime = Date.now()
  const requestId = getRequestId(req)

  try {
    const ct = (req.headers['content-type'] || '').toLowerCase()
    const isMultipart = ct.startsWith('multipart/form-data')
    if (!isMultipart) {
      errResponse(res, 400, 'Content-Type must be multipart/form-data', ERROR_CODES.UNSUPPORTED_CONTENT_TYPE)
      return
    }

    const decoded = await requireAuth(req, requestId)
    if (!decoded) {
      res.status(401).json({ error: 'Unauthorized: valid Firebase ID token required' })
      logger.warn('[handwriting-recognize] Unauthorized request', { requestId })
      return
    }

    let file: ParsedFile | null = null
    try {
      file = await parseMultipartFile(req, requestId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[handwriting-recognize] parseMultipartFile threw', { requestId, code: msg === 'FILE_TOO_LARGE' ? 'FILE_TOO_LARGE' : msg === 'UNSUPPORTED_CONTENT_TYPE' ? 'UNSUPPORTED_CONTENT_TYPE' : 'MALFORMED_MULTIPART' })
      if (msg === 'MALFORMED_MULTIPART') {
        errResponse(res, 400, 'Malformed multipart form data', ERROR_CODES.MALFORMED_MULTIPART)
        return
      }
      if (msg === 'FILE_TOO_LARGE') {
        errResponse(res, 413, 'Payload too large: max file size 10MB', ERROR_CODES.FILE_TOO_LARGE)
        return
      }
      if (msg === 'UNSUPPORTED_CONTENT_TYPE') {
        errResponse(res, 400, 'Content-Type must be multipart/form-data', ERROR_CODES.UNSUPPORTED_CONTENT_TYPE)
        return
      }
      errResponse(res, 400, 'Malformed multipart form data', ERROR_CODES.MALFORMED_MULTIPART)
      return
    }

    if (!file) {
      logger.warn('[handwriting-recognize] Missing file field', { requestId, code: 'MISSING_FILE', status: 400 })
      errResponse(res, 400, 'Missing file field', ERROR_CODES.MISSING_FILE)
      return
    }

    if (file.buffer.length > 4 * 1024 * 1024) {
      errResponse(res, 400, 'Image too large. Maximum size is 4MB.', ERROR_CODES.FILE_TOO_LARGE)
      return
    }

    const [result] = await visionClient.documentTextDetection({
      image: { content: file.buffer },
    })

    const text =
      result.fullTextAnnotation?.text?.trim() ??
      result.textAnnotations?.[0]?.description?.trim() ??
      ''

    const duration = Date.now() - startTime
    logger.info('[handwriting-recognize] Success', {
      requestId,
      uid: decoded.uid,
      duration: `${duration}ms`,
      textLength: text.length,
    })

    res.status(200).json({ text })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = msg.includes('File too large') || msg.includes('LIMIT_FILE_SIZE') ? 'FILE_TOO_LARGE' : msg.includes('Invalid mimetype') ? 'UNSUPPORTED_CONTENT_TYPE' : 'INTERNAL_ERROR'
    logger.error('[handwriting-recognize] Error', { requestId, code })

    if (msg.includes('File too large') || msg.includes('LIMIT_FILE_SIZE')) {
      errResponse(res, 413, 'Payload too large: max file size 10MB', ERROR_CODES.FILE_TOO_LARGE)
      return
    }
    if (msg.includes('Invalid mimetype')) {
      errResponse(res, 400, msg, ERROR_CODES.UNSUPPORTED_CONTENT_TYPE)
      return
    }

    errResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR')
  }
})

// JSON/urlencoded: only for non-multipart requests. Skip if multipart.
app.use((req: Request, res: Response, next: NextFunction) => {
  const ct = (req.headers['content-type'] || '').toLowerCase()
  const isMultipart = ct.startsWith('multipart/form-data')
  if (isMultipart) {
    return next()
  }
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) return next(err)
    express.urlencoded({ extended: true, limit: '10mb' })(req, res, next)
  })
})

/** Central error handler */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err)
  logger.error('[api] Unhandled error', { error: msg })

  if (msg.includes('File too large') || msg.includes('LIMIT_FILE_SIZE') || msg.includes('limit')) {
    errResponse(res, 413, 'Payload too large: max file size 10MB', ERROR_CODES.FILE_TOO_LARGE)
    return
  }
  if (msg.includes('Invalid mimetype')) {
    errResponse(res, 400, msg, ERROR_CODES.UNSUPPORTED_CONTENT_TYPE)
    return
  }
  if (msg.includes('Unexpected end of form') || msg.includes('Multipart')) {
    errResponse(res, 400, 'Malformed multipart form data', ERROR_CODES.MALFORMED_MULTIPART)
    return
  }
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 })
})

export { app as apiApp }
