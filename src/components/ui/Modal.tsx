import { useEffect, type ReactNode } from 'react'

interface Props {
  open:      boolean
  onClose:   () => void
  title:     string
  children:  ReactNode
  footer?:   ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

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
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />

      <div className={`relative w-full ${maxWidth} bg-surface border border-border rounded-2xl shadow-cardHov flex flex-col max-h-[90vh] animate-fade-up`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-textprim">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-textmut hover:bg-surface2 hover:text-textprim transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center gap-2 px-6 py-4 border-t border-border bg-surface2 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
