import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'
import { signIn, signUp, signInWithGoogleRedirect, handleGoogleRedirectResult } from '../services/firebase'
import GoogleSignInButton from '../components/GoogleSignInButton'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!user) return
    const redirectTo = sessionStorage.getItem('vellum:redirectAfterGoogle') || from
    sessionStorage.removeItem('vellum:redirectAfterGoogle')
    navigate(redirectTo, { replace: true })
  }, [user, navigate, from])

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    try {
      sessionStorage.setItem('vellum:redirectAfterGoogle', from)
      await signInWithGoogleRedirect()
    } catch (err) {
      setLoading(false)
      sessionStorage.removeItem('vellum:redirectAfterGoogle')
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password, username)
      } else {
        await signIn(email, password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      if (message.includes('password')) {
        setError('Incorrect password')
      } else if (message.includes('email') || message.includes('user')) {
        setError('Invalid email or user not found')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page gradient-background">
      <div className="login-card auth-card">
        <h1>
          <Link to="/" className="login-vellum-link">
            <img src="/letter-v.png" alt="" className="vellum-logo-icon vellum-logo-icon-login" aria-hidden />
            Vellum
          </Link>
        </h1>
        <p className="login-subtitle">Real-time collaborative whiteboard</p>
        <GoogleSignInButton
          onClick={handleGoogleSignIn}
          loading={loading}
          text="Continue with Google"
        />
        <div className="login-divider">
          <span className="login-divider-text">Or continue with email</span>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <div className="login-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="login-password-input"
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button
          type="button"
          className="login-toggle"
          onClick={() => {
            setIsSignUp((v) => !v)
            setError(null)
            setUsername('')
          }}
        >
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  )
}
