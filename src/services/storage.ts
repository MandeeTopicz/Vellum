/**
 * Firebase Storage for file uploads.
 * Used by link/upload feature and direct image/document upload to the board.
 */
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { firebaseApp } from './firebase'

/**
 * Uploads a file to the board's uploads folder and returns the public URL.
 * @param boardId - Board ID
 * @param file - File to upload
 * @returns Public URL of the uploaded file
 */
export async function uploadBoardFile(boardId: string, file: File): Promise<string> {
  const storage = getStorage(firebaseApp)
  const path = `boards/${boardId}/uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/**
 * Uploads an image to the board's images folder and returns the public URL.
 * @param boardId - Board ID
 * @param file - Image file to upload
 * @returns Public URL of the uploaded image
 */
export async function uploadBoardImage(boardId: string, file: File): Promise<string> {
  const storage = getStorage(firebaseApp)
  const ext = file.name.replace(/^.*\./, '') || 'png'
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'png'
  const path = `boards/${boardId}/images/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}
