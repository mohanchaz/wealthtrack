import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '../../constants/chartColors'
import type { IdealAllocation } from '../../types'

interface Props {
  allocations: IdealAllocation[]
}

interface TooltipPayload {
  name:  string
  value: number
  payload: { color: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: { color } } = payload[0]
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-card text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
        <span className="text-textsec">{name}</span>
        <span className="font-semibold font-mono text-textprim ml-1">{value.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function AllocationDonut({ allocations }: Props) {
  const data = allocations.map(a => ({
    name:  a.item,
    value: +(a.percentage * 100).toFixed(1),
  }))

  const total = data.reduce((s, d) => s + d.value, 0).toFixed(1)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[200px] h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={88}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={900}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold font-mono text-textprim">{total}%</span>
          <span className="text-[10px] text-textmut uppercase tracking-wider mt-0.5">allocated</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-textsec truncate max-w-[120px]">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
