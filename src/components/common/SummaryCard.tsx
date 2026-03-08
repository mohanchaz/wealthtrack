interface Props {
  label:     string
  value:     string
  sub?:      string
  positive?: boolean | null
}

export function SummaryCard({ label, value, sub, positive }: Props) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl border border-border bg-surface">
      <span className="text-[10px] font-bold uppercase tracking-widest text-textmut">{label}</span>
      <span className={`text-lg font-bold font-mono ${
        positive === true  ? 'text-green' :
        positive === false ? 'text-red'   : 'text-textprim'
      }`}>
        {value}
      </span>
      {sub && <span className="text-xs text-textmut">{sub}</span>}
    </div>
  )
}
