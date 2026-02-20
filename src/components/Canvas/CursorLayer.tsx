import { memo, useState, useEffect, useRef } from 'react'
import { Layer, Group, Path, Rect, Text } from 'react-konva'
import { subscribeToCursors } from '../../services/presence'
import type { Viewport } from './InfiniteCanvas'

const CURSOR_IDLE_TIMEOUT_MS = 5000 // Hide cursor after 5s without movement
const SNAP_THRESHOLD = 0.5 // px - when to stop interpolating
const MAX_INTERPOLATION_DISTANCE = 200 // px - snap immediately for large jumps
const SMOOTH_FACTOR = 0.25 // 0.2-0.3: lower = smoother, higher = more responsive

interface InterpolatedCursor {
  userId: string
  displayName: string | null
  color: string
  currentX: number
  currentY: number
  targetX: number
  targetY: number
  lastUpdate: number
}

interface CursorLayerProps {
  boardId: string
  viewport: Viewport
  currentUserId: string
}

function getDisplayName(displayName: string | null, userId: string): string {
  if (!displayName) return userId.slice(0, 8)
  if (displayName.includes('@')) return displayName.split('@')[0]
  return displayName
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

function CursorLayer({
  boardId,
  viewport,
  currentUserId,
}: CursorLayerProps) {
  const [interpolatedCursors, setInterpolatedCursors] = useState<
    Map<string, InterpolatedCursor>
  >(new Map())
  const [now, setNow] = useState(() => Date.now())
  const animationFrameRef = useRef<number | null>(null)

  const renderCountRef = useRef(0)
  useEffect(() => {
    renderCountRef.current += 1
    console.log('[CursorLayer] Render #', renderCountRef.current, 'Cursors:', interpolatedCursors.size)
  })

  // Subscribe to cursor updates from Firebase
  useEffect(() => {
    if (!boardId) return () => {}

    const unsubscribe = subscribeToCursors(boardId, (cursors) => {
      const updateTime = Date.now()

      setInterpolatedCursors((prev) => {
        const next = new Map(prev)

        for (const cursor of cursors) {
          const existing = next.get(cursor.userId)

          if (existing) {
            next.set(cursor.userId, {
              ...existing,
              targetX: cursor.x,
              targetY: cursor.y,
              displayName: cursor.displayName,
              color: cursor.color,
              lastUpdate: updateTime,
            })
          } else {
            next.set(cursor.userId, {
              userId: cursor.userId,
              displayName: cursor.displayName,
              color: cursor.color,
              currentX: cursor.x,
              currentY: cursor.y,
              targetX: cursor.x,
              targetY: cursor.y,
              lastUpdate: updateTime,
            })
          }
        }

        const activeIds = new Set(cursors.map((c) => c.userId))
        for (const [userId] of next) {
          if (!activeIds.has(userId)) next.delete(userId)
        }

        return next
      })
    })

    return () => unsubscribe()
  }, [boardId])

  // Idle timeout tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // 60fps animation loop for smooth interpolation
  useEffect(() => {
    const animate = () => {
      setInterpolatedCursors((prev) => {
        let hasChanges = false
        const next = new Map(prev)

        for (const [userId, cursor] of next) {
          const distX = cursor.targetX - cursor.currentX
          const distY = cursor.targetY - cursor.currentY
          const distance = Math.sqrt(distX * distX + distY * distY)

          if (distance > MAX_INTERPOLATION_DISTANCE) {
            next.set(userId, {
              ...cursor,
              currentX: cursor.targetX,
              currentY: cursor.targetY,
            })
            hasChanges = true
          } else if (distance > SNAP_THRESHOLD) {
            next.set(userId, {
              ...cursor,
              currentX: lerp(cursor.currentX, cursor.targetX, SMOOTH_FACTOR),
              currentY: lerp(cursor.currentY, cursor.targetY, SMOOTH_FACTOR),
            })
            hasChanges = true
          } else if (distance > 0) {
            next.set(userId, {
              ...cursor,
              currentX: cursor.targetX,
              currentY: cursor.targetY,
            })
            hasChanges = true
          }
        }

        animationFrameRef.current = requestAnimationFrame(animate)
        return hasChanges ? next : prev
      })
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const visibleCursors = Array.from(interpolatedCursors.values()).filter(
    (c) =>
      c.userId !== currentUserId &&
      now - c.lastUpdate < CURSOR_IDLE_TIMEOUT_MS
  )

  const FADE_START_MS = 4000 // Start fading 1s before hide

  return (
    <Layer listening={false}>
      {visibleCursors.map((cursor) => {
        const screenX = viewport.x + cursor.currentX * viewport.scale
        const screenY = viewport.y + cursor.currentY * viewport.scale
        const idleMs = now - cursor.lastUpdate
        const opacity = idleMs > FADE_START_MS ? 0.4 + (0.6 * (1 - (idleMs - FADE_START_MS) / 1000)) : 1
        const username = getDisplayName(cursor.displayName, cursor.userId)
        const labelWidth = Math.max(username.length * 7.5 + 16, 50)

        return (
          <Group
            key={cursor.userId}
            x={screenX}
            y={screenY}
            opacity={opacity}
            listening={false}
          >
            {/* Cursor arrow pointer (classic pointer shape) */}
            <Path
              data="M 0 0 L 0 20 L 6 14 L 10 21 L 12 20 L 8 13 L 15 13 Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth={1.5}
              strokeLinejoin="round"
              shadowColor="rgba(0,0,0,0.3)"
              shadowBlur={4}
              shadowOffset={{ x: 1, y: 1 }}
              listening={false}
            />
            {/* Username label */}
            <Group x={16} y={14} listening={false}>
              <Rect
                x={0}
                y={0}
                width={labelWidth}
                height={24}
                fill={cursor.color}
                cornerRadius={12}
                shadowColor="rgba(0,0,0,0.2)"
                shadowBlur={4}
                shadowOffset={{ x: 0, y: 2 }}
                listening={false}
              />
              <Text
                x={8}
                y={5}
                text={username}
                fontSize={13}
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
                fontStyle="500"
                fill="white"
                listening={false}
              />
            </Group>
          </Group>
        )
      })}
    </Layer>
  )
}

export default memo(CursorLayer)
