import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'import'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) => {

    // Import variant uses a custom split-pill render
    if (variant === 'import') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={`inline-flex items-stretch overflow-hidden rounded-full border border-[#CBD5E1] font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none text-xs ${className}`}
          style={{ padding: 0 }}
          {...rest}
        >
          <span className="flex items-center bg-[#475569] text-white px-2.5 py-1 shrink-0">
            {loading ? (
              <span className="rounded-full border-2 border-white/30 border-t-white animate-spin w-3 h-3" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
          </span>
          <span className="flex items-center text-[#334155] px-2.5 py-1">{children}</span>
        </button>
      )
    }

    const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:ring-offset-1 select-none'

    const variants: Record<string, string> = {
      // Design 6: underline text style for primary (Add buttons)
      primary:   'bg-transparent text-ink border-b-2 border-ink rounded-none hover:opacity-70 active:opacity-50 px-0',
      secondary: 'bg-surface2 hover:bg-surface3 text-textsec border border-border hover:border-border2 rounded-xl active:scale-[0.98]',
      ghost:     'hover:bg-surface2 text-textmut hover:text-textprim rounded-xl',
      danger:    'bg-red/8 hover:bg-red/12 text-red border border-red/20 rounded-xl',
      outline:   'border border-border text-textmut hover:bg-surface2 hover:border-border2 rounded-xl',
    }

    const sizes: Record<string, Record<string, string>> = {
      primary:  { sm: 'h-7 text-xs', md: 'h-8 text-sm', lg: 'h-10 text-sm' },
      other:    { sm: 'h-7 px-3 text-xs', md: 'h-8 px-4 text-sm', lg: 'h-10 px-5 text-sm' },
    }

    const sizeClass = variant === 'primary' ? sizes.primary[size] : sizes.other[size]

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizeClass} ${className}`}
        {...rest}
      >
        {loading && variant !== 'primary' && (
          <span className="rounded-full border-2 animate-spin w-3.5 h-3.5 border-ink/20 border-t-ink" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
