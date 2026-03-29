import { AlertTriangle, X } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}>
      <div
        className="animate-slide-in-up w-full max-w-sm rounded-2xl border p-6"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)' }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'rgba(239,68,68,0.15)' }}
            >
              <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
            </div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 transition hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
