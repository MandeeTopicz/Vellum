import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { subscribeToAuth, handleGoogleRedirectResult } from '../services/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  /** Set when returning from Google redirect but getRedirectResult failed (e.g. redirect_uri_mismatch) */
  redirectError: string | null
  clearRedirectError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirectError, setRedirectError] = useState<string | null>(null)

  const clearRedirectError = useCallback(() => setRedirectError(null), [])

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    const init = async () => {
      try {
        await handleGoogleRedirectResult()
      } catch (err) {
        setRedirectError(err instanceof Error ? err.message : 'Sign-in failed. Check OAuth redirect URI and authorized domains.')
      }
      unsubscribe = subscribeToAuth((u) => {
        setUser(u)
        if (u) setRedirectError(null)
        setLoading(false)
      })
    }
    init()
    return () => {
      unsubscribe?.()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, redirectError, clearRedirectError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
