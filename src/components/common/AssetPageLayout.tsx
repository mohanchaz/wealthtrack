import type { ReactNode } from 'react'

interface Props {
  stats:          ReactNode
  mainTable:      ReactNode
  actualInvested: ReactNode
}

export function AssetPageLayout({ stats, mainTable, actualInvested }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Sticky stat cards */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-bg/95 backdrop-blur-md border-b border-border/60">
        {stats}
      </div>

      {/* Two-column body */}
      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 card overflow-hidden">
          {mainTable}
        </div>
        <div className="w-60 shrink-0 sticky top-[60px] card overflow-hidden">
          {actualInvested}
        </div>
      </div>
    </div>
  )
}
