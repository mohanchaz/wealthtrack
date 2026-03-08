interface Props { size?: 'sm' | 'md' | 'lg'; className?: string }

export function Spinner({ size = 'md', className = '' }: Props) {
  const s = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }[size]
  return (
    <div className={`${s} rounded-full border-2 border-border2 border-t-accent animate-spin ${className}`} />
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
