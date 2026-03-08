import { useEffect, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  open:     boolean
  onClose:  () => void
  title:    string
  children: ReactNode
  footer?:  ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: Props) {
  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div className={`relative w-full ${maxWidth} bg-surface border border-border rounded-2xl shadow-card flex flex-col max-h-[90vh] animate-fade-up`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="text-base font-semibold text-textprim">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-textsec hover:bg-surface2 hover:text-textprim transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
