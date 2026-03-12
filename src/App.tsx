import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AppShell }     from './components/layout/AppShell'
import { ToastContainer } from './components/ui/Toast'
import { PageSpinner }  from './components/ui/Spinner'
import LoginPage        from './features/auth/LoginPage'
import DashboardPage    from './features/dashboard/DashboardPage'
import AllocationPage   from './features/allocation/AllocationPage'
import AssetsPage       from './features/assets/AssetsPage'
import AnalyticsPage    from './features/analytics/AnalyticsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 bg-ink text-chalk px-4 py-2 rounded-full text-sm font-bold shadow-card">
            <span className="opacity-60">₹</span>
            <span>WealthTrack</span>
          </div>
          <PageSpinner />
        </div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }
        >
          <Route index                      element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"          element={<DashboardPage />} />
          <Route path="/allocation"         element={<AllocationPage />} />
          <Route path="/assets/:assetClass" element={<AssetsPage />} />
          <Route path="/assets"             element={<Navigate to="/assets/overview" replace />} />
          <Route path="/analytics"           element={<AnalyticsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </BrowserRouter>
  )
}
