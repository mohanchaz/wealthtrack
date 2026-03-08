import { type InputHTMLAttributes, forwardRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?:    string
  error?:    string
  helpText?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, helpText, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-textsec uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full h-9 px-3 rounded-lg bg-surface2 border text-sm text-textprim
          placeholder:text-textmut outline-none transition-colors duration-150
          focus:border-accent focus:ring-1 focus:ring-accent/30
          ${error ? 'border-danger' : 'border-border2'}
          ${className}
        `}
        {...rest}
      />
      {(error || helpText) && (
        <p className={`text-xs ${error ? 'text-danger' : 'text-textmut'}`}>
          {error ?? helpText}
        </p>
      )}
    </div>
  )
)
Input.displayName = 'Input'
