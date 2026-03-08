import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <Topbar onMenuClick={() => setSidebarOpen(o => !o)} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — desktop always visible, mobile slide-in */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
          transition-transform duration-200 lg:transition-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="h-full overflow-hidden" style={{ paddingTop: sidebarOpen ? '56px' : '0' }}>
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-5 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
