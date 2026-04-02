import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ProtectedLayout from './components/ProtectedLayout'
import LoginPage from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage'))
const PipelinePage = lazy(() => import('./pages/PipelinePage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--brand-primary)' }} />
    </div>
  )
}

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--bg-border)',
            fontSize: 14,
          },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/:id" element={<ContactDetailPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
