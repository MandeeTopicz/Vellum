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
  writeBatch,
  getDocs,
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

/** Position update for drag (supports nesting: parentId, localX, localY) */
export type PositionUpdate = {
  objectId: string
  x: number
  y: number
  parentId?: string | null
  localX?: number
  localY?: number
}

/** Partial updates allowed for updateObject */
export type ObjectUpdates =
  | { position: { x: number; y: number } }
  | { parentId: string | null; localX: number; localY: number }
  | { position: { x: number; y: number }; parentId: string | null; localX: number; localY: number }
  | { dimensions: { width: number; height: number } }
  | { position: { x: number; y: number }; dimensions: { width: number; height: number }; rotation?: number }
  | { start: { x: number; y: number }; end: { x: number; y: number } }
  | { content: string }
  | { content: string; dimensions: { width: number; height: number } }
  | { fillColor: string }
  | { strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted' }
  | { opacity?: number }
  | { cornerRadius?: number }
  | { connectionType?: 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double' }
  | { emoji: string; fontSize?: number }
  | { textStyle?: Partial<typeof DEFAULT_TEXT_STYLE> }
  | { displayOrder?: number }
  | { rotation: number }
  | { linkUrl: string | null }

/** Input for creating a new object (server adds createdBy, createdAt, updatedAt). Optional fields get defaults. */
export type CreateObjectInput = (
  | { type: 'sticky'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; content?: string; textStyle?: Partial<typeof DEFAULT_TEXT_STYLE>; cornerRadius?: number; opacity?: number }
  | { type: 'rectangle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number; cornerRadius?: number }
  | { type: 'circle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'triangle'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number; inverted?: boolean }
  | { type: 'line'; start: Point; end: Point; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; connectionType?: 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-curved-cw' | 'arrow-elbow-bidirectional' | 'arrow-double' }
  | { type: 'diamond'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'star'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'pentagon'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'hexagon'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'octagon'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'arrow'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number; direction?: 'right' | 'left' }
  | { type: 'plus'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'parallelogram'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number; shapeKind: 'right' | 'left' }
  | { type: 'cylinder'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number; shapeKind: 'vertical' | 'horizontal' }
  | { type: 'tab-shape'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'trapezoid'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'circle-cross'; position: Point; dimensions: { width: number; height: number }; fillColor?: string; strokeColor?: string; strokeWidth?: number; strokeOpacity?: number; strokeStyle?: 'solid' | 'dashed' | 'dotted'; opacity?: number }
  | { type: 'pen'; points: [number, number][]; color?: string; strokeWidth?: number; isHighlighter?: boolean; opacity?: number; strokeType?: 'solid' | 'dotted' | 'double' }
  | { type: 'text'; position: Point; dimensions: { width: number; height: number }; content?: string; textStyle?: Partial<typeof DEFAULT_TEXT_STYLE> }
  | { type: 'emoji'; position: Point; emoji: string; fontSize?: number }
  | { type: 'frame'; position: Point; dimensions: { width: number; height: number }; title?: string }
) & { rotation?: number; linkUrl?: string | null; displayOrder?: number }

/** @internal Adds nesting, rotation, and linkUrl to position-based objects (backward compat) */
function withNestingFields<T extends BoardObject & { position: { x: number; y: number } }>(
  data: Record<string, unknown>,
  obj: T
): BoardObject {
  const pos = data.position as { x: number; y: number }
  return {
    ...obj,
    parentId: data.parentId !== undefined ? (data.parentId as string | null) : null,
    localX: typeof data.localX === 'number' ? data.localX : pos?.x ?? 0,
    localY: typeof data.localY === 'number' ? data.localY : pos?.y ?? 0,
    rotation: typeof data.rotation === 'number' ? data.rotation : undefined,
    linkUrl: data.linkUrl != null ? (data.linkUrl as string | null) : undefined,
  } as BoardObject
}

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
    displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : undefined,
    linkUrl: data.linkUrl != null ? (data.linkUrl as string | null) : undefined,
  }
  switch (type) {
    case 'sticky':
      return withNestingFields(data, {
        ...base,
        type: 'sticky',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        content: (data.content as string) ?? '',
        fillColor: (data.fillColor as string) ?? '#fef08a',
        textStyle: (data.textStyle as StickyObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
        cornerRadius: typeof data.cornerRadius === 'number' ? data.cornerRadius : undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
      })
    case 'rectangle':
      return withNestingFields(data, {
        ...base,
        type: 'rectangle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeOpacity: typeof data.strokeOpacity === 'number' ? data.strokeOpacity : undefined,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        cornerRadius: typeof data.cornerRadius === 'number' ? data.cornerRadius : undefined,
      })
    case 'circle':
      return withNestingFields(data, {
        ...base,
        type: 'circle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
      })
    case 'triangle':
      return withNestingFields(data, {
        ...base,
        type: 'triangle',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        inverted: (data.inverted as boolean) ?? false,
      })
    case 'line':
      return {
        ...base,
        type: 'line',
        start: data.start as { x: number; y: number },
        end: data.end as { x: number; y: number },
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        connectionType: (data.connectionType as 'line' | 'arrow-straight' | 'arrow-curved' | 'arrow-elbow-bidirectional' | 'arrow-double') ?? 'line',
      }
    case 'diamond':
    case 'pentagon':
    case 'hexagon':
    case 'octagon':
      return withNestingFields(data, {
        ...base,
        type,
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
      })
    case 'star':
      return withNestingFields(data, {
        ...base,
        type: 'star',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
      })
    case 'arrow':
      return withNestingFields(data, {
        ...base,
        type: 'arrow',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        direction: (data.direction as 'right' | 'left') ?? 'right',
      })
    case 'plus':
    case 'tab-shape':
    case 'trapezoid':
    case 'circle-cross':
      return withNestingFields(data, {
        ...base,
        type,
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
      })
    case 'parallelogram':
      return withNestingFields(data, {
        ...base,
        type: 'parallelogram',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        shapeKind: (data.shapeKind as 'right' | 'left') ?? 'right',
      })
    case 'cylinder':
      return withNestingFields(data, {
        ...base,
        type: 'cylinder',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        fillColor: (data.fillColor as string) ?? 'transparent',
        strokeColor: (data.strokeColor as string) ?? '#000000',
        strokeWidth: (data.strokeWidth as number) ?? 2,
        strokeStyle: (data.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? undefined,
        opacity: typeof data.opacity === 'number' ? data.opacity : undefined,
        shapeKind: (data.shapeKind as 'vertical' | 'horizontal') ?? 'vertical',
      })
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
      return withNestingFields(data, {
        ...base,
        type: 'text',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        content: (data.content as string) ?? '',
        textStyle: (data.textStyle as TextObject['textStyle']) ?? DEFAULT_TEXT_STYLE,
      })
    case 'emoji':
      return withNestingFields(data, {
        ...base,
        type: 'emoji',
        position: data.position as { x: number; y: number },
        emoji: (data.emoji as string) ?? '😀',
        fontSize: data.fontSize as number | undefined,
      })
    case 'frame':
      return withNestingFields(data, {
        ...base,
        type: 'frame',
        position: data.position as { x: number; y: number },
        dimensions: data.dimensions as { width: number; height: number },
        title: (data.title as string) ?? undefined,
      } as BoardObject & { position: { x: number; y: number } })
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
    }
  )
}

/**
 * Fetches all objects for a board once (no realtime subscription).
 * Used for preview thumbnails on the dashboard.
 * @param boardId - The board ID
 * @returns Promise resolving to array of board objects
 */
export async function getBoardObjectsOnce(boardId: string): Promise<BoardObject[]> {
  const snapshot = await getDocs(objectsCol(boardId))
  return snapshot.docs.map((d) => docToObject(boardId, d.id, d.data() as Record<string, unknown>))
}

/**
 * Builds a BoardObject from createInput for optimistic display.
 * Used to show objects immediately before Firestore snapshot arrives.
 * @param objectId - The new object's ID
 * @param input - CreateObjectInput used for creation
 * @returns BoardObject for optimistic UI
 */
export function createInputToBoardObject(objectId: string, input: CreateObjectInput): BoardObject {
  const user = auth.currentUser
  const uid = user?.uid ?? ''
  const now = Timestamp.now()
  const base = {
    objectId,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  }
  const pos = 'position' in input ? input.position : { x: 0, y: 0 }
  const dims = 'dimensions' in input ? input.dimensions : { width: 100, height: 100 }
  const parentId = 'parentId' in input ? (input.parentId ?? null) : null
  const localX = 'localX' in input && typeof input.localX === 'number' ? input.localX : pos.x
  const localY = 'localY' in input && typeof input.localY === 'number' ? input.localY : pos.y
  const rot = typeof (input as { rotation?: number }).rotation === 'number' ? (input as { rotation: number }).rotation : undefined
  if (input.type === 'sticky') {
    return {
      ...base,
      type: 'sticky',
      position: pos,
      dimensions: dims,
      content: input.content ?? '',
      fillColor: input.fillColor ?? '#fef08a',
      textStyle: { ...DEFAULT_TEXT_STYLE, ...input.textStyle },
      cornerRadius: input.cornerRadius,
      opacity: input.opacity,
      parentId: parentId ?? undefined,
      localX,
      localY,
      ...(rot !== undefined && { rotation: rot }),
    } as StickyObject
  }
  if (input.type === 'text') {
    return {
      ...base,
      type: 'text',
      position: pos,
      dimensions: dims,
      content: input.content ?? '',
      textStyle: { ...DEFAULT_TEXT_STYLE, ...input.textStyle },
      parentId: parentId ?? undefined,
      localX,
      localY,
      ...(rot !== undefined && { rotation: rot }),
    } as TextObject
  }
  const shapeBase = {
    ...base,
    type: input.type,
    position: pos,
    dimensions: dims,
    ...(parentId !== null && { parentId: parentId ?? undefined, localX, localY }),
  }
  return shapeBase as BoardObject
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
  } else if (
    input.type === 'rectangle' || input.type === 'circle' || input.type === 'triangle' ||
    input.type === 'diamond' || input.type === 'star' || input.type === 'pentagon' ||
    input.type === 'hexagon' || input.type === 'octagon' || input.type === 'arrow' ||
    input.type === 'plus' || input.type === 'parallelogram' || input.type === 'cylinder' ||
    input.type === 'tab-shape' || input.type === 'trapezoid' || input.type === 'circle-cross'
  ) {
    defaults.fillColor = input.fillColor ?? 'transparent'
    defaults.strokeColor = input.strokeColor ?? '#000000'
    defaults.strokeWidth = input.strokeWidth ?? 2
  } else if (input.type === 'text') {
    defaults.content = input.content ?? ''
    let textStyle = input.textStyle ?? DEFAULT_TEXT_STYLE
    const merged = { ...DEFAULT_TEXT_STYLE, ...textStyle }
    const textAlign =
      merged.textAlign ??
      (merged.fontSize >= 24 || (merged.bold && (input.content?.length ?? 0) < 50) ? 'center' : 'left')
    defaults.textStyle = { ...merged, textAlign }
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
  /** Firestore rejects undefined - strip keys with undefined values. Remove template metadata so placed objects are fully editable. */
  const TEMPLATE_METADATA_KEYS = ['locked', 'readonly', 'isTemplate', 'templateId', 'editable']
  const sanitized: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(docData)) {
    if (v !== undefined && !TEMPLATE_METADATA_KEYS.includes(k)) sanitized[k] = v
  }
  const ref = await addDoc(objectsCol(boardId), sanitized)
  return ref.id
}

const BATCH_WRITE_LIMIT = 500

/**
 * Batch-creates multiple objects. Uses Firestore writeBatch for efficiency.
 * @param boardId - The board ID
 * @param inputs - Array of CreateObjectInput (stickies, shapes, etc.)
 * @returns Promise resolving to array of created object IDs
 */
export async function batchCreateObjects(boardId: string, inputs: CreateObjectInput[]): Promise<string[]> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  if (inputs.length === 0) return []

  const ids: string[] = []
  for (let i = 0; i < inputs.length; i += BATCH_WRITE_LIMIT) {
    const batch = writeBatch(db)
    const chunk = inputs.slice(i, i + BATCH_WRITE_LIMIT)
    for (const input of chunk) {
      const ref = doc(objectsCol(boardId))
      ids.push(ref.id)
      const defaults: Record<string, unknown> = {}
      if (input.type === 'sticky') {
        defaults.content = input.content ?? ''
        defaults.textStyle = { ...DEFAULT_TEXT_STYLE, ...input.textStyle }
        defaults.fillColor = input.fillColor ?? '#fef08a'
      } else if (
        input.type === 'rectangle' || input.type === 'circle' || input.type === 'triangle' ||
        input.type === 'diamond' || input.type === 'star' || input.type === 'pentagon' ||
        input.type === 'hexagon' || input.type === 'octagon' || input.type === 'arrow' ||
        input.type === 'plus' || input.type === 'parallelogram' || input.type === 'cylinder' ||
        input.type === 'tab-shape' || input.type === 'trapezoid' || input.type === 'circle-cross'
      ) {
        defaults.fillColor = input.fillColor ?? 'transparent'
        defaults.strokeColor = (input as { strokeColor?: string }).strokeColor ?? '#000000'
        defaults.strokeWidth = (input as { strokeWidth?: number }).strokeWidth ?? 2
      } else if (input.type === 'text') {
        defaults.content = input.content ?? ''
        defaults.textStyle = { ...DEFAULT_TEXT_STYLE, ...input.textStyle }
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
      const sanitized: Record<string, unknown> = {}
      const TEMPLATE_KEYS = ['locked', 'readonly', 'isTemplate', 'templateId', 'editable']
      for (const [k, v] of Object.entries(docData)) {
        if (v !== undefined && !TEMPLATE_KEYS.includes(k)) sanitized[k] = v
      }
      batch.set(ref, sanitized)
    }
    await batch.commit()
  }
  return ids
}

/**
 * Updates an existing object with partial changes.
 * @param boardId - The board ID
 * @param objectId - The object ID
 * @param updates - Partial updates (position, dimensions, content, fillColor, etc.)
 * @returns Promise that resolves when the update is written
 */
export async function updateObject(boardId: string, objectId: string, updates: ObjectUpdates): Promise<void> {
  const docUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || key === 'updatedAt') continue
    if (key === 'dimensions' && value && typeof value === 'object' && 'width' in value && 'height' in value) {
      docUpdates['dimensions.width'] = (value as { width: number }).width
      docUpdates['dimensions.height'] = (value as { height: number }).height
    } else {
      docUpdates[key] = value
    }
  }
  await updateDoc(objectRef(boardId, objectId), docUpdates)
}

/**
 * Batch update positions for multiple objects. Use for drag-end batching.
 * Supports nesting: when parentId/localX/localY provided, writes those; otherwise position.
 */
export async function batchUpdatePositions(
  boardId: string,
  updates: PositionUpdate[]
): Promise<void> {
  if (updates.length === 0) return
  const batch = writeBatch(db)
  for (const u of updates) {
    const { objectId, x, y, parentId, localX, localY } = u
    if (typeof parentId !== 'undefined') {
      batch.update(objectRef(boardId, objectId), {
        parentId: parentId ?? null,
        localX: localX ?? x,
        localY: localY ?? y,
        'position.x': localX ?? x,
        'position.y': localY ?? y,
        updatedAt: serverTimestamp(),
      })
    } else {
      batch.update(objectRef(boardId, objectId), {
        'position.x': x,
        'position.y': y,
        updatedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
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
 * Batch-deletes multiple objects atomically (e.g. frame + children + connected lines).
 * @param boardId - The board ID
 * @param objectIds - Object IDs to delete
 * @returns Promise that resolves when the batch deletion is complete
 */
export async function batchDeleteObjects(boardId: string, objectIds: string[]): Promise<void> {
  if (objectIds.length === 0) return
  const batch = writeBatch(db)
  for (const oid of objectIds) {
    batch.delete(objectRef(boardId, oid))
  }
  await batch.commit()
}

/**
 * Deletes all objects on a board. Uses Firestore as source of truth.
 * @param boardId - The board ID
 * @returns Promise resolving to the number of objects deleted
 */
export async function deleteAllObjects(boardId: string): Promise<number> {
  const snapshot = await getDocs(objectsCol(boardId))
  const ids = snapshot.docs.map((d) => d.id)
  if (ids.length === 0) return 0
  const BATCH_SIZE = 500
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = ids.slice(i, i + BATCH_SIZE)
    for (const id of chunk) {
      batch.delete(objectRef(boardId, id))
    }
    await batch.commit()
  }
  return ids.length
}

/**
 * Returns board summary: total count and counts by type. Uses Firestore as source of truth.
 * @param boardId - The board ID
 */
export async function getBoardSummary(boardId: string): Promise<{ totalCount: number; byType: Record<string, number> }> {
  const snapshot = await getDocs(objectsCol(boardId))
  const byType: Record<string, number> = {}
  for (const d of snapshot.docs) {
    const type = (d.data().type as string) ?? 'unknown'
    byType[type] = (byType[type] ?? 0) + 1
  }
  return { totalCount: snapshot.size, byType }
}

/** @internal Appends rotation, linkUrl, parentId, localX, localY to doc when present on object */
function withRotationAndLink<T extends Record<string, unknown>>(
  doc: T,
  obj: BoardObject
): Record<string, unknown> {
  const rot = (obj as { rotation?: number }).rotation
  const link = (obj as { linkUrl?: string | null }).linkUrl
  const parentId = (obj as { parentId?: string | null }).parentId
  const localX = (obj as { localX?: number }).localX
  const localY = (obj as { localY?: number }).localY
  return {
    ...doc,
    ...(typeof rot === 'number' && { rotation: rot }),
    ...(link !== undefined && { linkUrl: link }),
    ...(parentId !== undefined && { parentId }),
    ...(typeof localX === 'number' && { localX }),
    ...(typeof localY === 'number' && { localY }),
  } as Record<string, unknown>
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
      return withRotationAndLink(
        { ...base, position: obj.position, dimensions: obj.dimensions, content: obj.content, fillColor: obj.fillColor, textStyle: obj.textStyle, cornerRadius: obj.cornerRadius },
        obj
      )
    case 'rectangle':
    case 'circle':
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'pentagon':
    case 'hexagon':
    case 'octagon':
    case 'arrow':
    case 'plus':
    case 'tab-shape':
    case 'trapezoid':
    case 'circle-cross':
      return withRotationAndLink(
        {
          ...base,
          position: obj.position,
          dimensions: obj.dimensions,
        fillColor: obj.fillColor,
        strokeColor: (obj as { strokeColor?: string }).strokeColor,
        strokeWidth: (obj as { strokeWidth?: number }).strokeWidth,
        ...(obj.type === 'rectangle' && typeof (obj as { cornerRadius?: number }).cornerRadius === 'number' && { cornerRadius: (obj as { cornerRadius: number }).cornerRadius }),
        ...(obj.type === 'triangle' && 'inverted' in obj && { inverted: obj.inverted }),
        ...(obj.type === 'arrow' && 'direction' in obj && { direction: obj.direction }),
        },
        obj
      )
    case 'parallelogram':
      return withRotationAndLink(
        {
          ...base,
          position: obj.position,
          dimensions: obj.dimensions,
          fillColor: obj.fillColor,
          strokeColor: obj.strokeColor,
          strokeWidth: obj.strokeWidth,
          shapeKind: obj.shapeKind,
        },
        obj
      )
    case 'cylinder':
      return withRotationAndLink(
        {
          ...base,
          position: obj.position,
          dimensions: obj.dimensions,
          fillColor: obj.fillColor,
          strokeColor: obj.strokeColor,
          strokeWidth: obj.strokeWidth,
          shapeKind: obj.shapeKind,
        },
        obj
      )
    case 'line': {
      const line = obj as { startObjectId?: string | null; endObjectId?: string | null }
      return withRotationAndLink(
        {
          ...base,
          start: obj.start,
          end: obj.end,
          strokeColor: obj.strokeColor,
          strokeWidth: obj.strokeWidth,
          connectionType: obj.connectionType ?? 'line',
          ...(line.startObjectId !== undefined && { startObjectId: line.startObjectId }),
          ...(line.endObjectId !== undefined && { endObjectId: line.endObjectId }),
        },
        obj
      )
    }
    case 'pen':
      return withRotationAndLink(
        {
          ...base,
          points: obj.points.flat(),
          color: obj.color,
          strokeWidth: obj.strokeWidth,
          isHighlighter: obj.isHighlighter,
          opacity: obj.opacity,
          strokeType: obj.strokeType ?? 'solid',
        },
        obj
      )
    case 'text':
      return withRotationAndLink(
        { ...base, position: obj.position, dimensions: obj.dimensions, content: obj.content, textStyle: obj.textStyle },
        obj
      )
    case 'emoji':
      return withRotationAndLink(
        { ...base, position: obj.position, emoji: obj.emoji, fontSize: obj.fontSize },
        obj
      )
    case 'frame':
      return withRotationAndLink(
        {
          ...base,
          position: obj.position,
          dimensions: obj.dimensions,
          title: (obj as { title?: string }).title,
        },
        obj
      )
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

/**
 * Batch-restores multiple objects atomically (e.g. frame + children + connected lines for undo).
 * @param boardId - The board ID
 * @param objects - BoardObjects to restore (full objects with objectId)
 * @returns Promise that resolves when the batch restore is complete
 */
export async function batchRestoreObjects(
  boardId: string,
  objects: BoardObject[]
): Promise<void> {
  if (objects.length === 0) return
  const batch = writeBatch(db)
  for (const obj of objects) {
    const docData = objectToFirestoreDoc(obj)
    const revived = {
      ...docData,
      createdAt: reviveTimestamp(docData.createdAt),
      updatedAt: serverTimestamp(),
    }
    batch.set(objectRef(boardId, obj.objectId), revived)
  }
  await batch.commit()
}
