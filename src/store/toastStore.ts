import { create } from 'zustand'
import type { Toast, ToastType } from '../types'

interface ToastState {
  toasts: Toast[]
  show:   (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },

  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
