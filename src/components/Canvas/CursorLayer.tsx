import { memo } from 'react'
import { Layer, Group, Circle, Text } from 'react-konva'
import type { CursorPosition } from '../../services/presence'
import type { Viewport } from './InfiniteCanvas'

interface CursorLayerProps {
  cursors: CursorPosition[]
  viewport: Viewport
  currentUserId: string
}

function getDisplayName(displayName: string | null, userId: string): string {
  if (!displayName) return userId.slice(0, 8)
  if (displayName.includes('@')) return displayName.split('@')[0]
  return displayName
}

function CursorLayer({
  cursors,
  viewport,
  currentUserId,
}: CursorLayerProps) {
  const otherCursors = cursors.filter((c) => c.userId !== currentUserId)

  return (
    <Layer listening={false}>
      {otherCursors.map((cursor) => {
        const screenX = viewport.x + cursor.x * viewport.scale
        const screenY = viewport.y + cursor.y * viewport.scale

        return (
          <Group key={cursor.userId} x={screenX} y={screenY}>
            <Circle
              radius={6}
              fill={cursor.color}
              listening={false}
            />
            <Text
              x={10}
              y={-6}
              text={getDisplayName(cursor.displayName, cursor.userId)}
              fontSize={12}
              fontFamily="Inter, system-ui, sans-serif"
              fill="#1a1a1a"
              listening={false}
            />
          </Group>
        )
      })}
    </Layer>
  )
}

export default memo(CursorLayer)
