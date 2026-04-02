import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    document.title = 'Login — Atomise CRM'
    // Bug fix #5: redirect if already authenticated
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) navigate('/dashboard', { replace: true })
    }
    void checkSession()
  }, [navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div
      className="relative flex min-h-screen animate-fade-in-page items-center justify-center px-4"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 rounded-lg p-2.5 transition hover:bg-white/5"
        style={{ color: 'var(--text-secondary)', border: '1px solid var(--bg-border)' }}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div
        className="login-card-glow w-full max-w-md p-8"
        style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-center text-[28px] font-bold tracking-tight"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Atomise{' '}
            <span
              style={{
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              CRM
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Your intelligent sales CRM
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="mb-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-sm" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Powered by Atomise AI
        </p>
      </div>
    </div>
  )
}
