import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }, ref) => {

    const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-1 select-none'

    const variants: Record<string, string> = {
      primary:   'bg-teal hover:bg-teal2 text-white shadow-sm hover:shadow-md active:scale-[0.98]',
      secondary: 'bg-surface2 hover:bg-surface3 text-textsec border border-border hover:border-border2 active:scale-[0.98]',
      ghost:     'hover:bg-surface2 text-textmut hover:text-textsec',
      danger:    'bg-red/10 hover:bg-red/15 text-red border border-red/20',
      outline:   'border border-teal/40 text-teal hover:bg-teal/5 hover:border-teal/60',
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
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...rest}
      >
        {loading && (
          <span className={`rounded-full border-2 animate-spin w-3.5 h-3.5 ${
            variant === 'primary' ? 'border-white/30 border-t-white' : 'border-teal/30 border-t-teal'
          }`} />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
