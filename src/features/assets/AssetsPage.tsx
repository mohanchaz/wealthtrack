import { useParams, Navigate } from 'react-router-dom'

// Placeholder panel for asset classes not yet built in Module 1
function ComingSoon({ assetClass }: { assetClass: string }) {
  const label = assetClass.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl">
        ⬡
      </div>
      <div>
        <h2 className="text-lg font-bold text-textprim mb-1">{label}</h2>
        <p className="text-sm text-textsec max-w-xs">
          This asset panel is part of Module 2. The full holdings table, live price refresh, CSV import and edit modals will be built here.
        </p>
      </div>
      <span className="text-xs text-textmut border border-border rounded-full px-3 py-1">
        Coming in Module 2
      </span>
    </div>
  )
}

export default function AssetsPage() {
  const { assetClass } = useParams<{ assetClass: string }>()
  if (!assetClass) return <Navigate to="/assets/zerodha-stocks" replace />

  return (
    <div className="animate-fade-in">
      <ComingSoon assetClass={assetClass} />
    </div>
  )
}
