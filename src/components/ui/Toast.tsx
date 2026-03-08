import { useEffect } from 'react'
import { useToastStore } from '../../store/toastStore'
import type { ToastType } from '../../types'

const icons: Record<ToastType, string> = {
  info:    '💬',
  success: '✓',
  error:   '✕',
}
const colors: Record<ToastType, string> = {
  info:    'border-accent/30 bg-accent/10 text-accent',
  success: 'border-green/30 bg-green/10 text-green',
  error:   'border-danger/30 bg-danger/10 text-danger',
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
            border backdrop-blur-sm shadow-card text-sm font-medium
            animate-fade-up max-w-sm
            ${colors[t.type]}
          `}
        >
          <span className="shrink-0 font-bold">{icons[t.type]}</span>
          <span className="text-textprim">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
