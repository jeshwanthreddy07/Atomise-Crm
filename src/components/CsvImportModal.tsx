import { useCallback, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

type ParsedContact = {
  name: string
  email: string
  phone: string
  company: string
  tag: string
}

type CsvImportModalProps = {
  open: boolean
  onClose: () => void
  onImportComplete: () => void
}

function parseCsv(text: string): ParsedContact[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full name' || h === 'fullname')
  const emailIdx = headers.findIndex((h) => h === 'email' || h === 'e-mail')
  const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'telephone' || h === 'mobile')
  const companyIdx = headers.findIndex((h) => h === 'company' || h === 'organization' || h === 'organisation')
  const tagIdx = headers.findIndex((h) => h === 'tag' || h === 'type' || h === 'category')

  if (nameIdx === -1) return []

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/['"]/g, ''))
    return {
      name: cols[nameIdx] ?? '',
      email: emailIdx >= 0 ? (cols[emailIdx] ?? '') : '',
      phone: phoneIdx >= 0 ? (cols[phoneIdx] ?? '') : '',
      company: companyIdx >= 0 ? (cols[companyIdx] ?? '') : '',
      tag: tagIdx >= 0 ? (cols[tagIdx] ?? 'Lead') : 'Lead',
    }
  }).filter((c) => c.name.trim().length > 0)
}

export default function CsvImportModal({ open, onClose, onImportComplete }: CsvImportModalProps) {
  const [parsed, setParsed] = useState<ParsedContact[]>([])
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCsv(text)
      if (rows.length === 0) {
        toast.error('No valid rows found. Ensure header row contains "Name" column.')
        return
      }
      setParsed(rows)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    setImporting(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { toast.error('Not authenticated'); setImporting(false); return }

    const validTags = ['Lead', 'Client', 'Partner']
    const payload = parsed.map((c) => ({
      user_id: userData.user!.id,
      name: c.name.trim(),
      email: c.email.trim() || null,
      phone: c.phone.trim() || null,
      company: c.company.trim() || null,
      tag: validTags.includes(c.tag) ? c.tag : 'Lead',
    }))

    const { error } = await supabase.from('contacts').insert(payload)
    setImporting(false)

    if (error) { toast.error(error.message); return }

    toast.success(`Imported ${parsed.length} contacts!`)
    setParsed([])
    onImportComplete()
    onClose()
  }

  const handleClose = () => { setParsed([]); onClose() }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}
    >
      <div
        className="animate-slide-in-up w-full max-w-2xl rounded-xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet size={18} style={{ color: 'var(--brand-secondary)' }} />
            Import Contacts from CSV
          </h2>
          <button type="button" onClick={handleClose} style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {parsed.length === 0 ? (
          <>
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition"
              style={{
                borderColor: dragOver ? 'var(--brand-secondary)' : 'var(--bg-border)',
                background: dragOver ? 'var(--brand-glow)' : 'transparent',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload size={32} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Drag & drop a CSV file here, or click to browse
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                CSV must include a "Name" column. Email, Phone, Company, Tag columns are optional.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </>
        ) : (
          <>
            <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Found <strong>{parsed.length}</strong> contacts to import:
            </p>
            <div className="max-h-64 overflow-auto rounded-lg" style={{ border: '1px solid var(--bg-border)' }}>
              <table className="w-full border-collapse text-left text-sm">
                <thead style={{ background: 'var(--bg-hover)' }}>
                  <tr className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.phone || '-'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.company || '-'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.tag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  ...and {parsed.length - 50} more
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" className="btn-secondary" onClick={() => setParsed([])}>
                Choose Different File
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleImport()} disabled={importing}>
                {importing ? `Importing ${parsed.length}...` : `Import ${parsed.length} Contacts`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
