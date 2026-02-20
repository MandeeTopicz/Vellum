import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  type Auth,
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore'
import {
  getDatabase,
  connectDatabaseEmulator,
  type Database,
} from 'firebase/database'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
}

let app: FirebaseApp
let auth: Auth
let db: Firestore
let rtdb: Database

function initFirebase(): {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  rtdb: Database
} {
  if (typeof app !== 'undefined') {
    return { app, auth, db, rtdb }
  }

  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  rtdb = getDatabase(app)

  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000)
    const functions = getFunctions(app)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  }

  return { app, auth, db, rtdb }
}

  const { app: firebaseApp, auth: authInstance, db: firestore, rtdb: realtimeDb } = initFirebase()

  if (import.meta.env?.DEV) {
    const url = firebaseConfig.databaseURL
    console.log('[FIREBASE] RTDB initialized, databaseURL:', url ?? '(MISSING - RTDB will not work!)')
  }

export { firebaseApp, authInstance as auth, firestore as db, realtimeDb as rtdb }

export async function signIn(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(authInstance, email, password)
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(authInstance, email, password)
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() })
  }
  return cred
}

export async function signOut(): Promise<void> {
  return firebaseSignOut(authInstance)
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(authInstance, callback)
}

export function currentUser(): User | null {
  return authInstance.currentUser
}

const googleProvider = new GoogleAuthProvider()

/**
 * Sign in with Google (popup). Returns the signed-in user.
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(authInstance, googleProvider)
    return result.user
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : ''
    const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Failed to sign in with Google'
    if (code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.')
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled.')
    }
    throw new Error(message)
  }
}

/**
 * Start Google sign-in with redirect. Call handleGoogleRedirectResult() on app load to complete.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(authInstance, googleProvider)
}

/**
 * Call on page load to complete redirect sign-in. Returns the user if returning from Google redirect, else null.
 */
export async function handleGoogleRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(authInstance)
    if (result) return result.user
    return null
  } catch (error: unknown) {
    const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Failed to complete Google sign-in'
    throw new Error(message)
  }
}
