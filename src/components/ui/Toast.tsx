import { useEffect } from 'react'
import { useToastStore } from '../../store/toastStore'

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: any; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [])

  const icon = toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'
  const iconBg = toast.type === 'success' ? 'bg-green text-chalk' : toast.type === 'error' ? 'bg-red text-chalk' : 'bg-ink text-chalk'

  return (
    <div className="pointer-events-auto flex items-center gap-3 bg-surface border border-border rounded-xl shadow-cardHov px-4 py-3 animate-slide-in min-w-[260px] max-w-sm">
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${iconBg}`}>
        {icon}
      </span>
      <div className="flex-1">
        {toast.title && <p className="text-sm font-semibold text-textprim">{toast.title}</p>}
        {toast.message && <p className="text-xs text-textmut">{toast.message}</p>}
      </div>
      <button onClick={onDismiss} className="text-textfade hover:text-textmut text-xs ml-1">✕</button>
    </div>
  )
}
