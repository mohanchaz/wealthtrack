import type { ReactNode } from 'react'

interface Props {
  stats:          ReactNode
  mainTable:      ReactNode
  actualInvested?: ReactNode
}

export function AssetPageLayout({ stats, mainTable, actualInvested }: Props) {
  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* Sticky stat cards */}
      <div className="sm:sticky sm:top-0 z-20 py-2 sm:py-2.5 bg-bg/95 backdrop-blur-md border-b border-border/60">
        {stats}
      </div>

      {/* Body: stacks on mobile, side-by-side on lg+ */}
      <div className="flex flex-col lg:flex-row gap-3 items-start w-full min-w-0">
        {/* Asset table — same width as actual invested on mobile (w-full, no overflow) */}
        <div className="w-full min-w-0 flex-1 card overflow-hidden">
          {mainTable}
        </div>
        {actualInvested && (
          <div className="w-full min-w-0 lg:w-60 lg:shrink-0 lg:sticky lg:top-[60px] card overflow-hidden">
            {actualInvested}
          </div>
        )}
      </div>
    </div>
  )
}
