import { Group, Rect, Text } from 'react-konva'
import type { BoardComment } from '../../services/comments'

interface CommentLayerProps {
  comments: BoardComment[]
  onCommentClick: (comment: BoardComment) => void
}

export default function CommentLayer({
  comments,
  onCommentClick,
}: CommentLayerProps) {
  return (
    <>
      {comments.map((comment) => {
        const size = 24
        return (
          <Group
            key={comment.id}
            x={comment.position.x}
            y={comment.position.y}
            onClick={() => onCommentClick(comment)}
            onTap={() => onCommentClick(comment)}
          >
            <Rect
              x={-size / 2}
              y={-size / 2}
              width={size}
              height={size}
              fill="#4f46e5"
              cornerRadius={6}
              shadowColor="black"
              shadowBlur={4}
              shadowOpacity={0.2}
            />
            <Text
              x={-8}
              y={-6}
              text="💬"
              fontSize={14}
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}
