import { fmtTL } from '../lib/money'

export interface BarChartItem {
  label: string
  incomeKurus: number
  expenseKurus: number
}

/** Bağımlılıksız, duyarlı SVG çubuk grafiği: aylık aidat geliri / masraf karşılaştırması. */
export default function BarChart({ items }: { items: BarChartItem[] }) {
  const W = 640
  const H = 240
  const padL = 8
  const padB = 28
  const padT = 12
  const chartH = H - padB - padT
  const max = Math.max(1, ...items.map((i) => Math.max(i.incomeKurus, i.expenseKurus)))
  const groupW = (W - padL * 2) / Math.max(1, items.length)
  const barW = Math.min(34, groupW / 2.6)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gelir ve masraf grafiği">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padL}
            y1={padT + chartH * (1 - f)}
            y2={padT + chartH * (1 - f)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        {items.map((it, i) => {
          const cx = padL + groupW * i + groupW / 2
          const hInc = (it.incomeKurus / max) * chartH
          const hExp = (it.expenseKurus / max) * chartH
          return (
            <g key={it.label}>
              <rect
                x={cx - barW - 2}
                y={padT + chartH - hInc}
                width={barW}
                height={Math.max(hInc, it.incomeKurus > 0 ? 2 : 0)}
                rx="3"
                fill="#0284c7"
              >
                <title>{`${it.label} aidat geliri: ${fmtTL(it.incomeKurus)}`}</title>
              </rect>
              <rect
                x={cx + 2}
                y={padT + chartH - hExp}
                width={barW}
                height={Math.max(hExp, it.expenseKurus > 0 ? 2 : 0)}
                rx="3"
                fill="#f59e0b"
              >
                <title>{`${it.label} masraf: ${fmtTL(it.expenseKurus)}`}</title>
              </rect>
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="#64748b">
                {it.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex justify-center gap-5 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-sky-600" /> Aidat Geliri
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" /> Masraf
        </span>
      </div>
    </div>
  )
}
