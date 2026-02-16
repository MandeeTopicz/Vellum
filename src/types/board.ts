import type { Timestamp } from 'firebase/firestore'

/**
 * Permission level for board members.
 * - edit: full capabilities (create, move, edit, delete)
 * - view: read-only, no modifications
 */
export type BoardMemberRole = 'edit' | 'view'

export interface BoardMember {
  userId: string
  email: string
  displayName: string | null
  role: BoardMemberRole
  addedAt: Timestamp
}

export interface Board {
  id: string
  name: string
  ownerId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Board document as stored in Firestore (ids are document ids).
 * Members are in subcollection boards/{boardId}/members/{userId}
 */
export interface BoardDoc {
  name: string
  ownerId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface BoardWithMembers extends Board {
  members: BoardMember[]
}

/** Pending invite: creator invites by email; invitee accepts to get access */
export type InviteStatus = 'pending' | 'accepted' | 'rejected'

export interface BoardInvite {
  id: string
  boardId: string
  email: string
  role: BoardMemberRole
  invitedBy: string
  invitedByName: string | null
  status: InviteStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface BoardInviteDoc {
  email: string
  role: BoardMemberRole
  invitedBy: string
  invitedByName: string | null
  status: InviteStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}
