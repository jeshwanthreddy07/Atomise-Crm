import type { User } from '@supabase/supabase-js'

/** Shared utility helpers used across pages */

// ──────────────────── Currency ────────────────────
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

// ──────────────────── Avatars ────────────────────
const AVATAR_PALETTE = ['#2563EB', '#0891B2', '#16A34A', '#7C3AED', '#DB2777', '#EA580C'] as const

export function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'NA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function getUserInitials(user: User | null): string {
  if (!user) return '?'
  const name = user.user_metadata?.full_name as string | undefined
  if (name) return getInitials(name)
  const email = user.email
  if (email && email.includes('@')) return email.split('@')[0].slice(0, 2).toUpperCase()
  return '??'
}

export function getAvatarColor(name: string): string {
  const code = name.trim().toUpperCase().charCodeAt(0)
  if (Number.isNaN(code)) return AVATAR_PALETTE[0]
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

// ──────────────────── Types ────────────────────
export type ContactTag = 'Lead' | 'Client' | 'Partner'
export type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'

export const TAG_CLASSES: Record<ContactTag, string> = {
  Lead: 'bg-blue-500/20 text-blue-300',
  Client: 'bg-emerald-500/20 text-emerald-300',
  Partner: 'bg-purple-500/20 text-purple-300',
}

export const DEAL_STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
