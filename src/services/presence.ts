/**
 * Presence service – Firebase Realtime Database for user presence and cursor positions.
 * Manages who is viewing a board and real-time cursor coordinates for collaborative editing.
 */
import {
  ref,
  set,
  onDisconnect,
  onValue,
  type Unsubscribe,
} from 'firebase/database'
import { rtdb, auth } from './firebase'

/** Subscribe to RTDB connection state (for debugging). */
export function subscribeToRtdbConnection(callback: (connected: boolean) => void): Unsubscribe {
  const connectedRef = ref(rtdb, '.info/connected')
  return onValue(connectedRef, (snapshot) => callback(snapshot.val() === true))
}

const CURSOR_THROTTLE_MS = 50 // ~20fps - smooth enough for cursor, reduces re-renders

export interface PresenceUser {
  userId: string
  displayName: string | null
  email: string
  color: string
  joinedAt: number
}

export interface CursorPosition {
  userId: string
  x: number
  y: number
  displayName: string | null
  color: string
  lastUpdated?: number
}

const CURSOR_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

/** Derives a consistent color from a string (e.g. userId). Matches cursor color. */
export function hashToColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i)
  const idx = Math.abs(h) % CURSOR_COLORS.length
  return CURSOR_COLORS[idx]
}

/**
 * Sets the current user's presence on a board and configures disconnect cleanup.
 * Call when entering a board page.
 * @param boardId - The board ID
 * @returns Promise that resolves when presence is written (no-op if not authenticated)
 */
export async function setUserPresence(boardId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) return

  const presenceRef = ref(rtdb, `presence/${boardId}/${user.uid}`)
  const cursorRef = ref(rtdb, `cursors/${boardId}/${user.uid}`)

  const userData: PresenceUser = {
    userId: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? '',
    color: hashToColor(user.uid),
    joinedAt: Date.now(),
  }

  await set(presenceRef, userData)
  onDisconnect(presenceRef).remove()
  onDisconnect(cursorRef).remove()
}

let lastCursorUpdate = 0
let pendingCursor: { x: number; y: number } | null = null
let cursorFlushTimer: ReturnType<typeof setTimeout> | null = null

/** Set VITE_DEBUG_PRESENCE=true to enable verbose presence/cursor logs */
const CURSOR_DEBUG = import.meta.env?.VITE_DEBUG_PRESENCE === 'true'

/**
 * Updates the current user's cursor position on the board (throttled for performance).
 * @param boardId - The board ID
 * @param x - X coordinate in canvas space
 * @param y - Y coordinate in canvas space
 */
export function updateCursor(boardId: string, x: number, y: number): void {
  const user = auth.currentUser
  if (CURSOR_DEBUG) {
    console.log('[PRESENCE] updateCursor called:', { boardId, x, y, hasUser: !!user })
  }
  if (!user) {
    if (CURSOR_DEBUG) console.error('[PRESENCE] No auth.currentUser - cursor update skipped')
    return
  }
  if (!boardId) {
    if (CURSOR_DEBUG) console.error('[PRESENCE] Invalid boardId:', boardId)
    return
  }

  const now = Date.now()
  if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) {
    pendingCursor = { x, y }
    if (!cursorFlushTimer) {
      cursorFlushTimer = setTimeout(() => {
        if (pendingCursor) {
          lastCursorUpdate = Date.now()
          const cursorRef = ref(rtdb, `cursors/${boardId}/${user.uid}`)
          const payload = {
            x: pendingCursor.x,
            y: pendingCursor.y,
            displayName: user.displayName ?? (user.email ? user.email.split('@')[0] : null),
            color: hashToColor(user.uid),
            lastUpdated: Date.now(),
          }
          set(cursorRef, payload)
            .then(() => {
              if (CURSOR_DEBUG) console.log('[PRESENCE] ✓ Cursor update (throttled) successful')
            })
            .catch((err) => console.error('[PRESENCE] ✗ Cursor update (throttled) failed:', err))
          pendingCursor = null
        }
        cursorFlushTimer = null
      }, CURSOR_THROTTLE_MS)
    }
    return
  }

  lastCursorUpdate = now
  pendingCursor = null
  const cursorRef = ref(rtdb, `cursors/${boardId}/${user.uid}`)
  const payload = {
    x,
    y,
    displayName: user.displayName ?? (user.email ? user.email.split('@')[0] : null),
    color: hashToColor(user.uid),
    lastUpdated: Date.now(),
  }
  if (CURSOR_DEBUG) console.log('[PRESENCE] Writing to cursors/', boardId, '/', user.uid, payload)
  set(cursorRef, payload)
    .then(() => {
      if (CURSOR_DEBUG) console.log('[PRESENCE] ✓ Cursor update successful')
    })
    .catch((err) => {
      console.error('[PRESENCE] ✗ Cursor update failed:', err)
    })
}

/**
 * Subscribes to real-time presence updates (who is viewing the board).
 * @param boardId - The board ID
 * @param callback - Invoked with the list of PresenceUser on each change
 * @returns Unsubscribe function
 */
export function subscribeToPresence(
  boardId: string,
  callback: (users: PresenceUser[]) => void
): Unsubscribe {
  const presenceRef = ref(rtdb, `presence/${boardId}`)
  return onValue(presenceRef, (snapshot) => {
    const data = snapshot.val()
    const users: PresenceUser[] = []
    if (data && typeof data === 'object') {
      for (const [userId, val] of Object.entries(data)) {
        const v = val as Record<string, unknown>
        if (v && typeof v === 'object') {
          users.push({
            userId,
            displayName: (v.displayName as string | null) ?? null,
            email: (v.email as string) ?? '',
            color: (v.color as string) ?? '#888',
            joinedAt: (v.joinedAt as number) ?? 0,
          })
        }
      }
    }
    callback(users)
  })
}

/**
 * Subscribes to real-time cursor positions for all users on the board.
 * @param boardId - The board ID
 * @param callback - Invoked with the list of CursorPosition on each change
 * @returns Unsubscribe function
 */
export function subscribeToCursors(
  boardId: string,
  callback: (cursors: CursorPosition[]) => void
): Unsubscribe {
  if (CURSOR_DEBUG) {
    console.log('[subscribeToCursors] Called for board:', boardId)
    console.log('[subscribeToCursors] Path: cursors/' + boardId)
  }
  const cursorsRef = ref(rtdb, `cursors/${boardId}`)
  const unsub = onValue(
    cursorsRef,
    (snapshot) => {
      const currentUserId = auth.currentUser?.uid
      const data = snapshot.val()
      if (CURSOR_DEBUG) {
        console.log('[subscribeToCursors] SNAPSHOT received, exists:', snapshot.exists(), 'raw:', data)
      }
      const allCursors: CursorPosition[] = []
      if (data && typeof data === 'object') {
        for (const [userId, val] of Object.entries(data)) {
          const v = val as Record<string, unknown>
          if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number') {
            allCursors.push({
              userId,
              x: v.x as number,
              y: v.y as number,
              displayName: (v.displayName as string | null) ?? null,
              color: (v.color as string) ?? '#888',
              lastUpdated: typeof v.lastUpdated === 'number' ? v.lastUpdated : undefined,
            })
          }
        }
      }
      const otherCursors = currentUserId
        ? allCursors.filter((c) => c.userId !== currentUserId)
        : allCursors
      if (CURSOR_DEBUG) console.log('[subscribeToCursors] Parsed cursors (own filtered):', otherCursors.length, otherCursors)
      callback(otherCursors)
    },
    (error) => {
      console.error('[subscribeToCursors] ERROR:', error)
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('[subscribeToCursors] Error code:', (error as { code: string }).code)
        console.error('[subscribeToCursors] Error message:', (error as { message: string }).message)
      }
    }
  )
  if (CURSOR_DEBUG) console.log('[subscribeToCursors] Listener attached')
  return unsub
}

/**
 * Writes a fake test cursor to Firebase (dev only). Use to verify subscription/rendering.
 * Cursor appears at (600, 600) as user "debug-test-user".
 */
export async function writeTestCursor(boardId: string): Promise<void> {
  if (!CURSOR_DEBUG) return
  const cursorRef = ref(rtdb, `cursors/${boardId}/debug-test-user`)
  const payload = {
    x: 600,
    y: 600,
    displayName: 'Test User',
    color: '#ef4444',
    lastUpdated: Date.now(),
  }
  console.log('[PRESENCE] writeTestCursor writing to', `cursors/${boardId}/debug-test-user`, payload)
  try {
    await set(cursorRef, payload)
    console.log('[PRESENCE] ✓ Test cursor written - subscription should pick it up')
  } catch (err) {
    console.error('[PRESENCE] ✗ writeTestCursor failed:', err)
  }
}
