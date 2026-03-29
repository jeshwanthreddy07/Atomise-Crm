import { useEffect, useState, type ReactNode } from 'react'
import {
  BarChart3,
  CheckSquare,
  Kanban,
  LayoutDashboard,
  Menu,
  Settings,
  X,
  Users,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
// Logo removed per user request
import NotificationBell from './NotificationBell'
import CommandPalette from './CommandPalette'
import { getUserInitials } from '../lib/utils'

type LayoutProps = {
  user: User
  children: ReactNode
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const pageTitleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contacts': 'Contacts',
  '/pipeline': 'Pipeline',
  '/reports': 'Reports',
  '/tasks': 'Tasks',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/contacts/')) return 'Contact Detail'
  return pageTitleMap[pathname] ?? 'Dashboard'
}



export default function Layout({ user, children }: LayoutProps) {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pageTitle = getPageTitle(location.pathname)
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const initials = getUserInitials(user)

  useEffect(() => {
    document.title = `${pageTitle} — Atomise CRM`
    setMobileNavOpen(false)
  }, [pageTitle])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen flex-col md:flex"
        style={{
          width: 240,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-border)',
          padding: '20px 12px',
        }}
      >
        {/* Branding */}
        <div
          className="flex items-center gap-2.5 px-2 pb-6"
          style={{ borderBottom: '1px solid var(--bg-border)', marginBottom: 16 }}
        >
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
            Atomise{' '}
            <span
              style={{
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
              }}
            >
              CRM
            </span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} data-label={item.label}>
                {({ isActive }) => (
                  <span
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150"
                    style={
                      isActive
                        ? {
                            background: 'var(--brand-glow)',
                            color: 'var(--brand-secondary)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            boxShadow: 'var(--shadow-brand)',
                          }
                        : {
                            color: 'var(--text-secondary)',
                            border: '1px solid transparent',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-hover)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {isActive && (
                      <span
                        className="ml-auto h-1.5 w-1.5 rounded-full"
                        style={{
                          background: 'var(--brand-secondary)',
                          boxShadow: '0 0 8px var(--brand-secondary)',
                        }}
                      />
                    )}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User pill */}
        <div
          className="flex items-center gap-3 pt-4"
          style={{ borderTop: '1px solid var(--bg-border)' }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: 'var(--brand-primary)' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {user.email?.split('@')[0]}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin</p>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          />
          <aside
            className="relative z-50 flex h-full w-[240px] flex-col p-5"
            style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--bg-border)' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Atomise{' '}
                  <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CRM</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-2 transition hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink key={item.to} to={item.to}>
                    {({ isActive }) => (
                      <span
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium"
                        style={
                          isActive
                            ? { background: 'var(--brand-glow)', color: 'var(--brand-secondary)' }
                            : { color: 'var(--text-secondary)' }
                        }
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around md:hidden"
        style={{
          height: 64,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--bg-border)',
        }}
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <span
                  className="flex flex-col items-center gap-0.5 px-3 py-2"
                  style={{ color: isActive ? 'var(--brand-secondary)' : 'var(--text-muted)', fontSize: 10 }}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col md:ml-[240px]" style={{ background: 'var(--bg-base)' }}>
        <header
          className="flex items-center justify-between px-4 py-4 md:px-8 md:py-5"
          style={{ borderBottom: '1px solid var(--bg-border)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md p-2 md:hidden"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-xl font-semibold md:text-2xl" style={{ fontFamily: "'Inter', sans-serif" }}>
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <p className="hidden text-sm md:block" style={{ color: 'var(--text-secondary)' }}>{today}</p>
          </div>
        </header>

        <main className="flex-1 animate-fade-in-page p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}
