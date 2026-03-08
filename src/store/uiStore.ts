import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error'

interface Toast {
  id: number
  msg: string
  type: ToastType
}

interface UiState {
  toasts: Toast[]
  showToast: (msg: string, type?: ToastType) => void
  removeToast: (id: number) => void
}

let _id = 0

export const useUiStore = create<UiState>((set) => ({
  toasts: [],

  showToast: (msg, type = 'info') => {
    const id = ++_id
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 3500)
  },

  removeToast: (id) =>
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

// Convenience hook
export const useToast = () => useUiStore(s => s.showToast)
