import type { ReactNode } from 'react'

interface Props {
  stats:          ReactNode   // StatGrid — sticky on scroll
  mainTable:      ReactNode   // holdings table — left column
  actualInvested: ReactNode   // ActualInvestedPanel — right column
}

/**
 * Standard two-column asset page layout:
 * - Sticky stat cards at top
 * - Left (wider): main holdings table
 * - Right (narrower, fixed): actual invested panel
 */
export function AssetPageLayout({ stats, mainTable, actualInvested }: Props) {
  return (
    <div className="flex flex-col gap-4">

      {/* Sticky stat cards */}
      <div className="sticky top-0 z-20 -mx-5 px-5 py-3 bg-bg/90 backdrop-blur-sm border-b border-border/50">
        {stats}
      </div>

      {/* Main content: table left, actual invested right */}
      <div className="flex gap-4 items-start">

        {/* Left — holdings table */}
        <div className="flex-1 min-w-0 card overflow-hidden">
          {mainTable}
        </div>

        {/* Right — actual invested panel, sticky so it stays visible while scrolling table */}
        <div className="w-80 shrink-0 sticky top-[88px]">
          <div className="card p-5">
            {actualInvested}
          </div>
        </div>

      </div>
    </div>
  )
}
