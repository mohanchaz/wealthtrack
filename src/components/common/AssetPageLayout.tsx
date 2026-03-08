import type { ReactNode } from 'react'

interface Props {
  stats:          ReactNode
  mainTable:      ReactNode
  actualInvested: ReactNode
}

export function AssetPageLayout({ stats, mainTable, actualInvested }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Sticky stat cards */}
      <div className="sticky top-0 z-20 -mx-5 px-5 py-3 bg-bg/95 backdrop-blur-md border-b border-border/60">
        {stats}
      </div>

      {/* Two-column body */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 card overflow-hidden">
          {mainTable}
        </div>
        <div className="w-64 shrink-0 sticky top-[72px] card overflow-hidden">
          {actualInvested}
        </div>
      </div>
    </div>
  )
}
