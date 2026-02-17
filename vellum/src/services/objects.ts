import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from './firebase'
import type {
  BoardObject,
  StickyObject,
  RectangleObject,
  ObjectsMap,
  Point,
} from '../types'
import { DEFAULT_TEXT_STYLE } from '../types'

const OBJECTS = 'objects'

function objectsCol(boardId: string) {
  return collection(db, 'boards', boardId, OBJECTS)
}

function objectRef(boardId: string, objectId: string) {
  return doc(db, 'boards', boardId, OBJECTS, objectId)
}

/** Convert Firestore doc to BoardObject (handles Timestamp) */
function docToObject(id: string, data: Record<string, unknown>): BoardObject {
  const base = {
    objectId: id,
    type: data.type as BoardObject['type'],
    createdBy: data.createdBy as string,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
  if (data.type === 'sticky') {
    return {
      ...base,
      type: 'sticky',
      position: data.position as Point,
      dimensions: data.dimensions as { width: number; height: number },
      content: (data.content as string) ?? '',
      fillColor: (data.fillColor as string) ?? '#fef08a',
      textStyle: (data.textStyle as StickyObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
    } as StickyObject
  }
  if (data.type === 'rectangle') {
    return {
      ...base,
      type: 'rectangle',
      position: data.position as Point,
      dimensions: data.dimensions as { width: number; height: number },
      fillColor: (data.fillColor as string) ?? '#3b82f6',
    } as RectangleObject
  }
  throw new Error(`Unknown object type: ${data.type}`)
}

export type CreateStickyInput = {
  type: 'sticky'
  position: Point
  dimensions?: { width: number; height: number }
  content?: string
  fillColor?: string
  textStyle?: Partial<StickyObject['textStyle']>
}

export type CreateRectangleInput = {
  type: 'rectangle'
  position: Point
  dimensions?: { width: number; height: number }
  fillColor?: string
}

export type CreateObjectInput = CreateStickyInput | CreateRectangleInput

export async function createObject(
  boardId: string,
  input: CreateObjectInput
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const base = {
    type: input.type,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  if (input.type === 'sticky') {
    const doc = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 200, height: 200 },
      content: input.content ?? '',
      fillColor: input.fillColor ?? '#fef08a',
      textStyle: { ...DEFAULT_TEXT_STYLE, ...input.textStyle },
    }
    const ref = await addDoc(objectsCol(boardId), doc)
    return ref.id
  }
  if (input.type === 'rectangle') {
    const doc = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 150, height: 100 },
      fillColor: input.fillColor ?? '#3b82f6',
    }
    const ref = await addDoc(objectsCol(boardId), doc)
    return ref.id
  }
  throw new Error(`Unsupported type: ${(input as CreateObjectInput).type}`)
}

export type ObjectUpdates =
  | { position: Point }
  | { content: string }
  | { content: string; textStyle?: Partial<StickyObject['textStyle']> }
  | { dimensions: { width: number; height: number } }
  | { fillColor: string }

export async function updateObject(
  boardId: string,
  objectId: string,
  updates: ObjectUpdates
): Promise<void> {
  await updateDoc(objectRef(boardId, objectId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  await deleteDoc(objectRef(boardId, objectId))
}

export function subscribeToObjects(
  boardId: string,
  callback: (objects: ObjectsMap) => void
): Unsubscribe {
  return onSnapshot(objectsCol(boardId), (snapshot) => {
    const map: ObjectsMap = {}
    snapshot.docs.forEach((d) => {
      const obj = docToObject(d.id, d.data() as Record<string, unknown>)
      map[d.id] = obj
    })
    callback(map)
  })
}
