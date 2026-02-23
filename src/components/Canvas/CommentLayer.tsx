import { Group, Rect, Text } from 'react-konva'
import { hashToColor } from '../../services/presence'
import type { BoardComment } from '../../services/comments'

function getUsername(authorName: string | null): string {
  if (!authorName) return 'Anonymous'
  if (authorName.includes('@')) return authorName.split('@')[0]
  return authorName
}

interface CommentLayerProps {
  comments: BoardComment[]
  onCommentClick: (comment: BoardComment) => void
  isPointerTool: boolean
  isSelecting?: boolean
}

export default function CommentLayer({
  comments,
  onCommentClick,
  isPointerTool,
  isSelecting = false,
}: CommentLayerProps) {
  return (
    <>
      {comments.map((comment) => {
        const username = getUsername(comment.authorName)
        const color = hashToColor(comment.authorId)
        const paddingX = 10
        const paddingY = 6
        const fontSize = 11
        const textWidth = username.length * 7
        const boxWidth = textWidth + paddingX * 2
        const boxHeight = fontSize + paddingY * 2
        return (
          <Group
            key={comment.id}
            x={comment.position.x}
            y={comment.position.y}
            listening={!isSelecting && isPointerTool}
            onClick={(e) => {
              e.cancelBubble = true
              onCommentClick(comment)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onCommentClick(comment)
            }}
          >
            <Rect
              x={0}
              y={0}
              width={boxWidth}
              height={boxHeight}
              fill="transparent"
              listening={!isSelecting && isPointerTool}
            />
            <Rect
              x={0}
              y={0}
              width={boxWidth}
              height={boxHeight}
              fill="rgba(255,255,255,0.95)"
              stroke={color}
              strokeWidth={2}
              cornerRadius={6}
              listening={false}
            />
            <Text
              x={paddingX}
              y={paddingY}
              text={username}
              fontSize={fontSize}
              fill={color}
              fontStyle="bold"
              listening={false}
              width={textWidth}
            />
          </Group>
        )
      })}
    </>
  )
}
