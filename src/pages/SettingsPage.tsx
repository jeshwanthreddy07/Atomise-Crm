import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { LogOut, Shield, Users } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useRole } from '../hooks/useRole'
import { getUserInitials } from '../lib/utils'

type TeamMember = {
  user_id: string
  role: 'admin' | 'sales'
  email?: string
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useRole()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  useEffect(() => { document.title = 'Settings — Atomise CRM' }, [])

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) { toast.error(error.message); setLoading(false); return }
      setUser(data.user)
      setLoading(false)
    }
    void loadUser()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const loadTeam = async () => {
      setTeamLoading(true)
      const { data } = await supabase.from('user_roles').select('id, user_id, role, email')
      setTeamMembers((data ?? []) as TeamMember[])
      setTeamLoading(false)
    }
    void loadTeam()
  }, [isAdmin])

  const initials = useMemo(() => getUserInitials(user), [user])
  const memberSince = user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) { toast.error(error.message); return }
    navigate('/login', { replace: true })
  }

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'sales' : 'admin'
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId)
    if (error) { toast.error(error.message); return }
    toast.success(`Role updated to ${newRole}`)
    setTeamMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: newRole as 'admin' | 'sales' } : m)))
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* User Profile */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">User Profile</h2>
        {loading ? (
          <div className="flex items-center gap-4">
            <div className="skeleton h-14 w-14 rounded-full" />
            <div className="space-y-2"><div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-28" /></div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ background: 'var(--brand-primary)' }}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.email ?? 'No email'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Member since {memberSince}</p>
            </div>
          </div>
        )}
      </section>

      {/* App Info */}
      <section className="card">
        <h2 className="text-lg font-semibold">App Info</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Atomise CRM v1.0</p>
      </section>

      {/* Team Management (Admin only) */}
      {isAdmin && (
        <section className="card">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={18} style={{ color: 'var(--brand-secondary)' }} />
            <h2 className="text-lg font-semibold">Team Management</h2>
          </div>

          {teamLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No team members found. Run the user_roles SQL migration first.</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ background: member.role === 'admin' ? 'var(--brand-primary)' : 'var(--text-muted)' }}
                    >
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-sm">{member.email ?? member.user_id.slice(0, 8) + '...'}</p>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: member.role === 'admin' ? 'rgba(124,58,237,0.15)' : 'rgba(59,130,246,0.15)',
                          color: member.role === 'admin' ? 'var(--brand-secondary)' : 'var(--info)',
                        }}
                      >
                        {member.role}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleRole(member.user_id, member.role)}
                    className="btn-secondary text-xs !px-3 !py-1"
                  >
                    Switch to {member.role === 'admin' ? 'Sales' : 'Admin'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sign Out */}
      <button type="button" onClick={() => void handleSignOut()} className="btn-danger">
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
