import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'import' | 'teal'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

// Split-pill icon for each variant
const PlusIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const SpinIcon = () => (
  <span className="rounded-full border-2 border-white/30 border-t-white animate-spin w-3 h-3 inline-block" />
)

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) => {

    // All action buttons (primary + import) use the split-pill style
    if (variant === 'primary' || variant === 'import') {
      const isPrimary = variant === 'primary'
      // primary: ink bg icon, ink text label
      // import: slate bg icon, slate text label
      const iconBg   = isPrimary ? '#1A1A1A' : '#475569'
      const labelClr = isPrimary ? '#1A1A1A' : '#334155'
      const border   = isPrimary ? '#1A1A1A' : '#CBD5E1'

      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={`inline-flex items-stretch overflow-hidden rounded-full font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none text-xs hover:opacity-80 active:opacity-60 ${className}`}
          style={{ padding: 0, border: `1px solid ${border}` }}
          {...rest}
        >
          <span className="flex items-center px-2.5 py-1 shrink-0 text-white" style={{ background: iconBg }}>
            {loading ? <SpinIcon /> : isPrimary ? <PlusIcon /> : <DownloadIcon />}
          </span>
          <span className="flex items-center px-2.5 py-1" style={{ color: labelClr }}>
            {children}
          </span>
        </button>
      )
    }

    const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-1 select-none'

    const variants: Record<string, string> = {
      secondary: 'bg-surface2 hover:bg-surface3 text-textsec border border-border hover:border-border2 active:scale-[0.98]',
      ghost:     'hover:bg-surface2 text-textmut hover:text-textprim',
      danger:    'bg-red/8 hover:bg-red/12 text-red border border-red/20',
      outline:   'border border-border text-textmut hover:bg-surface2 hover:border-border2',
      teal:      'bg-[#0F766E] hover:bg-[#0D5F58] text-white active:scale-[0.98]',
    }

    const sizes: Record<string, string> = {
      sm: 'h-7 px-3 text-xs',
      md: 'h-8 px-4 text-sm',
      lg: 'h-10 px-5 text-sm',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant] ?? ''} ${sizes[size]} ${className}`}
        {...rest}
      >
        {loading && (
          <span className="rounded-full border-2 animate-spin w-3.5 h-3.5 border-ink/20 border-t-ink" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
