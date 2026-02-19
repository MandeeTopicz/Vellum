/**
 * Objects service – Firestore CRUD for whiteboard objects (stickies, shapes, lines, text, emoji).
 * Handles real-time subscriptions, creation, updates, deletion, and conversion between
 * Firestore documents and BoardObject types.
 */
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
import type {
  BoardObject,
  ObjectsMap,
  Point,
  PenObject,
  StickyObject,
  TextObject,
} from '../types'
import { DEFAULT_TEXT_STYLE } from '../types'

const OBJECTS = 'objects'

/** @internal Firestore collection reference for a board's objects */
function objectsCol(boardId: string) {
  return collection(db, 'boards', boardId, OBJECTS)
}

/** @internal Firestore document reference for a single object */
function objectRef(boardId: string, objectId: string) {
  return doc(db, 'boards', boardId, OBJECTS, objectId)
}

/** Partial updates allowed for updateObject */
export type ObjectUpdates =
  | { position: { x: number; y: number } }
  | { dimensions: { width: number; height: number } }
  | { position: { x: number; y: number }; dimensions: { width: number; height: number } }
  | { start: { x: number; y: number }; end: { x: number; y: number } }
  | { content: string }
  | { fillColor: string }
  | { strokeColor?: string; strokeWidth?: number }
  | { emoji: string; fontSize?: number }
  | { textStyle?: Partial<typeof DEFAULT_TEXT_STYLE> }

/** Input for creating a new object (server adds createdBy, createdAt, updatedAt). Optional fields get defaults. */
export type CreateObjectInput =
  | { type: 'sticky'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; content?: string; textStyle?: Partial<typeof DEFAULT_TEXT_STYLE> }
  | { type: 'rectangle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string }
  | { type: 'circle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string }
  | { type: 'triangle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string }
  | { type: 'line'; start: Point; end: Point; strokeColor?: string; strokeWidth?: number }
  | { type: 'pen'; points: [number, number][]; color?: string; strokeWidth?: number; isHighlighter?: boolean; opacity?: number; strokeType?: 'solid' | 'dotted' | 'double' }
  | { type: 'text'; position: Point; dimensions: { width: number; height: number }; content?: string; textStyle?: Partial<typeof DEFAULT_TEXT_STYLE> }
  | { type: 'emoji'; position: Point; emoji: string; fontSize?: number }

/** @internal Converts Firestore timestamp-like object to Timestamp */
function reviveTimestamp(val: unknown): Timestamp {
  if (val && typeof val === 'object' && 'seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
    const v = val as { seconds: number; nanoseconds?: number }
    return Timestamp.fromMillis(v.seconds * 1000 + ((v.nanoseconds ?? 0) / 1e6))
  }
  return Timestamp.now()
}

/** @internal Converts a Firestore document to a BoardObject */
function docToObject(_boardId: string, docId: string, data: Record<string, unknown>): BoardObject {
  const type = data.type as BoardObject['type']
  const base = {
    objectId: docId,
    type,
    createdBy: data.createdBy as string,
    createdAt: reviveTimestamp(data.createdAt),
    updatedAt: reviveTimestamp(data.updatedAt),
  }
  switch (type) {
    case 'sticky':
      return {
        ...base,
        type: 'sticky',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        content: (data.content as string) ?? '',
        fillColor: (data.fillColor as string) ?? '#fef08a',
        textStyle: (data.textStyle as StickyObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
      }
    case 'rectangle':
      return {
        ...base,
        type: 'rectangle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? '#93c5fd',
      }
    case 'circle':
      return {
        ...base,
        type: 'circle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? '#93c5fd',
      }
    case 'triangle':
      return {
        ...base,
        type: 'triangle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? '#93c5fd',
      }
    case 'line':
      return {
        ...base,
        type: 'line',
        start: data.start as { x: number; y: number },
        end: data.end as { x: number; y: number },
        strokeColor: data.strokeColor as string | undefined,
        strokeWidth: data.strokeWidth as number | undefined,
      }
    case 'pen': {
      const flat = (data.points as number[]) ?? []
      const points: [number, number][] = []
      for (let i = 0; i < flat.length; i += 2) {
        points.push([flat[i], flat[i + 1]])
      }
      return {
        ...base,
        type: 'pen',
        points,
        color: (data.color as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 3,
        isHighlighter: (data.isHighlighter as boolean) ?? false,
        opacity: (data.opacity as number) ?? 1,
        strokeType: (data.strokeType as PenObject['strokeType']) ?? 'solid',
      } as PenObject
    }
    case 'text':
      return {
        ...base,
        type: 'text',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        content: (data.content as string) ?? '',
        textStyle: (data.textStyle as TextObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
      }
    case 'emoji':
      return {
        ...base,
        type: 'emoji',
        position: data.position as { x: number; y: number },
        emoji: (data.emoji as string) ?? '😀',
        fontSize: data.fontSize as number | undefined,
      }
    default:
      throw new Error(`Unknown object type: ${(base as { type: string }).type}`)
  }
}

/**
 * Subscribes to real-time updates for all objects on a board.
 * @param boardId - The board ID
 * @param callback - Invoked with the full objects map on every change
 * @returns Unsubscribe function
 * @example
 * const unsub = subscribeToObjects('board-123', (objects) => setObjects(objects))
 * return () => unsub()
 */
export function subscribeToObjects(boardId: string, callback: (objects: ObjectsMap) => void): Unsubscribe {
  return onSnapshot(
    objectsCol(boardId),
    (snapshot) => {
      const objects: ObjectsMap = {}
      snapshot.docs.forEach((d) => {
        objects[d.id] = docToObject(boardId, d.id, d.data() as Record<string, unknown>)
      })
      callback(objects)
    },
    (err) => {
      console.error('[objects] subscribeToObjects:', err)
      callback({})
    }
  )
}

/**
 * Creates a new object on the whiteboard.
 * @param boardId - The board ID
 * @param input - Object type and properties (position, dimensions, content, etc.)
 * @returns Promise resolving to the new object's ID
 * @example
 * const id = await createObject('board-123', { type: 'sticky', position: { x: 100, y: 200 }, dimensions: { width: 200, height: 160 } })
 */
export async function createObject(boardId: string, input: CreateObjectInput): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')

  const defaults: Record<string, unknown> = {}
  if (input.type === 'sticky') {
    defaults.content = input.content ?? ''
    defaults.textStyle = input.textStyle ?? DEFAULT_TEXT_STYLE
    defaults.fillColor = input.fillColor ?? '#fef08a'
  } else if (input.type === 'rectangle' || input.type === 'circle' || input.type === 'triangle') {
    defaults.fillColor = input.fillColor ?? '#93c5fd'
  } else if (input.type === 'text') {
    defaults.content = input.content ?? ''
    defaults.textStyle = input.textStyle ?? DEFAULT_TEXT_STYLE
  }

  const docData: Record<string, unknown> = {
    ...input,
    ...defaults,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (input.type === 'pen') {
    docData.points = input.points.flat()
  }
  const ref = await addDoc(objectsCol(boardId), docData)
  return ref.id
}

/**
 * Updates an existing object with partial changes.
 * @param boardId - The board ID
 * @param objectId - The object ID
 * @param updates - Partial updates (position, dimensions, content, fillColor, etc.)
 * @returns Promise that resolves when the update is written
 */
export async function updateObject(boardId: string, objectId: string, updates: ObjectUpdates): Promise<void> {
  await updateDoc(objectRef(boardId, objectId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Permanently deletes an object from the board.
 * @param boardId - The board ID
 * @param objectId - The object ID
 * @returns Promise that resolves when the deletion is complete
 */
export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  await deleteDoc(objectRef(boardId, objectId))
}

/**
 * Converts a BoardObject to a Firestore-compatible document shape (for restore/undo).
 * @param obj - The board object to serialize
 * @returns Plain object suitable for Firestore setDoc
 */
export function objectToFirestoreDoc(obj: BoardObject): Record<string, unknown> {
  const base = {
    type: obj.type,
    createdBy: obj.createdBy,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  }
  switch (obj.type) {
    case 'sticky':
      return { ...base, position: obj.position, dimensions: obj.dimensions, content: obj.content, fillColor: obj.fillColor, textStyle: obj.textStyle }
    case 'rectangle':
    case 'circle':
    case 'triangle':
      return { ...base, position: obj.position, dimensions: obj.dimensions, fillColor: obj.fillColor }
    case 'line':
      return { ...base, start: obj.start, end: obj.end, strokeColor: obj.strokeColor, strokeWidth: obj.strokeWidth }
    case 'pen':
      return {
        ...base,
        points: obj.points.flat(),
        color: obj.color,
        strokeWidth: obj.strokeWidth,
        isHighlighter: obj.isHighlighter,
        opacity: obj.opacity,
        strokeType: obj.strokeType ?? 'solid',
      }
    case 'text':
      return { ...base, position: obj.position, dimensions: obj.dimensions, content: obj.content, textStyle: obj.textStyle }
    case 'emoji':
      return { ...base, position: obj.position, emoji: obj.emoji, fontSize: obj.fontSize }
    default:
      throw new Error(`Unknown object type: ${(obj as { type: string }).type}`)
  }
}

/**
 * Restores a previously deleted object (used for undo).
 * @param boardId - The board ID
 * @param objectId - The object ID to restore
 * @param docData - The original document data (e.g. from objectToFirestoreDoc before delete)
 * @returns Promise that resolves when the restore is complete
 */
export async function restoreObject(
  boardId: string,
  objectId: string,
  docData: Record<string, unknown>
): Promise<void> {
  const revived = {
    ...docData,
    createdAt: reviveTimestamp(docData.createdAt),
    updatedAt: serverTimestamp(),
  }
  await setDoc(objectRef(boardId, objectId), revived)
}
