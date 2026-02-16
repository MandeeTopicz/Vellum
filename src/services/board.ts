import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  collectionGroup,
  serverTimestamp,
  type DocumentReference,
  type Timestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type { Board, BoardDoc, BoardMember, BoardMemberRole } from '../types'

const BOARDS = 'boards'
const MEMBERS = 'members'

function boardsCol() {
  return collection(db, BOARDS)
}

function boardRef(boardId: string): DocumentReference {
  return doc(db, BOARDS, boardId)
}

function membersCol(boardId: string) {
  return collection(db, BOARDS, boardId, MEMBERS)
}

function memberRef(boardId: string, userId: string): DocumentReference {
  return doc(db, BOARDS, boardId, MEMBERS, userId)
}

export async function createBoard(name: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const boardDoc: Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
  } = {
    name: name || 'Untitled Board',
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const ref = await addDoc(boardsCol(), boardDoc)
  await setDoc(memberRef(ref.id, user.uid), {
    userId: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? null,
    role: 'edit' as BoardMemberRole,
    addedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const snap = await getDoc(boardRef(boardId))
  if (!snap.exists()) return null
  const data = snap.data() as Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp
    updatedAt: Timestamp
  }
  return {
    id: snap.id,
    ...data,
  }
}

export async function updateBoard(
  boardId: string,
  updates: Partial<Pick<BoardDoc, 'name'>>
): Promise<void> {
  await updateDoc(boardRef(boardId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function getBoardsForUser(): Promise<Board[]> {
  const user = auth.currentUser
  if (!user) return []

  const owned = await getDocs(
    query(boardsCol(), where('ownerId', '==', user.uid))
  )

  const memberSnaps = await getDocs(
    query(
      collectionGroup(db, MEMBERS),
      where('userId', '==', user.uid)
    )
  )

  const sharedBoardIds = memberSnaps.docs
    .map((d) => d.ref.parent.parent?.id)
    .filter((id): id is string => !!id)

  const boards: Board[] = []
  const seen = new Set<string>()

  owned.docs.forEach((d) => {
    const id = d.id
    seen.add(id)
    const data = d.data() as Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
      createdAt: Timestamp
      updatedAt: Timestamp
    }
    boards.push({ id, ...data })
  })

  await Promise.all(
    sharedBoardIds
      .filter((id) => !seen.has(id))
      .map(async (id) => {
        const b = await getBoard(id)
        if (b) {
          boards.push(b)
          seen.add(id)
        }
      })
  )

  boards.sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? 0
    const bMs = b.updatedAt?.toMillis?.() ?? 0
    return bMs - aMs
  })
  return boards
}

export async function getBoardMembers(boardId: string): Promise<BoardMember[]> {
  const snap = await getDocs(membersCol(boardId))
  return snap.docs.map((d) => {
    const data = d.data() as Omit<BoardMember, 'userId'> & { userId: string }
    return {
      ...data,
      addedAt: data.addedAt as Timestamp,
    }
  })
}

export async function addBoardMember(
  boardId: string,
  userId: string,
  email: string,
  displayName: string | null,
  role: BoardMemberRole
): Promise<void> {
  await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
  await setDoc(memberRef(boardId, userId), {
    userId,
    email,
    displayName,
    role,
    addedAt: serverTimestamp(),
  })
}

export async function setMemberRole(
  boardId: string,
  userId: string,
  role: BoardMemberRole
): Promise<void> {
  await updateDoc(memberRef(boardId, userId), { role })
  await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
}

export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
  const ref = memberRef(boardId, userId)
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(ref)
}

export async function getCurrentUserRole(boardId: string): Promise<BoardMemberRole | 'owner' | null> {
  const user = auth.currentUser
  if (!user) return null

  const board = await getBoard(boardId)
  if (!board) return null
  if (board.ownerId === user.uid) return 'owner'

  const memberSnap = await getDoc(memberRef(boardId, user.uid))
  if (!memberSnap.exists()) return null
  return (memberSnap.data().role as BoardMemberRole) ?? null
}

export async function canCurrentUserEdit(boardId: string): Promise<boolean> {
  const role = await getCurrentUserRole(boardId)
  return role === 'owner' || role === 'edit'
}
