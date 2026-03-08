import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AppShell } from './components/layout/AppShell'
import { ToastContainer } from './components/ui/Toast'
import { PageSpinner } from './components/ui/Spinner'
import LoginPage     from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import AllocationPage from './features/allocation/AllocationPage'
import AssetsPage    from './features/assets/AssetsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <PageSpinner />
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"          element={<DashboardPage />} />
          <Route path="/allocation"         element={<AllocationPage />} />
          <Route path="/assets/:assetClass" element={<AssetsPage />} />
          <Route path="/assets"             element={<Navigate to="/assets/zerodha-stocks" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </BrowserRouter>
  )
}
