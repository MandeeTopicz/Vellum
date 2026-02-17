import { Layer, Group, Circle, Text } from 'react-konva'
import type { CursorPosition } from '../../services/presence'
import type { Viewport } from './InfiniteCanvas'

interface CursorLayerProps {
  cursors: CursorPosition[]
  viewport: Viewport
  currentUserId: string
}

export default function CursorLayer({
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
              stroke="#fff"
              strokeWidth={2}
              listening={false}
            />
            <Text
              x={10}
              y={-6}
              text={cursor.displayName || cursor.userId.slice(0, 8)}
              fontSize={12}
              fontFamily="Inter, system-ui, sans-serif"
              fill={cursor.color}
              listening={false}
            />
          </Group>
        )
      })}
    </Layer>
  )
}
