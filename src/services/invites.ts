import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  collectionGroup,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type { BoardInvite, BoardInviteDoc, BoardMemberRole } from '../types'
import { getBoard } from './board'
import { addBoardMember } from './board'

const INVITES = 'invites'

function invitesCol(boardId: string) {
  return collection(db, 'boards', boardId, INVITES)
}

function inviteRef(boardId: string, inviteId: string) {
  return doc(db, 'boards', boardId, INVITES, inviteId)
}

export interface CreateInviteInput {
  boardId: string
  email: string
  role: BoardMemberRole
}

export async function createInvite(input: CreateInviteInput): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const board = await getBoard(input.boardId)
  if (!board || board.ownerId !== user.uid) {
    throw new Error('Only the board owner can send invites')
  }

  const normalizedEmail = input.email.trim().toLowerCase()
  const docData: Omit<BoardInviteDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
  } = {
    email: normalizedEmail,
    role: input.role,
    invitedBy: user.uid,
    invitedByName: user.displayName ?? null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const ref = await addDoc(invitesCol(input.boardId), docData)
  return ref.id
}

export async function getInvitesForBoard(boardId: string): Promise<BoardInvite[]> {
  const snap = await getDocs(invitesCol(boardId))
  return snap.docs.map((d) => {
    const data = d.data() as BoardInviteDoc
    return {
      id: d.id,
      boardId,
      ...data,
    }
  })
}

export async function getPendingInvitesForEmail(email: string): Promise<BoardInvite[]> {
  const normalized = email.trim().toLowerCase()
  const invSnap = await getDocs(
    query(
      collectionGroup(db, INVITES),
      where('email', '==', normalized),
      where('status', '==', 'pending')
    )
  )
  return invSnap.docs.map((d) => {
    const data = d.data() as BoardInviteDoc
    const boardId = d.ref.parent.parent?.id ?? ''
    return { id: d.id, boardId, ...data }
  })
}

/** Fetch pending invites for the current user's email */
export async function getMyPendingInvites(): Promise<BoardInvite[]> {
  const user = auth.currentUser
  if (!user?.email) return []
  return getPendingInvitesForEmail(user.email)
}

export async function acceptInvite(boardId: string, inviteId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const ref = inviteRef(boardId, inviteId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Invite not found')

  const data = snap.data() as BoardInviteDoc
  if (data.status !== 'pending') throw new Error('Invite already used')
  if (data.email !== (user.email ?? '').trim().toLowerCase()) {
    throw new Error('This invite was sent to a different email')
  }

  await addBoardMember(
    boardId,
    user.uid,
    user.email ?? '',
    user.displayName ?? null,
    data.role
  )
  await updateDoc(ref, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  })
}

export async function rejectInvite(boardId: string, inviteId: string): Promise<void> {
  const ref = inviteRef(boardId, inviteId)
  await updateDoc(ref, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
}
