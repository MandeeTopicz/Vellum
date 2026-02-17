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

/** Get the best available email for the current user (primary or from providers) */
function getCurrentUserEmail(): string | null {
  const user = auth.currentUser
  if (!user) return null
  if (user.email) return user.email.trim().toLowerCase()
  const provider = user.providerData?.[0]
  if (provider?.email) return provider.email.trim().toLowerCase()
  return null
}

/** Fetch pending invites for the current user's email */
export async function getMyPendingInvites(): Promise<BoardInvite[]> {
  const email = getCurrentUserEmail()
  if (!email) return []
  try {
    return await getPendingInvitesForEmail(email)
  } catch (err) {
    console.error('[invites] getMyPendingInvites failed:', err)
    return []
  }
}

/** Get pending invite for the current user on a specific board, if any */
export async function getPendingInviteForBoard(boardId: string): Promise<BoardInvite | null> {
  const invites = await getMyPendingInvites()
  return invites.find((inv) => inv.boardId === boardId) ?? null
}

export async function acceptInvite(boardId: string, inviteId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const ref = inviteRef(boardId, inviteId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Invite not found')

  const data = snap.data() as BoardInviteDoc
  if (data.status !== 'pending') throw new Error('Invite already used')
  const myEmail = getCurrentUserEmail()
  if (!myEmail || data.email !== myEmail) {
    throw new Error('This invite was sent to a different email')
  }

  try {
    await addBoardMember(
      boardId,
      user.uid,
      user.email ?? '',
      user.displayName ?? null,
      data.role
    )
  } catch (err) {
    console.error('[invites] addBoardMember failed:', err)
    throw new Error('Failed to join board. You may already be a member.')
  }

  try {
    await updateDoc(ref, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('[invites] updateDoc invite failed:', err)
    throw new Error('Failed to update invite. You have been added to the board.')
  }
}

export async function rejectInvite(boardId: string, inviteId: string): Promise<void> {
  const ref = inviteRef(boardId, inviteId)
  await updateDoc(ref, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  })
}
