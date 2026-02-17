import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from './firebase'

export interface CommentReply {
  authorId: string
  authorName: string | null
  text: string
  timestamp: Timestamp
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

  const authorName = user.displayName ?? (user.email ? user.email.split('@')[0] : null)
  const docData = {
    position,
    authorId: user.uid,
    authorName,
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
  const authorName = user.displayName ?? (user.email ? user.email.split('@')[0] : null)
  const reply: CommentReply = {
    authorId: user.uid,
    authorName,
    text,
    timestamp: Timestamp.now(),
  }

  const snap = await import('firebase/firestore').then(({ getDoc }) => getDoc(commentRef))
  const data = snap.data()
  const replies = (data?.replies ?? []) as CommentReply[]
  await updateDoc(commentRef, {
    replies: [...replies, reply],
    updatedAt: serverTimestamp(),
  })
}

export async function deleteComment(boardId: string, commentId: string): Promise<void> {
  const commentRef = doc(db, 'boards', boardId, 'comments', commentId)
  await deleteDoc(commentRef)
}

/** Revive serialized Firestore Timestamp (from JSON/IndexedDB). */
function reviveTimestamp(val: unknown): Timestamp {
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
    const v = val as { seconds: number; nanoseconds?: number }
    return Timestamp.fromMillis(v.seconds * 1000 + ((v.nanoseconds ?? 0) / 1e6))
  }
  return Timestamp.now()
}

/** Restore a deleted comment (for undo). */
export async function restoreComment(
  boardId: string,
  commentId: string,
  data: {
    position: { x: number; y: number }
    authorId: string
    authorName: string | null
    text: string
    replies: Array<{ authorId: string; authorName: string | null; text: string; timestamp: unknown }>
    createdAt?: unknown
    updatedAt?: unknown
  }
): Promise<void> {
  const commentRef = doc(db, 'boards', boardId, 'comments', commentId)
  const revivedReplies = (data.replies ?? []).map((r) => ({
    ...r,
    timestamp: reviveTimestamp(r.timestamp),
  }))
  await setDoc(commentRef, {
    position: data.position,
    authorId: data.authorId,
    authorName: data.authorName,
    text: data.text,
    replies: revivedReplies,
    createdAt: reviveTimestamp(data.createdAt),
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
