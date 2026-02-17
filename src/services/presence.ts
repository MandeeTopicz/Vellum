import {
  ref,
  set,
  onDisconnect,
  onValue,
  type Unsubscribe,
} from 'firebase/database'
import { rtdb, auth } from './firebase'

const CURSOR_THROTTLE_MS = 33 // ~30fps

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

function hashToColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i)
  const idx = Math.abs(h) % CURSOR_COLORS.length
  return CURSOR_COLORS[idx]
}

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

export function updateCursor(boardId: string, x: number, y: number): void {
  const user = auth.currentUser
  if (!user) {
    console.log('[presence] updateCursor skipped: no user')
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
            displayName: user.displayName ?? user.email ?? null,
            color: hashToColor(user.uid),
          }
          console.log('[presence] Sending cursor update (throttled flush)', boardId, user.uid, payload)
          set(cursorRef, payload)
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
    displayName: user.displayName ?? user.email ?? null,
    color: hashToColor(user.uid),
  }
  console.log('[presence] Sending cursor update', boardId, user.uid, payload)
  set(cursorRef, payload)
}

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

export function subscribeToCursors(
  boardId: string,
  callback: (cursors: CursorPosition[]) => void
): Unsubscribe {
  const cursorsRef = ref(rtdb, `cursors/${boardId}`)
  console.log('[presence] subscribeToCursors: listening to path', `cursors/${boardId}`)
  return onValue(cursorsRef, (snapshot) => {
    const data = snapshot.val()
    console.log('[presence] Received cursor data', boardId, 'raw:', data)
    const cursors: CursorPosition[] = []
    if (data && typeof data === 'object') {
      for (const [userId, val] of Object.entries(data)) {
        const v = val as Record<string, unknown>
        if (v && typeof v === 'object' && typeof v.x === 'number' && typeof v.y === 'number') {
          cursors.push({
            userId,
            x: v.x as number,
            y: v.y as number,
            displayName: (v.displayName as string | null) ?? null,
            color: (v.color as string) ?? '#888',
          })
        } else {
          console.log('[presence] Skipped cursor entry (invalid)', userId, val)
        }
      }
    }
    console.log('[presence] Parsed cursors:', cursors.length, cursors)
    callback(cursors)
  })
}
