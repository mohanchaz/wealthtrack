import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AppShell }     from './components/layout/AppShell'
import { ToastContainer } from './components/ui/Toast'
import { PageSpinner }  from './components/ui/Spinner'
import LoginPage        from './features/auth/LoginPage'
import DashboardPage    from './features/dashboard/DashboardPage'
import AllocationPage   from './features/allocation/AllocationPage'
import AssetsPage       from './features/assets/AssetsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user    = useAuthStore(s => s.user)
  const loading = useAuthStore(s => s.loading)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal to-cyan flex items-center justify-center text-white font-bold text-lg shadow-card">
            ₹
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
          <Route index                   element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/allocation"      element={<AllocationPage />} />
          <Route path="/assets/:assetClass" element={<AssetsPage />} />
          <Route path="/assets"          element={<Navigate to="/assets/zerodha-stocks" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer />
    </BrowserRouter>
  )
}
