import { useState, useRef, useEffect } from 'react'
import { Bell, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications } from '../hooks/useNotifications'

const typeColors: Record<string, string> = {
  contact: '#7C3AED',
  deal: '#06B6D4',
  task: '#10B981',
  stage_change: '#F59E0B',
  default: '#3B82F6',
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg p-2 transition hover:bg-white/5"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="animate-slide-in-up absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border shadow-xl"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bg-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs transition hover:opacity-80"
                style={{ color: 'var(--brand-secondary)' }}
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:bg-white/[0.03]"
                  style={{
                    borderColor: 'var(--bg-border)',
                    background: n.read ? 'transparent' : 'rgba(124,58,237,0.05)',
                  }}
                >
                  <div
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: n.read
                        ? 'var(--text-muted)'
                        : typeColors[n.type] ?? typeColors.default,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {n.message}
                    </p>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
