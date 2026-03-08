import { type InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?:    string
  error?:    string
  helpText?: string
  prefix?:   string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helpText, prefix, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-textsec uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm text-textmut font-medium pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={`
            w-full h-9 rounded-xl bg-white border text-sm text-textprim
            placeholder:text-textfade outline-none transition-all duration-150
            focus:border-ink focus:ring-2 focus:ring-ink/10
            ${error ? 'border-red/50 focus:border-red focus:ring-red/10' : 'border-border hover:border-border2'}
            ${prefix ? 'pl-7' : 'pl-3'}
            pr-3 ${className}
          `}
          {...rest}
        />
      </div>
      {(error || helpText) && (
        <p className={`text-xs ${error ? 'text-red' : 'text-textmut'}`}>
          {error ?? helpText}
        </p>
      )}
    </div>
  )
)
Input.displayName = 'Input'
