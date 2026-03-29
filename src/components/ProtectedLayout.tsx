import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import Layout from './Layout'
import { supabase } from '../lib/supabase'

export default function ProtectedLayout() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    void checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: 'var(--brand-primary)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <Layout user={user}>
      <Outlet />
    </Layout>
  )
}
