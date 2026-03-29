import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Activity, MessageSquare, Plus, Target, TrendingUp, Trophy, Users } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, getInitials, TAG_CLASSES, DEAL_STAGES } from '../lib/utils'
import type { ContactTag, DealStage } from '../lib/utils'
import EmptyState from '../components/EmptyState'

type Contact = { id: string; name: string; tag: ContactTag; created_at: string }
type Deal = { id: string; value: number | null; stage: DealStage }
type ActivityItem = { id: string; type: string; message: string; created_at: string }

const stages = DEAL_STAGES
const tagClasses = TAG_CLASSES



function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const kpiCards = [
  {
    key: 'contacts',
    title: 'Total Contacts',
    icon: Users,
    gradient: 'linear-gradient(90deg, #7C3AED, #A855F7)',
  },
  {
    key: 'pipeline',
    title: 'Pipeline Value',
    icon: TrendingUp,
    gradient: 'linear-gradient(90deg, #06B6D4, #3B82F6)',
  },
  {
    key: 'won',
    title: 'Deals Won',
    icon: Trophy,
    gradient: 'linear-gradient(90deg, #10B981, #059669)',
  },
  {
    key: 'revenue',
    title: 'Revenue',
    icon: Activity,
    gradient: 'linear-gradient(90deg, #FACC15, #EAB308)',
  },
  {
    key: 'conversion',
    title: 'Conversion Rate',
    icon: Target,
    gradient: 'linear-gradient(90deg, #F59E0B, #EF4444)',
  },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from('contacts').select('id, name, tag, created_at').order('created_at', { ascending: false }),
        supabase.from('deals').select('id, value, stage'),
      ])
      if (contactsRes.error) toast.error(contactsRes.error.message)
      if (dealsRes.error) toast.error(dealsRes.error.message)
      setContacts((contactsRes.data ?? []) as Contact[])
      setDeals((dealsRes.data ?? []) as Deal[])
      // Fetch recent activities (may not exist yet)
      try {
        const { data: actData } = await supabase
          .from('contact_activities')
          .select('id, type, message, created_at')
          .order('created_at', { ascending: false })
          .limit(10)
        setRecentActivities((actData ?? []) as ActivityItem[])
      } catch { /* table may not exist */ }
      setLoading(false)
    }
    void fetchData()
  }, [])

  const totalContacts = contacts.length
  const pipelineValue = deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0)
  const wonDeals = deals.filter((d) => d.stage === 'Closed Won')
  const dealsWon = wonDeals.length
  const revenue = wonDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0)
  const conversionRate = deals.length > 0 ? Math.round((dealsWon / deals.length) * 100) : 0

  const kpiValues: Record<string, string> = {
    contacts: loading ? '—' : `${totalContacts}`,
    pipeline: loading ? '—' : formatCurrency(pipelineValue),
    won: loading ? '—' : `${dealsWon}`,
    revenue: loading ? '—' : formatCurrency(revenue),
    conversion: loading ? '—' : `${conversionRate}%`,
  }

  const chartData = useMemo(
    () => stages.map((stage) => ({ stage, count: deals.filter((d) => d.stage === stage).length })),
    [deals],
  )
  const recentContacts = contacts.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="page-header relative">
        <p className="relative z-10 text-lg font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
          {getTimeGreeting()} 👋
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary text-sm" onClick={() => navigate('/contacts')}>
          <Plus size={16} /> Add Contact
        </button>
        <button className="btn-secondary text-sm" onClick={() => navigate('/pipeline')}>
          <Plus size={16} /> New Deal
        </button>
        <button className="btn-secondary text-sm" onClick={() => navigate('/tasks')}>
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <article
              key={card.key}
              className="card group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: 'var(--shadow-sm)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
            >
              {/* Gradient top border */}
              <div
                className="absolute left-0 right-0 top-0 h-[3px]"
                style={{ background: card.gradient, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}
              />
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{card.title}</p>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: card.gradient, opacity: 0.15 }}
                >
                  <Icon size={18} style={{ color: 'var(--text-primary)', opacity: 1 }} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {kpiValues[card.key]}
              </p>
            </article>
          )
        })}
      </section>

      {/* Recent Contacts */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Contacts</h2>
          <Link to="/contacts" className="text-sm transition hover:opacity-80" style={{ color: 'var(--brand-secondary)' }}>
            View All
          </Link>
        </div>
        <div className="space-y-2">
          {!loading && recentContacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Add people from the Contacts page to see recent activity here."
              action={{ label: '+ Add Contact', onClick: () => navigate('/contacts') }}
            />
          ) : loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))
          ) : (
            recentContacts.map((contact) => (
              <Link
                key={contact.id}
                to={`/contacts/${contact.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: 'var(--brand-primary)' }}
                  >
                    {getInitials(contact.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{contact.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagClasses[contact.tag]}`}>
                      {contact.tag}
                    </span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Overview Chart */}
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Pipeline Overview</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="stage" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis allowDecimals={false} stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Activity Feed */}
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Activity size={18} style={{ color: 'var(--brand-secondary)' }} />
              Live Activity Feed
            </h2>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No recent activity. Actions like adding notes and moving deals will appear here.
              </p>
            ) : (
              recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--brand-glow)' }}
                  >
                    <MessageSquare size={12} style={{ color: 'var(--brand-secondary)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{a.message}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                      >
                        {a.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
