import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p
        className="text-7xl font-black tracking-tighter"
        style={{
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        404
      </p>
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Page not found
      </h1>
      <p className="max-w-xs text-sm" style={{ color: 'var(--text-secondary)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn-primary mt-2">
        Back to Dashboard
      </Link>
    </div>
  )
}
