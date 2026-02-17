import {
  collection,
  doc,
  addDoc,
  setDoc,
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
  CircleObject,
  TriangleObject,
  LineObject,
  TextObject,
  EmojiObject,
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
      fillColor: (data.fillColor as string) ?? 'transparent',
    } as RectangleObject
  }
  if (data.type === 'circle') {
    return {
      ...base,
      type: 'circle',
      position: data.position as Point,
      dimensions: data.dimensions as { width: number; height: number },
      fillColor: (data.fillColor as string) ?? 'transparent',
    } as CircleObject
  }
  if (data.type === 'triangle') {
    return {
      ...base,
      type: 'triangle',
      position: data.position as Point,
      dimensions: data.dimensions as { width: number; height: number },
      fillColor: (data.fillColor as string) ?? 'transparent',
    } as TriangleObject
  }
  if (data.type === 'line') {
    return {
      ...base,
      type: 'line',
      start: data.start as Point,
      end: data.end as Point,
      strokeColor: (data.strokeColor as string) ?? '#000',
      strokeWidth: (data.strokeWidth as number) ?? 2,
    } as LineObject
  }
  if (data.type === 'text') {
    return {
      ...base,
      type: 'text',
      position: data.position as Point,
      dimensions: data.dimensions as { width: number; height: number },
      content: (data.content as string) ?? '',
      textStyle: (data.textStyle as TextObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
    } as TextObject
  }
  if (data.type === 'emoji') {
    return {
      ...base,
      type: 'emoji',
      position: data.position as Point,
      emoji: (data.emoji as string) ?? '😀',
      fontSize: (data.fontSize as number) ?? 32,
    } as EmojiObject
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
}

export type CreateCircleInput = {
  type: 'circle'
  position: Point
  dimensions?: { width: number; height: number }
}

export type CreateTriangleInput = {
  type: 'triangle'
  position: Point
  dimensions?: { width: number; height: number }
}

export type CreateLineInput = {
  type: 'line'
  start: Point
  end: Point
  strokeColor?: string
  strokeWidth?: number
}

export type CreateTextInput = {
  type: 'text'
  position: Point
  dimensions?: { width: number; height: number }
  content?: string
  textStyle?: Partial<TextObject['textStyle']>
}

export type CreateEmojiInput = {
  type: 'emoji'
  position: Point
  emoji: string
  fontSize?: number
}

export type CreateObjectInput =
  | CreateStickyInput
  | CreateRectangleInput
  | CreateCircleInput
  | CreateTriangleInput
  | CreateLineInput
  | CreateTextInput
  | CreateEmojiInput

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
    const docData = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 200, height: 200 },
      content: input.content ?? '',
      fillColor: input.fillColor ?? '#fef08a',
      textStyle: { ...DEFAULT_TEXT_STYLE, ...input.textStyle },
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'rectangle') {
    const docData = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 150, height: 100 },
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'circle') {
    const docData = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 100, height: 100 },
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'triangle') {
    const docData = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 100, height: 80 },
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'line') {
    const docData = {
      ...base,
      start: input.start,
      end: input.end,
      strokeColor: input.strokeColor ?? '#000',
      strokeWidth: input.strokeWidth ?? 2,
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'text') {
    const docData = {
      ...base,
      position: input.position,
      dimensions: input.dimensions ?? { width: 200, height: 40 },
      content: input.content ?? 'Text',
      textStyle: { ...DEFAULT_TEXT_STYLE, ...input.textStyle },
    }
    const ref = await addDoc(objectsCol(boardId), docData)
    return ref.id
  }
  if (input.type === 'emoji') {
    const docData = {
      ...base,
      position: input.position,
      emoji: input.emoji ?? '😀',
      fontSize: input.fontSize ?? 32,
    }
    const ref = await addDoc(objectsCol(boardId), docData)
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
  | { start: Point; end: Point }

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

/** Convert BoardObject to Firestore document (for restore). Omits objectId. */
export function objectToFirestoreDoc(obj: BoardObject): Record<string, unknown> {
  const { objectId: _id, ...rest } = obj as BoardObject & { objectId: string }
  return rest
}

/** Restore a deleted object (for undo). Uses setDoc to recreate with same ID. */
export async function restoreObject(
  boardId: string,
  objectId: string,
  data: Record<string, unknown>
): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const docData = {
    ...data,
    createdBy: data.createdBy ?? user.uid,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(objectRef(boardId, objectId), docData)
}

export function subscribeToObjects(
  boardId: string,
  callback: (objects: ObjectsMap) => void
): Unsubscribe {
  return onSnapshot(objectsCol(boardId), (snapshot) => {
    const map: ObjectsMap = {}
    snapshot.docs.forEach((d) => {
      try {
        const obj = docToObject(d.id, d.data() as Record<string, unknown>)
        map[d.id] = obj
      } catch (e) {
        console.warn('[objects] skip unknown type:', d.data()?.type)
      }
    })
    callback(map)
  })
}
