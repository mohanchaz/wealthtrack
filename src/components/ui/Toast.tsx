import { useToastStore } from '../../store/toastStore'
import type { ToastType } from '../../types'

const META: Record<ToastType, { icon: string; bg: string; color: string }> = {
  info:    { icon: 'ℹ', bg: 'bg-surface2',    color: 'text-textprim'  },
  success: { icon: '✓', bg: 'bg-green/8',      color: 'text-green'    },
  error:   { icon: '✕', bg: 'bg-red/8',        color: 'text-red'      },
}

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { icon, bg, color } = META[t.type]
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
              border border-border shadow-cardHov text-sm font-medium bg-surface
              animate-fade-up max-w-sm
            `}
          >
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${bg} ${color}`}>
              {icon}
            </span>
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
