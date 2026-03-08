import { useToastStore } from '../../store/toastStore'
import type { ToastType } from '../../types'

const META: Record<ToastType, { icon: string; cls: string }> = {
  info:    { icon: 'ℹ', cls: 'bg-cyan/5 border-cyan/25 text-cyan2'  },
  success: { icon: '✓', cls: 'bg-green/5 border-green/25 text-green2' },
  error:   { icon: '✕', cls: 'bg-red/5 border-red/25 text-red2'      },
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { icon, cls } = META[t.type]
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
              border shadow-cardHov text-sm font-medium bg-white
              animate-fade-up max-w-sm ${cls}
            `}
          >
            <span className="font-bold text-sm">{icon}</span>
            <span className="text-textprim flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="opacity-40 hover:opacity-70 transition-opacity text-xs ml-1"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
