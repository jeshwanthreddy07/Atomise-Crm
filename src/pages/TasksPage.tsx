import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { format, isBefore, isToday, startOfDay } from 'date-fns'
import { CheckSquare, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useEscapeKey } from '../hooks/useEscapeKey'

type TaskStatus = 'Pending' | 'Complete'
type TaskFilter = 'All' | TaskStatus
type TaskPriority = 'high' | 'medium' | 'low'

type Task = {
  id: string; user_id: string; title: string; contact_id: string | null;
  contact_name: string | null; due_date: string | null; status: TaskStatus;
  priority?: TaskPriority; description?: string | null
}
type Contact = { id: string; name: string }
type TaskFormState = { title: string; contactId: string; dueDate: string; priority: TaskPriority; description: string }

const initialForm: TaskFormState = { title: '', contactId: '', dueDate: '', priority: 'medium', description: '' }

const priorityColors: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  high: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'High' },
  medium: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Medium' },
  low: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'Low' },
}

function getDueDateStyle(value: string | null): { color: string; label: string } {
  if (!value) return { color: 'var(--text-muted)', label: 'No due date' }
  const due = startOfDay(new Date(value))
  const today = startOfDay(new Date())
  const formatted = format(due, 'MMM d, yyyy')
  if (isToday(due)) return { color: 'var(--warning)', label: `Today · ${formatted}` }
  if (isBefore(due, today)) return { color: 'var(--danger)', label: `Overdue · ${formatted}` }
  return { color: 'var(--text-secondary)', label: formatted }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<TaskFilter>('All')
  const [form, setForm] = useState<TaskFormState>(initialForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { document.title = 'Tasks — Atomise CRM' }, [])

  const filteredTasks = useMemo(() => {
    if (filter === 'All') return tasks
    return tasks.filter((t) => t.status === filter)
  }, [tasks, filter])

  const completeCount = tasks.filter((t) => t.status === 'Complete').length
  const completionRate = tasks.length > 0 ? Math.round((completeCount / tasks.length) * 100) : 0

  const fetchData = async () => {
    setLoading(true)
    const [tasksRes, contactsRes] = await Promise.all([
      supabase.from('tasks').select('id, user_id, title, contact_id, contact_name, due_date, status, priority, description, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('contacts').select('id, name').order('name'),
    ])
    if (tasksRes.error) toast.error(tasksRes.error.message)
    if (contactsRes.error) toast.error(contactsRes.error.message)
    setTasks((tasksRes.data ?? []) as Task[])
    setContacts((contactsRes.data ?? []) as Contact[])
    setLoading(false)
  }

  useEffect(() => { void fetchData() }, [])

  const closeModal = () => { setModalOpen(false); setForm(initialForm) }
  useEscapeKey(closeModal, modalOpen)

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
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
      due_date: form.dueDate || null,
      status: 'Pending' as TaskStatus,
      priority: form.priority,
      description: form.description.trim() || null,
    }

    const { error } = await supabase.from('tasks').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Task added!')
    closeModal()
    void fetchData()
  }

  const handleToggleStatus = async (task: Task) => {
    const next: TaskStatus = task.status === 'Pending' ? 'Complete' : 'Pending'
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id)
    if (error) { toast.error(error.message); return }
    toast.success(next === 'Complete' ? 'Task completed!' : 'Task reopened.')
    void fetchData()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await supabase.from('tasks').delete().eq('id', confirmDelete)
    setDeleting(false)
    setConfirmDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Task deleted.')
    void fetchData()
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog open={confirmDelete !== null} title="Delete Task" message="Are you sure you want to delete this task?" onConfirm={() => void handleDelete()} onCancel={() => setConfirmDelete(null)} loading={deleting} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Completion badge */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 flex-col items-center justify-center rounded-full"
            style={{ border: '2px solid var(--brand-primary)', background: 'var(--brand-glow)' }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--brand-secondary)' }}>{completionRate}%</span>
          </div>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{completeCount}/{tasks.length} complete</span>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['All', 'Pending', 'Complete'] as TaskFilter[]).map((item) => (
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

      {/* Task list */}
      <div className="space-y-2">
        {loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}

        {!loading && filteredTasks.length === 0 && (
          <EmptyState icon={CheckSquare} title="No tasks yet" description="Stay organized by adding your first task." action={{ label: '+ Add Task', onClick: () => setModalOpen(true) }} />
        )}

        {!loading && filteredTasks.map((task) => {
          const dateStyle = getDueDateStyle(task.due_date)
          const priority = priorityColors[task.priority ?? 'medium']
          return (
            <article
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleToggleStatus(task)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition"
                  style={{
                    borderColor: task.status === 'Complete' ? 'var(--success)' : 'var(--text-muted)',
                    background: task.status === 'Complete' ? 'var(--success)' : 'transparent',
                  }}
                  aria-label={task.status === 'Pending' ? 'Complete task' : 'Reopen task'}
                >
                  {task.status === 'Complete' && <CheckSquare size={12} className="text-white" />}
                </button>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${task.status === 'Complete' ? 'line-through' : ''}`}
                    style={{ color: task.status === 'Complete' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {task.contact_name && (
                      <span className="text-xs" style={{ color: 'var(--brand-secondary)' }}>{task.contact_name}</span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: priority.bg, color: priority.text }}>
                      {priority.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: dateStyle.color }}>{dateStyle.label}</span>
                <button type="button" onClick={() => setConfirmDelete(task.id)} className="btn-secondary !p-1.5" aria-label="Delete task">
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* Add Task Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onKeyDown={(e) => { if (e.key === 'Escape') setModalOpen(false) }}>
          <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Task</h2>
              <button type="button" onClick={closeModal} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="taskTitle" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Title*</label>
                <input id="taskTitle" required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label htmlFor="taskDesc" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea id="taskDesc" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="form-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="taskPriority" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Priority</label>
                  <select id="taskPriority" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))} className="form-input">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="taskDueDate" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Due date</label>
                  <input id="taskDueDate" type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="form-input" />
                </div>
              </div>
              <div>
                <label htmlFor="taskContact" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Link to contact</label>
                <select id="taskContact" value={form.contactId} onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))} className="form-input">
                  <option value="">No contact</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
