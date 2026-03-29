import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn-primary mt-2" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
