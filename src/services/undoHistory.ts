const DB_NAME = 'vellum-undo'
const DB_VERSION = 1
const STORE_NAME = 'stacks'
const MAX_STACK_SIZE = 10000

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'boardId' })
    }
  })
}

export interface PersistedStacks {
  undoStack: unknown[]
  redoStack: unknown[]
}

export async function loadUndoStacks(boardId: string): Promise<PersistedStacks | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(boardId)
      req.onsuccess = () => {
        const row = req.result
        resolve(row ? { undoStack: row.undoStack ?? [], redoStack: row.redoStack ?? [] } : null)
      }
      req.onerror = () => reject(req.error)
      db.close()
    })
  } catch {
    return null
  }
}

export async function saveUndoStacks(
  boardId: string,
  undoStack: unknown[],
  redoStack: unknown[]
): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ boardId, undoStack, redoStack })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      db.close()
    })
  } catch {
    // Ignore persistence errors
  }
}

export { MAX_STACK_SIZE }
