import { TR_MONTHS, addMonths, currentYM } from '../lib/dates'
import type { YM } from '../lib/dates'

interface PeriodPickerProps {
  value: YM
  onChange: (ym: YM) => void
}

/** Yıl + ay seçici; ‹ › okları ile ay ay gezilebilir. */
export default function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const nowYear = currentYM().year
  const years: number[] = []
  for (let y = 2023; y <= nowYear + 2; y++) years.push(y)
  if (!years.includes(value.year)) years.push(value.year)
  years.sort((a, b) => a - b)

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="btn btn-secondary !px-3"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Önceki ay"
      >
        ‹
      </button>
      <select
        className="input !w-auto"
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        aria-label="Ay"
      >
        {TR_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        className="input !w-auto"
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        aria-label="Yıl"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-secondary !px-3"
        onClick={() => onChange(addMonths(value, 1))}
        aria-label="Sonraki ay"
      >
        ›
      </button>
    </div>
  )
}
