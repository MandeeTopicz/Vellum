import { Group, Rect, Text } from 'react-konva'
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
}

export default function CommentLayer({
  comments,
  onCommentClick,
  isPointerTool,
}: CommentLayerProps) {
  return (
    <>
      {comments.map((comment) => {
        const username = getUsername(comment.authorName)
        const iconSize = 18
        const hitPadding = 8
        const hitWidth = iconSize + 4 + (username.length * 6) + hitPadding * 2
        const hitHeight = iconSize + hitPadding * 2
        return (
          <Group
            key={comment.id}
            x={comment.position.x}
            y={comment.position.y}
            listening={isPointerTool}
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
              x={-hitPadding}
              y={-hitPadding}
              width={hitWidth}
              height={hitHeight}
              fill="transparent"
              listening={true}
            />
            <Rect
              x={0}
              y={0}
              width={iconSize}
              height={iconSize}
              fill="#fff"
              stroke="#4f46e5"
              strokeWidth={1.5}
              cornerRadius={3}
              listening={false}
            />
            <Text
              x={4}
              y={2}
              text="T"
              fontSize={12}
              fontStyle="bold"
              fill="#4f46e5"
              listening={false}
            />
            <Text
              x={iconSize + 4}
              y={2}
              text={username}
              fontSize={10}
              fill="#374151"
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}
