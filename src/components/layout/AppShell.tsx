import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <Topbar onMenuClick={() => setSidebarOpen(o => !o)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-textprim/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
          transition-transform duration-200 lg:transition-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
          style={{ paddingTop: sidebarOpen ? '56px' : '0', height: sidebarOpen ? '100dvh' : 'auto' }}
        >
          <div className="h-full">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-bg">
          <div className="px-2 py-2 sm:px-4 sm:py-3">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
