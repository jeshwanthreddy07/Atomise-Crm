import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command, CornerDownLeft, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

type SearchResult = {
  id: string
  label: string
  sub: string
  type: 'page' | 'contact' | 'deal'
  href: string
}

const pageResults: SearchResult[] = [
  { id: 'page-dashboard', label: 'Dashboard', sub: 'Go to Dashboard', type: 'page', href: '/dashboard' },
  { id: 'page-contacts', label: 'Contacts', sub: 'Manage contacts', type: 'page', href: '/contacts' },
  { id: 'page-pipeline', label: 'Pipeline', sub: 'View deals', type: 'page', href: '/pipeline' },
  { id: 'page-tasks', label: 'Tasks', sub: 'Manage tasks', type: 'page', href: '/tasks' },
  { id: 'page-appointments', label: 'Appointments', sub: 'Schedule meetings & calls', type: 'page', href: '/appointments' },
  { id: 'page-reports', label: 'Reports', sub: 'Analytics & reports', type: 'page', href: '/reports' },
  { id: 'page-settings', label: 'Settings', sub: 'User settings', type: 'page', href: '/settings' },
]

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [deals, setDeals] = useState<{ id: string; contact_name: string; value: number | null }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      // Fetch contacts and deals for search
      const fetchData = async () => {
        const [c, d] = await Promise.all([
          supabase.from('contacts').select('id, name, email').order('created_at', { ascending: false }).limit(50),
          supabase.from('deals').select('id, contact_name, value').limit(50),
        ])
        setContacts((c.data ?? []) as { id: string; name: string; email: string | null }[])
        setDeals((d.data ?? []) as { id: string; contact_name: string; value: number | null }[])
      }
      void fetchData()
    }
  }, [open])

  const results = useMemo((): SearchResult[] => {
    const q = query.toLowerCase().trim()
    const items: SearchResult[] = []

    // Pages
    const matchedPages = q
      ? pageResults.filter((p) => p.label.toLowerCase().includes(q))
      : pageResults

    items.push(...matchedPages)

    // Contacts 
    const matchedContacts = contacts
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))
      .slice(0, 5)
      .map((c): SearchResult => ({
        id: `contact-${c.id}`,
        label: c.name,
        sub: c.email ?? 'Contact',
        type: 'contact',
        href: `/contacts/${c.id}`,
      }))

    items.push(...matchedContacts)

    // Deals
    const matchedDeals = deals
      .filter((d) => !q || d.contact_name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((d): SearchResult => ({
        id: `deal-${d.id}`,
        label: d.contact_name,
        sub: `Deal · $${Number(d.value ?? 0).toLocaleString()}`,
        type: 'deal',
        href: '/pipeline',
      }))

    items.push(...matchedDeals)

    return items
  }, [query, contacts, deals])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      navigate(result.href)
    },
    [navigate],
  )

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIndex]) { handleSelect(results[selectedIndex]) }
  }

  useEffect(() => { setSelectedIndex(0) }, [query])

  if (!open) return null

  const typeBadge: Record<string, { bg: string; text: string; label: string }> = {
    page: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'Page' },
    contact: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', label: 'Contact' },
    deal: { bg: 'rgba(124,58,237,0.15)', text: '#A855F7', label: 'Deal' },
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 pt-[15vh] px-4"
      onClick={() => setOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <div
        className="animate-slide-in-up w-full max-w-lg overflow-hidden rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', boxShadow: 'var(--shadow-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--bg-border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, contacts, deals…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <kbd
            className="hidden items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium md:flex"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No results found
            </div>
          )}
          {results.map((r, i) => {
            const badge = typeBadge[r.type]
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition"
                style={{
                  background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{r.sub}</p>
                </div>
                <span
                  className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: badge.bg, color: badge.text }}
                >
                  {badge.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center justify-between border-t px-4 py-2"
          style={{ borderColor: 'var(--bg-border)' }}
        >
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <CornerDownLeft size={10} /> to select
          </span>
          <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <Command size={10} />K to toggle
          </span>
        </div>
      </div>
    </div>
  )
}
