import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'

    const variants = {
      primary:   'bg-accent hover:bg-accent2 text-white shadow-sm',
      secondary: 'bg-surface2 hover:bg-surface3 text-textprim border border-border2',
      ghost:     'hover:bg-surface2 text-textsec hover:text-textprim',
      danger:    'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20',
    }

    const sizes = {
      sm: 'h-7 px-3 text-xs',
      md: 'h-8 px-4 text-sm',
      lg: 'h-10 px-5 text-sm',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        {loading && (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
