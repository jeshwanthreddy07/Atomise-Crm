import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { getInitials, getAvatarColor, TAG_CLASSES } from '../lib/utils'
import type { ContactTag } from '../lib/utils'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { createNotification } from '../hooks/useNotifications'
import CsvImportModal from '../components/CsvImportModal'
import { useEscapeKey } from '../hooks/useEscapeKey'

type Contact = {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  tag: ContactTag
  notes: string | null
  created_at: string
}

type ContactFormState = {
  name: string
  email: string
  phone: string
  company: string
  tag: ContactTag
  notes: string
}

const tagClasses = TAG_CLASSES


const initialForm: ContactFormState = { name: '', email: '', phone: '', company: '', tag: 'Lead', notes: '' }



export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactFormState>(initialForm)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)

  useEffect(() => { document.title = 'Contacts — Atomise CRM' }, [])

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return contacts
    return contacts.filter((c) =>
      [c.name, c.email ?? '', c.company ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [contacts, search])

  const fetchContacts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contacts')
      .select('id, user_id, name, email, phone, company, tag, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) { toast.error(error.message); setLoading(false); return }
    setContacts((data ?? []) as Contact[])
    setLoading(false)
  }

  useEffect(() => { void fetchContacts() }, [])

  const handleFormChange = (field: keyof ContactFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const closeDrawer = () => { setDrawerOpen(false); setEditingContact(null); setForm(initialForm) }
  useEscapeKey(closeDrawer, drawerOpen)

  const openAddDrawer = () => { setEditingContact(null); setForm(initialForm); setDrawerOpen(true) }
  const openEditDrawer = (contact: Contact) => {
    setEditingContact(contact)
    setForm({ name: contact.name, email: contact.email ?? '', phone: contact.phone ?? '', company: contact.company ?? '', tag: contact.tag, notes: contact.notes ?? '' })
    setDrawerOpen(true)
  }

  const handleSaveContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) { toast.error('Unable to find logged in user.'); setSaving(false); return }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      tag: form.tag,
      notes: form.notes.trim(),
      user_id: userData.user.id,
    }

    if (editingContact) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', editingContact.id)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Contact updated!')
      closeDrawer()
      void fetchContacts()
      return
    }

    const { data, error } = await supabase.from('contacts').insert(payload).select().single()
    setSaving(false)
    if (error) { toast.error(error.message); return }

    toast.success('Contact added!')
    void createNotification('contact', `New contact "${form.name.trim()}" was added`)

    const newContact = data as Contact
    const webhookUrl = import.meta.env.VITE_N8N_NEW_LEAD_WEBHOOK
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newContact.name,
            email: newContact.email || '',
            contact_id: newContact.id,
          }),
        })
      } catch (err) {
        console.error('Failed to trigger n8n new lead webhook:', err)
      }
    }

    closeDrawer()
    void fetchContacts()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    const { error } = await supabase.from('contacts').delete().eq('id', confirmDelete)
    setDeleting(false)
    setConfirmDelete(null)
    if (error) { toast.error(error.message); return }
    toast.success('Contact deleted.')
    void fetchContacts()
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />


      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-sm flex-1">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or company..."
              className="form-input pl-9"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCsvOpen(true)} className="btn-secondary">
            <FileSpreadsheet size={16} /> Import CSV
          </button>
          <button type="button" onClick={openAddDrawer} className="btn-primary">
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-surface)' }}>
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full border-collapse text-left">
            <thead style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <tr className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Date Added</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-40" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-44" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-28" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-24" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-20" /></td>
                </tr>
              ))}

              {!loading && filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Users}
                      title="No contacts yet"
                      description="Add your first contact to get started."
                      action={{ label: '+ Add Contact', onClick: openAddDrawer }}
                    />
                  </td>
                </tr>
              )}

              {!loading && filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="group transition hover:bg-white/[0.02]"
                  style={{ borderBottom: '1px solid var(--bg-border)' }}
                >
                  <td className="px-4 py-3">
                    <Link to={`/contacts/${contact.id}`} className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ background: getAvatarColor(contact.name) }}
                      >
                        {getInitials(contact.name)}
                      </div>
                      <span className="font-medium">{contact.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.email ?? '-'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.company ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tagClasses[contact.tag]}`}>{contact.tag}</span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(contact.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEditDrawer(contact)} className="btn-secondary !px-2 !py-1.5" aria-label="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(contact.id)} className="btn-secondary !px-2 !py-1.5" aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2"><div className="skeleton h-4 w-32" /><div className="skeleton h-3 w-24" /></div>
            </div>
          ))}
          {!loading && filteredContacts.length === 0 && (
            <EmptyState icon={Users} title="No contacts yet" description="Add your first contact." action={{ label: '+ Add', onClick: openAddDrawer }} />
          )}
          {!loading && filteredContacts.map((contact) => (
            <Link
              key={contact.id}
              to={`/contacts/${contact.id}`}
              className="flex items-center gap-3 p-4 transition hover:bg-white/[0.02]"
              style={{ borderBottom: '1px solid var(--bg-border)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: getAvatarColor(contact.name) }}>
                {getInitials(contact.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{contact.name}</p>
                <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{contact.email ?? contact.company ?? '-'}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tagClasses[contact.tag]}`}>{contact.tag}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div
            className="animate-slide-in-right ml-auto h-full w-full max-w-[400px] p-5"
            style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--bg-border)' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button type="button" onClick={closeDrawer} className="rounded-md p-2 transition hover:bg-white/5" style={{ color: 'var(--text-muted)' }} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="flex h-[calc(100%-4rem)] flex-col">
              <div className="space-y-4 overflow-y-auto pr-1">
                {[
                  { id: 'name', label: 'Full Name*', required: true },
                  { id: 'email', label: 'Email', type: 'email' },
                  { id: 'phone', label: 'Phone' },
                  { id: 'company', label: 'Company' },
                ].map((f) => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                    <input
                      id={f.id}
                      type={f.type ?? 'text'}
                      required={f.required}
                      value={form[f.id as keyof ContactFormState]}
                      onChange={handleFormChange(f.id as keyof ContactFormState)}
                      className="form-input"
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="tag" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Tag</label>
                  <select id="tag" value={form.tag} onChange={handleFormChange('tag')} className="form-input">
                    <option value="Lead">Lead</option>
                    <option value="Client">Client</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes" className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                  <textarea id="notes" rows={5} value={form.notes} onChange={handleFormChange('notes')} className="form-input" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
                <button type="button" onClick={closeDrawer} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CSV Import Modal */}
      <CsvImportModal open={csvOpen} onClose={() => setCsvOpen(false)} onImportComplete={() => void fetchContacts()} />
    </div>
  )
}
