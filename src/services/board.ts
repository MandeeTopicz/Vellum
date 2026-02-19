/**
 * Board service – Firestore CRUD for boards and membership.
 * Handles board creation, fetching, updates, deletion, member management,
 * and real-time subscriptions for owned and shared boards.
 */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type DocumentReference,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type { Board, BoardDoc, BoardMember, BoardMemberRole, PublicAccessLevel } from '../types'

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

/**
 * Creates a new board and adds the current user as owner with edit role.
 * @param name - Board display name (defaults to "Untitled Board" if empty)
 * @returns Promise resolving to the new board ID
 * @example
 * const boardId = await createBoard('My Whiteboard')
 */
export async function createBoard(name: string): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const boardDoc: Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>
    updatedAt: ReturnType<typeof serverTimestamp>
  } = {
    name: name || 'Untitled Board',
    ownerId: user.uid,
    publicAccess: 'none',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const ref = await addDoc(boardsCol(), boardDoc)
  console.log('[board] createBoard saved to Firestore:', { boardId: ref.id, name, ownerId: user.uid })
  console.log('[board] createBoard saved to Firestore:', { boardId: ref.id, name, ownerId: user.uid })
  await setDoc(memberRef(ref.id, user.uid), {
    userId: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? null,
    role: 'edit' as BoardMemberRole,
    addedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Fetches a single board by ID.
 * @param boardId - The board ID
 * @returns Promise resolving to the board or null if not found
 */
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
    publicAccess: data.publicAccess ?? 'none',
  }
}

/**
 * Updates board metadata (name, public access level).
 * @param boardId - The board ID
 * @param updates - Partial updates for name and/or publicAccess
 * @returns Promise that resolves when the update is written
 */
export async function updateBoard(
  boardId: string,
  updates: Partial<Pick<BoardDoc, 'name' | 'publicAccess'>>
): Promise<void> {
  await updateDoc(boardRef(boardId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Deletes a board. Only the owner can delete.
 * @param boardId - The board ID
 * @returns Promise that resolves when the board is deleted
 * @throws Error if not authenticated or not the board owner
 */
export async function deleteBoard(boardId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const board = await getBoard(boardId)
  if (!board || board.ownerId !== user.uid) {
    throw new Error('Only the board owner can delete it')
  }
  await deleteDoc(boardRef(boardId))
}

/**
 * Fetches all boards owned by the current user, sorted by updatedAt descending.
 * @returns Promise resolving to an array of boards (empty if not authenticated)
 */
export async function getBoardsForUser(): Promise<Board[]> {
  const user = auth.currentUser
  console.log('[board] getBoardsForUser: current user', user ? { uid: user.uid, email: user.email } : null)
  if (!user) {
    console.log('[board] getBoardsForUser: no user, returning []')
    return []
  }

  try {
    const q = query(boardsCol(), where('ownerId', '==', user.uid))
    console.log('[board] getBoardsForUser: executing query boards where ownerId ==', user.uid)
    const snap = await getDocs(q)
    console.log('[board] getBoardsForUser: snapshot size', snap.size, 'docs:', snap.docs.map((d) => ({ id: d.id, data: d.data() })))

    const boards: Board[] = snap.docs.map((d) => {
      const data = d.data() as Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
        createdAt: Timestamp
        updatedAt: Timestamp
      }
      return { id: d.id, ...data }
    })

    boards.sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() ?? 0
      const bMs = b.updatedAt?.toMillis?.() ?? 0
      return bMs - aMs
    })
    console.log('[board] getBoardsForUser: returning', boards.length, 'boards', boards.map((b) => ({ id: b.id, name: b.name, ownerId: b.ownerId })))
    return boards
  } catch (err) {
    console.error('[board] getBoardsForUser: ERROR', err)
    throw err
  }
}

export type BoardsByCategory = { owned: Board[]; shared: Board[] }

/** @internal Sorts boards by updatedAt descending */
function sortBoards(boards: Board[]): Board[] {
  return [...boards].sort((a, b) => {
    const aMs = a.updatedAt?.toMillis?.() ?? 0
    const bMs = b.updatedAt?.toMillis?.() ?? 0
    return bMs - aMs
  })
}

/**
 * Subscribes to real-time updates of owned and shared boards for the current user.
 * @param callback - Invoked with { owned, shared } boards on every change
 * @returns Unsubscribe function
 * @example
 * const unsub = subscribeToBoardsForUser(({ owned, shared }) => { setOwned(owned); setShared(shared) })
 */
export function subscribeToBoardsForUser(callback: (data: BoardsByCategory) => void): Unsubscribe {
  const user = auth.currentUser
  if (!user) {
    callback({ owned: [], shared: [] })
    return () => {}
  }

  let ownedBoards: Board[] = []
  let sharedBoards: Board[] = []

  const emit = () => {
    const ownedIds = new Set(ownedBoards.map((b) => b.id))
    const sharedFiltered = sharedBoards.filter((b) => !ownedIds.has(b.id))
    callback({
      owned: sortBoards(ownedBoards),
      shared: sortBoards(sharedFiltered),
    })
  }

  const unsubOwned = onSnapshot(
    query(boardsCol(), where('ownerId', '==', user.uid)),
    (snap) => {
      ownedBoards = snap.docs.map((d) => {
        const data = d.data() as Omit<BoardDoc, 'createdAt' | 'updatedAt'> & {
          createdAt: Timestamp
          updatedAt: Timestamp
        }
        return { id: d.id, ...data }
      })
      emit()
    },
    (err) => {
      console.error('[board] subscribeToBoardsForUser (owned):', err)
      ownedBoards = []
      emit()
    }
  )

  let unsubMembers: Unsubscribe = () => {}
  try {
    unsubMembers = onSnapshot(
      query(collectionGroup(db, MEMBERS), where('userId', '==', user.uid)),
      async (snap) => {
        const boardIds = new Set<string>()
        snap.docs.forEach((d) => {
          const segments = d.ref.path.split('/')
          const idx = segments.indexOf(BOARDS)
          if (idx >= 0 && segments[idx + 1]) boardIds.add(segments[idx + 1])
        })
        const idsToFetch = [...boardIds]
        const boards: Board[] = []
        for (const boardId of idsToFetch) {
          const b = await getBoard(boardId)
          if (b && b.ownerId !== user.uid) boards.push(b)
        }
        sharedBoards = boards
        emit()
      },
      (err) => {
        console.warn('[board] subscribeToBoardsForUser (shared) failed, showing owned only:', err.message)
        sharedBoards = []
        emit()
      }
    )
  } catch (err) {
    console.warn('[board] subscribeToBoardsForUser (shared) setup failed:', err)
  }

  return () => {
    unsubOwned()
    unsubMembers()
  }
}

/**
 * Fetches all members of a board.
 * @param boardId - The board ID
 * @returns Promise resolving to an array of board members
 */
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

/**
 * Adds or updates a board member (used for invites and self-join).
 * @param boardId - The board ID
 * @param userId - The user ID to add
 * @param email - User email
 * @param displayName - User display name or null
 * @param role - Member role ('view' or 'edit')
 * @returns Promise that resolves when the member is added
 */
export async function addBoardMember(
  boardId: string,
  userId: string,
  email: string,
  displayName: string | null,
  role: BoardMemberRole
): Promise<void> {
  const currentUid = auth.currentUser?.uid
  // Only owner can update board; invitee adding themselves cannot read/update board yet
  const isOwnerAddingSomeone = currentUid && userId !== currentUid
  if (isOwnerAddingSomeone) {
    await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
  }
  await setDoc(memberRef(boardId, userId), {
    userId,
    email,
    displayName,
    role,
    addedAt: serverTimestamp(),
  })
}

/**
 * Updates a board member's role.
 * @param boardId - The board ID
 * @param userId - The user ID
 * @param role - New role ('view' or 'edit')
 * @returns Promise that resolves when the update is written
 */
export async function setMemberRole(
  boardId: string,
  userId: string,
  role: BoardMemberRole
): Promise<void> {
  await updateDoc(memberRef(boardId, userId), { role })
  await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
}

/**
 * Removes a member from a board.
 * @param boardId - The board ID
 * @param userId - The user ID to remove
 * @returns Promise that resolves when the member is removed
 */
export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  await updateDoc(boardRef(boardId), { updatedAt: serverTimestamp() })
  const ref = memberRef(boardId, userId)
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(ref)
}

/**
 * Gets the current user's role on a board (owner, edit, view, or null if no access).
 * Considers membership and public access level.
 * @param boardId - The board ID
 * @returns Promise resolving to 'owner' | 'edit' | 'view' | null
 */
export async function getCurrentUserRole(boardId: string): Promise<BoardMemberRole | 'owner' | null> {
  const user = auth.currentUser
  if (!user) return null

  const board = await getBoard(boardId)
  if (!board) return null
  if (board.ownerId === user.uid) return 'owner'

  const memberSnap = await getDoc(memberRef(boardId, user.uid))
  if (memberSnap.exists()) return (memberSnap.data().role as BoardMemberRole) ?? null

  const publicAccess = board.publicAccess ?? 'none'
  if (publicAccess === 'edit') return 'edit'
  if (publicAccess === 'view') return 'view'
  return null
}

export type { PublicAccessLevel }

/**
 * Checks whether the current user can edit the board (owner or edit role).
 * @param boardId - The board ID
 * @returns Promise resolving to true if the user can edit
 */
export async function canCurrentUserEdit(boardId: string): Promise<boolean> {
  const role = await getCurrentUserRole(boardId)
  return role === 'owner' || role === 'edit'
}
