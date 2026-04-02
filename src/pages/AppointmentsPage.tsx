import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { format, isBefore, isToday, startOfDay } from 'date-fns'
import { Calendar, Clock, MapPin, Plus, Trash2, User, Video, Phone, X, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { createNotification } from '../hooks/useNotifications'

/* ─── Types ─── */
type AppointmentType = 'call' | 'meeting' | 'demo' | 'follow_up'
type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled'
type ViewMode = 'list' | 'calendar'
type FilterMode = 'All' | 'Upcoming' | 'Past'

type Appointment = {
  id: string
  user_id: string
  title: string
  contact_id: string | null
  contact_name: string | null
  appointment_date: string
  start_time: string
  duration_minutes: number
  type: AppointmentType
  status: AppointmentStatus
  location: string | null
  notes: string | null
  created_at: string
}

type Contact = { id: string; name: string }

type AppointmentFormState = {
  title: string
  contactId: string
  date: string
  startTime: string
  duration: string
  type: AppointmentType
  location: string
  notes: string
}

/* ─── Constants ─── */
const initialForm: AppointmentFormState = {
  title: '', contactId: '', date: '', startTime: '09:00',
  duration: '30', type: 'meeting', location: '', notes: '',
}

const typeConfig: Record<AppointmentType, { icon: typeof Phone; bg: string; text: string; label: string }> = {
  call: { icon: Phone, bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'Call' },
  meeting: { icon: User, bg: 'rgba(124,58,237,0.15)', text: '#A855F7', label: 'Meeting' },
  demo: { icon: Video, bg: 'rgba(6,182,212,0.15)', text: '#06B6D4', label: 'Demo' },
  follow_up: { icon: Clock, bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Follow-up' },
}

const statusConfig: Record<AppointmentStatus, { bg: string; text: string }> = {
  Scheduled: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
  Completed: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
  Cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
}

const durationOptions = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
]

function getDateLabel(dateStr: string): { color: string; label: string } {
  const date = startOfDay(new Date(dateStr))
  const today = startOfDay(new Date())
  const formatted = format(date, 'EEE, MMM d, yyyy')
  if (isToday(date)) return { color: 'var(--brand-secondary)', label: `Today · ${formatted}` }
  if (isBefore(date, today)) return { color: 'var(--danger)', label: `Past · ${formatted}` }
  return { color: 'var(--text-secondary)', label: formatted }
}

/* ─── Component ─── */
export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('Upcoming')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [form, setForm] = useState<AppointmentFormState>(initialForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date())

  useEffect(() => { document.title = 'Appointments — Atomise CRM' }, [])

  /* ─── Derived data ─── */
  const filteredAppointments = useMemo(() => {
    const today = startOfDay(new Date())
    let filtered = appointments
    if (filter === 'Upcoming') {
      filtered = appointments.filter((a) => !isBefore(startOfDay(new Date(a.appointment_date)), today) && a.status !== 'Cancelled')
    } else if (filter === 'Past') {
      filtered = appointments.filter((a) => isBefore(startOfDay(new Date(a.appointment_date)), today) || a.status === 'Cancelled')
    }
    return filtered.sort((a, b) => {
      const dateA = new Date(`${a.appointment_date}T${a.start_time}`)
      const dateB = new Date(`${b.appointment_date}T${b.start_time}`)
      return dateA.getTime() - dateB.getTime()
    })
  }, [appointments, filter])

  const todayCount = useMemo(() =>
    appointments.filter((a) => isToday(new Date(a.appointment_date)) && a.status === 'Scheduled').length,
  [appointments])

  const upcomingCount = useMemo(() => {
    const today = startOfDay(new Date())
    return appointments.filter((a) => !isBefore(startOfDay(new Date(a.appointment_date)), today) && a.status === 'Scheduled').length
  }, [appointments])

  // Calendar: days in month grid
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay() // 0 = Sunday
    const days: (Date | null)[] = []

    for (let i = 0; i < startDay; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

    return days
  }, [calendarDate])

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    appointments.forEach((a) => {
      const key = a.appointment_date
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [appointments])

  /* ─── Data fetching ─── */
  const fetchData = async () => {
    setLoading(true)
    const [apptRes, contactsRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, user_id, title, contact_id, contact_name, appointment_date, start_time, duration_minutes, type, status, location, notes, created_at')
        .order('appointment_date', { ascending: true })
        .limit(200),
      supabase.from('contacts').select('id, name').order('name'),
    ])
    if (apptRes.error) toast.error(apptRes.error.message)
    if (contactsRes.error) toast.error(contactsRes.error.message)
    setAppointments((apptRes.data ?? []) as Appointment[])
    setContacts((contactsRes.data ?? []) as Contact[])
    setLoading(false)
  }

  useEffect(() => { void fetchData() }, [])

  /* ─── Handlers ─── */
  const closeModal = () => { setModalOpen(false); setForm(initialForm); setEditingId(null) }
  useEscapeKey(closeModal, modalOpen)

  const openAddModal = () => {
    setEditingId(null)
    setForm({ ...initialForm, date: format(new Date(), 'yyyy-MM-dd') })
    setModalOpen(true)
  }

  const openEditModal = (appt: Appointment) => {
    setEditingId(appt.id)
    setForm({
      title: appt.title,
      contactId: appt.contact_id ?? '',
      date: appt.appointment_date,
      startTime: appt.start_time,
      duration: String(appt.duration_minutes),
      type: appt.type,
      location: appt.location ?? '',
      notes: appt.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) { toast.error('Unable to find logged in user.'); setSaving(false); return }
    const selectedContact = contacts.find((c) => c.id === form.contactId)

    const payload = {
      user_id: userData.user.id,
      title: form.title.trim(),
      contact_id: form.contactId || null,
      contact_name: selectedContact?.name ?? '',
      appointment_date: form.date,
      start_time: form.startTime,
      duration_minutes: Number(form.duration),
      type: form.type,
      status: 'Scheduled' as AppointmentStatus,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingId)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Appointment updated!')
    } else {
      const { error } = await supabase.from('appointments').insert(payload)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Appointment scheduled!')
      void createNotification('appointment', `New appointment "${form.title.trim()}" on ${format(new Date(form.date), 'MMM d')}`)
    }

    closeModal()
    void fetchData()
  }

  const handleToggleStatus = async (appt: Appointment) => {
    const nextStatus: AppointmentStatus = appt.status === 'Scheduled' ? 'Completed' : 'Scheduled'
    const { error } = await supabase.from('appointments').update({ status: nextStatus }).eq('id', appt.id)
    if (error) { toast.error(error.message); return }
    toast.success(nextStatus === 'Completed' ? 'Marked as completed!' : 'Reopened!')
    void fetchData()
  }

  const handleCancel = async (appt: Appointment) => {
    const { error } = await supabase.from('appointments').update({ status: 'Cancelled' }).eq('id', appt.id)
    if (error) { toast.error(error.message); return }
    toast.success('Appointment cancelled.')
    void fetchData()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await supabase.from('appointments').delete().eq('id', confirmDelete)
    setDeleting(false)
    setConfirmDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Appointment deleted.')
    void fetchData()
  }

  /* ─── Calendar navigation ─── */
  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
  const goToToday = () => setCalendarDate(new Date())

  /* ─── Render ─── */
  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment? This action cannot be undone."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Today badge */}
          <div
            className="flex h-14 w-14 flex-col items-center justify-center rounded-xl"
            style={{ border: '2px solid var(--brand-primary)', background: 'var(--brand-glow)' }}
          >
            <span className="text-[10px] font-medium" style={{ color: 'var(--brand-secondary)' }}>
              {format(new Date(), 'MMM').toUpperCase()}
            </span>
            <span className="text-lg font-bold leading-none" style={{ color: 'var(--brand-secondary)' }}>
              {format(new Date(), 'd')}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">
              <span style={{ color: 'var(--brand-secondary)' }}>{todayCount}</span>
              <span style={{ color: 'var(--text-secondary)' }}> today</span>
              <span className="mx-2" style={{ color: 'var(--bg-border)' }}>·</span>
              <span style={{ color: 'var(--text-primary)' }}>{upcomingCount}</span>
              <span style={{ color: 'var(--text-secondary)' }}> upcoming</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg" style={{ border: '1px solid var(--bg-border)' }}>
            {(['list', 'calendar'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition"
                style={{
                  background: viewMode === mode ? 'var(--brand-glow)' : 'transparent',
                  color: viewMode === mode ? 'var(--brand-secondary)' : 'var(--text-secondary)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <button type="button" onClick={openAddModal} className="btn-primary">
            <Plus size={16} /> New Appointment
          </button>
        </div>
      </div>

      {/* Filters (list view only) */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-2">
          {(['All', 'Upcoming', 'Past'] as FilterMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className="rounded-full px-4 py-1.5 text-sm transition"
              style={
                filter === item
                  ? { background: 'var(--brand-glow)', color: 'var(--brand-secondary)', border: '1px solid rgba(124,58,237,0.3)' }
                  : { background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid transparent' }
              }
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}

          {!loading && filteredAppointments.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No appointments"
              description="Schedule your first appointment to get started."
              action={{ label: '+ Schedule', onClick: openAddModal }}
            />
          )}

          {!loading && filteredAppointments.map((appt) => {
            const dateStyle = getDateLabel(appt.appointment_date)
            const tc = typeConfig[appt.type]
            const sc = statusConfig[appt.status]
            const TypeIcon = tc.icon
            return (
              <article
                key={appt.id}
                className="group rounded-xl p-4 transition hover:bg-white/[0.01]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Type icon */}
                    <div
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: tc.bg }}
                    >
                      <TypeIcon size={18} style={{ color: tc.text }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{appt.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {/* Type badge */}
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: tc.bg, color: tc.text }}
                        >
                          {tc.label}
                        </span>
                        {/* Status badge */}
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {appt.status}
                        </span>
                        {/* Contact */}
                        {appt.contact_name && (
                          <span className="text-xs" style={{ color: 'var(--brand-secondary)' }}>
                            {appt.contact_name}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          <span style={{ color: dateStyle.color }}>{dateStyle.label}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {appt.start_time} · {appt.duration_minutes}min
                        </span>
                        {appt.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {appt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {appt.status === 'Scheduled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(appt)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel(appt)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {appt.status === 'Completed' && (
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(appt)}
                        className="btn-secondary !px-2.5 !py-1.5 text-[11px]"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(appt)}
                      className="btn-secondary !px-2 !py-1.5"
                      aria-label="Edit"
                    >
                      <Calendar size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(appt.id)}
                      className="btn-secondary !px-2 !py-1.5"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ─── CALENDAR VIEW ─── */}
      {viewMode === 'calendar' && (
        <div className="card">
          {/* Calendar header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={prevMonth} className="btn-secondary !p-2" aria-label="Previous month">
                <ChevronLeft size={16} />
              </button>
              <h3 className="min-w-[160px] text-center text-base font-semibold">
                {format(calendarDate, 'MMMM yyyy')}
              </h3>
              <button type="button" onClick={nextMonth} className="btn-secondary !p-2" aria-label="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
            <button type="button" onClick={goToToday} className="btn-secondary text-xs">
              Today
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="min-h-[80px] rounded-lg p-1" style={{ background: 'var(--bg-base)' }} />

              const dateKey = format(day, 'yyyy-MM-dd')
              const dayAppointments = appointmentsByDate[dateKey] ?? []
              const isCurrentDay = isToday(day)
              const isPast = isBefore(day, startOfDay(new Date())) && !isCurrentDay

              return (
                <div
                  key={dateKey}
                  className="min-h-[80px] rounded-lg p-1.5 transition"
                  style={{
                    background: isCurrentDay ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                    border: isCurrentDay ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                    opacity: isPast ? 0.5 : 1,
                  }}
                >
                  <p
                    className="mb-1 text-xs font-medium"
                    style={{ color: isCurrentDay ? 'var(--brand-secondary)' : 'var(--text-secondary)' }}
                  >
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-0.5">
                    {dayAppointments.slice(0, 3).map((appt) => {
                      const tc = typeConfig[appt.type]
                      return (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={() => openEditModal(appt)}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[9px] font-medium transition hover:opacity-80"
                          style={{ background: tc.bg, color: tc.text }}
                          title={`${appt.start_time} — ${appt.title}`}
                        >
                          {appt.start_time.slice(0, 5)} {appt.title}
                        </button>
                      )
                    })}
                    {dayAppointments.length > 3 && (
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        +{dayAppointments.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── ADD / EDIT MODAL ─── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onKeyDown={(e) => { if (e.key === 'Escape') closeModal() }}
        >
          <div
            className="animate-slide-in-up w-full max-w-md rounded-xl p-5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button type="button" onClick={closeModal} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="apptTitle" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Title*
                </label>
                <input
                  id="apptTitle"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="form-input"
                  placeholder="e.g., Discovery call with Acme Corp"
                />
              </div>

              {/* Type */}
              <div>
                <label htmlFor="apptType" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Type
                </label>
                <div className="flex gap-2">
                  {(Object.entries(typeConfig) as [AppointmentType, typeof typeConfig.call][]).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, type: key }))}
                        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] font-medium transition"
                        style={{
                          background: form.type === key ? cfg.bg : 'var(--bg-hover)',
                          color: form.type === key ? cfg.text : 'var(--text-muted)',
                          border: form.type === key ? `1px solid ${cfg.text}33` : '1px solid transparent',
                        }}
                      >
                        <Icon size={16} />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apptDate" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Date*
                  </label>
                  <input
                    id="apptDate"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label htmlFor="apptTime" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Start Time*
                  </label>
                  <input
                    id="apptTime"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Duration & Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="apptDuration" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Duration
                  </label>
                  <select
                    id="apptDuration"
                    value={form.duration}
                    onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                    className="form-input"
                  >
                    {durationOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="apptContact" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Contact
                  </label>
                  <select
                    id="apptContact"
                    value={form.contactId}
                    onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">No contact</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="apptLocation" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Location / Link
                </label>
                <input
                  id="apptLocation"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="form-input"
                  placeholder="e.g., Zoom link or office address"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="apptNotes" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Notes
                </label>
                <textarea
                  id="apptNotes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="form-input"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
