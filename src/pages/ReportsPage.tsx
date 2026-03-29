import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, DEAL_STAGES } from '../lib/utils'
import type { DealStage } from '../lib/utils'
import EmptyState from '../components/EmptyState'
import { BarChart3 } from 'lucide-react'
type Deal = { id: string; value: number | null; stage: DealStage; contact_name: string; created_at: string }
type Task = { id: string; status: string }

const stages = DEAL_STAGES
const stageColors: Record<DealStage, string> = {
  Lead: '#3B82F6', Qualified: '#FACC15', Proposal: '#7C3AED',
  Negotiation: '#F97316', 'Closed Won': '#10B981', 'Closed Lost': '#EF4444',
}

const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 12,
}



export default function ReportsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Reports — Atomise CRM'
    const fetchData = async () => {
      const [dealsRes, tasksRes] = await Promise.all([
        supabase.from('deals').select('id, value, stage, contact_name, created_at'),
        supabase.from('tasks').select('id, status'),
      ])
      if (dealsRes.error) toast.error(dealsRes.error.message)
      if (tasksRes.error) toast.error(tasksRes.error.message)
      setDeals((dealsRes.data ?? []) as Deal[])
      setTasks((tasksRes.data ?? []) as Task[])
      setLoading(false)
    }
    void fetchData()
  }, [])

  // Deal funnel
  const funnelData = useMemo(
    () => stages.map((s) => ({
      stage: s,
      count: deals.filter((d) => d.stage === s).length,
      value: deals.filter((d) => d.stage === s).reduce((sum, d) => sum + Number(d.value ?? 0), 0),
      color: stageColors[s],
    })),
    [deals],
  )

  // Revenue over time (by month)
  const revenueData = useMemo(() => {
    const wonDeals = deals.filter((d) => d.stage === 'Closed Won')
    const byMonth: Record<string, number> = {}
    wonDeals.forEach((d) => {
      const month = new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      byMonth[month] = (byMonth[month] ?? 0) + Number(d.value ?? 0)
    })
    return Object.entries(byMonth).map(([month, value]) => ({ month, value }))
  }, [deals])

  // Top contacts
  const topContacts = useMemo(() => {
    const byContact: Record<string, number> = {}
    deals.forEach((d) => {
      if (d.contact_name) {
        byContact[d.contact_name] = (byContact[d.contact_name] ?? 0) + Number(d.value ?? 0)
      }
    })
    return Object.entries(byContact)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [deals])

  // Task completion donut
  const taskData = useMemo(() => {
    const complete = tasks.filter((t) => t.status === 'Complete').length
    const pending = tasks.length - complete
    return [
      { name: 'Complete', value: complete, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#52525B' },
    ]
  }, [tasks])

  // Win/Loss
  const wonCount = deals.filter((d) => d.stage === 'Closed Won').length
  const lostCount = deals.filter((d) => d.stage === 'Closed Lost').length
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-64 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (deals.length === 0 && tasks.length === 0) {
    return <EmptyState icon={BarChart3} title="No data yet" description="Add some deals and tasks to see reports and analytics." />
  }

  return (
    <div className="space-y-6">
      {/* Win/Loss Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Win Rate</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--success)' }}>{winRate}%</p>
        </div>
        <div className="card text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Deals Won</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--success)' }}>{wonCount}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Deals Lost</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--danger)' }}>{lostCount}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Deal Funnel */}
        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Deal Funnel</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Task Completion */}
        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Task Completion</h3>
          <div className="flex h-64 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskData}
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={4} dataKey="value"
                >
                  {taskData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-6 text-xs">
            {taskData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </section>

        {/* Revenue Over Time */}
        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Revenue Over Time</h3>
          <div className="h-64">
            {revenueData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No closed deals yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4, fill: '#7C3AED' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Top Contacts by Deal Value */}
        <section className="card">
          <h3 className="mb-4 text-base font-semibold">Top Contacts by Value</h3>
          {topContacts.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No deals yet
            </div>
          ) : (
            <div className="space-y-3">
              {topContacts.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: i === 0 ? 'var(--brand-glow)' : 'var(--bg-hover)', color: i === 0 ? 'var(--brand-secondary)' : 'var(--text-secondary)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
