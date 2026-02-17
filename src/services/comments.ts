import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from './firebase'

export interface CommentReply {
  authorId: string
  authorName: string | null
  text: string
  timestamp: ReturnType<typeof serverTimestamp>
}

export interface BoardComment {
  id: string
  boardId: string
  position: { x: number; y: number }
  authorId: string
  authorName: string | null
  text: string
  replies: CommentReply[]
  createdAt: ReturnType<typeof serverTimestamp>
  updatedAt: ReturnType<typeof serverTimestamp>
}

function commentsCol(boardId: string) {
  return collection(db, 'boards', boardId, 'comments')
}

export async function createComment(
  boardId: string,
  position: { x: number; y: number },
  text: string
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const docData = {
    position,
    authorId: user.uid,
    authorName: user.displayName ?? null,
    text,
    replies: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(commentsCol(boardId), docData)
  return ref.id
}

export async function addCommentReply(
  boardId: string,
  commentId: string,
  text: string
): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const commentRef = doc(db, 'boards', boardId, 'comments', commentId)
  const reply: CommentReply = {
    authorId: user.uid,
    authorName: user.displayName ?? null,
    text,
    timestamp: serverTimestamp(),
  }

  const snap = await import('firebase/firestore').then(({ getDoc }) => getDoc(commentRef))
  const data = snap.data()
  const replies = (data?.replies ?? []) as CommentReply[]
  await updateDoc(commentRef, {
    replies: [...replies, reply],
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToComments(
  boardId: string,
  callback: (comments: BoardComment[]) => void
): Unsubscribe {
  return onSnapshot(commentsCol(boardId), (snapshot) => {
    const comments: BoardComment[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        boardId,
        position: data.position as { x: number; y: number },
        authorId: data.authorId as string,
        authorName: data.authorName as string | null,
        text: data.text as string,
        replies: (data.replies ?? []) as CommentReply[],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })
    callback(comments)
  })
}
