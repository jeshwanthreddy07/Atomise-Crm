import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, Building, Calendar, Copy, Edit3, Loader2, Mail, MessageSquare,
  Phone, Plus, Send, Sparkles, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatCurrency, getInitials, getAvatarColor, TAG_CLASSES } from '../lib/utils'
import type { ContactTag } from '../lib/utils'
import ConfirmDialog from '../components/ConfirmDialog'
type Contact = {
  id: string; name: string; email: string | null; phone: string | null;
  company: string | null; tag: ContactTag; notes: string | null; created_at: string
}
type Activity = {
  id: string; type: string; message: string; created_at: string; metadata: Record<string, unknown> | null
}
type Deal = {
  id: string; contact_name: string; value: number | null; stage: string
}
type Task = {
  id: string; title: string; status: string; due_date: string | null
}

const tagClasses = TAG_CLASSES

const typeIcons: Record<string, typeof MessageSquare> = {
  note: MessageSquare, stage_change: ArrowLeft, task: Calendar, email: Mail,
}




export default function ContactDetailPage() {
  const { id } = useParams()
  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Add note
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // AI Email Drafting
  const [emailDraft, setEmailDraft] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Editing
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', company: '', tag: 'Lead' as ContactTag })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      if (!id) { setLoading(false); return }
      setLoading(true)

      const [contactRes, activitiesRes, tasksRes] = await Promise.all([
        supabase.from('contacts').select('id, user_id, name, email, phone, company, tag, notes, created_at').eq('id', id).single(),
        supabase.from('contact_activities').select('id, contact_id, user_id, type, message, metadata, created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('tasks').select('id, user_id, title, contact_id, contact_name, due_date, status, priority, description, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
      ])

      if (contactRes.error && contactRes.error.code !== 'PGRST116') toast.error(contactRes.error.message)

      const c = contactRes.data as Contact | null
      setContact(c)
      if (c) {
        setNotesValue(c.notes ?? '')
        setEditForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', company: c.company ?? '', tag: c.tag })
        // Try fetching deals by contact name
        const dealsRes2 = await supabase.from('deals').select('id, contact_name, value, stage, created_at').ilike('contact_name', `%${c.name}%`)
        setDeals((dealsRes2.data ?? []) as Deal[])
      }
      setActivities((activitiesRes.data ?? []) as Activity[])
      setTasks((tasksRes.data ?? []) as Task[])
      setLoading(false)
    }
    void fetchAll()
  }, [id])

  const saveNotes = async () => {
    if (!contact) return
    setSavingNotes(true)
    const { error } = await supabase.from('contacts').update({ notes: notesValue }).eq('id', contact.id)
    setSavingNotes(false)
    if (error) { toast.error(error.message); return }
    setContact((p) => p ? { ...p, notes: notesValue } : p)
    setEditingNotes(false)
    toast.success('Notes updated!')
  }

  const handleAddNote = async () => {
    if (!contact || !newNote.trim()) return
    setAddingNote(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('contact_activities').insert({
      contact_id: contact.id,
      user_id: userData.user?.id,
      type: 'note',
      message: newNote.trim(),
    })
    setAddingNote(false)
    setNewNote('')
    toast.success('Note added!')
    // Refresh activities
    const { data } = await supabase.from('contact_activities').select('id, contact_id, user_id, type, message, metadata, created_at').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(20)
    setActivities((data ?? []) as Activity[])
  }

  const handleSaveEdit = async () => {
    if (!contact) return
    setSavingEdit(true)
    const { error } = await supabase.from('contacts').update({
      name: editForm.name.trim(), email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null, company: editForm.company.trim() || null, tag: editForm.tag,
    }).eq('id', contact.id)
    setSavingEdit(false)
    if (error) { toast.error(error.message); return }
    setContact((p) => p ? { ...p, ...editForm, email: editForm.email || null, phone: editForm.phone || null, company: editForm.company || null } : p)
    setEditMode(false)
    toast.success('Contact updated!')
  }

  const handleDelete = async () => {
    if (!contact) return
    const { error } = await supabase.from('contacts').delete().eq('id', contact.id)
    if (error) { toast.error(error.message); return }
    toast.success('Contact deleted.')
    window.location.href = '/contacts'
  }

  const handleGenerateAI = async () => {
    if (!contact) return
    setAiLoading(true)
    setAiSummary(null)

    const apiKey = import.meta.env.VITE_ANTHROPIC_KEY
    if (!apiKey) {
      // Fallback to tag-based insight
      const insights: Record<ContactTag, string> = {
        Lead: '• High-potential lead detected\n• Recommend scheduling a discovery call within 24 hours\n• Send a personalised intro email with your key value proposition\n• Next Action: Schedule initial discovery call',
        Client: '• Active client profile\n• Schedule a quarterly business review\n• Identify upsell opportunities in current pipeline\n• Next Action: Set up quarterly review meeting',
        Partner: '• Strategic partner contact\n• Follow up on pending collaboration items\n• Confirm the next joint initiative timeline\n• Next Action: Review partnership agreement',
      }
      setTimeout(() => { setAiSummary(insights[contact.tag]); setAiLoading(false) }, 1200)
      return
    }

    try {
      const prompt = `You are a CRM AI assistant. Summarise this contact for a sales rep in 3-4 bullet points covering: relationship status, key opportunities, recommended next action, and any risks.\n\nContact: ${JSON.stringify(contact)}\nActivities: ${JSON.stringify(activities.slice(0, 10))}\nDeals: ${JSON.stringify(deals)}\n\nRespond in this format:\n- [bullet 1]\n- [bullet 2]\n- [bullet 3]\n- Next Action: [specific recommendation]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await response.json()
      setAiSummary(data.content?.[0]?.text ?? 'Unable to generate summary.')
    } catch {
      toast.error('Failed to generate AI summary')
    }
    setAiLoading(false)
  }

  const handleDraftEmail = async () => {
    if (!contact) return
    setEmailLoading(true)
    setEmailDraft(null)

    const apiKey = import.meta.env.VITE_ANTHROPIC_KEY
    if (!apiKey) {
      // Fallback template
      const templates: Record<ContactTag, string> = {
        Lead: `Subject: Following up — Atomise AI\n\nHi ${contact.name.split(' ')[0]},\n\nI hope this message finds you well. I wanted to follow up on our recent conversation and share how Atomise AI can help streamline your workflow.\n\nWould you be available for a quick 15-minute call this week to discuss your requirements?\n\nLooking forward to hearing from you.\n\nBest regards`,
        Client: `Subject: Checking in — Quarterly Review\n\nHi ${contact.name.split(' ')[0]},\n\nI wanted to check in and see how things are going with your current setup. We've recently launched some new features that I think would be valuable for your team.\n\nWould you be open to scheduling a quarterly review call to discuss your progress and any upcoming needs?\n\nBest regards`,
        Partner: `Subject: Partnership Update\n\nHi ${contact.name.split(' ')[0]},\n\nI hope you're doing well. I wanted to touch base regarding our partnership and discuss any upcoming collaboration opportunities.\n\nLet me know a convenient time for a quick sync this week.\n\nBest regards`,
      }
      setTimeout(() => { setEmailDraft(templates[contact.tag]); setEmailLoading(false) }, 1000)
      return
    }

    try {
      const prompt = `You are an email assistant for a CRM called Atomise AI. Draft a professional, personalized follow-up email for this contact. Be warm but concise. Include a subject line.\n\nContact: ${contact.name} (${contact.tag})\nCompany: ${contact.company ?? 'Unknown'}\nEmail: ${contact.email ?? 'N/A'}\nNotes: ${contact.notes ?? 'None'}\nRecent Activities: ${JSON.stringify(activities.slice(0, 5))}\nDeals: ${JSON.stringify(deals)}\n\nFormat:\nSubject: [subject]\n\n[email body]`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await response.json()
      setEmailDraft(data.content?.[0]?.text ?? 'Unable to draft email.')
    } catch {
      toast.error('Failed to draft email')
    }
    setEmailLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-20" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-16 w-16 rounded-full" />
          <div className="space-y-2"><div className="skeleton h-6 w-48" /><div className="skeleton h-4 w-32" /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="card text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Contact not found.</p>
        <Link to="/contacts" className="btn-primary mt-4 inline-flex">Back to Contacts</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog open={showDeleteConfirm} title="Delete Contact" message="This will permanently delete the contact and all associated data." onConfirm={() => void handleDelete()} onCancel={() => setShowDeleteConfirm(false)} />

      <Link to="/contacts" className="inline-flex items-center gap-1 text-sm transition hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={14} /> Contacts
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold text-white" style={{ background: getAvatarColor(contact.name) }}>
            {getInitials(contact.name)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{contact.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tagClasses[contact.tag]}`}>{contact.tag}</span>
            </div>
            {contact.company && <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.company}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditMode(true)} className="btn-secondary text-sm"><Edit3 size={14} /> Edit</button>
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-sm"><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      {/* Edit modal */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onKeyDown={(e) => { if (e.key === 'Escape') setEditMode(false) }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Contact</h2>
              <button type="button" onClick={() => setEditMode(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'phone', l: 'Phone' }, { k: 'company', l: 'Company' }].map((f) => (
                <div key={f.k}>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{f.l}</label>
                  <input className="form-input" value={editForm[f.k as keyof typeof editForm]} onChange={(e) => setEditForm((p) => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>Tag</label>
                <select className="form-input" value={editForm.tag} onChange={(e) => setEditForm((p) => ({ ...p, tag: e.target.value as ContactTag }))}>
                  <option value="Lead">Lead</option><option value="Client">Client</option><option value="Partner">Partner</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => void handleSaveEdit()} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Mail, label: 'Email', value: contact.email },
          { icon: Phone, label: 'Phone', value: contact.phone },
          { icon: Building, label: 'Company', value: contact.company },
          { icon: Calendar, label: 'Added', value: format(new Date(contact.created_at), 'MMM d, yyyy') },
        ].map((item) => (
          <div key={item.label} className="card flex items-start gap-3 !p-4">
            <item.icon size={16} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="mt-1 text-sm">{item.value ?? '-'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Notes */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Notes</h2>
              {!editingNotes && (
                <button type="button" onClick={() => setEditingNotes(true)} className="btn-secondary text-xs !px-3 !py-1">Edit</button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <textarea rows={5} value={notesValue} onChange={(e) => setNotesValue(e.target.value)} className="form-input" />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => { setNotesValue(contact.notes ?? ''); setEditingNotes(false) }}>Cancel</button>
                  <button type="button" className="btn-primary text-sm" onClick={() => void saveNotes()} disabled={savingNotes}>{savingNotes ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                {contact.notes?.trim() || 'No notes added yet.'}
              </div>
            )}
          </section>

          {/* Activity Timeline */}
          <section className="card">
            <h2 className="mb-4 text-base font-semibold">Activity Timeline</h2>

            {/* Add Note */}
            <div className="mb-4 flex gap-2">
              <input
                className="form-input flex-1"
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newNote.trim()) void handleAddNote() }}
              />
              <button type="button" className="btn-primary text-sm" onClick={() => void handleAddNote()} disabled={addingNote}>
                <Plus size={14} />{addingNote ? '...' : 'Add'}
              </button>
            </div>

            {activities.length === 0 ? (
              <p className="py-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => {
                  const IconComp = typeIcons[a.type] ?? MessageSquare
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--brand-glow)' }}>
                        <IconComp size={12} style={{ color: 'var(--brand-secondary)' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{a.message}</p>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* AI Summary */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Sparkles size={16} style={{ color: 'var(--brand-secondary)' }} />
                AI Lead Summary
              </h3>
              <button type="button" className="btn-primary text-xs !px-3 !py-1.5" onClick={() => void handleGenerateAI()} disabled={aiLoading}>
                {aiLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {aiLoading && (
              <div className="flex items-center gap-2 py-6" style={{ color: 'var(--brand-secondary)' }}>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Analysing...</span>
              </div>
            )}
            {aiSummary && !aiLoading && (
              <div className="animate-fade-in rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line" style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--brand-primary)', color: 'var(--text-secondary)' }}>
                {aiSummary}
              </div>
            )}
            {!aiSummary && !aiLoading && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Click "Generate" for an AI-powered lead summary.</p>
            )}
          </section>

          {/* AI Email Drafting */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Send size={16} style={{ color: 'var(--brand-accent)' }} />
                AI Email Draft
              </h3>
              <button type="button" className="btn-primary text-xs !px-3 !py-1.5" onClick={() => void handleDraftEmail()} disabled={emailLoading}>
                {emailLoading ? 'Drafting...' : 'Draft Email'}
              </button>
            </div>
            {emailLoading && (
              <div className="flex items-center gap-2 py-6" style={{ color: 'var(--brand-accent)' }}>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Composing...</span>
              </div>
            )}
            {emailDraft && !emailLoading && (
              <div className="animate-fade-in">
                <div className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-line" style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--brand-accent)', color: 'var(--text-secondary)' }}>
                  {emailDraft}
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-2 text-xs"
                  onClick={() => { void navigator.clipboard.writeText(emailDraft); toast.success('Copied to clipboard!') }}
                >
                  <Copy size={12} /> Copy to Clipboard
                </button>
              </div>
            )}
            {!emailDraft && !emailLoading && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Generate a personalized follow-up email for this contact.</p>
            )}
          </section>

          {/* Linked Deals */}
          <section className="card">
            <h3 className="mb-3 text-base font-semibold">Linked Deals</h3>
            {deals.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No deals linked.</p>
            ) : (
              <div className="space-y-2">
                {deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                    <div>
                      <p className="text-sm font-medium">{d.contact_name}</p>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.stage}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>{formatCurrency(Number(d.value ?? 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Contact Tasks */}
          <section className="card">
            <h3 className="mb-3 text-base font-semibold">Tasks</h3>
            {tasks.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks for this contact.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                    <p className={`text-sm ${t.status === 'Complete' ? 'line-through' : ''}`} style={{ color: t.status === 'Complete' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {t.title}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.status === 'Complete' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}